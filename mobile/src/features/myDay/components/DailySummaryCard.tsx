import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';
import { DaySummary } from '../services/timelineService';

interface DailySummaryCardProps {
  summary: DaySummary;
}

export const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ summary }) => {
  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.headerRow}>
        <Text variant="caption" color={colors.textMuted} style={styles.headerLabel}>
          TODAY'S SUMMARY
        </Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text variant="caption" color="#10B981" style={styles.liveText}>
            ACTIVE
          </Text>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        {/* Metric 1: Focus */}
        <View style={styles.metricCell}>
          <Text variant="hero" color={colors.textPrimary} style={styles.metricValue}>
            {summary.focusHours}h
          </Text>
          <Text variant="caption" color={colors.textSecondary} style={styles.metricLabel}>
            Focus Hours
          </Text>
        </View>

        <View style={styles.metricDivider} />

        {/* Metric 2: Places */}
        <View style={styles.metricCell}>
          <Text variant="hero" color={colors.textPrimary} style={styles.metricValue}>
            {summary.placesCount}
          </Text>
          <Text variant="caption" color={colors.textSecondary} style={styles.metricLabel}>
            Places Visited
          </Text>
        </View>

        <View style={styles.metricDivider} />

        {/* Metric 3: Meals */}
        <View style={styles.metricCell}>
          <Text variant="hero" color={colors.textPrimary} style={styles.metricValue}>
            {summary.mealsCount}
          </Text>
          <Text variant="caption" color={colors.textSecondary} style={styles.metricLabel}>
            Meals Logged
          </Text>
        </View>
      </View>

      {/* Auto-Tracking Device Sync Footer */}
      <View style={styles.footerRow}>
        <Text variant="caption" color={colors.textMuted} style={styles.syncText}>
          Auto-Tracking: GPS & Device Sensors Connected
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F1F5F9',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  footerRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    alignItems: 'center',
  },
  syncText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
