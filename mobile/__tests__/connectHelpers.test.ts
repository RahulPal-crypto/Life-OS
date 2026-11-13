import { ConnectConversation, ConnectFilterTab } from '../src/features/connect/types';
import { connectService } from '../src/features/connect/services/connectService';
import {
  formatDuration,
  formatFileSize,
  getDocumentIcon,
} from '../src/features/connect/services/connectMediaNative';
import { resolveMediaUrl } from '../src/config/apiConfig';

describe('My Connect Unit Tests', () => {
  it('manages lock and unlock session states accurately', () => {
    connectService.setUnlocked(false);
    expect(connectService.isUnlocked()).toBe(false);

    connectService.setUnlocked(true);
    expect(connectService.isUnlocked()).toBe(true);

    connectService.lock();
    expect(connectService.isUnlocked()).toBe(false);
  });

  it('filters conversations correctly according to active tab', () => {
    const mockConversations: ConnectConversation[] = [
      {
        id: 'c1',
        type: 'direct',
        displayName: 'Aman Sharma',
        displayAvatar: null,
        displayHeadline: 'Available',
        partnerUserId: 'u1',
        isGroup: false,
        isPinned: false,
        isFavorite: true,
        isMuted: false,
        unreadCount: 2,
        lastMessage: 'Kahan ho?',
        lastMessageSenderId: 'u1',
        lastMessageAt: '2026-11-13T10:00:00Z',
        membersCount: 2,
      },
      {
        id: 'c2',
        type: 'group',
        displayName: 'Family Group',
        displayAvatar: null,
        displayHeadline: '5 members',
        partnerUserId: null,
        isGroup: true,
        isPinned: true,
        isFavorite: false,
        isMuted: false,
        unreadCount: 0,
        lastMessage: 'Dinner ready',
        lastMessageSenderId: 'u2',
        lastMessageAt: '2026-11-12T10:00:00Z',
        membersCount: 5,
      },
      {
        id: 'c3',
        type: 'direct',
        displayName: 'Priya',
        displayAvatar: null,
        displayHeadline: 'Busy',
        partnerUserId: 'u3',
        isGroup: false,
        isPinned: false,
        isFavorite: false,
        isMuted: false,
        unreadCount: 0,
        lastMessage: 'Okay',
        lastMessageSenderId: 'u0',
        lastMessageAt: '2026-11-10T10:00:00Z',
        membersCount: 2,
      },
    ];

    const filterFn = (list: ConnectConversation[], tab: ConnectFilterTab) => {
      return list.filter((c) => {
        if (tab === 'unread' && c.unreadCount === 0) return false;
        if (tab === 'groups' && !c.isGroup) return false;
        if (tab === 'favorites' && !c.isFavorite) return false;
        return true;
      });
    };

    expect(filterFn(mockConversations, 'all').length).toBe(3);
    expect(filterFn(mockConversations, 'unread').length).toBe(1);
    expect(filterFn(mockConversations, 'unread')[0].displayName).toBe('Aman Sharma');
    expect(filterFn(mockConversations, 'groups').length).toBe(1);
    expect(filterFn(mockConversations, 'groups')[0].displayName).toBe('Family Group');
    expect(filterFn(mockConversations, 'favorites').length).toBe(1);
    expect(filterFn(mockConversations, 'favorites')[0].displayName).toBe('Aman Sharma');
  });

  it('formats audio durations and file sizes for Phase 2 media', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(360)).toBe('6:00');

    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });

  it('selects appropriate document icons and resolves media URLs', () => {
    expect(getDocumentIcon('project_spec.pdf')).toBe('📄');
    expect(getDocumentIcon('proposal.docx')).toBe('📝');
    expect(getDocumentIcon('budget.xlsx')).toBe('📊');
    expect(getDocumentIcon('bundle.zip')).toBe('📦');
    expect(getDocumentIcon('unknown.bin')).toBe('📁');

    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
    expect(resolveMediaUrl('file:///data/user/0/audio.m4a')).toBe('file:///data/user/0/audio.m4a');
    expect(resolveMediaUrl('/uploads/connect/sample.jpg')?.startsWith('http')).toBe(true);
  });
});
