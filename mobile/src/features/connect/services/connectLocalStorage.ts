import { NativeModules } from 'react-native';
import { ConnectConversation, ConnectMessage, ConnectMessageStatus, ConnectCallLog } from '../types';

interface NativeConnectStorage {
  saveConversation: (conv: any) => Promise<boolean>;
  saveConversations: (convs: any[]) => Promise<boolean>;
  getConversations: () => Promise<any[]>;
  saveMessage: (msg: any) => Promise<boolean>;
  saveMessages: (msgs: any[]) => Promise<boolean>;
  getMessages: (conversationId: string, limit: number, beforeCreatedAt?: string | null) => Promise<any[]>;
  updateMessageStatus: (messageId: string, status: string) => Promise<boolean>;
  markConversationRead: (conversationId: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  clearConversation: (conversationId: string) => Promise<boolean>;
  saveCallLog: (call: any) => Promise<boolean>;
  saveCallLogs: (calls: any[]) => Promise<boolean>;
  getCallLogs: (limit: number) => Promise<any[]>;
}

const nativeStorage: NativeConnectStorage | undefined = NativeModules?.ConnectStorage;

/**
 * In-memory fallback for unit tests and environments without native SQLite attached
 */
class MemoryFallbackStorage {
  private conversations: Map<string, ConnectConversation> = new Map();
  private messages: Map<string, ConnectMessage[]> = new Map();

  async saveConversation(conv: ConnectConversation): Promise<boolean> {
    this.conversations.set(conv.id, { ...conv });
    return true;
  }

  async saveConversations(convs: ConnectConversation[]): Promise<boolean> {
    for (const c of convs) {
      this.conversations.set(c.id, { ...c });
    }
    return true;
  }

  async getConversations(): Promise<ConnectConversation[]> {
    return Array.from(this.conversations.values()).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const tA = new Date(a.lastMessageAt || 0).getTime();
      const tB = new Date(b.lastMessageAt || 0).getTime();
      return tB - tA;
    });
  }

  async saveMessage(msg: ConnectMessage): Promise<boolean> {
    const list = this.messages.get(msg.conversationId) || [];
    const existingIdx = list.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...msg };
    } else {
      list.push({ ...msg });
    }
    this.messages.set(msg.conversationId, list);

    // Update conversation summary
    const conv = this.conversations.get(msg.conversationId);
    if (conv) {
      conv.lastMessage = msg.content || (msg.messageType !== 'text' ? `[${msg.messageType}]` : '');
      conv.lastMessageAt = msg.createdAt;
      this.conversations.set(conv.id, conv);
    }
    return true;
  }

  async saveMessages(msgs: ConnectMessage[]): Promise<boolean> {
    for (const m of msgs) {
      await this.saveMessage(m);
    }
    return true;
  }

  async getMessages(
    conversationId: string,
    limit = 50,
    beforeCreatedAt?: string | null
  ): Promise<ConnectMessage[]> {
    const list = this.messages.get(conversationId) || [];
    let filtered = list;
    if (beforeCreatedAt) {
      const beforeTime = new Date(beforeCreatedAt).getTime();
      filtered = filtered.filter((m) => new Date(m.createdAt).getTime() < beforeTime);
    }
    return filtered.slice(-limit);
  }

  async updateMessageStatus(messageId: string, status: string): Promise<boolean> {
    for (const [convId, list] of this.messages.entries()) {
      const target = list.find((m) => m.id === messageId);
      if (target) {
        target.status = status as ConnectMessageStatus;
        this.messages.set(convId, [...list]);
        return true;
      }
    }
    return false;
  }

  async markConversationRead(conversationId: string): Promise<boolean> {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.unreadCount = 0;
      this.conversations.set(conversationId, conv);
    }
    const list = this.messages.get(conversationId);
    if (list) {
      this.messages.set(
        conversationId,
        list.map((m) => (m.isOutgoing ? m : { ...m, status: 'read' as ConnectMessageStatus }))
      );
    }
    return true;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    for (const [convId, list] of this.messages.entries()) {
      const nextList = list.filter((m) => m.id !== messageId);
      if (nextList.length !== list.length) {
        this.messages.set(convId, nextList);
        return true;
      }
    }
    return true;
  }

  async clearConversation(conversationId: string): Promise<boolean> {
    this.messages.delete(conversationId);
    return true;
  }

  private callLogs: ConnectCallLog[] = [];

  async saveCallLog(call: ConnectCallLog): Promise<boolean> {
    const idx = this.callLogs.findIndex((c) => c.id === call.id);
    if (idx >= 0) {
      this.callLogs[idx] = { ...call };
    } else {
      this.callLogs.unshift({ ...call });
    }
    return true;
  }

  async saveCallLogs(calls: ConnectCallLog[]): Promise<boolean> {
    for (const c of calls) {
      await this.saveCallLog(c);
    }
    return true;
  }

  async getCallLogs(limit = 50): Promise<ConnectCallLog[]> {
    return this.callLogs.slice(0, limit);
  }
}

