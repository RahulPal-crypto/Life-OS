import { Alert, Linking } from 'react-native';
import { memoriesNative, PickedLocalFile } from '../../memories/services/memoriesNative';
import { resolveMediaUrl } from '../../../config/apiConfig';

export type { PickedLocalFile };

export const formatDuration = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getDocumentIcon = (fileName?: string | null, mimeType?: string | null): string => {
  const name = String(fileName || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();

  if (name.endsWith('.pdf') || mime.includes('pdf')) return '📄';
  if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) return '📝';
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv') || mime.includes('sheet') || mime.includes('csv')) return '📊';
  if (name.endsWith('.ppt') || name.endsWith('.pptx') || mime.includes('presentation')) return '📑';
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || mime.includes('zip') || mime.includes('compressed')) return '📦';
  if (name.endsWith('.txt') || mime.includes('text')) return '📋';
  return '📁';
};

export const connectMediaNative = {
  isAvailable: (): boolean => memoriesNative.isAvailable(),

  capturePhoto: async (): Promise<PickedLocalFile | null> => {
    return memoriesNative.captureMedia('photo');
  },

  captureVideo: async (): Promise<PickedLocalFile | null> => {
    return memoriesNative.captureMedia('video');
  },

  pickPhotos: async (): Promise<PickedLocalFile[]> => {
    return memoriesNative.pickFiles('photo');
  },

  pickVideos: async (): Promise<PickedLocalFile[]> => {
    return memoriesNative.pickFiles('video');
  },

  pickDocuments: async (): Promise<PickedLocalFile[]> => {
    return memoriesNative.pickFiles('document');
  },

  pickAudioFiles: async (): Promise<PickedLocalFile[]> => {
    return memoriesNative.pickFiles('audio');
  },

  startVoiceRecording: async (): Promise<boolean> => {
    return memoriesNative.startVoiceRecording();
  },

  stopVoiceRecording: async (): Promise<PickedLocalFile | null> => {
    return memoriesNative.stopVoiceRecording();
  },

  playAudio: async (uriOrPath: string): Promise<boolean> => {
    const resolved = resolveMediaUrl(uriOrPath) || uriOrPath;
    return memoriesNative.playAudio(resolved);
  },

  stopAudio: async (): Promise<boolean> => {
    return memoriesNative.stopAudio();
  },

  setAudioSpeed: async (speed: number): Promise<boolean> => {
    return memoriesNative.setAudioSpeed(speed);
  },

  isAudioPlaying: async (): Promise<boolean> => {
    return memoriesNative.isAudioPlaying();
  },

  readFileBase64: async (uriOrPath: string): Promise<string> => {
    return memoriesNative.readFileAsBase64(uriOrPath);
  },

  openDocument: async (mediaUrlOrPath: string, mimeType?: string | null): Promise<boolean> => {
    try {
      const resolved = resolveMediaUrl(mediaUrlOrPath) || mediaUrlOrPath;

      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        const canOpen = await Linking.canOpenURL(resolved);
        if (canOpen) {
          await Linking.openURL(resolved);
          return true;
        }
      }

      if (memoriesNative.isAvailable()) {
        await memoriesNative.openFileExternally(resolved, mimeType || '*/*');
        return true;
      }

      await Linking.openURL(resolved);
      return true;
    } catch (err: any) {
      Alert.alert('Cannot Open Document', err?.message || 'No compatible app found to open this document.');
      return false;
    }
  },
};
