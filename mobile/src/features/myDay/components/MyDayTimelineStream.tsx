import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

export interface TimelineEventItem {
  id: string;
  time: string;
  icon: string;
  title: string;
  subtitle: string;
}

interface MyDayTimelineStreamProps {
  events: TimelineEventItem[];
  onViewAll?: () => void;
  onItemPress?: (item: TimelineEventItem) => void;
}

const getIconBgColor = (icon: string) => {
  if (icon === '☀️') return '#FEF3C7'; // warm yellow
  if (icon === '🍴') return '#FFEDD5'; // peach
  if (icon === '📖') return '#E0F2FE'; // light blue
  if (icon === '💻') return '#DCFCE7'; // light green
  if (icon === '📍') return '#FFE4E6'; // rose
  if (icon === '💬') return '#F3E8FF'; // violet
  return '#F5F3FF';
};

export const MyDayTimelineStream: React.FC<MyDayTimelineStreamProps> = ({
  events = [],
  onViewAll,
  onItemPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text variant="h3" color="#1E1B4B" style={styles.sectionTitle}>
          My Day Timeline
        </Text>

        {events.length > 0 && (
          <Pressable onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text variant="caption" color="#7C3AED" style={styles.viewAllText}>
              View All ({events.length})
            </Text>
          </Pressable>
        )}
      </View>

      {/* When no activities are logged yet for this day */}
      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptySproutIcon}>🌱</Text>
          </View>
          <Text variant="h3" color="#1E1B4B" style={styles.emptyTitle}>
            No activities logged yet
          </Text>
          <Text variant="caption" color="#6B7280" align="center" style={styles.emptySubtitle}>
            Capture your meals, study sessions, workouts, and places by tapping the + button below.
          </Text>
        </View>
      ) : (
        /* Connected Stream Items */
        <View style={styles.streamList}>
          {events.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === events.length - 1;

            return (
              <View key={item.id} style={styles.streamItemRow}>
                {/* Left Column: Continuous Line + Purple Node */}
                <View style={styles.trackColumn}>
                  {!isFirst && <View style={styles.trackLineTop} />}
                  <View style={styles.purpleNode} />
                  {!isLast && <View style={styles.trackLineBottom} />}
                </View>

                {/* Time Column */}
                <View style={styles.timeColumn}>
                  <Text
                    variant="caption"
                    numberOfLines={1}
                    style={styles.timeText}
                  >
                    {item.time}
                  </Text>
                </View>

                {/* Right Event Card */}
                <Pressable
                  onPress={() => onItemPress && onItemPress(item)}
                  style={({ pressed }) => [
                    styles.eventCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={[styles.eventIconBox, { backgroundColor: getIconBgColor(item.icon) }]}>
                    <Text style={styles.eventIcon}>{item.icon}</Text>
                  </View>

                  <View style={styles.eventDetails}>
                    <Text
                      variant="caption"
                      color="#1E1B4B"
                      numberOfLines={1}
                      style={styles.eventTitle}
                    >
                      {item.title}
                    </Text>
                    <Text
                      variant="caption"
                      color="#6B7280"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={styles.eventSubtitle}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm + 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  streamList: {
    marginTop: 2,
  },
  streamItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm + 2,
    minHeight: 56,
  },
  /* Continuous Line Track */
  trackColumn: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    position: 'relative',
    marginRight: 6,
  },
  trackLineTop: {
    position: 'absolute',
    top: 0,
    bottom: '50%',
    width: 2,
    backgroundColor: '#DDD6FE',
  },
  trackLineBottom: {
    position: 'absolute',
    top: '50%',
    bottom: -10,
    width: 2,
    backgroundColor: '#DDD6FE',
  },
  purpleNode: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
    zIndex: 2,
  },
  /* Time Column */
  timeColumn: {
    width: 58,
    justifyContent: 'center',
    marginRight: 4,
  },
  timeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.1,
  },
  /* Right Event Card */
  eventCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md - 2,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  eventIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  eventIcon: {
    fontSize: 17,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  eventSubtitle: {
    fontSize: 10.5,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'none',
  },
  /* Clean Empty State */
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    marginTop: spacing.xs,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptySproutIcon: {
    fontSize: 22,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    maxWidth: 260,
  },
});
