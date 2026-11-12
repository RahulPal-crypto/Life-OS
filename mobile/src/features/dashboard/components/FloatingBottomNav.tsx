import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

export type DashboardNavTab = 'home' | 'my-day' | 'action' | 'memories' | 'profile';

interface FloatingBottomNavProps {
  activeTab: DashboardNavTab;
  onChangeTab: (tab: DashboardNavTab) => void;
  onCenterActionPress?: () => void;
}

export const FloatingBottomNav: React.FC<FloatingBottomNavProps> = ({
  activeTab,
  onChangeTab,
  onCenterActionPress,
}) => {
  return (
    <View style={styles.outerContainer}>
      <View style={styles.navBar}>
        {/* Tab 1: Home */}
        <Pressable
          onPress={() => onChangeTab('home')}
          style={styles.navItem}
        >
          <Text style={[styles.navIcon, activeTab === 'home' && styles.iconActive]}>
            🏠
          </Text>
          <Text
            variant="caption"
            color={activeTab === 'home' ? '#7C3AED' : '#9CA3AF'}
            style={[styles.navLabel, activeTab === 'home' && styles.labelActive]}
          >
            Home
          </Text>
        </Pressable>

        {/* Tab 2: My Day */}
        <Pressable
          onPress={() => onChangeTab('my-day')}
          style={styles.navItem}
        >
          <Text style={[styles.navIcon, activeTab === 'my-day' && styles.iconActive]}>
            📅
          </Text>
          <Text
            variant="caption"
            color={activeTab === 'my-day' ? '#7C3AED' : '#9CA3AF'}
            style={[styles.navLabel, activeTab === 'my-day' && styles.labelActive]}
          >
            My Day
          </Text>
        </Pressable>

        {/* Center Elevated Floating Plus Button */}
        <Pressable
          onPress={onCenterActionPress}
          style={({ pressed }) => [
            styles.centerButton,
            pressed && styles.centerButtonPressed,
          ]}
        >
          <View style={styles.centerButtonInner}>
            <Text style={styles.centerPlusIcon}>＋</Text>
          </View>
        </Pressable>

        {/* Tab 4: Memories */}
        <Pressable
          onPress={() => onChangeTab('memories')}
          style={styles.navItem}
        >
          <Text style={[styles.navIcon, activeTab === 'memories' && styles.iconActive]}>
            🖼️
          </Text>
          <Text
            variant="caption"
            color={activeTab === 'memories' ? '#7C3AED' : '#9CA3AF'}
            style={[styles.navLabel, activeTab === 'memories' && styles.labelActive]}
          >
            Memories
          </Text>
        </Pressable>

        {/* Tab 5: Profile */}
        <Pressable
          onPress={() => onChangeTab('profile')}
          style={styles.navItem}
        >
          <Text style={[styles.navIcon, activeTab === 'profile' && styles.iconActive]}>
            👤
          </Text>
          <Text
            variant="caption"
            color={activeTab === 'profile' ? '#7C3AED' : '#9CA3AF'}
            style={[styles.navLabel, activeTab === 'profile' && styles.labelActive]}
          >
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  navBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.65,
  },
  iconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelActive: {
    fontWeight: '800',
  },
  centerButton: {
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  centerButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#F4F0FA',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  centerPlusIcon: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 28,
  },
});
