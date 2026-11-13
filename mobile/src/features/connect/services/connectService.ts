import { apiConfig } from '../../../config/apiConfig';
import { authService } from '../../auth/services/authService';
import {
  ConnectConversation,
  ConnectContactsSyncResult,
  ConnectMessage,
  ConnectSecurityStatus,
  ConnectUserContact,
} from '../types';

class ConnectService {
  private isUnlockedSession = false;

  isUnlocked(): boolean {
    return this.isUnlockedSession;
  }

  setUnlocked(unlocked: boolean): void {
    this.isUnlockedSession = unlocked;
  }

  lock(): void {
    this.isUnlockedSession = false;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    return authService.authorizedRequest(endpoint, options);
  }

  // 1. Security
  async getSecurityStatus(): Promise<ConnectSecurityStatus> {
    const json = await this.request(apiConfig.endpoints.connect.securityStatus);
    return json.data;
  }

  async setupPin(payload: {
    pin: string;
    biometricEnabled?: boolean;
    autoLockDelay?: string;
  }): Promise<ConnectSecurityStatus> {
    const json = await this.request(apiConfig.endpoints.connect.setupPin, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.isUnlockedSession = true;
    return json.data;
  }

  async verifyPin(pin: string): Promise<boolean> {
    const json = await this.request(apiConfig.endpoints.connect.verifyPin, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    const ok = Boolean(json.data?.verified);
    if (ok) this.isUnlockedSession = true;
    return ok;
  }

  // 2. Contacts Sync
  async syncContacts(contacts: { name: string; phone: string }[]): Promise<ConnectContactsSyncResult> {
    const json = await this.request(apiConfig.endpoints.connect.contactsSync, {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    });
    return json.data;
  }

  async searchUsers(queryStr: string): Promise<ConnectUserContact[]> {
    const qs = `?q=${encodeURIComponent(queryStr.trim())}`;
    const json = await this.request(`${apiConfig.endpoints.connect.contactsSearch}${qs}`);
    return json.data || [];
  }

  // 3. Conversations
  async getConversations(filter = 'all'): Promise<ConnectConversation[]> {
    const qs = filter !== 'all' ? `?filter=${encodeURIComponent(filter)}` : '';
    const json = await this.request(`${apiConfig.endpoints.connect.conversations}${qs}`);
    return json.data || [];
  }

  async createDirectConversation(targetUserId: string): Promise<ConnectConversation> {
    const json = await this.request(apiConfig.endpoints.connect.conversations, {
      method: 'POST',
      body: JSON.stringify({ type: 'direct', targetUserId }),
    });
    return json.data;
  }

  async createGroupConversation(payload: {
    name: string;
    memberIds: string[];
    icon?: string | null;
  }): Promise<ConnectConversation> {
    const json = await this.request(apiConfig.endpoints.connect.conversations, {
      method: 'POST',
      body: JSON.stringify({ type: 'group', ...payload }),
    });
    return json.data;
  }

  // 4. Messages
  async getMessages(
    conversationId: string,
    options: { limit?: number; beforeId?: string } = {}
  ): Promise<ConnectMessage[]> {
    const params: string[] = [];
    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.beforeId) params.push(`beforeId=${encodeURIComponent(options.beforeId)}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';

    const json = await this.request(
      `${apiConfig.endpoints.connect.conversations}/${encodeURIComponent(conversationId)}/messages${qs}`
    );
    return json.data || [];
  }

  async sendMessage(
    conversationId: string,
    content: string,
    replyToId?: string | null
  ): Promise<ConnectMessage> {
    const json = await this.request(
      `${apiConfig.endpoints.connect.conversations}/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content, replyToId: replyToId || null }),
      }
    );
    return json.data;
  }

  async markRead(conversationId: string): Promise<void> {
    try {
      await this.request(
        `${apiConfig.endpoints.connect.conversations}/${encodeURIComponent(conversationId)}/read`,
        { method: 'POST' }
      );
    } catch {
      // Ignore background read receipt failure
    }
  }
}

export const connectService = new ConnectService();
