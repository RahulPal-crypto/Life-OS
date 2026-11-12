import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

export const DaySnapshotBanner: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.bannerCard}>
        {/* Sky Background */}
        <View style={styles.skyLayer}>
          <View style={styles.sunGlow}>
            <View style={styles.sunCore} />
          </View>
        </View>

        {/* Scenic Ridge Layers */}
        <View style={[styles.ridgeLayer, styles.ridgeFar]} />
        <View style={[styles.ridgeLayer, styles.ridgeNear]} />

        {/* Meditating / Sitting Person Silhouette on Peak */}
        <View style={styles.personContainer}>
          <View style={styles.cliffRock} />
          <View style={styles.personHead} />
          <View style={styles.personBody} />
        </View>

        {/* Text Content */}
        <View style={styles.contentOverlay}>
          <Text variant="h2" color="#1E1B4B" style={styles.title}>
            A snapshot of your day
          </Text>
          <Text variant="bodySmall" color="#4B5563" style={styles.subtitle}>
            Your activities, habits, and moments in one place.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  bannerCard: {
    height: 110,
    borderRadius: borderRadius.lg + 2,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FED7AA',
    borderWidth: 1,
    borderColor: '#FED7AA',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  skyLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FDE68A', // Sunset glow amber/peach
  },
  sunGlow: {
    position: 'absolute',
    right: 80,
    top: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(251, 146, 60, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F97316',
    shadowColor: '#F97316',
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  ridgeLayer: {
    position: 'absolute',
    bottom: -15,
    left: -20,
    right: -20,
    height: 65,
  },
  ridgeFar: {
    backgroundColor: 'rgba(168, 85, 247, 0.55)', // Purple distant ridge
    borderTopLeftRadius: 120,
    borderTopRightRadius: 100,
    transform: [{ rotate: '-3deg' }],
    bottom: -10,
  },
  ridgeNear: {
    backgroundColor: '#7E22CE', // Deep twilight purple near mountain
    borderTopLeftRadius: 140,
    borderTopRightRadius: 160,
    bottom: -20,
  },
  personContainer: {
    position: 'absolute',
    right: 22,
    bottom: 10,
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 4,
  },
  cliffRock: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 10,
    backgroundColor: '#3B0764',
  },
  personHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E1B4B',
    marginBottom: 2,
    zIndex: 5,
  },
  personBody: {
    width: 16,
    height: 18,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#1E1B4B',
    zIndex: 5,
  },
  contentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '65%',
    padding: spacing.md + 2,
    justifyContent: 'center',
    zIndex: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E1B4B',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
    color: '#4B5563',
    fontWeight: '500',
  },
});
