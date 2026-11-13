export interface ConnectSecurityStatus {
  isConfigured: boolean;
  biometricEnabled: boolean;
  autoLockDelay: 'immediate' | '1m' | '5m' | 'never';
}

export interface ConnectUserContact {
  id: string;
  name: string;
  phoneBookName?: string;
  phone: string;
  email: string;
  profileImage: string | null;
  headline: string;
  isRegistered: boolean;
  isOnline?: boolean;
}

export interface ConnectOtherContact {
  name: string;
  phone: string;
  isRegistered: false;
}

export interface ConnectContactsSyncResult {
  registeredUsers: ConnectUserContact[];
  otherContacts: ConnectOtherContact[];
}

export interface ConnectConversation {
  id: string;
  type: 'direct' | 'group';
  displayName: string;
  displayAvatar: string | null;
  displayHeadline: string;
  partnerUserId: string | null;
  isGroup: boolean;
  isPinned: boolean;
  isFavorite: boolean;
  isMuted: boolean;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageSenderId: string | null;
  lastMessageAt: string | null;
  membersCount: number;
  isOnline?: boolean;
}

export interface ConnectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  messageType: 'text' | 'system';
  content: string;
  status: 'sent' | 'delivered' | 'read';
  replyToId: string | null;
  createdAt: string;
  isOutgoing: boolean;
}

export type ConnectFilterTab = 'all' | 'unread' | 'groups' | 'favorites';
