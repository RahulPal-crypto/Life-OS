import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { spacing, borderRadius } from '../../../theme';
import { ScreenContainer, Text } from '../../../components';
import { User } from '../../auth/services/authService';
import {
  profileService,
  ProfileStats,
  DeviceSession,
  UpdateProfilePayload,
  ChangePasswordPayload,
} from '../services/profileService';
import { ProfileTopBar } from '../components/ProfileTopBar';
import { ProfileHeroCard } from '../components/ProfileHeroCard';
import { ProfileStatsRow } from '../components/ProfileStatsRow';
import { EditProfileModal } from '../components/EditProfileModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { SessionsModal } from '../components/SessionsModal';

interface ProfileScreenProps {
  user: User | null;
  onBack: () => void;
  onUserUpdated: (updatedUser: User) => void;
  onSwitchSpace: () => void;
  onLogout: () => void;
}

const DEFAULT_STATS: ProfileStats = {
  daysTracked: 0,
  totalActivities: 0,
  totalStudyHours: 0,
  totalWorkHours: 0,
  avgSleepHours: 0,
  activeSessionsCount: 0,
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user: initialUser,
  onBack,
  onUserUpdated,
  onSwitchSpace,
  onLogout,
}) => {
  const [profileUser, setProfileUser] = useState<User | null>(initialUser);
  const [stats, setStats] = useState<ProfileStats>(DEFAULT_STATS);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);

  const loadOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const overview = await profileService.fetchOverview();
      setProfileUser(overview.user);
      setStats(overview.stats || DEFAULT_STATS);
      setSessions(overview.sessions || []);
      onUserUpdated(overview.user);
    } catch (err: any) {
      console.warn('[ProfileScreen] Unable to fetch profile overview:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onUserUpdated]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSaveProfile = async (payload: UpdateProfilePayload) => {
    const updated = await profileService.updateProfile(payload);
    setProfileUser(updated);
    onUserUpdated(updated);
    Alert.alert('Profile Updated', 'Your personal details and daily goals have been saved.');
  };

  const handleChangePassword = async (payload: ChangePasswordPayload) => {
    const message = await profileService.changePassword(payload);
    Alert.alert('Security Updated', message);
    loadOverview(true);
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await profileService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setStats((prev) => ({
        ...prev,
        activeSessionsCount: Math.max(0, prev.activeSessionsCount - 1),
      }));
    } catch (err: any) {
      Alert.alert('Revoke Failed', err?.message || 'Unable to revoke session.');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      const result = await profileService.revokeOtherSessions();
      Alert.alert('Sessions Updated', result.message);
      loadOverview(true);
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Unable to sign out other devices.');
    }
  };

  const handleConfirmLogout = () => {
    Alert.alert(
      'Log Out of LIFE OS',
      'Are you sure you want to end your current session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <ScreenContainer backgroundColor="#F4F0FA" barStyle="dark-content">
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadOverview(true)}
              colors={['#7C3AED']}
            />
          }
        >
          <ProfileTopBar
            onBack={onBack}
            onEditPress={() => setEditModalVisible(true)}
          />

          <ProfileHeroCard
            user={profileUser}
            onEditPress={() => setEditModalVisible(true)}
          />

          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#7C3AED" />
            </View>
          ) : (
            <ProfileStatsRow stats={stats} />
          )}

          {/* Daily Goals Card */}
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeaderRow}>
              <Text variant="caption" color="#6B7280" style={styles.sectionLabel}>
                DAILY TARGETS
              </Text>
              <Pressable onPress={() => setEditModalVisible(true)}>
                <Text variant="caption" color="#6D28D9" style={styles.adjustLink}>
                  Adjust
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.goalRow}>
                <View style={styles.goalItem}>
                  <Text variant="caption" color="#9CA3AF" style={styles.goalMetaLabel}>
                    FOCUS TARGET
                  </Text>
                  <Text variant="h2" color="#1E1B4B" style={styles.goalValue}>
                    {profileUser?.dailyFocusGoal ?? 8} hrs / day
                  </Text>
                </View>

                <View style={styles.goalDivider} />

                <View style={styles.goalItem}>
                  <Text variant="caption" color="#9CA3AF" style={styles.goalMetaLabel}>
                    STEPS TARGET
                  </Text>
                  <Text variant="h2" color="#1E1B4B" style={styles.goalValue}>
                    {(profileUser?.dailyStepsGoal ?? 8000).toLocaleString()} steps
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Account & Security */}
          <View style={styles.sectionWrapper}>
            <Text variant="caption" color="#6B7280" style={styles.sectionLabelStandalone}>
              ACCOUNT & SECURITY
            </Text>

            <View style={styles.card}>
              <Pressable
                onPress={() => setEditModalVisible(true)}
                style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>✏️</Text>
                  <View>
                    <Text variant="h3" color="#1E1B4B" style={styles.menuTitle}>
                      Edit Personal Details
                    </Text>
                    <Text variant="caption" color="#6B7280" style={styles.menuSubtitle}>
                      Name, phone, bio, location & avatar
                    </Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <View style={styles.rowDivider} />

              <Pressable
                onPress={() => setPasswordModalVisible(true)}
                style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>🔐</Text>
                  <View>
                    <Text variant="h3" color="#1E1B4B" style={styles.menuTitle}>
                      Change Password
                    </Text>
                    <Text variant="caption" color="#6B7280" style={styles.menuSubtitle}>
                      Update your account password securely
                    </Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <View style={styles.rowDivider} />

              <Pressable
                onPress={() => setSessionsModalVisible(true)}
                style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>📱</Text>
                  <View>
                    <Text variant="h3" color="#1E1B4B" style={styles.menuTitle}>
                      Active Devices
                    </Text>
                    <Text variant="caption" color="#6B7280" style={styles.menuSubtitle}>
                      {sessions.length} signed-in device{sessions.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>
          </View>

          {/* Space & Session */}
          <View style={styles.sectionWrapper}>
            <Text variant="caption" color="#6B7280" style={styles.sectionLabelStandalone}>
              WORKSPACE & SESSION
            </Text>

            <View style={styles.card}>
              <Pressable
                onPress={onSwitchSpace}
                style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>🌐</Text>
                  <View>
                    <Text variant="h3" color="#1E1B4B" style={styles.menuTitle}>
                      Switch Space
                    </Text>
                    <Text variant="caption" color="#6B7280" style={styles.menuSubtitle}>
                      Currently in Personal Space
                    </Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <View style={styles.rowDivider} />

              <Pressable
                onPress={handleConfirmLogout}
                style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
              >
                <View style={styles.menuLeft}>
                  <Text style={styles.menuIcon}>🚪</Text>
                  <View>
                    <Text variant="h3" color="#DC2626" style={styles.menuTitle}>
                      Log Out
                    </Text>
                    <Text variant="caption" color="#9CA3AF" style={styles.menuSubtitle}>
                      Sign out of this device
                    </Text>
                  </View>
                </View>
                <Text style={[styles.chevron, styles.chevronDanger]}>›</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <EditProfileModal
          visible={editModalVisible}
          user={profileUser}
          onClose={() => setEditModalVisible(false)}
          onSave={handleSaveProfile}
        />

        <ChangePasswordModal
          visible={passwordModalVisible}
          onClose={() => setPasswordModalVisible(false)}
          onSubmit={handleChangePassword}
        />

        <SessionsModal
          visible={sessionsModalVisible}
          sessions={sessions}
          onClose={() => setSessionsModalVisible(false)}
          onRevokeSession={handleRevokeSession}
          onRevokeOthers={handleRevokeOtherSessions}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0FA',
  },
  scrollContent: {
    paddingBottom: spacing.xxl + 12,
  },
  loadingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionWrapper: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionLabelStandalone: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  adjustLink: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'none',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    overflow: 'hidden',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  goalItem: {
    flex: 1,
  },
  goalMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  goalValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  goalDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#EDE9FE',
    marginHorizontal: spacing.md,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 4,
  },
  rowPressed: {
    backgroundColor: '#F8F6FF',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0.1,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '500',
    color: '#9CA3AF',
    marginLeft: spacing.sm,
  },
  chevronDanger: {
    color: '#FCA5A5',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F3F0FF',
    marginLeft: spacing.xl + spacing.lg,
  },
});
