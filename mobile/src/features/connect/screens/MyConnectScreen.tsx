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
  ConnectActiveCall,
  ConnectCallLog,
  ConnectMainTab,
} from '../types';
import { connectService } from '../services/connectService';
import { connectSocketService } from '../services/connectSocketService';
import { connectContactsNative } from '../services/connectContactsNative';
import { connectLocalStorage } from '../services/connectLocalStorage';
import { ConnectSecurityModal } from '../components/ConnectSecurityModal';
import { NewChatModal } from '../components/NewChatModal';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { ActiveCallModal } from '../components/ActiveCallModal';
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

  // Tab State: Chats vs Calls (Phase 3)
  const [mainTab, setMainTab] = useState<ConnectMainTab>('chats');
  const [callLogs, setCallLogs] = useState<ConnectCallLog[]>([]);
  const [activeCall, setActiveCall] = useState<ConnectActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ConnectActiveCall | null>(null);

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
        if (status.isConfigured && !connectService.isUnlocked()) {
          setLockModalVisible(true);
        } else {
          setIsUnlocked(true);
          connectService.setUnlocked(true);
          setLockModalVisible(false);
        }
      })
      .catch(() => {
        // Fallback: unlock if security endpoint unavailable
        setIsUnlocked(true);
        connectService.setUnlocked(true);
        setLockModalVisible(false);
      });
  }, []);

  // 2. Load conversations and call history (Local phone database first, then background cloud sync)
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // WhatsApp Instant Load: Read immediately from local SQLite database (0ms)
      const localList = await connectLocalStorage.getConversations();
      if (localList && localList.length > 0) {
        setConversations(localList);
      }
      const localLogs = await connectLocalStorage.getCallLogs();
      if (localLogs && localLogs.length > 0) {
        setCallLogs(localLogs);
      }
      if (!silent && (localList.length > 0 || localLogs.length > 0)) {
        setLoading(false);
      }

      // Background Cloud Sync: fetch latest from server relay
      const [list, serverLogs] = await Promise.allSettled([
        connectService.getConversations(),
        connectService.getCallHistory(),
      ]);

      if (list.status === 'fulfilled') {
        setConversations(list.value);
        await connectLocalStorage.saveConversations(list.value);
      }
      if (serverLogs.status === 'fulfilled') {
        setCallLogs(serverLogs.value);
        await connectLocalStorage.saveCallLogs(serverLogs.value);
      }
    } catch {
      // If offline, silently use local storage without error popups
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

    // Real-time message listener to update local DB and chat snippet & badge
    const unsubMsg = connectSocketService.onMessage(async (msg) => {
      await connectLocalStorage.saveMessage(msg);
      loadData(true);
    });

    // Real-time call signaling listeners (Phase 3)
    const unsubIncoming = connectSocketService.onIncomingCall((data) => {
      setIncomingCall({
        callId: data.callId,
        conversationId: data.conversationId,
        callType: data.callType,
        status: 'ringing',
        caller: data.caller,
        receiver: data.receiver,
        isOutgoing: false,
        durationSeconds: 0,
      });
    });

    const unsubCallResp = connectSocketService.onCallResponse((resp) => {
      if (resp.status === 'ongoing') {
        setActiveCall((prev) => (prev ? { ...prev, status: 'ongoing' } : null));
      } else {
        Alert.alert('Call', `Call was ${resp.status}`);
        setActiveCall(null);
        loadData(true);
      }
    });

    const unsubCallEnded = connectSocketService.onCallEnded(() => {
      setActiveCall(null);
      setIncomingCall(null);
      loadData(true);
    });

    return () => {
      unsubMsg();
      unsubIncoming();
      unsubCallResp();
      unsubCallEnded();
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
      await connectLocalStorage.saveConversation(conv);
      setActiveConversation(conv);
      loadData(true);
    } catch (err: any) {
      Alert.alert('Chat Error', err?.message || 'Could not start conversation.');
    }
  };

  const handleSelectOtherContactForChat = async (contact: ConnectOtherContact) => {
    setNewChatVisible(false);
    try {
      const conv = await connectService.startContactConversation({
        name: contact.name,
        phone: contact.phone,
      });
      await connectLocalStorage.saveConversation(conv);
      setActiveConversation(conv);
      loadData(true);
    } catch (err: any) {
      Alert.alert('Chat Error', err?.message || 'Could not start conversation with contact.');
    }
  };

  const handleStartSelfChat = async () => {
    if (!user?.id) {
      Alert.alert('Sign In', 'Please sign in to message yourself.');
      return;
    }
    setNewChatVisible(false);
    try {
      const conv = await connectService.createDirectConversation(user.id);
      await connectLocalStorage.saveConversation(conv);
      setActiveConversation(conv);
      loadData(true);
    } catch (err: any) {
      Alert.alert('Chat Error', err?.message || 'Could not start self chat.');
    }
  };

  const handleStartChatByPhone = async (phoneNumber: string) => {
    setNewChatVisible(false);
    try {
      const conv = await connectService.startContactConversation({
        name: phoneNumber,
        phone: phoneNumber,
      });
      await connectLocalStorage.saveConversation(conv);
      setActiveConversation(conv);
      loadData(true);
    } catch (err: any) {
      Alert.alert('Chat Error', err?.message || 'Could not start conversation with phone number.');
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

  // Phase 3 Call Handlers
  const handleStartCall = async (
    callType: 'voice' | 'video',
    partner: { id: string; name: string; profileImage: string | null; headline?: string | null }
  ) => {
    try {
      const res = await connectService.initiateCall({
        receiverId: partner.id,
        conversationId: activeConversation?.id || null,
        callType,
      });

      connectSocketService.emitCallInitiate(partner.id, activeConversation?.id || null, callType);

      setActiveCall({
        callId: res.callId,
        conversationId: res.conversationId,
        callType,
        status: 'ringing',
        caller: {
          id: user?.id || '',
          name: user?.name || 'You',
          profileImage: user?.profileImage || null,
        },
        receiver: {
          id: partner.id,
          name: partner.name,
          profileImage: partner.profileImage,
          headline: partner.headline,
        },
        isOutgoing: true,
        durationSeconds: 0,
      });
    } catch (err: any) {
      Alert.alert('Call Failed', err?.message || 'Could not place call.');
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      await connectService.respondCall(incomingCall.callId, 'accept');
      connectSocketService.emitCallRespond(incomingCall.callId, 'accept');
      setActiveCall({ ...incomingCall, status: 'ongoing' });
      setIncomingCall(null);
    } catch (err: any) {
      Alert.alert('Call Error', err?.message || 'Could not connect call.');
      setIncomingCall(null);
    }
  };

  const handleDeclineIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      await connectService.respondCall(incomingCall.callId, 'decline');
      connectSocketService.emitCallRespond(incomingCall.callId, 'decline');
    } catch {
      // Ignore
    } finally {
      setIncomingCall(null);
      loadData(true);
    }
  };

  const handleEndActiveCall = async (durationSecs: number) => {
    if (!activeCall) return;
    const callToLog = { ...activeCall };
    setActiveCall(null);
    try {
      await connectService.endCall(callToLog.callId, durationSecs);
      connectSocketService.emitCallEnd(callToLog.callId, durationSecs);

      const partner = callToLog.isOutgoing ? callToLog.receiver : callToLog.caller;
      const log: ConnectCallLog = {
        id: callToLog.callId,
        conversationId: callToLog.conversationId,
        callType: callToLog.callType,
        status: durationSecs > 0 ? 'completed' : 'missed',
        startedAt: new Date(Date.now() - durationSecs * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        durationSeconds: durationSecs,
        createdAt: new Date().toISOString(),
        isOutgoing: callToLog.isOutgoing,
        contactUserId: partner.id,
        contactName: partner.name,
        contactAvatar: partner.profileImage,
        contactPhone: null,
      };
      await connectLocalStorage.saveCallLog(log);
    } catch {
      // Ignore
    } finally {
      loadData(true);
    }
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
      <>
        <ConnectConversationScreen
          conversation={activeConversation}
          currentUserId={user?.id || ''}
          onBack={() => {
            setActiveConversation(null);
            loadData(true);
          }}
          onStartCall={handleStartCall}
        />
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
        <ActiveCallModal
          call={activeCall}
          onEndCall={handleEndActiveCall}
          onToggleCallType={(newType) => {
            if (activeCall) setActiveCall({ ...activeCall, callType: newType });
          }}
        />
      </>
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

        {/* WhatsApp Top Navigation Tabs: CHATS and CALLS */}
        <View style={styles.mainTabsBar}>
          <Pressable
            onPress={() => setMainTab('chats')}
            style={[styles.mainTabBtn, mainTab === 'chats' && styles.mainTabBtnActive]}
          >
            <Text
              style={[styles.mainTabText, mainTab === 'chats' && styles.mainTabTextActive]}
            >
              CHATS
            </Text>
            {totalUnread > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{totalUnread}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setMainTab('calls')}
            style={[styles.mainTabBtn, mainTab === 'calls' && styles.mainTabBtnActive]}
          >
            <Text
              style={[styles.mainTabText, mainTab === 'calls' && styles.mainTabTextActive]}
            >
              CALLS
            </Text>
            {callLogs.filter((c) => c.status === 'missed').length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.tabBadgeText}>
                  {callLogs.filter((c) => c.status === 'missed').length}
                </Text>
              </View>
            )}
          </Pressable>
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

        {/* Quick Filter Tabs (All, Unread, Groups, Favorites) - in Chats view */}
        {mainTab === 'chats' && (
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
        )}

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
          {mainTab === 'calls' ? (
            /* Calls Tab: Call History (Phase 3) */
            <View style={styles.callsSection}>
              {callLogs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>📞</Text>
                  <Text variant="body" color="#0F172A" align="center" style={styles.emptyTitle}>
                    No call history yet
                  </Text>
                  <Text variant="caption" color="#64748B" align="center" style={styles.emptySub}>
                    Tap the call button below to start a HD voice or video call with your contacts
                  </Text>
                </View>
              ) : (
                <View style={styles.convList}>
                  {callLogs.map((log) => {
                    const isMissed = log.status === 'missed' || log.status === 'declined';
                    const timeStr = new Date(log.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const mins = Math.floor(log.durationSeconds / 60);
                    const secs = log.durationSeconds % 60;
                    const durStr = log.durationSeconds > 0 ? (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`) : '';

                    return (
                      <View key={log.id} style={styles.convRow}>
                        <View style={styles.convAvatar}>
                          {log.contactAvatar ? (
                            <Image source={{ uri: log.contactAvatar }} style={styles.avatarImg} />
                          ) : (
                            <Text style={styles.avatarLetter}>
                              {log.contactName.slice(0, 1).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View style={styles.convBody}>
                          <View style={styles.convTopRow}>
                            <Text
                              variant="caption"
                              color={isMissed ? '#EF4444' : '#0F172A'}
                              numberOfLines={1}
                              style={styles.convName}
                            >
                              {log.contactName}
                            </Text>
                          </View>

                          <View style={styles.callMetaRow}>
                            <Text
                              style={[
                                styles.callDirArrow,
                                isMissed ? styles.arrowMissed : log.isOutgoing ? styles.arrowOut : styles.arrowIn,
                              ]}
                            >
                              {isMissed ? '↙' : log.isOutgoing ? '↗' : '↙'}
                            </Text>
                            <Text variant="caption" color="#64748B" style={styles.callMetaText}>
                              {timeStr} {durStr ? `• ${durStr}` : ''}
                            </Text>
                          </View>
                        </View>

                        {/* Quick Callback Icon Button */}
                        <Pressable
                          onPress={() =>
                            handleStartCall(log.callType, {
                              id: log.contactUserId,
                              name: log.contactName,
                              profileImage: log.contactAvatar,
                            })
                          }
                          style={styles.callbackBtn}
                          hitSlop={8}
                        >
                          <Text style={styles.callbackIcon}>
                            {log.callType === 'video' ? '🎥' : '📞'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            /* Chats Tab: Stories & Conversations */
            <>
              {/* Quick Contacts & Self-Chat Tray */}
              <View style={styles.storiesSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
                  {/* My Notes / Self Chat Bubble */}
                  <Pressable
                    onPress={handleStartSelfChat}
                    style={styles.storyItem}
                  >
                    <View style={styles.myStatusRing}>
                      <Text style={styles.myStatusPlus}>💬</Text>
                    </View>
                    <Text variant="caption" color="#0F172A" style={styles.storyName}>
                      Message You
                    </Text>
                  </Pressable>

                  {/* Registered Contact circles for 1-Tap Direct Chat */}
                  {registeredContacts.slice(0, 5).map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => handleSelectContactForChat(c)}
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
                      Start chatting with any Life OS user or message yourself to save notes!
                    </Text>
                    <View style={styles.emptyActionsRow}>
                      <Pressable onPress={handleStartSelfChat} style={styles.selfChatBtn}>
                        <Text style={styles.selfChatBtnText}>💬 Message Yourself</Text>
                      </Pressable>
                      <Pressable onPress={handleOpenNewChatModal} style={styles.startChatBtn}>
                        <Text style={styles.startChatBtnText}>Find Contacts ›</Text>
                      </Pressable>
                    </View>
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
            </>
          )}
        </ScrollView>

        {/* WhatsApp-Style Floating Action Button (FAB) */}
        <Pressable onPress={handleOpenNewChatModal} style={styles.fab}>
          <Text style={styles.fabIcon}>{mainTab === 'calls' ? '📞' : '💬'}</Text>
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
          currentUser={user}
          registeredUsers={registeredContacts}
          otherContacts={otherContacts}
          loading={contactsLoading}
          onRefreshContacts={syncPhoneContacts}
          onSelectUser={handleSelectContactForChat}
          onSelectOtherContact={handleSelectOtherContactForChat}
          onStartSelfChat={handleStartSelfChat}
          onStartChatByPhone={handleStartChatByPhone}
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

        {/* Incoming & Active Call Modals for Main Screen (Phase 3) */}
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
        <ActiveCallModal
          call={activeCall}
          onEndCall={handleEndActiveCall}
          onToggleCallType={(newType) => {
            if (activeCall) setActiveCall({ ...activeCall, callType: newType });
          }}
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
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  selfChatBtn: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  selfChatBtnText: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '800',
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
  mainTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mainTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  mainTabBtnActive: {
    borderBottomColor: '#7C3AED',
  },
  mainTabText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  mainTabTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  callsSection: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  convList: {
    backgroundColor: '#FFFFFF',
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  convAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#475569',
  },
  callMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  callDirArrow: {
    fontSize: 14,
    fontWeight: '800',
  },
  arrowMissed: {
    color: '#EF4444',
  },
  arrowOut: {
    color: '#22C55E',
  },
  arrowIn: {
    color: '#3B82F6',
  },
  callMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  callbackBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  callbackIcon: {
    fontSize: 18,
  },
});
