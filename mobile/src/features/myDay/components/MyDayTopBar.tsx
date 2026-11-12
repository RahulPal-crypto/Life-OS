import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface MyDayTopBarProps {
  onBack: () => void;
  onCalendarPress?: () => void;
}

export const MyDayTopBar: React.FC<MyDayTopBarProps> = ({
  onBack,
  onCalendarPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Left Group: Back Arrow + My Day Title */}
      <View style={styles.leftGroup}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <Text variant="hero" color="#1E1B4B" style={styles.title}>
          My Day
        </Text>
      </View>

      {/* Right Calendar Action */}
      <Pressable
        onPress={onCalendarPress}
        style={({ pressed }) => [
          styles.calendarButton,
          pressed && styles.pressed,
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.calendarIcon}>📅</Text>
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
  iconButton: {
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
  calendarButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  calendarIcon: {
    fontSize: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
