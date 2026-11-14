import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Text } from '../../../components';
import { colors, spacing, borderRadius } from '../../../theme';
import { ConnectOtherContact, ConnectUserContact } from '../types';

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser?: { id: string; name: string; phone?: string } | null;
  registeredUsers: ConnectUserContact[];
  otherContacts: ConnectOtherContact[];
  loading: boolean;
  onRefreshContacts: () => void;
  onSelectUser: (user: ConnectUserContact) => void;
  onSelectOtherContact?: (contact: ConnectOtherContact) => void;
  onStartSelfChat?: () => void;
  onStartChatByPhone?: (phone: string) => void;
  onOpenCreateGroup: () => void;
  onSearchGlobal: (query: string) => Promise<ConnectUserContact[]>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  visible,
  onClose,
  currentUser,
  registeredUsers,
  otherContacts,
  loading,
  onRefreshContacts,
  onSelectUser,
  onSelectOtherContact,
  onStartSelfChat,
  onStartChatByPhone,
  onOpenCreateGroup,
  onSearchGlobal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [directPhone, setDirectPhone] = useState('');
  const [globalResults, setGlobalResults] = useState<ConnectUserContact[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  const cleanQuery = searchQuery.trim().toLowerCase();

  const filteredRegistered = cleanQuery
    ? registeredUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(cleanQuery) ||
          (u.phoneBookName && u.phoneBookName.toLowerCase().includes(cleanQuery)) ||
          u.phone.includes(cleanQuery)
      )
    : registeredUsers;

  const filteredOther = cleanQuery
    ? otherContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(cleanQuery) || c.phone.includes(cleanQuery)
      )
    : otherContacts;

  const handleGlobalSearch = async () => {
    if (!cleanQuery) return;
    setSearchingGlobal(true);
    try {
      const results = await onSearchGlobal(cleanQuery);
      setGlobalResults(results);
    } catch {
      // Ignore
    } finally {
      setSearchingGlobal(false);
    }
  };

  const handleInviteWhatsApp = (contact: ConnectOtherContact) => {
    const text = encodeURIComponent(
      `Hey ${contact.name}! Chat with me securely on Life OS. Download the app here: https://github.com/RahulPal-crypto/Life-OS/releases`
    );
    const url = `whatsapp://send?phone=${contact.phone}&text=${text}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(`sms:${contact.phone}?body=${text}`);
        }
      })
      .catch(() => {
        Alert.alert('Invite', `Share Life OS download link with ${contact.name}`);
      });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <View style={styles.headerTitles}>
            <Text variant="h3" color="#0F172A" style={styles.headerTitle}>
              Select Contact
            </Text>
            <Text variant="caption" color="#64748B" style={styles.headerSub}>
              {registeredUsers.length + otherContacts.length} contacts
            </Text>
          </View>
          <Pressable onPress={onRefreshContacts} style={styles.refreshBtn}>
            <Text style={styles.refreshIcon}>🔄</Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarRow}>
          <TextInput
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t);
              if (!t.trim()) setGlobalResults([]);
            }}
            onSubmitEditing={handleGlobalSearch}
            placeholder="Search name or phone number..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {Boolean(searchQuery.trim()) && (
            <Pressable onPress={handleGlobalSearch} style={styles.searchGoBtn}>
              <Text variant="caption" color="#7C3AED" style={styles.searchGoText}>
                Search All
              </Text>
            </Pressable>
          )}
        </View>

        {/* Quick Actions: New Group & Message Yourself */}
        <View style={styles.quickActions}>
          <Pressable onPress={onOpenCreateGroup} style={styles.actionRow}>
            <View style={[styles.actionIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Text style={styles.actionEmoji}>👥</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text variant="caption" color="#0F172A" style={styles.actionLabel}>
                New Group
              </Text>
              <Text variant="caption" color="#64748B" style={styles.actionSub}>
                Create a chat group with friends & family
              </Text>
            </View>
          </Pressable>

          {/* WhatsApp-style "Message yourself" */}
          {Boolean(onStartSelfChat) && (
            <Pressable onPress={onStartSelfChat} style={styles.actionRow}>
              <View style={[styles.actionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Text style={styles.actionEmoji}>👤</Text>
              </View>
              <View style={styles.actionInfo}>
                <Text variant="caption" color="#0F172A" style={styles.actionLabel}>
                  {currentUser?.name || 'You'} (You)
                </Text>
                <Text variant="caption" color="#64748B" style={styles.actionSub}>
                  Message yourself • Notes, testing & reminders
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Direct Phone Number Chat Input */}
        <View style={styles.directPhoneCard}>
          <Text variant="caption" color="#0F172A" style={styles.directPhoneTitle}>
            💬 Chat with any Phone Number
          </Text>
          <View style={styles.directPhoneRow}>
            <TextInput
              value={directPhone}
              onChangeText={setDirectPhone}
              placeholder="Enter mobile number (e.g. 9876543210)"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              style={styles.directPhoneInput}
            />
            <Pressable
              onPress={() => {
                const clean = directPhone.replace(/[^0-9+]/g, '').trim();
                if (clean.length >= 7 && onStartChatByPhone) {
                  onStartChatByPhone(clean);
                } else {
                  Alert.alert('Phone Number', 'Please enter a valid mobile number (at least 7-10 digits).');
                }
              }}
              style={styles.directPhoneBtn}
            >
              <Text style={styles.directPhoneBtnText}>Chat ›</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderArea}>
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text variant="caption" color="#64748B" style={styles.loaderText}>
              Discovering phone contacts on Life OS...
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollList}>
            {/* Global Search Results if searched */}
            {globalResults.length > 0 && (
              <View style={styles.section}>
                <Text variant="caption" color="#7C3AED" style={styles.sectionHeader}>
                  SEARCH RESULTS ({globalResults.length})
                </Text>
                {globalResults.map((user) => (
                  <Pressable
                    key={user.id}
                    onPress={() => onSelectUser(user)}
                    style={styles.contactRow}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {user.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text variant="caption" color="#0F172A" style={styles.contactName}>
                        {user.name}
                      </Text>
                      <Text variant="caption" color="#64748B" style={styles.contactHeadline}>
                        {user.headline}
                      </Text>
                    </View>
                    <Text variant="caption" color="#7C3AED" style={styles.chatLink}>
                      Chat ›
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Contacts on Life OS (if any registered contacts exist) */}
            {filteredRegistered.length > 0 && (
              <View style={styles.section}>
                <Text variant="caption" color="#475569" style={styles.sectionHeader}>
                  REGISTERED ON LIFE OS ({filteredRegistered.length})
                </Text>
                {filteredRegistered.map((user) => (
                  <Pressable
                    key={user.id}
                    onPress={() => onSelectUser(user)}
                    style={styles.contactRow}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {user.name.slice(0, 1).toUpperCase()}
                      </Text>
                      {user.isOnline && <View style={styles.onlineDot} />}
                    </View>
                    <View style={styles.contactInfo}>
                      <Text variant="caption" color="#0F172A" style={styles.contactName}>
                        {user.phoneBookName || user.name}
                      </Text>
                      <Text
                        variant="caption"
                        color="#64748B"
                        numberOfLines={1}
                        style={styles.contactHeadline}
                      >
                        {user.headline}
                      </Text>
                    </View>
                    <View style={styles.chatBadge}>
                      <Text variant="caption" color="#7C3AED" style={styles.chatBadgeText}>
                        Chat ›
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* All Phone Contacts — 1-Tap Direct Chat (Option A) */}
            {filteredOther.length > 0 ? (
              <View style={styles.section}>
                <Text variant="caption" color="#475569" style={styles.sectionHeader}>
                  PHONE CONTACTS ({filteredOther.length})
                </Text>
                {filteredOther.map((contact, index) => (
                  <Pressable
                    key={`${contact.phone}_${index}`}
                    onPress={() => {
                      if (onSelectOtherContact) {
                        onSelectOtherContact(contact);
                      } else {
                        handleInviteWhatsApp(contact);
                      }
                    }}
                    style={styles.contactRow}
                  >
                    <View style={[styles.avatar, styles.avatarContact]}>
                      <Text style={styles.avatarContactText}>
                        {contact.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text variant="caption" color="#0F172A" style={styles.contactName}>
                        {contact.name}
                      </Text>
                      <Text variant="caption" color="#64748B" style={styles.contactHeadline}>
                        {contact.phone}
                      </Text>
                    </View>

                    <View style={styles.contactActionsRow}>
                      <View style={styles.chatBadge}>
                        <Text variant="caption" color="#7C3AED" style={styles.chatBadgeText}>
                          Chat ›
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleInviteWhatsApp(contact)}
                        hitSlop={8}
                        style={styles.inviteMiniBtn}
                      >
                        <Text style={styles.inviteMiniIcon}>💬</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              filteredRegistered.length === 0 && (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text variant="caption" color="#64748B" align="center" style={styles.emptyText}>
                    {cleanQuery
                      ? 'No contacts found matching your search.'
                      : 'No phone contacts found. Tap refresh above to sync.'}
                  </Text>
                </View>
              )
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
    color: '#0F172A',
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11.5,
  },
  refreshBtn: {
    padding: 6,
  },
  refreshIcon: {
    fontSize: 18,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  searchGoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  searchGoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickActions: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 4,
  },
  directPhoneCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  directPhoneTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  directPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  directPhoneInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  directPhoneBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
  },
  directPhoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 4,
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 11.5,
  },
  loaderArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
  },
  scrollList: {
    paddingBottom: spacing.xxl,
  },
  section: {
    marginTop: spacing.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 4,
    position: 'relative',
  },
  avatarGray: {
    backgroundColor: '#E2E8F0',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
  },
  contactHeadline: {
    fontSize: 12,
  },
  chatBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  chatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  avatarContact: {
    backgroundColor: '#F3E8FF',
  },
  avatarContactText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7C3AED',
  },
  contactActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  inviteMiniBtn: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
  },
  inviteMiniIcon: {
    fontSize: 14,
  },
  chatLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  inviteBtn: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  inviteText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
  },
});
