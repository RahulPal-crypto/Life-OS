import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing } from '../../../theme';
import { Text, ScreenContainer } from '../../../components';
import { SpaceCard } from '../components/SpaceCard';
import { appConfig } from '../../../config/appConfig';

interface SpaceSelectionScreenProps {
  onSelectPersonalSpace?: () => void;
  onSelectFamilySpace?: () => void;
}

export const SpaceSelectionScreen: React.FC<SpaceSelectionScreenProps> = ({
  onSelectPersonalSpace,
  onSelectFamilySpace,
}) => {
  const [selectedSpace, setSelectedSpace] = useState<'personal' | 'family' | null>(null);

  // Staggered entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-10)).current;

  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateY = useRef(new Animated.Value(20)).current;

  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card2TranslateY = useRef(new Animated.Value(20)).current;

  const footerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card1Opacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(card1TranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card2Opacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(card2TranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    headerOpacity,
    headerTranslateY,
    card1Opacity,
    card1TranslateY,
    card2Opacity,
    card2TranslateY,
    footerOpacity,
  ]);

  const handlePersonalPress = () => {
    setSelectedSpace('personal');

    setTimeout(() => {
      if (onSelectPersonalSpace) {
        onSelectPersonalSpace();
      } else {
        Alert.alert(
          'Personal Space',
          'Entering Personal Space.',
          [
            {
              text: 'Continue',
              onPress: () => setSelectedSpace(null),
            },
          ]
        );
      }
    }, 240);
  };

  const handleFamilyPress = () => {
    setSelectedSpace('family');

    setTimeout(() => {
      if (onSelectFamilySpace) {
        onSelectFamilySpace();
      } else {
        Alert.alert(
          'Family Space',
          'Family Space is scheduled for Phase 2.\n\nPersonal Space is active.',
          [
            {
              text: 'OK',
              onPress: () => setSelectedSpace(null),
            },
          ]
        );
      }
    }, 240);
  };

  return (
    <ScreenContainer backgroundColor="#FAFAFC" barStyle="dark-content">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Architectural Clean Header */}
        <Animated.View
          style={[
            styles.headerSection,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <Text variant="caption" color={colors.primary} style={styles.kicker}>
            {appConfig.appName}
          </Text>
          <Text variant="hero" color={colors.textPrimary} style={styles.headingTitle}>
            Select Space
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.headingSubtitle}>
            Choose where you want to focus today.
          </Text>
        </Animated.View>

        {/* Space Cards */}
        <View style={styles.cardsContainer}>
          {/* Card 1: Personal */}
          <Animated.View
            style={{
              opacity: card1Opacity,
              transform: [{ translateY: card1TranslateY }],
            }}
          >
            <SpaceCard
              type="personal"
              index="01"
              title="Personal Space"
              tagline="Private daily logging, nutrition, focus hours, and personal memories."
              meta="Private • Encrypted"
              isSelected={selectedSpace === 'personal'}
              isDimmed={selectedSpace === 'family'}
              onPress={handlePersonalPress}
            />
          </Animated.View>

          {/* Card 2: Family */}
          <Animated.View
            style={{
              opacity: card2Opacity,
              transform: [{ translateY: card2TranslateY }],
            }}
          >
            <SpaceCard
              type="family"
              index="02"
              title="Family Space"
              tagline="Shared circles, family memories, and collaborative schedules."
              meta="Phase 2 • Preview"
              isSelected={selectedSpace === 'family'}
              isDimmed={selectedSpace === 'personal'}
              onPress={handleFamilyPress}
            />
          </Animated.View>
        </View>

        {/* Minimal Editorial Footer */}
        <Animated.View
          style={[
            styles.footerSection,
            { opacity: footerOpacity },
          ]}
        >
          <Text variant="caption" color={colors.textMuted} style={styles.creditText}>
            {appConfig.developerCredit}
          </Text>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
  },
  headerSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headingTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#0F172A',
    marginBottom: 4,
  },
  headingSubtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },
  cardsContainer: {
    marginVertical: spacing.xs,
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  creditText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#94A3B8',
  },
});
