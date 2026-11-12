import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text, Button } from '../../../components';
import { MemoryFolder } from '../services/memoriesService';

const FOLDER_ICONS = ['📁', '🏝️', '👨‍👩‍👧‍👦', '🎓', '🪪', '🏠', '💼', '🎉', '❤️'];
const FOLDER_COLORS = ['#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

interface CreateFolderModalProps {
  visible: boolean;
  isVault: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; icon: string; color: string; isPinned: boolean }) => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  visible,
  isVault,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(isVault ? '🔐' : '📁');
  const [color, setColor] = useState('#7C3AED');
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }
    onCreate({ name: name.trim(), icon, color, isPinned });
    setName('');
    setIsPinned(false);
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text variant="h3" color={colors.textPrimary} style={styles.title}>
            {isVault ? 'New Safe Vault Folder' : 'New Folder'}
          </Text>

          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            placeholder="e.g. Goa Trip 2026 or IDs & Docs"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          {error ? (
            <Text variant="caption" color="#DC2626" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Text variant="caption" color={colors.textSecondary} style={styles.label}>
            ICON
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {FOLDER_ICONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => setIcon(ic)}
                style={[styles.iconChip, icon === ic && styles.iconChipActive]}
              >
                <Text style={styles.iconEmoji}>{ic}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text variant="caption" color={colors.textSecondary} style={styles.label}>
            COLOR
          </Text>
          <View style={styles.colorRow}>
            {FOLDER_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  color === c && styles.colorDotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.pinRow}>
            <Text variant="caption" color={colors.textPrimary} style={styles.pinLabel}>
              Pin folder to top
            </Text>
            <Switch value={isPinned} onValueChange={setIsPinned} />
          </View>

          <View style={styles.btnRow}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.halfBtn} />
            <Button title="Create" onPress={handleSave} style={styles.darkCreateBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface FolderDestinationModalProps {
  visible: boolean;
  title: string;
  folders: MemoryFolder[];
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
}

export const FolderDestinationModal: React.FC<FolderDestinationModalProps> = ({
  visible,
  title,
  folders,
  onClose,
  onSelect,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdropCenter}>
        <View style={styles.pickerCard}>
          <Text variant="h3" color={colors.textPrimary} style={styles.title}>
            {title}
          </Text>
          <ScrollView style={styles.folderList}>
            <Pressable
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              style={styles.folderOption}
            >
              <Text style={styles.optionIcon}>🏠</Text>
              <Text variant="caption" color={colors.textPrimary} style={styles.optionName}>
                Root Directory (Top Level)
              </Text>
            </Pressable>
            {folders.map((folder) => (
              <Pressable
                key={folder.id}
                onPress={() => {
                  onSelect(folder.id);
                  onClose();
                }}
                style={styles.folderOption}
              >
                <Text style={styles.optionIcon}>{folder.icon}</Text>
                <Text variant="caption" color={colors.textPrimary} style={styles.optionName}>
                  {folder.name}
                </Text>
                <Text variant="caption" color={colors.textSecondary} style={styles.optionCount}>
                  {folder.itemCount}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '72%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: spacing.xs,
  },
  error: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipScroll: {
    marginBottom: spacing.xs,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconChipActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  iconEmoji: {
    fontSize: 19,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.1 }],
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  pinLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfBtn: {
    flex: 1,
    height: 46,
  },
  darkCreateBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#0F172A',
  },
  folderList: {
    marginBottom: spacing.md,
  },
  folderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  optionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  optionCount: {
    fontSize: 12,
  },
});
