import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text, Button } from '../../../components';
import { MemoryItem } from '../services/memoriesService';
import { formatBytes, getMediaTypeIcon, memoriesNative } from '../services/memoriesNative';

const MOOD_CHIPS = ['Happy', 'Grateful', 'Milestone', 'Travel', 'Important', 'Private'];

interface MemoryViewerModalProps {
  visible: boolean;
  item: MemoryItem | null;
  onClose: () => void;
  onSaveDetails: (
    item: MemoryItem,
    updates: {
      title: string;
      story: string | null;
      memoryDate: string;
      location: string | null;
      people: string | null;
      tags: string | null;
      mood: string | null;
    }
  ) => Promise<void>;
  onToggleFavorite: (item: MemoryItem) => void;
  onMoveVault: (item: MemoryItem) => void;
  onMoveFolder: (item: MemoryItem) => void;
  onDelete: (item: MemoryItem) => void;
  onExternalAction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const MemoryViewerModal: React.FC<MemoryViewerModalProps> = ({
  visible,
  item,
  onClose,
  onSaveDetails,
  onToggleFavorite,
  onMoveVault,
  onMoveFolder,
  onDelete,
  onExternalAction,
}) => {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [memoryDate, setMemoryDate] = useState('');
  const [location, setLocation] = useState('');
  const [people, setPeople] = useState('');
  const [tags, setTags] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !item) {
      setResolvedUri(null);
      setPlayingAudio(false);
      memoriesNative.stopAudio();
      return;
    }

    setTitle(item.title || '');
    setStory(item.story || '');
    setMemoryDate(item.memoryDate ? String(item.memoryDate).slice(0, 10) : '');
    setLocation(item.location || '');
    setPeople(item.people || '');
    setTags(item.tags || '');
    setMood(item.mood || null);