const memoryFallback = new MemoryFallbackStorage();

/**
 * WhatsApp-style On-Device Local Storage API for Life OS My Connect
 */
class ConnectLocalStorage {
  async saveConversation(conv: ConnectConversation): Promise<void> {
    if (nativeStorage) {
      try {
        await nativeStorage.saveConversation(conv);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.saveConversation(conv);
  }

  async saveConversations(convs: ConnectConversation[]): Promise<void> {
    if (!convs || convs.length === 0) return;
    if (nativeStorage) {
      try {
        await nativeStorage.saveConversations(convs);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.saveConversations(convs);
  }

  async getConversations(): Promise<ConnectConversation[]> {
    if (nativeStorage) {
      try {
        const raw = await nativeStorage.getConversations();
        if (Array.isArray(raw)) {
          return raw as ConnectConversation[];
        }
      } catch {
        // Fallback below
      }
    }
    return await memoryFallback.getConversations();
  }

  async saveMessage(msg: ConnectMessage): Promise<void> {
    if (nativeStorage) {
      try {
        await nativeStorage.saveMessage(msg);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.saveMessage(msg);
  }

  async saveMessages(msgs: ConnectMessage[]): Promise<void> {
    if (!msgs || msgs.length === 0) return;
    if (nativeStorage) {
      try {
        await nativeStorage.saveMessages(msgs);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.saveMessages(msgs);
  }

  async getMessages(
    conversationId: string,
    limit = 50,
    beforeCreatedAt?: string | null
  ): Promise<ConnectMessage[]> {
    if (nativeStorage) {
      try {
        const raw = await nativeStorage.getMessages(conversationId, limit, beforeCreatedAt || null);
        if (Array.isArray(raw)) {
          return raw as ConnectMessage[];
        }
      } catch {
        // Fallback below
      }
    }
    return await memoryFallback.getMessages(conversationId, limit, beforeCreatedAt);
  }

  async updateMessageStatus(messageId: string, status: ConnectMessageStatus): Promise<void> {
    if (nativeStorage) {
      try {
        await nativeStorage.updateMessageStatus(messageId, status);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.updateMessageStatus(messageId, status);
  }

  async markConversationRead(conversationId: string): Promise<void> {
    if (nativeStorage) {
      try {
        await nativeStorage.markConversationRead(conversationId);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.markConversationRead(conversationId);
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (nativeStorage) {
      try {
        await nativeStorage.deleteMessage(messageId);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.deleteMessage(messageId);
  }

  async clearConversation(conversationId: string): Promise<void> {
    if (nativeStorage) {
      try {
        await nativeStorage.clearConversation(conversationId);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.clearConversation(conversationId);
  }

  async saveCallLog(call: ConnectCallLog): Promise<void> {
    if (nativeStorage) {
      try {
        await nativeStorage.saveCallLog(call);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.saveCallLog(call);
  }

  async saveCallLogs(calls: ConnectCallLog[]): Promise<void> {
    if (!calls || calls.length === 0) return;
    if (nativeStorage) {
      try {
        await nativeStorage.saveCallLogs(calls);
        return;
      } catch {
        // Fallback below
      }
    }
    await memoryFallback.saveCallLogs(calls);
  }

  async getCallLogs(limit = 50): Promise<ConnectCallLog[]> {
    if (nativeStorage) {
      try {
        const raw = await nativeStorage.getCallLogs(limit);
        if (Array.isArray(raw)) {
          return raw as ConnectCallLog[];
        }
      } catch {
        // Fallback below
      }
    }
    return await memoryFallback.getCallLogs(limit);
  }
}

export const connectLocalStorage = new ConnectLocalStorage();
