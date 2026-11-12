import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface QuickActionsRowProps {
  onAddActivity?: () => void;
  onLogMeal?: () => void;
  onStartStudy?: () => void;
  onAddMemory?: () => void;
  onViewAll?: () => void;
}

export const QuickActionsRow: React.FC<QuickActionsRowProps> = ({
  onAddActivity,
  onLogMeal,
  onStartStudy,
  onAddMemory,
  onViewAll,
}) => {
  const actions = [
    {
      id: 'activity',
      label: 'Add Activity',
      icon: '➕',
      bgColor: '#EDE9FE',
      iconColor: '#7C3AED',
      onPress: onAddActivity,
    },
    {
      id: 'meal',
      label: 'Log Meal',
      icon: '🍴',
      bgColor: '#FFEDD5',
      iconColor: '#EA580C',
      onPress: onLogMeal,
    },
    {
      id: 'study',
      label: 'Start Study',
      icon: '📖',
      bgColor: '#E0F2FE',
      iconColor: '#0284C7',
      onPress: onStartStudy,
    },
    {
      id: 'memory',
      label: 'Add Memory',
      icon: '🖼️',
      bgColor: '#FFE4E6',
      iconColor: '#E11D48',
      onPress: onAddMemory,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Text style={styles.lightningIcon}>⚡</Text>
          <Text variant="h3" color={colors.textPrimary} style={styles.sectionTitle}>
            Quick Actions
          </Text>
        </View>

        <Pressable onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text variant="caption" color={colors.primaryLight} style={styles.viewAllText}>
            View All
          </Text>
        </Pressable>
      </View>

      {/* 4 Cards Grid/Row */}
      <View style={styles.actionsGrid}>
        {actions.map(action => (
          <Pressable
            key={action.id}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: action.bgColor }]}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
            </View>
            <Text
              variant="caption"
              color={colors.textPrimary}
              align="center"
              numberOfLines={1}
              style={styles.actionLabel}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lightningIcon: {
    fontSize: 15,
    marginRight: 6,
    color: '#7C3AED',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
