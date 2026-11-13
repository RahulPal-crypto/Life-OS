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

export type ConnectMessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'system';

export interface ConnectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  messageType: ConnectMessageType;
  content: string;
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  mediaDuration?: number | null;
  thumbnailUrl?: string | null;
  status: 'sent' | 'delivered' | 'read';
  replyToId: string | null;
  createdAt: string;
  isOutgoing: boolean;
}

export interface ConnectMediaUploadResponse {
  mediaUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  mediaType: ConnectMessageType;
  mediaDuration: number | null;
}

export type ConnectFilterTab = 'all' | 'unread' | 'groups' | 'favorites';
