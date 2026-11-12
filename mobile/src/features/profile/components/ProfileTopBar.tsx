import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { spacing } from '../../../theme';
import { Text } from '../../../components';

interface ProfileTopBarProps {
  onBack: () => void;
  onEditPress: () => void;
}

export const ProfileTopBar: React.FC<ProfileTopBarProps> = ({
  onBack,
  onEditPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <Text variant="hero" color="#1E1B4B" style={styles.title}>
          Profile
        </Text>
      </View>

      <Pressable
        onPress={onEditPress}
        style={({ pressed }) => [styles.editPill, pressed && styles.pressed]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text variant="caption" color="#6D28D9" style={styles.editText}>
          Edit
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: '#1E1B4B',
  },
  editPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.72,
  },
});