    if (item.isVault && item.vaultUri) {
      memoriesNative
        .decryptVaultFileToPreview(item.vaultUri, item.fileName)
        .then((res) => setResolvedUri(res?.previewUri || null))
        .catch(() => setResolvedUri(null));
    } else {
      setResolvedUri(item.localUri || null);
    }
  }, [visible, item]);

  if (!item) return null;

  const handleOpenExternal = async () => {
    if (!resolvedUri) {
      Alert.alert('Unavailable', 'Local file copy is not present on this device.');
      return;
    }
    try {
      const exec = () => memoriesNative.openFileExternally(resolvedUri, item.mimeType);
      await (onExternalAction ? onExternalAction(exec) : exec());
    } catch (err: any) {
      Alert.alert('Cannot Open File', err?.message || 'No viewer installed for this file type.');
    }
  };

  const handleShare = async () => {
    if (!resolvedUri) {
      Alert.alert('Unavailable', 'Local file is not available to share.');
      return;
    }
    try {
      const exec = () => memoriesNative.shareFiles([resolvedUri], item.mimeType);
      await (onExternalAction ? onExternalAction(exec) : exec());
    } catch (err: any) {
      Alert.alert('Share Failed', err?.message || 'Could not share file.');
    }
  };

  const handleAudioToggle = async () => {
    if (!resolvedUri) return;
    if (playingAudio) {
      await memoriesNative.stopAudio();
      setPlayingAudio(false);
      return;
    }
    try {
      await memoriesNative.playAudio(resolvedUri);
      setPlayingAudio(true);
    } catch (err: any) {
      Alert.alert('Audio Error', err?.message || 'Unable to play voice memo.');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await onSaveDetails(item, {
        title: title.trim(),
        story: story.trim() || null,
        memoryDate: memoryDate.trim() || String(item.memoryDate).slice(0, 10),
        location: location.trim() || null,
        people: people.trim() || null,
        tags: tags.trim() || null,
        mood,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Action Bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.topBtn}>
            <Text variant="caption" color="#FFFFFF" style={styles.topBtnText}>
              Close
            </Text>
          </Pressable>
          <View style={styles.topActions}>
            <Pressable onPress={() => onToggleFavorite(item)} style={styles.iconAction}>
              <Text style={styles.actionEmoji}>{item.isFavorite ? '⭐' : '☆'}</Text>
            </Pressable>
            <Pressable onPress={handleShare} style={styles.iconAction}>
              <Text style={styles.actionEmoji}>↗️</Text>
            </Pressable>
            <Pressable onPress={() => onDelete(item)} style={styles.iconAction}>
              <Text style={styles.actionEmoji}>🗑️</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Preview Canvas */}
          <View style={styles.previewBox}>
            {item.mediaType === 'photo' && resolvedUri ? (
              <Image source={{ uri: resolvedUri }} style={styles.photoPreview} resizeMode="contain" />
            ) : (
              <View style={styles.fileCardPreview}>
                <Text style={styles.bigTypeIcon}>{getMediaTypeIcon(item.mediaType)}</Text>
                <Text variant="h3" color="#FFFFFF" align="center" style={styles.fileNameText}>
                  {item.fileName}
                </Text>
                <Text variant="caption" color="#CBD5E1" style={styles.metaText}>
                  {formatBytes(item.sizeBytes)} • {item.mimeType || item.mediaType}
                </Text>

                {item.mediaType === 'audio' ? (
                  <Pressable onPress={handleAudioToggle} style={styles.openBtn}>
                    <Text variant="caption" color="#0F172A" style={styles.openBtnText}>
                      {playingAudio ? '⏹ Stop Voice Playback' : '▶️ Play Voice Memo'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={handleOpenExternal} style={styles.openBtn}>
                    <Text variant="caption" color="#0F172A" style={styles.openBtnText}>
                      Open {item.mediaType === 'video' ? 'Video' : 'Document'}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Quick File Operations */}
          <View style={styles.quickOpsRow}>
            <Pressable onPress={() => onMoveFolder(item)} style={styles.quickOpPill}>
              <Text variant="caption" color="#1E293B" style={styles.quickOpText}>
                📁 Move Folder
              </Text>
            </Pressable>
            <Pressable onPress={() => onMoveVault(item)} style={styles.quickOpPill}>
              <Text variant="caption" color="#6D28D9" style={styles.quickOpText}>
                {item.isVault ? '🔓 Move Out of Safe' : '🔒 Move to Safe Vault'}
              </Text>
            </Pressable>
          </View>

          {/* Memory Context & Story Editor */}
          <View style={styles.detailsSheet}>
            <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
              TITLE / FILE DISPLAY NAME
            </Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} />

            <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
              STORY OR MEMORY NOTE
            </Text>
            <TextInput
              value={story}
              onChangeText={setStory}
              multiline
              placeholder="Write what happened in this memory or what document this is..."
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.storyInput]}
            />

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
                  DATE (YYYY-MM-DD)
                </Text>
                <TextInput value={memoryDate} onChangeText={setMemoryDate} style={styles.input} />
              </View>
              <View style={styles.col}>
                <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
                  LOCATION
                </Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Goa, Home"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>
            </View>

            <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
              PEOPLE & TAGS
            </Text>
            <TextInput
              value={people}
              onChangeText={setPeople}
              placeholder="People (e.g. @Mom, @Rahul)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="Tags (e.g. #trip, #certificate, #id)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
              MOOD / CATEGORY CHIP
            </Text>
            <View style={styles.moodRow}>
              {MOOD_CHIPS.map((m) => {
                const active = mood === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMood(active ? null : m)}
                    style={[styles.moodChip, active && styles.moodChipActive]}
                  >
                    <Text
                      variant="caption"
                      color={active ? '#FFFFFF' : '#475569'}
                      style={styles.moodText}
                    >
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              title={saving ? 'Saving...' : 'Save Memory Details'}
              onPress={handleSave}
              disabled={saving}
              style={styles.saveBtn}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: '#0F172A',
  },
  topBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  topBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: {
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  previewBox: {
    minHeight: 260,
    maxHeight: 340,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    marginBottom: spacing.sm,
  },
  photoPreview: {
    width: '100%',
    height: 300,
  },
  fileCardPreview: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  bigTypeIcon: {
    fontSize: 52,
    marginBottom: spacing.sm,
  },
  fileNameText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    marginBottom: spacing.md,
  },
  openBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
  },
  openBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickOpsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 8,
    marginBottom: spacing.sm,
  },
  quickOpPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickOpText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  detailsSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: spacing.xs,
  },
  storyInput: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  moodChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: '#F1F5F9',
  },
  moodChipActive: {
    backgroundColor: '#7C3AED',
  },
  moodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#0F172A',
    height: 46,
  },
});
