import { AppState, AppStateStatus } from 'react-native';
import { getConnectWsUrl } from '../../../config/apiConfig';
import { ConnectMessage } from '../types';

type MessageCallback = (message: ConnectMessage) => void;
type TypingCallback = (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
type ReadReceiptCallback = (payload: { conversationId: string; readByUserId: string }) => void;
type DeliveryReceiptCallback = (payload: { conversationId: string; messageId: string }) => void;
type IncomingCallCallback = (callData: any) => void;
type CallResponseCallback = (responseData: any) => void;
type CallEndedCallback = (endData: any) => void;
type CallSignalCallback = (signalData: any) => void;

class ConnectSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private messageListeners: Set<MessageCallback> = new Set();
  private typingListeners: Set<TypingCallback> = new Set();
  private readListeners: Set<ReadReceiptCallback> = new Set();
  private deliveryListeners: Set<DeliveryReceiptCallback> = new Set();
  private incomingCallListeners: Set<IncomingCallCallback> = new Set();
  private callResponseListeners: Set<CallResponseCallback> = new Set();
  private callEndedListeners: Set<CallEndedCallback> = new Set();
  private callSignalListeners: Set<CallSignalCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isExplicitDisconnect = false;
  private appStateSubscription: any = null;

  constructor() {
    // Reconnect automatically when app comes to foreground
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && this.token && !this.isExplicitDisconnect) {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
          this.connect(this.token);
        }
      }
    });
  }

  connect(accessToken: string): void {
    if (!accessToken) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.token === accessToken) return;
      this.disconnect();
    }

    this.token = accessToken;
    this.isExplicitDisconnect = false;
    const url = getConnectWsUrl(accessToken);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { event: evType, data } = payload || {};

          if (evType === 'new_message') {
            this.messageListeners.forEach((cb) => cb(data));
          } else if (evType === 'typing') {
            this.typingListeners.forEach((cb) => cb(data));
          } else if (evType === 'messages_read') {
            this.readListeners.forEach((cb) => cb(data));
          } else if (evType === 'message_delivered') {
            this.deliveryListeners.forEach((cb) => cb(data));
          } else if (evType === 'incoming_call') {
            this.incomingCallListeners.forEach((cb) => cb(data));
          } else if (evType === 'call_response') {
            this.callResponseListeners.forEach((cb) => cb(data));
          } else if (evType === 'call_ended') {
            this.callEndedListeners.forEach((cb) => cb(data));
          } else if (evType === 'call_signal') {
            this.callSignalListeners.forEach((cb) => cb(data));
          }
        } catch {
          // Ignore malformed frames
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.ws = null;
        if (!this.isExplicitDisconnect && this.token) {
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (this.token && !this.isExplicitDisconnect) {
              this.connect(this.token);
            }
          }, 3000);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      // Ignore initial connection creation errors
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    // 20-second ping keeps NAT / reverse proxy tunnel alive
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ event: 'ping', data: { time: Date.now() } }));
        } catch {
          // Socket error handled in onerror
        }
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect(): void {
    this.isExplicitDisconnect = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.token = null;
  }

  isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  sendSocketMessage(
    conversationId: string,
    contentOrPayload:
      | string
      | {
          content?: string;
          messageType?: string;
          mediaUrl?: string | null;
          fileName?: string | null;
          fileSize?: number | null;
          mimeType?: string | null;
          mediaDuration?: number | null;
          thumbnailUrl?: string | null;
          replyToId?: string | null;
        },
    replyToId?: string
  ): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      const data =
        typeof contentOrPayload === 'string'
          ? { conversationId, content: contentOrPayload, replyToId: replyToId || null }
          : { conversationId, ...contentOrPayload, replyToId: contentOrPayload.replyToId || replyToId || null };

      this.ws.send(
        JSON.stringify({
          event: 'send_message',
          data,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  emitTyping(
    conversationId: string,
    isTyping: boolean,
    recipientUserIds: string[] = []
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          event: isTyping ? 'typing_start' : 'typing_stop',
          data: { conversationId, recipientUserIds },
        })
      );
    } catch {
      // Ignore
    }
  }

  emitMarkRead(conversationId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          event: 'mark_read',
          data: { conversationId },
        })
      );
    } catch {
      // Ignore
    }
  }

  emitDelivered(conversationId: string, messageId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          event: 'message_delivered',
          data: { conversationId, messageId },
        })
      );
    } catch {
      // Ignore
    }
  }

  onMessage(cb: MessageCallback): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  onTyping(cb: TypingCallback): () => void {
    this.typingListeners.add(cb);
    return () => this.typingListeners.delete(cb);
  }

  onReadReceipt(cb: ReadReceiptCallback): () => void {
    this.readListeners.add(cb);
    return () => this.readListeners.delete(cb);
  }

  onDeliveryReceipt(cb: DeliveryReceiptCallback): () => void {
    this.deliveryListeners.add(cb);
    return () => this.deliveryListeners.delete(cb);
  }

  // Voice & Video Calls Signaling (Phase 3)
  emitCallInitiate(receiverId: string, conversationId: string | null, callType: 'voice' | 'video'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          event: 'call_initiate',
          data: { receiverId, conversationId, callType },
        })
      );
    } catch {
      // Ignore
    }
  }

  emitCallRespond(callId: string, action: 'accept' | 'decline' | 'busy'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          event: 'call_respond',
          data: { callId, action },
        })
      );
    } catch {
      // Ignore
    }
  }

  emitCallEnd(callId: string, durationSeconds = 0): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          event: 'call_end',
          data: { callId, durationSeconds },
        })
      );
    } catch {
      // Ignore
    }
  }

  emitCallSignal(targetUserId: string, callId: string, signal: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          event: 'call_signal',
          data: { targetUserId, callId, signal },
        })
      );
    } catch {
      // Ignore
    }
  }

  onIncomingCall(cb: IncomingCallCallback): () => void {
    this.incomingCallListeners.add(cb);
    return () => this.incomingCallListeners.delete(cb);
  }

  onCallResponse(cb: CallResponseCallback): () => void {
    this.callResponseListeners.add(cb);
    return () => this.callResponseListeners.delete(cb);
  }

  onCallEnded(cb: CallEndedCallback): () => void {
    this.callEndedListeners.add(cb);
    return () => this.callEndedListeners.delete(cb);
  }

  onCallSignal(cb: CallSignalCallback): () => void {
    this.callSignalListeners.add(cb);
    return () => this.callSignalListeners.delete(cb);
  }
}

export const connectSocketService = new ConnectSocketService();
