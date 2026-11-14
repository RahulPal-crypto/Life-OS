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
export type ConnectMessageStatus = 'sent' | 'delivered' | 'read';

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
  status: ConnectMessageStatus;
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

// Phase 3 Voice & Video Calls Types
export type ConnectCallType = 'voice' | 'video';
export type ConnectCallStatus = 'ringing' | 'connecting' | 'ongoing' | 'completed' | 'missed' | 'declined' | 'busy' | 'ended';

export interface ConnectCallLog {
  id: string;
  callerId?: string;
  receiverId?: string;
  conversationId?: string | null;
  callType: ConnectCallType;
  status: ConnectCallStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  createdAt: string;
  isOutgoing: boolean;
  contactUserId: string;
  contactName: string;
  contactAvatar: string | null;
  contactPhone?: string | null;
}

export interface ConnectActiveCall {
  callId: string;
  conversationId?: string | null;
  callType: ConnectCallType;
  status: ConnectCallStatus;
  caller: {
    id: string;
    name: string;
    profileImage: string | null;
    headline?: string | null;
  };
  receiver: {
    id: string;
    name: string;
    profileImage: string | null;
    headline?: string | null;
  };
  isOutgoing: boolean;
  durationSeconds: number;
}

export type ConnectMainTab = 'chats' | 'calls';
