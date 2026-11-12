import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  AppState,
} from 'react-native';
import { Text } from '../../../components';
import { colors, spacing, borderRadius } from '../../../theme';
import {
  appUpdateService,
  DownloadProgress,
  UpdateCheckResult,
} from '../services/appUpdateService';

interface UpdateAvailableModalProps {
  visible: boolean;
  updateInfo: UpdateCheckResult | null;
  onDismiss: () => void;
}

type UpdateStage = 'prompt' | 'downloading' | 'permission' | 'error';

const formatBytesMb = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const UpdateAvailableModal: React.FC<UpdateAvailableModalProps> = ({
  visible,
  updateInfo,
  onDismiss,
}) => {
  const [stage, setStage] = useState<UpdateStage>('prompt');
  const [progress, setProgress] = useState<DownloadProgress>({
    progress: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
  });
  const [downloadedFileName, setDownloadedFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!visible) {
      setStage('prompt');
      setErrorMessage('');
      return;
    }
  }, [visible]);

  // Automatically re-trigger installer once the user returns from "Allow from this source" Settings
  useEffect(() => {
    if (!visible || stage !== 'permission' || !downloadedFileName) return;

    const subscription = AppState.addEventListener('change', async nextState => {
      if (nextState !== 'active') return;
      try {
        const allowed = await appUpdateService.canRequestPackageInstalls();
        if (allowed) {
          const result = await appUpdateService.installDownloadedApk(downloadedFileName);
          if (result.status === 'installer_opened' && !updateInfo?.isForced) {
            onDismiss();
          }
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Unable to launch APK installer.');
        setStage('error');
      }
    });

    return () => subscription.remove();
  }, [visible, stage, downloadedFileName, updateInfo?.isForced, onDismiss]);

  const apkUrl = updateInfo?.remote?.apkUrl;
  if (!updateInfo || !updateInfo.hasUpdate || !apkUrl) {
    return null;
  }

  const { installed, remote, isForced } = updateInfo;

  const handleStartUpdate = async () => {
    setStage('downloading');
    setErrorMessage('');
    setProgress({ progress: 0, bytesDownloaded: 0, totalBytes: remote.apkSizeBytes || 0 });

    try {
      const result = await appUpdateService.downloadAndInstall(
        apkUrl,
        remote.latestVersionName,
        remote.latestVersionCode,
        event => setProgress(event)
      );

      setDownloadedFileName(result.fileName);

      if (result.status === 'permission_required') {
        setStage('permission');
      } else if (!isForced) {
        onDismiss();
      } else {
        setStage('prompt');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Update download failed. Try again or download in browser.');
      setStage('error');
    }
  };

  const handleOpenSettings = async () => {
    try {
      await appUpdateService.openUnknownSourcesSettings();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not open settings automatically.');
      setStage('error');
    }
  };

  const handleInstallNow = async () => {
    try {
      const result = await appUpdateService.installDownloadedApk(downloadedFileName);
      if (result.status === 'permission_required') {
        setStage('permission');
      } else if (!isForced) {
        onDismiss();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to launch installer.');
      setStage('error');
    }
  };

  const pct = progress.progress >= 0 ? Math.min(100, Math.max(0, progress.progress)) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isForced && stage !== 'downloading') {
          onDismiss();
        }
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isForced ? 'REQUIRED UPDATE' : 'NEW UPDATE AVAILABLE'}
            </Text>
          </View>

          <Text style={styles.title}>Life OS v{remote.latestVersionName}</Text>
          <Text style={styles.subtitle}>
            Installed: v{installed.versionName} ({installed.versionCode})
            {remote.apkSizeBytes ? `  •  ${formatBytesMb(remote.apkSizeBytes)}` : ''}
          </Text>

          {stage === 'prompt' && (
            <>
              {Boolean(remote.releaseNotes) && (
                <ScrollView style={styles.notesBox} showsVerticalScrollIndicator={false}>
                  <Text style={styles.notesLabel}>What's New</Text>
                  <Text style={styles.notesText}>{remote.releaseNotes}</Text>
                </ScrollView>
              )}

              <Pressable style={styles.primaryBtn} onPress={handleStartUpdate}>
                <Text style={styles.primaryBtnText}>Download & Install Update</Text>
              </Pressable>

              {!isForced && (
                <Pressable style={styles.secondaryBtn} onPress={onDismiss}>
                  <Text style={styles.secondaryBtnText}>Later</Text>
                </Pressable>
              )}
            </>
          )}

          {stage === 'downloading' && (
            <View style={styles.progressSection}>
              <View style={styles.progressRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.progressTitle}>
                  {pct !== null ? `Downloading update... ${pct}%` : 'Downloading update...'}
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct ?? 35}%` }]} />
              </View>

              {progress.totalBytes > 0 && (
                <Text style={styles.progressMeta}>
                  {formatBytesMb(progress.bytesDownloaded)} / {formatBytesMb(progress.totalBytes)}
                </Text>
              )}
            </View>
          )}

          {stage === 'permission' && (
            <View style={styles.permissionSection}>
              <Text style={styles.permissionText}>
                Android requires one-time permission to install Life OS updates directly. Tap{' '}
                <Text style={styles.boldText}>Open Settings</Text>, turn on{' '}
                <Text style={styles.boldText}>Allow from this source</Text>, then return here.
              </Text>

              <Pressable style={styles.primaryBtn} onPress={handleOpenSettings}>
                <Text style={styles.primaryBtnText}>Open Settings</Text>
              </Pressable>

              <Pressable style={styles.secondaryBtn} onPress={handleInstallNow}>
                <Text style={styles.secondaryBtnText}>I Enabled It — Install Update</Text>
              </Pressable>
            </View>
          )}

          {stage === 'error' && (
            <View style={styles.errorSection}>
              <Text style={styles.errorText}>{errorMessage}</Text>

              <Pressable style={styles.primaryBtn} onPress={handleStartUpdate}>
                <Text style={styles.primaryBtnText}>Retry Download</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryBtn}
                onPress={() => appUpdateService.openBrowserDownload(apkUrl)}
              >
                <Text style={styles.secondaryBtnText}>Download via Browser</Text>
              </Pressable>

              {!isForced && (
                <Pressable style={styles.dismissBtn} onPress={onDismiss}>
                  <Text style={styles.dismissText}>Close</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.personal.lightBg,
    borderColor: colors.personal.border,
    borderWidth: 1,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  notesBox: {
    maxHeight: 150,
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHover,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    paddingVertical: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm + 4,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 8,
    width: '100%',
    backgroundColor: colors.surfaceBorder,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.round,
  },
  progressMeta: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  permissionSection: {
    gap: spacing.xs,
  },
  permissionText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  boldText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorSection: {
    gap: spacing.xs,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.rose,
    marginBottom: spacing.sm,
  },
  dismissBtn: {
    marginTop: spacing.xs,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
