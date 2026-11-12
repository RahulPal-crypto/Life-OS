import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import { colors, spacing } from '../../../theme';
import { Text, ScreenContainer } from '../../../components';
import { appConfig } from '../../../config/appConfig';
import { images } from '../../../assets';

interface WelcomeScreenProps {
  onAnimationComplete?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onAnimationComplete,
}) => {
  // Animation drivers
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.7)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const titleTranslateY = useRef(new Animated.Value(25)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  const taglineTranslateY = useRef(new Animated.Value(15)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  const creditOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Logo Zoom-in + Glow
    const logoAnimation = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 750,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 35,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.spring(glowScale, {
        toValue: 1.2,
        tension: 30,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);

    // 2. "Welcome to LIFE OS" slide-up from bottom
    const titleAnimation = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    // 3. Tagline "Your Life. Your World. One Place."
    const taglineAnimation = Animated.parallel([
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(taglineTranslateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    // 4. Bottom "Developed by Rahul Pal" elegant fade-in
    const creditAnimation = Animated.timing(creditOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    });

    // Run choreographed sequence
    const sequence = Animated.sequence([
      Animated.delay(200), // Clean initial screen rest
      logoAnimation,
      Animated.delay(100),
      titleAnimation,
      Animated.delay(100),
      taglineAnimation,
      Animated.delay(150),
      creditAnimation,
      Animated.delay(1200), // Hold view so user smoothly perceives the entire screen
    ]);

    sequence.start(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    });

    return () => {
      sequence.stop();
    };
  }, [
    logoScale,
    logoOpacity,
    glowScale,
    glowOpacity,
    titleTranslateY,
    titleOpacity,
    taglineTranslateY,
    taglineOpacity,
    creditOpacity,
    onAnimationComplete,
  ]);

  return (
    <ScreenContainer backgroundColor={colors.background} barStyle="dark-content">
      <View style={styles.container}>
        {/* Center Content: Animated Logo, Title & Tagline */}
        <View style={styles.centerSection}>
          {/* Animated Official Logo with Glow */}
          <View style={styles.logoWrapper}>
            <Animated.View
              style={[
                styles.glowCircle,
                {
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.logoCard,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Animated.Image
                source={images.logo}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </Animated.View>
          </View>

          {/* Animated "Welcome to LIFE OS" */}
          <Animated.View
            style={[
              styles.textBlock,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            <Text
              variant="hero"
              color={colors.textPrimary}
              align="center"
              style={styles.titleText}
            >
              {appConfig.welcomeTitle}
            </Text>
          </Animated.View>

          {/* Animated Tagline */}
          <Animated.View
            style={[
              styles.taglineBlock,
              {
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslateY }],
              },
            ]}
          >
            <Text
              variant="body"
              color={colors.textSecondary}
              align="center"
              style={styles.taglineText}
            >
              {appConfig.tagline}
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Section: Developed by Rahul Pal */}
        <Animated.View
          style={[
            styles.bottomSection,
            {
              opacity: creditOpacity,
            },
          ]}
        >
          <View style={styles.creditRow}>
            <View style={styles.creditDot} />
            <Text
              variant="caption"
              color={colors.creditText}
              style={styles.creditLabel}
            >
              Developed by
            </Text>
            <Text
              variant="caption"
              color={colors.creditHighlight}
              style={styles.developerName}
            >
              {appConfig.developer.name}
            </Text>
          </View>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoWrapper: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  glowCircle: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  logoCard: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  textBlock: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleText: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.textPrimary,
  },
  taglineBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  taglineText: {
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  bottomSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: '#F1F5F9', // light pill badge
  },
  creditDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  creditLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 4,
    letterSpacing: 0.3,
    textTransform: 'none',
  },
  developerName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'none',
  },
});
