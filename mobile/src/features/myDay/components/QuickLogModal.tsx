import React, { useState } from 'react';
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

interface QuickLogModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: {
    category: ActivityCategory;
    title: string;
    details?: string;
    meta?: string;
    time: string;
  }) => void;
}

const CATEGORIES: Array<{ key: ActivityCategory; label: string }> = [
  { key: 'focus', label: 'Work & Study' },
  { key: 'meal', label: 'Meal & Diet' },
  { key: 'place', label: 'Place & Travel' },
  { key: 'social', label: 'Call & Meet' },
  { key: 'note', label: 'Quick Note' },
];

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>('focus');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [meta, setMeta] = useState('');
  const [error, setError] = useState('');

  const formatCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    onSave({
      category: selectedCategory,
      title: title.trim(),
      details: details.trim() || undefined,
      meta: meta.trim() || undefined,
      time: formatCurrentTime(),
    });

    // Reset
    setTitle('');
    setDetails('');
    setMeta('');
    setError('');
    onClose();
  };

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
