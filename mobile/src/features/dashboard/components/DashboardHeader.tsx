import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';
import { parseAvatar } from '../../profile/utils/avatarHelper';

interface DashboardHeaderProps {
  userName: string;
  profileImage?: string | null;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  profileImage,
  onNotificationPress,
  onProfilePress,
}) => {
  const avatar = parseAvatar(profileImage, userName);
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const firstName = userName ? userName.split(' ')[0] : 'Rahul';

  return (
    <View style={styles.container}>
      {/* 1. Top Navbar: Brand & Actions */}
      <View style={styles.navRow}>
        {/* Brand: Sprout Icon + LIFE OS */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.sproutIcon}>🌱</Text>
          </View>
          <Text variant="h2" color={colors.primary} style={styles.brandTitle}>
            LIFE OS
          </Text>
        </View>

        {/* Right Actions: Bell + User Avatar */}
        <View style={styles.rightActions}>
          <Pressable
            onPress={onNotificationPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.bellIcon}>🔔</Text>
          </Pressable>

          <Pressable
            onPress={onProfilePress}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.avatarCircle}>
              {avatar.kind === 'image' ? (
                <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
              ) : avatar.kind === 'emoji' ? (
                <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
              ) : (
                <Text style={styles.avatarInitials}>{avatar.initials}</Text>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      {/* 2. Editorial Greeting Block (Above Banner matching mockup) */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingRow}>
          <Text variant="hero" color="#1E1B4B" style={styles.greetingText}>
            {getGreeting()}, {firstName}
          </Text>
          <Text style={styles.waveHand}> 👋</Text>
        </View>
        <Text variant="body" color="#6B7280" style={styles.subGreetingText}>
          Welcome to your Personal Space
        </Text>
      </View>

      {/* 3. Scenic Sunset Mountain Landscape Banner */}
      <View style={styles.scenicBanner}>
        {/* Sky Background */}
        <View style={styles.skyBackground}>
          <View style={styles.sunGlow}>
            <View style={styles.sunCore} />
          </View>
        </View>

        {/* Layered Mountain Silhouettes */}
        <View style={[styles.mountainLayer, styles.mountainFar]} />
        <View style={[styles.mountainLayer, styles.mountainMid]} />
        <View style={[styles.mountainLayer, styles.mountainNear]} />

        {/* Pine Trees Silhouette Accent */}
        <View style={styles.treesRow}>
          <View style={[styles.treeSilhouette, { height: 18, left: 24 }]} />
          <View style={[styles.treeSilhouette, { height: 24, left: 32 }]} />
          <View style={[styles.treeSilhouette, { height: 20, left: 42 }]} />
          <View style={[styles.treeSilhouette, { height: 16, right: 36 }]} />
          <View style={[styles.treeSilhouette, { height: 22, right: 48 }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm + 4,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sproutIcon: {
    fontSize: 18,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#4C1D95',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  bellIcon: {
    fontSize: 16,
  },
  avatarButton: {
    padding: 2,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarEmoji: {
    fontSize: 18,
  },
  /* Greeting Section */
  greetingSection: {
    marginBottom: spacing.sm + 2,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 23,
    fontWeight: '900',
    color: '#1E1B4B',
    letterSpacing: -0.4,
  },
  waveHand: {
    fontSize: 20,
  },
  subGreetingText: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
    color: '#6B7280',
  },
  /* Scenic Sunset Mountain Banner */
  scenicBanner: {
    height: 96,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#3B0764',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  skyBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#581C87',
  },
  sunGlow: {
    position: 'absolute',
    top: 10,
    right: 56,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(251, 191, 36, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunCore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FDE047',
    shadowColor: '#FDE047',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  mountainLayer: {
    position: 'absolute',
    bottom: -10,
    left: -20,
    right: -20,
    height: 65,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 90,
  },
  mountainFar: {
    backgroundColor: 'rgba(107, 33, 168, 0.65)',
    transform: [{ rotate: '-3deg' }],
    bottom: -6,
  },
  mountainMid: {
    backgroundColor: 'rgba(74, 14, 119, 0.82)',
    transform: [{ rotate: '2.5deg' }],
    bottom: -12,
  },
  mountainNear: {
    backgroundColor: '#2E1065',
    bottom: -20,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
  },
  treesRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  treeSilhouette: {
    position: 'absolute',
    bottom: 0,
    width: 8,
    backgroundColor: '#1E1B4B',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
});
