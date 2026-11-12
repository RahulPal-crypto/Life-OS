import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing } from '../../../theme';
import { Text } from '../../../components';

export type MainTab = 'my-day' | 'memories' | 'settings';

interface BottomNavBarProps {
  activeTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onChangeTab,
}) => {
  return (
    <View style={styles.container}>
      {/* Tab 1: My Day */}
      <Pressable
        onPress={() => onChangeTab('my-day')}
        style={styles.tabButton}
      >
        <Text
          variant="caption"
          color={activeTab === 'my-day' ? '#0F172A' : '#94A3B8'}
          style={[styles.tabLabel, activeTab === 'my-day' && styles.tabLabelActive]}
        >
          My Day
        </Text>
        {activeTab === 'my-day' && <View style={styles.activeDot} />}
      </Pressable>

      {/* Tab 2: Memories */}
      <Pressable
        onPress={() => onChangeTab('memories')}
        style={styles.tabButton}
      >
        <Text
          variant="caption"
          color={activeTab === 'memories' ? '#0F172A' : '#94A3B8'}
          style={[styles.tabLabel, activeTab === 'memories' && styles.tabLabelActive]}
        >
          Memories
        </Text>
        {activeTab === 'memories' && <View style={styles.activeDot} />}
      </Pressable>

      {/* Tab 3: Settings */}
      <Pressable
        onPress={() => onChangeTab('settings')}
        style={styles.tabButton}
      >
        <Text
          variant="caption"
          color={activeTab === 'settings' ? '#0F172A' : '#94A3B8'}
          style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}
        >
          Settings
        </Text>
        {activeTab === 'settings' && <View style={styles.activeDot} />}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    fontWeight: '800',
    color: '#0F172A',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
});
