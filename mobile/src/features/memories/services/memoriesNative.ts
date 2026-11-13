import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export type NativeMediaType = 'photo' | 'video' | 'document' | 'audio' | 'other';
export type PickMode = 'photo' | 'video' | 'document' | 'audio' | 'any';

export interface PickedLocalFile {
  fileName: string;
  mediaType: NativeMediaType;
  mimeType: string;
  sizeBytes: number;
  localUri: string;
  sourceUri?: string | null;
}

export interface LocalStorageStats {
  regularBytes: number;
  vaultBytes: number;
  totalBytes: number;
}

export interface DeleteSourceResult {
  deletedCount: number;
  promptRequired: boolean;
  failedCount: number;
}

interface MemoriesVaultNativeModule {
  pickFiles: (mode: string) => Promise<PickedLocalFile[]>;
  captureMedia: (kind: string) => Promise<PickedLocalFile | null>;
  startVoiceRecording: () => Promise<boolean>;
  stopVoiceRecording: () => Promise<PickedLocalFile | null>;
  playAudio: (pathOrUri: string) => Promise<boolean>;
  stopAudio: () => Promise<boolean>;
  setAudioSpeed: (speed: number) => Promise<boolean>;
  isAudioPlaying: () => Promise<boolean>;
  readFileAsBase64: (pathOrUri: string) => Promise<string>;
  saveBase64ToFile: (
    base64Data: string,
    fileName: string
  ) => Promise<{ localUri: string; filePath: string; fileName: string; sizeBytes: number }>;
  encryptFileToVault: (
    pathOrUri: string,
    itemId: string,
    deleteSource: boolean
  ) => Promise<{ vaultUri: string; sizeBytes: number }>;
  decryptVaultFileToPreview: (
    vaultPathOrUri: string,
    fileName: string
  ) => Promise<{ previewUri: string; previewPath: string }>;
  decryptVaultFileToRegular: (
    vaultPathOrUri: string,
    fileName: string
  ) => Promise<{ localUri: string; sizeBytes: number }>;
  clearVaultPreviewCache: () => Promise<boolean>;
  openFileExternally: (pathOrUri: string, mimeType: string | null) => Promise<boolean>;
  shareFiles: (pathsOrUris: string[], mimeType: string | null) => Promise<boolean>;
  deleteLocalFile: (pathOrUri: string) => Promise<boolean>;
  deleteSourceUris: (sourceUris: string[]) => Promise<DeleteSourceResult>;
  getLocalStorageStats: () => Promise<LocalStorageStats>;
  setScreenSecure: (enabled: boolean) => Promise<boolean>;
  canUseBiometric: () => Promise<boolean>;
  storeBiometricKey: (key: string) => Promise<boolean>;
  unlockWithBiometric: (title: string, subtitle: string) => Promise<string>;
}

const nativeVault: MemoriesVaultNativeModule | undefined =
  Platform.OS === 'android' ? NativeModules.MemoriesVault : undefined;

