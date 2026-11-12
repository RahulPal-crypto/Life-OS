import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

export interface ModuleItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  isPrimary?: boolean;
}

interface PersonalSpaceGridProps {
  onSelectModule: (moduleId: string) => void;
}

export const PersonalSpaceGrid: React.FC<PersonalSpaceGridProps> = ({
  onSelectModule,
}) => {
  const modules: ModuleItem[] = [
    {
      id: 'my-day',
      title: 'My Day',
      subtitle: 'Your daily life',
      icon: '📅',
      isPrimary: true,
    },
    {
      id: 'my-memories',
      title: 'My Memories',
      subtitle: 'Photos & videos',
      icon: '🖼️',
    },
    {
      id: 'my-interview',
      title: 'My Interview',
      subtitle: 'Prepare & practice',
      icon: '🎙️',
    },
    {
      id: 'my-ai',
      title: 'My AI',
      subtitle: 'Your personal AI',
      icon: '✨',
    },
    {
      id: 'my-finance',
      title: 'My Finance',
      subtitle: 'Income & expenses',
      icon: '👛',
    },
    {
      id: 'my-learning',
      title: 'My Learning',
      subtitle: 'Courses & study',
      icon: '🎓',
    },
    {
      id: 'my-knowledge',
      title: 'My Knowledge',
      subtitle: 'Notes & resources',
      icon: '📖',
    },
    {
      id: 'my-places',
      title: 'My Places',
      subtitle: 'Visited & saved',
      icon: '📍',
    },
    {
      id: 'my-connect',
      title: 'My Connect',
      subtitle: 'Chat & calls',
      icon: '💬',
    },
    {
      id: 'my-vault',
      title: 'My Vault',
      subtitle: 'Passwords & files',
      icon: '🔒',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text style={styles.userIcon}>👤</Text>
        <Text variant="h3" color={colors.textPrimary} style={styles.sectionTitle}>
          Personal Space
        </Text>
      </View>

      {/* 3-Column Grid */}
      <View style={styles.grid}>
        {modules.map(item => (
          <Pressable
            key={item.id}
            onPress={() => onSelectModule(item.id)}
            style={({ pressed }) => [
              styles.moduleCard,
              item.isPrimary && styles.moduleCardPrimary,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.moduleIcon}>{item.icon}</Text>
            </View>

            <Text
              variant="caption"
              color={colors.textPrimary}
              numberOfLines={1}
              style={styles.moduleTitle}
            >
              {item.title}
            </Text>

            <Text
              variant="caption"
              color={colors.textSecondary}
              numberOfLines={2}
              style={styles.moduleSubtitle}
            >
              {item.subtitle}
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
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  userIcon: {
    fontSize: 16,
    marginRight: 6,
    color: '#7C3AED',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moduleCard: {
    width: '31.5%',
    minHeight: 102,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.xs + 3,
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleCardPrimary: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    marginBottom: spacing.xs,
  },
  moduleIcon: {
    fontSize: 22,
  },
  moduleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  moduleSubtitle: {
    fontSize: 9.5,
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0,
    textTransform: 'none',
  },
});
