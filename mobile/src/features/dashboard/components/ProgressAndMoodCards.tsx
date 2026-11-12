import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface ProgressAndMoodCardsProps {
  progressPercentage?: number;
  studyHours?: number;
  workHours?: number;
  otherHours?: number;
  mood?: string;
  onMoodPress?: () => void;
}

export const ProgressAndMoodCards: React.FC<ProgressAndMoodCardsProps> = ({
  progressPercentage = 78,
  studyHours = 4.5,
  workHours = 2.0,
  otherHours = 3.0,
  mood = 'Productive',
  onMoodPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Card 1: Today's Progress */}
      <View style={styles.progressCard}>
        <Text variant="caption" color={colors.textPrimary} style={styles.cardHeader}>
          Today's Progress
        </Text>

        <View style={styles.progressContentRow}>
          {/* Circular Ring Gauge */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeOuterRing}>
              <View style={styles.gaugeProgressArc} />
              <View style={styles.gaugeInnerCutout}>
                <Text variant="h3" color={colors.textPrimary} style={styles.percentText}>
                  {progressPercentage}%
                </Text>
              </View>
            </View>
          </View>

          {/* Legend Items */}
          <View style={styles.legendColumn}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
              <Text
                variant="caption"
                color={colors.textSecondary}
                numberOfLines={1}
                style={styles.legendLabel}
              >
                Study
              </Text>
              <Text
                variant="caption"
                color={colors.textPrimary}
                numberOfLines={1}
                style={styles.legendValue}
              >
                {studyHours} hrs
              </Text>
            </View>

            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
              <Text
                variant="caption"
                color={colors.textSecondary}
                numberOfLines={1}
                style={styles.legendLabel}
              >
                Work
              </Text>
              <Text
                variant="caption"
                color={colors.textPrimary}
                numberOfLines={1}
                style={styles.legendValue}
              >
                {workHours} hrs
              </Text>
            </View>

            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
              <Text
                variant="caption"
                color={colors.textSecondary}
                numberOfLines={1}
                style={styles.legendLabel}
              >
                Other
              </Text>
              <Text
                variant="caption"
                color={colors.textPrimary}
                numberOfLines={1}
                style={styles.legendValue}
              >
                {otherHours} hrs
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Card 2: Today's Mood */}
      <Pressable
        onPress={onMoodPress}
        style={({ pressed }) => [
          styles.moodCard,
          pressed && styles.cardPressed,
        ]}
      >
        <Text variant="caption" color={colors.textPrimary} style={styles.cardHeader}>
          Today's Mood
        </Text>

        <View style={styles.moodCenter}>
          <Text style={styles.moodEmoji}>😊</Text>
          <View style={styles.moodPill}>
            <Text
              variant="caption"
              color="#15803D"
              numberOfLines={1}
              style={styles.moodText}
            >
              {mood}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  /* Today's Progress Card */
  progressCard: {
    flex: 1.75,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
    color: '#1E1B4B',
  },
  progressContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gaugeContainer: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeOuterRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 6,
    borderColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeProgressArc: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 6,
    borderColor: '#10B981',
    borderTopColor: '#38BDF8',
    borderRightColor: '#8B5CF6',
    transform: [{ rotate: '45deg' }],
  },
  gaugeInnerCutout: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: '#0F172A',
  },
  legendColumn: {
    flex: 1,
    paddingLeft: spacing.sm,
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
  legendValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E1B4B',
    flexShrink: 0,
  },
  /* Today's Mood Card */
  moodCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPressed: {
    opacity: 0.85,
  },
  moodCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  moodEmoji: {
    fontSize: 34,
    marginBottom: 6,
  },
  moodPill: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: borderRadius.round,
  },
  moodText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
