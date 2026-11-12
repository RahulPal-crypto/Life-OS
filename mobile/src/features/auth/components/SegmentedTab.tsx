import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

export type AuthMode = 'login' | 'register';

interface SegmentedTabProps {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
}

export const SegmentedTab: React.FC<SegmentedTabProps> = ({
  mode,
  onChangeMode,
}) => {
  const slideAnim = useRef(new Animated.Value(mode === 'login' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === 'login' ? 0 : 1,
      tension: 70,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [mode, slideAnim]);

  return (
    <View style={styles.container}>
      {/* Sliding Active Pill */}
      <Animated.View
        style={[
          styles.activeIndicator,
          {
            transform: [
              {
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [3, (SCREEN_WIDTH - 46) / 2 - 3],
                }),
              },
            ],
          },
        ]}
      />

      {/* Sign In Tab */}
      <Pressable
        onPress={() => onChangeMode('login')}
        style={styles.tabButton}
      >
        <Text
          variant="body"
          color={mode === 'login' ? '#0F172A' : '#64748B'}
          style={[styles.tabText, mode === 'login' && styles.tabTextActive]}
        >
          Sign In
        </Text>
      </Pressable>

      {/* Create Account Tab */}
      <Pressable
        onPress={() => onChangeMode('register')}
        style={styles.tabButton}
      >
        <Text
          variant="body"
          color={mode === 'register' ? '#0F172A' : '#64748B'}
          style={[styles.tabText, mode === 'register' && styles.tabTextActive]}
        >
          Create Account
        </Text>
      </Pressable>
    </View>
  );
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    padding: 3,
    height: 44,
    position: 'relative',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  activeIndicator: {
    position: 'absolute',
    width: (SCREEN_WIDTH - 46) / 2 - 3,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.sm + 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
});
