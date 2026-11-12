import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface DateSelectorProps {
  date: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  date,
  onPreviousDay,
  onNextDay,
}) => {
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Left Chevron */}
      <Pressable
        onPress={onPreviousDay}
        style={({ pressed }) => [
          styles.chevronBtn,
          pressed && styles.pressed,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.chevronText}>‹</Text>
      </Pressable>

      {/* Center Date Pill */}
      <View style={styles.datePill}>
        <Text style={styles.pillIcon}>📅</Text>
        <Text variant="caption" color={colors.textPrimary} style={styles.dateText}>
          {formattedDate}
        </Text>
      </View>

      {/* Right Chevron */}
      <Pressable
        onPress={onNextDay}
        style={({ pressed }) => [
          styles.chevronBtn,
          pressed && styles.pressed,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.chevronText}>›</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  chevronBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  chevronText: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '700',
    lineHeight: 26,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: spacing.md + 4,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pillIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E1B4B',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.6,
  },
});
