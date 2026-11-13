import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '../../../components';
import { colors, spacing, borderRadius } from '../../../theme';
import { ConnectUserContact } from '../types';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  availableUsers: ConnectUserContact[];
  onCreateGroup: (payload: { name: string; memberIds: string[]; icon?: string }) => Promise<void>;
}

const GROUP_ICONS = ['👥', '👨‍👩‍👧‍👦', '🚀', '✈️', '💼', '🎯', '⚽', '🍕', '🎉', '🔥'];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  availableUsers,
  onCreateGroup,
}) => {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('👥');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Validation', 'Group name is required.');
      return;
    }
    if (selectedUserIds.size === 0) {
      Alert.alert('Validation', 'Select at least 1 contact to create a group.');
      return;
    }

    setBusy(true);
    try {
      await onCreateGroup({
        name: cleanName,
        icon: selectedIcon,
        memberIds: Array.from(selectedUserIds),
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create group.');
    } finally {
      setBusy(false);
    }
  };

  const filteredUsers = searchQuery.trim()
    ? availableUsers.filter((u) =>
        u.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : availableUsers;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <View style={styles.headerTitles}>
            <Text variant="h3" color="#0F172A" style={styles.headerTitle}>
              New Group
            </Text>
            <Text variant="caption" color="#64748B" style={styles.headerSub}>
              {selectedUserIds.size} of {availableUsers.length} selected
            </Text>
          </View>
          <Pressable
            onPress={handleCreate}
            disabled={busy || !name.trim() || selectedUserIds.size === 0}
            style={[
              styles.createBtn,
              (!name.trim() || selectedUserIds.size === 0) && styles.createBtnDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text variant="caption" color="#FFFFFF" style={styles.createBtnText}>
                Create ✓
              </Text>
            )}
          </Pressable>
        </View>

        {/* Group Name & Icon Row */}
        <View style={styles.nameRow}>
          <View style={styles.iconBox}>
            <Text style={styles.iconEmoji}>{selectedIcon}</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Type group subject here..."
            placeholderTextColor="#94A3B8"
            style={styles.nameInput}
          />
        </View>

        {/* Icon Picker Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.iconChips}
        >
          {GROUP_ICONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => setSelectedIcon(emoji)}
              style={[styles.emojiChip, selectedIcon === emoji && styles.emojiChipSelected]}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Selected Members Chips */}
        {selectedUserIds.size > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedRow}
          >
            {Array.from(selectedUserIds).map((id) => {
              const u = availableUsers.find((x) => x.id === id);
              if (!u) return null;
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleSelectUser(id)}
                  style={styles.memberChip}
                >
                  <Text variant="caption" color="#7C3AED" style={styles.memberChipText}>
                    {u.phoneBookName || u.name} ✕
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Search Contacts to Add */}
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search contacts to add..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        {/* Contacts Checkbox List */}
        <ScrollView contentContainerStyle={styles.contactsList}>
          {filteredUsers.map((user) => {
            const selected = selectedUserIds.has(user.id);
            return (
              <Pressable
                key={user.id}
                onPress={() => toggleSelectUser(user.id)}
                style={styles.userRow}
              >
                <View style={[styles.avatar, selected && styles.avatarSelected]}>
                  <Text style={styles.avatarText}>
                    {user.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text variant="caption" color="#0F172A" style={styles.userName}>
                    {user.phoneBookName || user.name}
                  </Text>
                  <Text variant="caption" color="#64748B" style={styles.userSub}>
                    {user.headline}
                  </Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                  {selected && <Text style={styles.checkCheck}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
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
  createBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 24,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  iconChips: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  emojiChip: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  emojiChipSelected: {
    backgroundColor: '#DDD6FE',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  emojiText: {
    fontSize: 20,
  },
  selectedRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  memberChip: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchRow: {
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  contactsList: {
    paddingBottom: spacing.xxl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 4,
  },
  avatarSelected: {
    backgroundColor: '#7C3AED',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userSub: {
    fontSize: 11.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  checkCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
