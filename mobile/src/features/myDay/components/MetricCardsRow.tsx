import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface MetricCardsRowProps {
  studyHours?: number;
  workHours?: number;
  activeSteps?: number;
  sleepHours?: number;
}

export const MetricCardsRow: React.FC<MetricCardsRowProps> = ({
  studyHours = 4.5,
  workHours = 2.0,
  activeSteps = 6842,
  sleepHours = 7.2,
}) => {
  return (
    <View style={styles.container}>
      {/* 1. Study Card */}
      <View style={styles.card}>
        <Text style={styles.cardIcon}>📖</Text>
        <Text variant="caption" color="#6B7280" style={styles.cardLabel}>
          Study
        </Text>
        <Text
          variant="caption"
          color="#1E1B4B"
          numberOfLines={1}
          style={styles.cardValue}
        >
          {studyHours} hrs
        </Text>
      </View>

      {/* 2. Work Card */}
      <View style={styles.card}>
        <Text style={styles.cardIcon}>💻</Text>
        <Text variant="caption" color="#6B7280" style={styles.cardLabel}>
          Work
        </Text>
        <Text
          variant="caption"
          color="#1E1B4B"
          numberOfLines={1}
          style={styles.cardValue}
        >
          {workHours} hrs
        </Text>
      </View>

      {/* 3. Active Card (Highlighted in warm peach/orange tint matching reference) */}
      <View style={[styles.card, styles.cardActiveHighlighted]}>
        <Text style={styles.cardIcon}>🏃</Text>
        <Text variant="caption" color="#EA580C" style={[styles.cardLabel, styles.activeLabel]}>
          Active
        </Text>
        <Text
          variant="caption"
          color="#9A3412"
          numberOfLines={1}
          style={[styles.cardValue, styles.activeValue]}
        >
          {activeSteps.toLocaleString()} steps
        </Text>
      </View>

      {/* 4. Sleep Card */}
      <View style={styles.card}>
        <Text style={styles.cardIcon}>🌙</Text>
        <Text variant="caption" color="#6B7280" style={styles.cardLabel}>
          Sleep
        </Text>
        <Text
          variant="caption"
          color="#1E1B4B"
          numberOfLines={1}
          style={styles.cardValue}
        >
          {sleepHours} hrs
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: 2,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardActiveHighlighted: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  cardIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  activeLabel: {
    color: '#EA580C',
  },
  cardValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  activeValue: {
    color: '#9A3412',
    fontWeight: '900',
  },
});
