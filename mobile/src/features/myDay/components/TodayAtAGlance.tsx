import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface TodayAtAGlanceProps {
  mealsCount?: number;
  conversationsCount?: number;
  placesCount?: number;
  activitiesCount?: number;
  onMealsPress?: () => void;
  onConversationsPress?: () => void;
  onPlacesPress?: () => void;
  onActivitiesPress?: () => void;
}

export const TodayAtAGlance: React.FC<TodayAtAGlanceProps> = ({
  mealsCount = 3,
  conversationsCount = 5,
  placesCount = 3,
  activitiesCount = 6,
  onMealsPress,
  onConversationsPress,
  onPlacesPress,
  onActivitiesPress,
}) => {
  const items = [
    {
      id: 'meals',
      icon: '🍴',
      iconBg: '#FFF7ED',
      title: 'Meals',
      subtitle: 'Breakfast, Lunch, Dinner, Snacks',
      badge: `${mealsCount} logged`,
      onPress: onMealsPress,
    },
    {
      id: 'conversations',
      icon: '💬',
      iconBg: '#F0FDF4',
      title: 'Conversations',
      subtitle: 'Family, Friends, Team',
      badge: `${conversationsCount} people`,
      onPress: onConversationsPress,
    },
    {
      id: 'places',
      icon: '📍',
      iconBg: '#FFF1F2',
      title: 'Places',
      subtitle: 'Home, Office, Cafe',
      badge: `${placesCount} places`,
      onPress: onPlacesPress,
    },
    {
      id: 'activities',
      icon: '☑️',
      iconBg: '#FAF5FF',
      title: 'Activities',
      subtitle: 'Work, Study, Project, Other',
      badge: `${activitiesCount} activities`,
      onPress: onActivitiesPress,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text variant="h3" color="#1E1B4B" style={styles.sectionHeader}>
        Today at a Glance
      </Text>

      {/* Grouped White Card */}
      <View style={styles.groupedCard}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.itemRow,
                !isLast && styles.itemDivider,
                pressed && styles.itemPressed,
              ]}
            >
              {/* Left Squircle Icon */}
              <View style={[styles.iconContainer, { backgroundColor: item.iconBg }]}>
                <Text style={styles.itemIcon}>{item.icon}</Text>
              </View>

              {/* Title & Subtitle */}
              <View style={styles.textContainer}>
                <Text variant="caption" color="#1E1B4B" style={styles.itemTitle}>
                  {item.title}
                </Text>
                <Text
                  variant="caption"
                  color="#6B7280"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.itemSubtitle}
                >
                  {item.subtitle}
                </Text>
              </View>

              {/* Right Pill Badge & Chevron */}
              <View style={styles.badgeContainer}>
                <View style={styles.badgePill}>
                  <Text variant="caption" color="#7C3AED" style={styles.badgeText}>
                    {item.badge}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: spacing.sm,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
  },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3FF',
  },
  itemPressed: {
    backgroundColor: '#F8F6FF',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 4,
  },
  itemIcon: {
    fontSize: 17,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.xs,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 10.5,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'none',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgePill: {
    backgroundColor: '#EDE9FE',
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.round,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.1,
    textTransform: 'none',
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
    lineHeight: 22,
  },
});
