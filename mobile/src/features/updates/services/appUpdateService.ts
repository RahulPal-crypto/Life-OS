import { Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { apiConfig } from '../../../config/apiConfig';

export interface InstalledAppVersion {
  versionCode: number;
  versionName: string;
}

export interface RemoteVersionInfo {
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  apkUrl: string | null;
  apkSizeBytes: number | null;
  releaseNotes: string;
  forceUpdate: boolean;
  publishedAt: string | null;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  isForced: boolean;
  installed: InstalledAppVersion;
  remote: RemoteVersionInfo;
}

export interface DownloadProgress {
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
}

export type InstallResultStatus = 'installer_opened' | 'permission_required';

export interface InstallResult {
  status: InstallResultStatus;
  fileName: string;
}

const { AppUpdater } = NativeModules;

class AppUpdateService {
  async getInstalledVersion(): Promise<InstalledAppVersion> {
    if (Platform.OS === 'android' && AppUpdater?.getAppVersion) {
      try {
        const res = await AppUpdater.getAppVersion();
        return {
          versionCode: Number(res?.versionCode) || 1,
          versionName: String(res?.versionName || '1.0'),
        };
      } catch {
        // Fall through to safe default
      }
    }
    return { versionCode: 1, versionName: '1.0' };
  }

  async checkForUpdate(signal?: AbortSignal): Promise<UpdateCheckResult | null> {
    if (Platform.OS !== 'android') return null;

    const installed = await this.getInstalledVersion();

    for (const base of apiConfig.fallbackUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeoutMs);
        const onParentAbort = () => controller.abort();
        signal?.addEventListener('abort', onParentAbort);

        let response: Response;
        try {
          response = await fetch(`${base}${apiConfig.endpoints.appVersion}`, {
            method: 'GET',
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
        } finally {
          clearTimeout(timeoutId);
          signal?.removeEventListener('abort', onParentAbort);
        }

        if (!response.ok) continue;
        const json = await response.json();
        if (!json?.success || !json?.data) continue;

        const remote = json.data as RemoteVersionInfo;
        const hasUpdate = Boolean(
          remote.apkUrl && Number(remote.latestVersionCode) > installed.versionCode
        );
        const isForced = Boolean(
          remote.forceUpdate || installed.versionCode < (Number(remote.minVersionCode) || 1)
        );

        return { hasUpdate, isForced, installed, remote };
      } catch {
        if (signal?.aborted) return null;
      }
    }

    return null;
  }

  async downloadAndInstall(
    apkUrl: string,
    versionName: string,
    versionCode: number,
    onProgress: (event: DownloadProgress) => void
  ): Promise<InstallResult> {
    if (Platform.OS !== 'android' || !AppUpdater?.downloadAndInstallApk) {
      await Linking.openURL(apkUrl);
      return { status: 'installer_opened', fileName: '' };
    }

    const fileName = `LifeOS-v${versionName}-c${versionCode}.apk`;
    const emitter = new NativeEventEmitter(AppUpdater);
    const subscription = emitter.addListener('AppUpdateDownloadProgress', (event: any) => {
      onProgress(event as DownloadProgress);
    });

    try {
      const result = await AppUpdater.downloadAndInstallApk(apkUrl, fileName);
      return {
        status: result?.status === 'permission_required' ? 'permission_required' : 'installer_opened',
        fileName: String(result?.fileName || fileName),
      };
    } finally {
      subscription.remove();
    }
  }

  async canRequestPackageInstalls(): Promise<boolean> {
    if (Platform.OS !== 'android' || !AppUpdater?.canRequestPackageInstalls) {
      return true;
    }
    return Boolean(await AppUpdater.canRequestPackageInstalls());
  }

  async openUnknownSourcesSettings(): Promise<void> {
    if (Platform.OS === 'android' && AppUpdater?.openUnknownSourcesSettings) {
      await AppUpdater.openUnknownSourcesSettings();
    }
  }

  async installDownloadedApk(fileName: string): Promise<InstallResult> {
    if (Platform.OS !== 'android' || !AppUpdater?.installDownloadedApk) {
      throw new Error('Native APK installer is unavailable on this platform.');
    }
    const result = await AppUpdater.installDownloadedApk(fileName);
    return {
      status: result?.status === 'permission_required' ? 'permission_required' : 'installer_opened',
      fileName: String(result?.fileName || fileName),
    };
  }

  async openBrowserDownload(apkUrl: string): Promise<void> {
    await Linking.openURL(apkUrl);
  }
}

export const appUpdateService = new AppUpdateService();
