import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ConnectService } from './connect.service.js';

// Map of userId -> Set of active WebSocket instances
const userSockets = new Map();

function addSocket(userId, ws) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(ws);
}

function removeSocket(userId, ws) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
  }
}

/**
 * Broadcast an event to specific users if they are connected
 */
export function broadcastToUsers(userIds = [], event, payload = {}) {
  const messageStr = JSON.stringify({ event, data: payload });
  for (const uid of userIds) {
    const sockets = userSockets.get(uid);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(messageStr);
          } catch (err) {
            console.error(`[WebSocket] Send error to ${uid}:`, err.message);
          }
        }
      }
    }
  }
}

/**
 * Check if a user is currently connected/online
 */
export function isUserOnline(userId) {
  const sockets = userSockets.get(userId);
  return Boolean(sockets && sockets.size > 0);
}

/**
 * Initialize WebSocket server attached to HTTP server
 */
export function initConnectWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/connect-ws' || url.pathname === '/api/v1/connect-ws') {
      const token = url.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        const decoded = jwt.verify(token, env.jwt.accessSecret);
        request.user = decoded;
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, request) => {
    const userId = request.user?.id || request.user?.sub;
    if (!userId) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    addSocket(userId, ws);

    // Send connection established confirmation
    ws.send(
      JSON.stringify({
        event: 'connected',
        data: { userId, timestamp: new Date().toISOString() },
      })
    );

    // Heartbeat ping-pong to keep connection active through proxies/NAT
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const { event, data } = parsed;

        if (event === 'ping') {
          ws.send(JSON.stringify({ event: 'pong', data: { time: Date.now() } }));
          return;
        }

        if (event === 'send_message') {
          const {
            conversationId,
            content,
            messageType,
            mediaUrl,
            fileName,
            fileSize,
            mimeType,
            mediaDuration,
            thumbnailUrl,
            replyToId,
          } = data || {};
          if (conversationId && (content || mediaUrl)) {
            const result = await ConnectService.sendMessage(userId, conversationId, {
              content: content || '',
              messageType: messageType || (mediaUrl ? 'image' : 'text'),
              mediaUrl,
              fileName,
              fileSize,
              mimeType,
              mediaDuration,
              thumbnailUrl,
              replyToId,
            });

            // Acknowledge back to sender
            ws.send(JSON.stringify({ event: 'message_sent', data: result.message }));

            // Broadcast to other recipients
            broadcastToUsers(result.recipientUserIds, 'new_message', {
              ...result.message,
              isOutgoing: false,
            });
          }
          return;
        }

        if (event === 'typing_start') {
          const { conversationId, recipientUserIds = [] } = data || {};
          broadcastToUsers(recipientUserIds, 'typing', {
            conversationId,
            userId,
            isTyping: true,
          });
          return;
        }

        if (event === 'typing_stop') {
          const { conversationId, recipientUserIds = [] } = data || {};
          broadcastToUsers(recipientUserIds, 'typing', {
            conversationId,
            userId,
            isTyping: false,
          });
          return;
        }

        if (event === 'mark_read') {
          const { conversationId } = data || {};
          if (conversationId) {
            const res = await ConnectService.markConversationRead(userId, conversationId);
            broadcastToUsers(res.recipientUserIds, 'messages_read', {
              conversationId,
              readByUserId: userId,
            });
          }
          return;
        }

        if (event === 'message_delivered') {
          const { conversationId, messageId } = data || {};
          if (conversationId && messageId) {
            const res = await ConnectService.markMessageDelivered(userId, conversationId, messageId);
            if (res?.senderId) {
              broadcastToUsers([res.senderId], 'message_delivered', {
                conversationId,
                messageId,
              });
            }
          }
          return;
        }
      } catch (err) {
        ws.send(
          JSON.stringify({
            event: 'error',
            data: { message: err?.message || 'WebSocket message handling failed.' },
          })
        );
      }
    });

    ws.on('close', () => {
      removeSocket(userId, ws);
    });

    ws.on('error', () => {
      removeSocket(userId, ws);
    });
  });

  // Ping interval every 30 seconds to clean up stalled sockets
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WebSocket] My Connect real-time WebSocket engine initialized on /connect-ws');
  return wss;
}
