import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text, Button } from '../../../components';
import { InputField } from '../../auth/components/InputField';
import { ActivityCategory } from '../services/timelineService';
import { formatClockTime } from '../services/activityTimerHelper';

interface QuickLogModalProps {
  visible: boolean;
  onClose: () => void;
  defaultCategory?: ActivityCategory;
  onSave: (entry: {
    category: ActivityCategory;
    title: string;
    details?: string;
    meta?: string;
    time: string;
    durationMinutes?: number;
  }) => void;
}

const CATEGORIES: Array<{ key: ActivityCategory; label: string }> = [
  { key: 'focus', label: 'Work & Study' },
  { key: 'meal', label: 'Meal & Diet' },
  { key: 'place', label: 'Place & Travel' },
  { key: 'social', label: 'Call & Meet' },
  { key: 'note', label: 'Quick Note' },
];

const DURATION_PRESETS: Array<{ label: string; minutes: number | null | 'custom' }> = [
  { label: 'No Timer', minutes: null },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '60m', minutes: 60 },
  { label: 'Custom', minutes: 'custom' },
];

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  visible,
  onClose,
  defaultCategory,
  onSave,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>(defaultCategory || 'focus');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [meta, setMeta] = useState('');
  const [timerSelection, setTimerSelection] = useState<number | null | 'custom'>(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && defaultCategory) {
      setSelectedCategory(defaultCategory);
    }
  }, [visible, defaultCategory]);

  const formatCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getResolvedDurationMinutes = (): number | undefined => {
    if (timerSelection === null) return undefined;
    if (timerSelection === 'custom') {
      const parsed = Number(customMinutes.trim());
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) {
        return NaN;
      }
      return parsed;
    }
    return timerSelection;
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const durationMinutes = getResolvedDurationMinutes();
    if (durationMinutes !== undefined && Number.isNaN(durationMinutes)) {
      setError('Enter custom timer minutes between 1 and 720');
      return;
    }

    onSave({
      category: selectedCategory,
      title: title.trim(),
      details: details.trim() || undefined,
      meta: meta.trim() || undefined,
      time: formatCurrentTime(),
      durationMinutes,
    });

    // Reset
    setTitle('');
    setDetails('');
    setMeta('');
    setTimerSelection(null);
    setCustomMinutes('');
    setError('');
    onClose();
  };

  const resolvedPreviewMinutes = getResolvedDurationMinutes();
  const hasValidPreview =
    typeof resolvedPreviewMinutes === 'number' && !Number.isNaN(resolvedPreviewMinutes);
  const previewEndTime = hasValidPreview
    ? formatClockTime(Date.now() + resolvedPreviewMinutes * 60_000)
    : null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        Keyboard.dismiss();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text variant="h2" color={colors.textPrimary} style={styles.headerTitle}>
                Log Activity
              </Text>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  onClose();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="caption" color={colors.textMuted} style={styles.closeText}>
                  Close
                </Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Category Chips */}
              <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                CATEGORY
              </Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map(cat => {
                  const isActive = selectedCategory === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setSelectedCategory(cat.key)}
                      style={[
                        styles.categoryChip,
                        isActive && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        variant="caption"
                        color={isActive ? '#FFFFFF' : '#475569'}
                        style={[styles.chipText, isActive && styles.chipTextActive]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Form Fields */}
              <InputField
                label="Activity Title"
                placeholder="e.g. Read Architecture Docs or Lunch"
                value={title}
                onChangeText={t => {
                  setTitle(t);
                  if (error) setError('');
                }}
                error={error}
              />

              <InputField
                label="Notes or Description"
                placeholder="Add quick notes or highlights"
                value={details}
                onChangeText={setDetails}
              />

              <InputField
                label="Duration or Location (Optional)"
                placeholder="e.g. 1.5 hrs or Central Park"
                value={meta}
                onChangeText={setMeta}
              />

              {/* Auto-Stop Timer Selector */}
              <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                AUTO-STOP TIMER (OPTIONAL)
              </Text>
              <View style={styles.categoryRow}>
                {DURATION_PRESETS.map((preset) => {
                  const isActive = timerSelection === preset.minutes;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => {
                        setTimerSelection(preset.minutes);
                        if (error) setError('');
                      }}
                      style={[
                        styles.categoryChip,
                        isActive && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        variant="caption"
                        color={isActive ? '#FFFFFF' : '#475569'}
                        style={[styles.chipText, isActive && styles.chipTextActive]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {timerSelection === 'custom' && (
                <InputField
                  label="Custom Minutes (1 - 720)"
                  placeholder="e.g. 20"
                  keyboardType="numeric"
                  value={customMinutes}
                  onChangeText={(val) => {
                    setCustomMinutes(val.replace(/[^0-9]/g, ''));
                    if (error) setError('');
                  }}
                />
              )}

              {previewEndTime && (
                <View style={styles.timerHintBox}>
                  <Text variant="caption" color="#0F766E" style={styles.timerHintText}>
                    Auto-stops at {previewEndTime} with an alarm beep; time slot stays saved in your log.
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                  style={styles.cancelButton}
                />
                <Button
                  title="Save to Timeline"
                  variant="primary"
                  onPress={handleSave}
                  style={styles.saveButton}
                />
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    maxHeight: '85%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  categoryChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'none',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  timerHintBox: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  timerHintText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    marginRight: spacing.sm,
    height: 48,
  },
  saveButton: {
    flex: 1,
    marginLeft: spacing.sm,
    height: 48,
    backgroundColor: '#0F172A',
  },
});
