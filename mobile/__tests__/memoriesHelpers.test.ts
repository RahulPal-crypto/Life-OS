import { formatBytes, getMediaTypeIcon } from '../src/features/memories/services/memoriesNative';
import { memoriesService } from '../src/features/memories/services/memoriesService';

describe('My Memories helpers & vault session state', () => {
  it('formats byte sizes cleanly across units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('maps media types to expected icons', () => {
    expect(getMediaTypeIcon('photo')).toBe('🖼️');
    expect(getMediaTypeIcon('video')).toBe('🎥');
    expect(getMediaTypeIcon('document')).toBe('📄');
    expect(getMediaTypeIcon('audio')).toBe('🎙️');
  });

  it('clears in-memory vault session when locked', () => {
    memoriesService.clearVaultSession();
    expect(memoriesService.isVaultUnlocked()).toBe(false);
    expect(memoriesService.getVaultToken()).toBeNull();
  });
});