function isJestEnv(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return Boolean(proc?.env?.JEST_WORKER_ID);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getMediaTypeIcon(mediaType: NativeMediaType): string {
  switch (mediaType) {
    case 'photo':
      return '🖼️';
    case 'video':
      return '🎥';
    case 'document':
      return '📄';
    case 'audio':
      return '🎙️';
    default:
      return '📎';
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || isJestEnv()) return false;
  try {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || isJestEnv()) return false;
  try {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export const memoriesNative = {
  isAvailable: () => Boolean(nativeVault && !isJestEnv()),

  pickFiles: async (mode: PickMode): Promise<PickedLocalFile[]> => {
    if (!nativeVault || isJestEnv()) return [];
    return nativeVault.pickFiles(mode);
  },

  captureMedia: async (kind: 'photo' | 'video'): Promise<PickedLocalFile | null> => {
    if (!nativeVault || isJestEnv()) return null;
    const granted = await requestCameraPermission();
    if (!granted) throw new Error('Camera permission is required.');
    return nativeVault.captureMedia(kind);
  },

  startVoiceRecording: async (): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    const granted = await requestAudioPermission();
    if (!granted) throw new Error('Microphone permission is required to record audio.');
    return nativeVault.startVoiceRecording();
  },

  stopVoiceRecording: async (): Promise<PickedLocalFile | null> => {
    if (!nativeVault || isJestEnv()) return null;
    return nativeVault.stopVoiceRecording();
  },

  playAudio: async (pathOrUri: string): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    return nativeVault.playAudio(pathOrUri);
  },

  setAudioSpeed: async (speed: number): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    return nativeVault.setAudioSpeed(speed);
  },

  isAudioPlaying: async (): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    return nativeVault.isAudioPlaying();
  },

  stopAudio: async (): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    return nativeVault.stopAudio();
  },

  readFileAsBase64: async (pathOrUri: string): Promise<string> => {
    if (!nativeVault || isJestEnv()) return '';
    return nativeVault.readFileAsBase64(pathOrUri);
  },

  saveBase64ToFile: async (
    base64Data: string,
    fileName: string
  ): Promise<{ localUri: string; filePath: string; fileName: string; sizeBytes: number } | null> => {
    if (!nativeVault || isJestEnv()) return null;
    return nativeVault.saveBase64ToFile(base64Data, fileName);
  },

  encryptFileToVault: async (
    pathOrUri: string,
    itemId: string,
    deleteSource = true
  ): Promise<{ vaultUri: string; sizeBytes: number } | null> => {
    if (!nativeVault || isJestEnv()) return null;
    return nativeVault.encryptFileToVault(pathOrUri, itemId, deleteSource);
  },

  decryptVaultFileToPreview: async (
    vaultPathOrUri: string,
    fileName: string
  ): Promise<{ previewUri: string; previewPath: string } | null> => {
    if (!nativeVault || isJestEnv()) return null;
    return nativeVault.decryptVaultFileToPreview(vaultPathOrUri, fileName);
  },

  decryptVaultFileToRegular: async (
    vaultPathOrUri: string,
    fileName: string
  ): Promise<{ localUri: string; sizeBytes: number } | null> => {
    if (!nativeVault || isJestEnv()) return null;
    return nativeVault.decryptVaultFileToRegular(vaultPathOrUri, fileName);
  },

  clearVaultPreviewCache: async (): Promise<void> => {
    if (!nativeVault || isJestEnv()) return;
    try {
      await nativeVault.clearVaultPreviewCache();
    } catch {
      // Best-effort cache wipe
    }
  },

  openFileExternally: async (pathOrUri: string, mimeType: string | null): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    return nativeVault.openFileExternally(pathOrUri, mimeType);
  },

  shareFiles: async (pathsOrUris: string[], mimeType: string | null): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    return nativeVault.shareFiles(pathsOrUris, mimeType);
  },

  deleteLocalFile: async (pathOrUri: string): Promise<void> => {
    if (!nativeVault || isJestEnv()) return;
    try {
      await nativeVault.deleteLocalFile(pathOrUri);
    } catch {
      // Best-effort cleanup
    }
  },

  deleteSourceUris: async (sourceUris: string[]): Promise<DeleteSourceResult> => {
    const valid = sourceUris.filter((u): u is string => Boolean(u && u.startsWith('content://')));
    if (!nativeVault || isJestEnv() || valid.length === 0) {
      return { deletedCount: 0, promptRequired: false, failedCount: 0 };
    }
    try {
      return await nativeVault.deleteSourceUris(valid);
    } catch {
      return { deletedCount: 0, promptRequired: false, failedCount: valid.length };
    }
  },

  getLocalStorageStats: async (): Promise<LocalStorageStats> => {
    if (!nativeVault || isJestEnv()) {
      return { regularBytes: 0, vaultBytes: 0, totalBytes: 0 };
    }
    try {
      return await nativeVault.getLocalStorageStats();
    } catch {
      return { regularBytes: 0, vaultBytes: 0, totalBytes: 0 };
    }
  },

  setScreenSecure: async (enabled: boolean): Promise<void> => {
    if (!nativeVault || isJestEnv()) return;
    try {
      await nativeVault.setScreenSecure(enabled);
    } catch {
      // Best-effort window security flag
    }
  },

  canUseBiometric: async (): Promise<boolean> => {
    if (!nativeVault || isJestEnv()) return false;
    try {
      return await nativeVault.canUseBiometric();
    } catch {
      return false;
    }
  },

  storeBiometricKey: async (key: string): Promise<void> => {
    if (!nativeVault || isJestEnv()) return;
    await nativeVault.storeBiometricKey(key);
  },

  unlockWithBiometric: async (): Promise<string> => {
    if (!nativeVault || isJestEnv()) {
      throw new Error('Biometric unlock is only available on Android devices.');
    }
    return nativeVault.unlockWithBiometric(
      'Unlock Safe Vault',
      'Verify your fingerprint or face to view private files'
    );
  },
};
