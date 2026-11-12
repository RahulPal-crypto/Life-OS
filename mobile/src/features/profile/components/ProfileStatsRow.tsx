import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';
import { ProfileStats } from '../services/profileService';

interface ProfileStatsRowProps {
  stats: ProfileStats;
}

export const ProfileStatsRow: React.FC<ProfileStatsRowProps> = ({ stats }) => {
  const items = [
    { label: 'Days Tracked', value: String(stats.daysTracked), icon: '📅', color: '#6D28D9' },
    { label: 'Activities', value: String(stats.totalActivities), icon: '⚡', color: '#0EA5E9' },
    { label: 'Study Hrs', value: `${stats.totalStudyHours.toFixed(1)}h`, icon: '📖', color: '#10B981' },
    { label: 'Work Hrs', value: `${stats.totalWorkHours.toFixed(1)}h`, icon: '💼', color: '#EA580C' },
  ];

  return (
    <View style={styles.container}>
      <Text variant="caption" color="#6B7280" style={styles.sectionLabel}>
        LIFE OS ACTIVITY SUMMARY
      </Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.label} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.icon}>{item.icon}</Text>
              <Text variant="h2" color={item.color} style={styles.value}>
                {item.value}
              </Text>
            </View>
            <Text variant="caption" color="#6B7280" numberOfLines={1} style={styles.label}>
              {item.label}
            </Text>
          </View>
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  card: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  icon: {
    fontSize: 18,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0.1,
  },
});
