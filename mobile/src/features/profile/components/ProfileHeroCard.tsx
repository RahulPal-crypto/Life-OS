import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';
import { User } from '../../auth/services/authService';
import { parseAvatar } from '../utils/avatarHelper';

interface ProfileHeroCardProps {
  user: User | null;
  onEditPress: () => void;
}

const formatMemberSince = (isoDate?: string): string => {
  if (!isoDate) return 'Active Member';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 'Active Member';
  return `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
};

export const ProfileHeroCard: React.FC<ProfileHeroCardProps> = ({
  user,
  onEditPress,
}) => {
  const avatar = parseAvatar(user?.profileImage, user?.name);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.topBand} />

        <View style={styles.topRow}>
          <Pressable
            onPress={onEditPress}
            style={({ pressed }) => [
              styles.avatarCircle,
              avatar.kind === 'emoji' && { borderColor: avatar.accentColor },
              pressed && styles.pressed,
            ]}
          >
            {avatar.kind === 'image' ? (
              <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
            ) : avatar.kind === 'emoji' ? (
              <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
            ) : (
              <Text style={styles.avatarInitials}>{avatar.initials}</Text>
            )}
            <View style={styles.editBadgeDot}>
              <Text style={styles.editBadgeIcon}>✎</Text>
            </View>
          </Pressable>

          <View style={styles.identityCol}>
            <View style={styles.nameRow}>
              <Text variant="h2" color="#1E1B4B" numberOfLines={1} style={styles.name}>
                {user?.name || 'User'}
              </Text>
              <View style={styles.statusPill}>
                <Text variant="caption" color="#059669" style={styles.statusText}>
                  {user?.accountStatus === 'active' ? 'Active' : user?.accountStatus || 'Active'}
                </Text>
              </View>
            </View>

            <Text variant="bodySmall" color="#6D28D9" numberOfLines={1} style={styles.headline}>
              {user?.headline || 'Personal Space Member'}
            </Text>

            <Text variant="caption" color="#9CA3AF" style={styles.joinedText}>
              {user?.location ? `📍 ${user.location}  •  ` : ''}
              {formatMemberSince(user?.createdAt)}
            </Text>
          </View>
        </View>

        {user?.bio ? (
          <View style={styles.bioBox}>
            <Text variant="bodySmall" color="#4B5563" style={styles.bioText}>
              {user.bio}
            </Text>
          </View>
        ) : null}

        <View style={styles.contactStrip}>
          <View style={styles.contactItem}>
            <Text variant="caption" color="#9CA3AF" style={styles.contactLabel}>
              EMAIL
            </Text>
            <Text variant="bodySmall" color="#1E1B4B" numberOfLines={1} style={styles.contactValue}>
              {user?.email || 'Not set'}
            </Text>
          </View>

          <View style={styles.dividerVertical} />

          <View style={styles.contactItem}>
            <Text variant="caption" color="#9CA3AF" style={styles.contactLabel}>
              PHONE
            </Text>
            <Text variant="bodySmall" color="#1E1B4B" numberOfLines={1} style={styles.contactValue}>
              {user?.phone || 'Not set'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    overflow: 'hidden',
    padding: spacing.lg,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#7C3AED',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EDE9FE',
    borderWidth: 2,
    borderColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: '#6D28D9',
  },
  editBadgeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6D28D9',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadgeIcon: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  identityCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '800',
    marginRight: 8,
  },
  statusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  headline: {
    fontWeight: '600',
    marginBottom: 4,
  },
  joinedText: {
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0.1,
  },
  bioBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: '#F3F0FF',
  },
  bioText: {
    lineHeight: 20,
  },
  contactStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F0FF',
  },
  contactItem: {
    flex: 1,
    paddingHorizontal: 4,
  },
  dividerVertical: {
    width: 1,
    height: 28,
    backgroundColor: '#EDE9FE',
    marginHorizontal: spacing.sm,
  },
  contactLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
