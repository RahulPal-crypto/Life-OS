import { ConnectConversation, ConnectFilterTab } from '../src/features/connect/types';
import { connectService } from '../src/features/connect/services/connectService';

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
});
