import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer, Text } from '../../../components';
import { colors, spacing, borderRadius } from '../../../theme';
import { User, authService } from '../../auth';
import {
  ConnectConversation,
  ConnectFilterTab,
  ConnectOtherContact,
  ConnectSecurityStatus,
  ConnectUserContact,
} from '../types';
import { connectService } from '../services/connectService';
import { connectSocketService } from '../services/connectSocketService';
import { connectContactsNative } from '../services/connectContactsNative';
import { ConnectSecurityModal } from '../components/ConnectSecurityModal';
import { NewChatModal } from '../components/NewChatModal';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { ConnectConversationScreen } from './ConnectConversationScreen';

interface MyConnectScreenProps {
  user: User | null;
  onBackToDashboard: () => void;
}

const FILTER_TABS: { key: ConnectFilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
  { key: 'favorites', label: 'Favorites' },
];

export const MyConnectScreen: React.FC<MyConnectScreenProps> = ({
  user,
  onBackToDashboard,
}) => {
  // Security & Lock State
  const [isUnlocked, setIsUnlocked] = useState(connectService.isUnlocked());
  const [securityStatus, setSecurityStatus] = useState<ConnectSecurityStatus>({
    isConfigured: false,
    biometricEnabled: true,
    autoLockDelay: 'immediate',
  });
  const [lockModalVisible, setLockModalVisible] = useState(!connectService.isUnlocked());

  // Conversation & Data States
  const [conversations, setConversations] = useState<ConnectConversation[]>([]);
  const [registeredContacts, setRegisteredContacts] = useState<ConnectUserContact[]>([]);
  const [otherContacts, setOtherContacts] = useState<ConnectOtherContact[]>([]);
  const [activeFilter, setActiveFilter] = useState<ConnectFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Active Chat & Sub-Modals
  const [activeConversation, setActiveConversation] = useState<ConnectConversation | null>(null);
  const [newChatVisible, setNewChatVisible] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);

  // 1. Initial Security Check
  useEffect(() => {
    connectService
      .getSecurityStatus()
      .then((status) => {
        setSecurityStatus(status);
        if (!connectService.isUnlocked()) {
          setLockModalVisible(true);
        }
      })
      .catch(() => {
        // Fallback: unlock if security endpoint unavailable
        setIsUnlocked(true);
        setLockModalVisible(false);
      });
  }, []);

  // 2. Load conversations and auto-connect WebSocket
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const list = await connectService.getConversations();
      setConversations(list);
    } catch (err: any) {
      if (!silent) {
        Alert.alert('Connect', err?.message || 'Unable to load chats.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;

    loadData();

    // Connect WebSocket
    const token = authService.getTokens()?.accessToken;
    if (token) {
      connectSocketService.connect(token);
    }

    // Real-time message listener to update chat snippet & badge
    const unsubMsg = connectSocketService.onMessage(() => {
      loadData(true);
    });

    return () => {
      unsubMsg();
    };
  }, [isUnlocked, loadData]);

  // 3. WhatsApp-style Phone Contacts Auto-Sync
  const syncPhoneContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const hasPerm = await connectContactsNative.hasPermission();
      let granted = hasPerm;

      if (!granted) {
        granted = await connectContactsNative.requestPermission();
      }

      if (granted) {
        const rawContacts = await connectContactsNative.getPhoneContacts();
        if (rawContacts.length > 0) {
          const syncRes = await connectService.syncContacts(rawContacts);
          setRegisteredContacts(syncRes.registeredUsers);
          setOtherContacts(syncRes.otherContacts);
        }
      }
    } catch {
      // Best-effort contact sync
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const handleOpenNewChatModal = () => {
    setNewChatVisible(true);
    syncPhoneContacts();
  };

  const handleManualLock = () => {
    connectService.lock();
    setIsUnlocked(false);
    setActiveConversation(null);
    setLockModalVisible(true);
  };

  const handleSecurityUnlocked = () => {
    setIsUnlocked(true);
    connectService.setUnlocked(true);
    setLockModalVisible(false);
    loadData();
  };

  const handleSelectContactForChat = async (targetUser: ConnectUserContact) => {
    setNewChatVisible(false);
    try {
      const conv = await connectService.createDirectConversation(targetUser.id);
      setActiveConversation(conv);
      loadData(true);
    } catch (err: any) {
      Alert.alert('Chat Error', err?.message || 'Could not start conversation.');
    }
  };

  const handleCreateGroup = async (payload: {
    name: string;
    memberIds: string[];
    icon?: string;
  }) => {
    const conv = await connectService.createGroupConversation(payload);
    setCreateGroupVisible(false);
    setNewChatVisible(false);
    setActiveConversation(conv);
    loadData(true);
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (activeFilter === 'unread' && c.unreadCount === 0) return false;
    if (activeFilter === 'groups' && !c.isGroup) return false;
    if (activeFilter === 'favorites' && !c.isFavorite) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.displayName.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // If a conversation is active, show the WhatsApp-like Chat screen
  if (activeConversation) {
    return (
      <ConnectConversationScreen
        conversation={activeConversation}
        currentUserId={user?.id || ''}
        onBack={() => {
          setActiveConversation(null);
          loadData(true);
        }}
      />
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {/* Top Branded Header */}
        <View style={styles.header}>
          <Pressable onPress={onBackToDashboard} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>

          <View style={styles.brandRow}>
            <Image
              source={require('../../../assets/images/logo.jpg')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text variant="h2" color="#0F172A" style={styles.headerTitle}>
              My Connect
            </Text>
            {totalUnread > 0 && (
              <View style={styles.unreadTopBadge}>
                <Text style={styles.unreadTopBadgeText}>{totalUnread}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerIcons}>
            <Pressable
              onPress={() => setIsSearchActive((prev) => !prev)}
              style={styles.headerIconBtn}
            >
              <Text style={styles.headerIcon}>🔍</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Moments Camera',
                  'Snap photos & post 24-hour Status arriving in Phase 4!'
                )
              }
              style={styles.headerIconBtn}
            >
              <Text style={styles.headerIcon}>📷</Text>
            </Pressable>
            <Pressable onPress={handleManualLock} style={styles.headerIconBtn}>
              <Text style={styles.headerIcon}>🔒</Text>
            </Pressable>
          </View>
        </View>

        {/* Collapsible Search Input */}
        {isSearchActive && (
          <View style={styles.searchBarRow}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search chats, messages, groups..."
              placeholderTextColor="#94A3B8"
              autoFocus
              style={styles.searchInput}
            />
            {Boolean(searchQuery) && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                <Text style={styles.searchClearText}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Quick Filter Tabs (All, Unread, Groups, Favorites) */}
        <View style={styles.filterTabsRow}>
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[styles.filterTab, active && styles.filterTabActive]}
              >
                <Text
                  variant="caption"
                  color={active ? '#FFFFFF' : '#475569'}
                  style={styles.filterTabText}
                >
                  {tab.label}
                  {tab.key === 'unread' && totalUnread > 0 ? ` (${totalUnread})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData(true);
              }}
            />
          }
        >
          {/* Stories / Moments Tray (Phase 4 Ready) */}
          <View style={styles.storiesSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
              {/* My Status Bubble */}
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'My Status',
                    'Post 24-hour disappearing photos, stories & moments arriving in Phase 4!'
                  )
                }
                style={styles.storyItem}
              >
                <View style={styles.myStatusRing}>
                  <Text style={styles.myStatusPlus}>+</Text>
                </View>
                <Text variant="caption" color="#0F172A" style={styles.storyName}>
                  My Status
                </Text>
              </Pressable>

              {/* Sample / Contact Moments circles */}
              {registeredContacts.slice(0, 5).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() =>
                    Alert.alert(
                      `${c.name}'s Status`,
                      'Moments & Stories feed arriving in Phase 4!'
                    )
                  }
                  style={styles.storyItem}
                >
                  <View style={styles.storyRing}>
                    <View style={styles.storyAvatar}>
                      <Text style={styles.storyAvatarText}>
                        {c.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text
                    variant="caption"
                    color="#0F172A"
                    numberOfLines={1}
                    style={styles.storyName}
                  >
                    {c.phoneBookName || c.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Conversations List */}
          <View style={styles.conversationsBlock}>
            {loading ? (
              <ActivityIndicator size="small" color="#7C3AED" style={styles.loader} />
            ) : filteredConversations.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text variant="h3" color="#0F172A" style={styles.emptyTitle}>
                  {searchQuery ? 'No matching chats found' : 'No conversations yet'}
                </Text>
                <Text variant="caption" color="#64748B" align="center" style={styles.emptySub}>
                  Tap the floating chat button 💬 below to start chatting with your phone contacts on Life OS!
                </Text>
                <Pressable onPress={handleOpenNewChatModal} style={styles.startChatBtn}>
                  <Text variant="caption" color="#FFFFFF" style={styles.startChatBtnText}>
                    Find Contacts on Life OS ›
                  </Text>
                </Pressable>
              </View>
            ) : (
              filteredConversations.map((conv) => {
                const timeStr = conv.lastMessageAt
                  ? new Date(conv.lastMessageAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <Pressable
                    key={conv.id}
                    onPress={() => setActiveConversation(conv)}
                    style={styles.convCard}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {conv.displayName.slice(0, 1).toUpperCase()}
                      </Text>
                      {conv.isOnline && <View style={styles.onlineDot} />}
                    </View>

                    <View style={styles.convBody}>
                      <View style={styles.convTopRow}>
                        <Text
                          variant="caption"
                          color="#0F172A"
                          numberOfLines={1}
                          style={styles.convName}
                        >
                          {conv.displayName}
                        </Text>
                        <Text
                          variant="caption"
                          color={conv.unreadCount > 0 ? '#7C3AED' : '#94A3B8'}
                          style={styles.convTime}
                        >
                          {timeStr}
                        </Text>
                      </View>

                      <View style={styles.convBottomRow}>
                        <Text
                          variant="caption"
                          color="#64748B"
                          numberOfLines={1}
                          style={[
                            styles.convSnippet,
                            conv.unreadCount > 0 && styles.convSnippetUnread,
                          ]}
                        >
                          {conv.lastMessage || conv.displayHeadline}
                        </Text>

                        {conv.unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {conv.unreadCount}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* WhatsApp-Style Floating Action Button (FAB) for New Chat */}
        <Pressable onPress={handleOpenNewChatModal} style={styles.fab}>
          <Text style={styles.fabIcon}>💬</Text>
        </Pressable>

        {/* Security Unlock Modal */}
        <ConnectSecurityModal
          visible={lockModalVisible}
          isConfigured={securityStatus.isConfigured}
          biometricEnabled={securityStatus.biometricEnabled}
          onUnlocked={handleSecurityUnlocked}
          onClose={onBackToDashboard}
        />

        {/* Select Contact / New Chat Modal */}
        <NewChatModal
          visible={newChatVisible}
          onClose={() => setNewChatVisible(false)}
          registeredUsers={registeredContacts}
          otherContacts={otherContacts}
          loading={contactsLoading}
          onRefreshContacts={syncPhoneContacts}
          onSelectUser={handleSelectContactForChat}
          onOpenCreateGroup={() => {
            setNewChatVisible(false);
            setCreateGroupVisible(true);
          }}
          onSearchGlobal={(q) => connectService.searchUsers(q)}
        />

        {/* Create Group Modal */}
        <CreateGroupModal
          visible={createGroupVisible}
          onClose={() => setCreateGroupVisible(false)}
          availableUsers={registeredContacts}
          onCreateGroup={handleCreateGroup}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    paddingRight: 6,
    paddingVertical: 4,
  },
  backArrow: {
    fontSize: 26,
    fontWeight: '300',
    color: '#0F172A',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  unreadTopBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  unreadTopBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    padding: 4,
  },
  headerIcon: {
    fontSize: 18,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
  },
  searchClearBtn: {
    paddingHorizontal: 8,
  },
  searchClearText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterTabActive: {
    backgroundColor: '#7C3AED',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  storiesSection: {
    paddingVertical: spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: spacing.xs,
  },
  storiesRow: {
    paddingHorizontal: spacing.md,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 62,
  },
  myStatusRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE9FE',
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  myStatusPlus: {
    fontSize: 22,
    color: '#7C3AED',
    fontWeight: '800',
  },
  storyRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#7C3AED',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  storyName: {
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  conversationsBlock: {
    backgroundColor: '#FFFFFF',
  },
  loader: {
    marginVertical: spacing.xl,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  convBody: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: {
    fontSize: 14.5,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  convTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  convBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convSnippet: {
    fontSize: 12.5,
    flex: 1,
    marginRight: 8,
  },
  convSnippetUnread: {
    fontWeight: '700',
    color: '#0F172A',
  },
  unreadBadge: {
    backgroundColor: '#7C3AED',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  startChatBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  startChatBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});
