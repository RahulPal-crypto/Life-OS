import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface SpaceCardProps {
  type: 'personal' | 'family';
  index: string;
  title: string;
  tagline: string;
  meta: string;
  isSelected?: boolean;
  isDimmed?: boolean;
  onPress: () => void;
}

export const SpaceCard: React.FC<SpaceCardProps> = ({
  type,
  index,
  title,
  tagline,
  meta,
  isSelected = false,
  isDimmed = false,
  onPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dimAnim = useRef(new Animated.Value(1)).current;
  const isPersonal = type === 'personal';

  useEffect(() => {
    Animated.timing(dimAnim, {
      toValue: isDimmed ? 0.45 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isDimmed, dimAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: dimAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          isSelected && styles.cardSelected,
        ]}
      >
        {/* Top Header: Index & Geometric Art */}
        <View style={styles.topRow}>
          <Text variant="caption" color={colors.textMuted} style={styles.indexText}>
            {index}
          </Text>

          {/* Minimalist Architectural Line Art (Human Crafted, No Emojis) */}
          <View style={styles.geometricIcon}>
            {isPersonal ? (
              /* Precision Horizon Glyph */
              <View style={styles.personalGlyph}>
                <View style={styles.horizonSunDisc} />
                <View style={styles.horizonLine} />
              </View>
            ) : (
              /* Precision Interlocking Rings */
              <View style={styles.familyGlyph}>
                <View style={[styles.ring, styles.ringLeft]} />
                <View style={[styles.ring, styles.ringRight]} />
              </View>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          <Text variant="h2" color={colors.textPrimary} style={styles.titleText}>
            {title}
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.taglineText}>
            {tagline}
          </Text>
        </View>

        {/* Bottom Metadata & Arrow Indicator */}
        <View style={styles.bottomRow}>
          <View style={styles.metaBadge}>
            <Text variant="caption" color={colors.textSecondary} style={styles.metaText}>
              {meta}
            </Text>
          </View>

          <View style={[styles.arrowPill, isSelected && styles.arrowPillActive]}>
            <Text style={[styles.arrowGlyph, isSelected && styles.arrowGlyphActive]}>
              {isSelected ? '✓' : '→'}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  indexText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  geometricIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Personal Precision Glyph */
  personalGlyph: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  horizonSunDisc: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: colors.primary,
    marginBottom: 2,
  },
  horizonLine: {
    width: 22,
    height: 1.5,
    backgroundColor: '#0F172A',
    borderRadius: 1,
  },
  /* Family Precision Glyph */
  familyGlyph: {
    width: 28,
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    position: 'absolute',
  },
  ringLeft: {
    borderColor: '#0F172A',
    left: 2,
  },
  ringRight: {
    borderColor: colors.primary,
    right: 2,
  },
  contentSection: {
    marginBottom: spacing.md,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  taglineText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.sm,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  arrowPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  arrowGlyph: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  arrowGlyphActive: {
    color: '#FFFFFF',
  },
});
