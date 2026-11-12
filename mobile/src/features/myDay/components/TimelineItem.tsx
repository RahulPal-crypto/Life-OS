import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';
import { TimelineEntry, ActivityCategory } from '../services/timelineService';

interface TimelineItemProps {
  entry: TimelineEntry;
  isLast?: boolean;
}

const getCategoryBadge = (category: ActivityCategory) => {
  switch (category) {
    case 'focus':
      return { label: 'FOCUS', color: '#4F46E5', bg: 'rgba(79, 70, 229, 0.08)' };
    case 'meal':
      return { label: 'MEAL', color: '#059669', bg: 'rgba(5, 150, 105, 0.08)' };
    case 'place':
      return { label: 'LOCATION', color: '#0284C7', bg: 'rgba(2, 132, 199, 0.08)' };
    case 'social':
      return { label: 'CALL / MEET', color: '#D97706', bg: 'rgba(217, 119, 6, 0.08)' };
    case 'note':
    default:
      return { label: 'NOTE', color: '#475569', bg: 'rgba(71, 85, 105, 0.08)' };
  }
};

export const TimelineItem: React.FC<TimelineItemProps> = ({ entry, isLast = false }) => {
  const badge = getCategoryBadge(entry.category);

  return (
    <View style={styles.container}>
      {/* Left Time & Vertical Line Column */}
      <View style={styles.timeColumn}>
        <Text variant="caption" color={colors.textSecondary} style={styles.timeText}>
          {entry.time}
        </Text>
        <View style={styles.bulletNode} />
        {!isLast && <View style={styles.verticalTrack} />}
      </View>

      {/* Right Content Card */}
      <View style={styles.contentCard}>
        {/* Category Header Row */}
        <View style={styles.categoryRow}>
          <View style={[styles.categoryBadge, { backgroundColor: badge.bg }]}>
            <Text
              variant="caption"
              color={badge.color}
              style={styles.categoryLabel}
            >
              {badge.label}
            </Text>
          </View>

          {entry.isAutoTracked && (
            <View style={styles.autoBadge}>
              <Text variant="caption" color={colors.textMuted} style={styles.autoText}>
                Auto-detected
              </Text>
            </View>
          )}
        </View>

        {/* Title & Details */}
        <Text variant="h3" color={colors.textPrimary} style={styles.entryTitle}>
          {entry.title}
        </Text>

        {entry.details ? (
          <Text variant="bodySmall" color={colors.textSecondary} style={styles.entryDetails}>
            {entry.details}
          </Text>
        ) : null}

        {/* Meta Pill */}
        {entry.meta ? (
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text variant="caption" color={colors.textSecondary} style={styles.metaText}>
                {entry.meta}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timeColumn: {
    width: 72,
    alignItems: 'flex-end',
    paddingRight: spacing.md,
    position: 'relative',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#64748B',
    marginTop: 2,
  },
  bulletNode: {
    position: 'absolute',
    right: -4,
    top: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  verticalTrack: {
    position: 'absolute',
    right: 0,
    top: 15,
    bottom: -spacing.md,
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginLeft: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  autoBadge: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
  },
  autoText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    color: '#0F172A',
  },
  entryDetails: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  metaPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
});
