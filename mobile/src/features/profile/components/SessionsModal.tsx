import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { spacing, borderRadius } from '../../../theme';
import { Text, Button } from '../../../components';
import { DeviceSession } from '../services/profileService';

interface SessionsModalProps {
  visible: boolean;
  sessions: DeviceSession[];
  onClose: () => void;
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeOthers: () => Promise<void>;
}

const formatLastActive = (isoDate: string): string => {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 'Active recently';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const SessionsModal: React.FC<SessionsModalProps> = ({
  visible,
  sessions,
  onClose,
  onRevokeSession,
  onRevokeOthers,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const handleRevokeOne = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      await onRevokeSession(sessionId);
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await onRevokeOthers();
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text variant="h2" color="#1E1B4B" style={styles.headerTitle}>
              Active Devices ({sessions.length})
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="caption" color="#6B7280" style={styles.closeText}>
                Close
              </Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {sessions.length === 0 ? (
              <Text variant="bodySmall" color="#6B7280" align="center" style={styles.emptyText}>
                No active sessions recorded.
              </Text>
            ) : (
              sessions.map((session, index) => (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionInfo}>
                    <View style={styles.deviceRow}>
                      <Text style={styles.deviceIcon}>📱</Text>
                      <Text variant="h3" color="#1E1B4B" numberOfLines={1} style={styles.deviceName}>
                        {session.deviceName}
                      </Text>
                      {index === 0 ? (
                        <View style={styles.latestBadge}>
                          <Text variant="caption" color="#6D28D9" style={styles.latestText}>
                            Recent
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text variant="caption" color="#6B7280" style={styles.metaText}>
                      IP: {session.ipAddress}  •  {formatLastActive(session.lastActiveAt)}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleRevokeOne(session.id)}
                    disabled={busyId === session.id}
                    style={styles.revokeBtn}
                  >
                    {busyId === session.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Text variant="caption" color="#DC2626" style={styles.revokeText}>
                        Revoke
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>

          {sessions.length > 1 ? (
            <Button
              title={revokingOthers ? 'Signing Out Others...' : 'Sign Out All Other Devices'}
              variant="outline"
              onPress={handleRevokeOthers}
              loading={revokingOthers}
              style={styles.revokeOthersBtn}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontWeight: '800',
  },
  closeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'none',
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  emptyText: {
    paddingVertical: spacing.lg,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F6FF',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sessionInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    marginRight: 6,
  },
  latestBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  latestText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'none',
  },
  metaText: {
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0.1,
  },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  revokeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'none',
  },
  revokeOthersBtn: {
    marginTop: spacing.xs,
  },
});
