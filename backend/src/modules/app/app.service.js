import { env } from '../../config/env.js';

let cachedVersionInfo = null;
let cachedAtMs = 0;

/**
 * Extract integer versionCode, clean versionName, APK asset URL, and release notes
 * from a GitHub Release payload.
 */
export const parseGitHubRelease = (release, options = {}) => {
  const {
    minVersionCode = env.appUpdate.minVersionCode,
    forceUpdateDefault = env.appUpdate.forceUpdate,
  } = options;

  const tagName = String(release?.tag_name || '').trim();
  const body = String(release?.body || '');
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const apkAsset = assets.find((asset) => String(asset?.name || '').toLowerCase().endsWith('.apk')) || null;
  const apkName = String(apkAsset?.name || '');

  // Priority: explicit body marker -> tag +N suffix -> APK filename -cN -> semver fallback
  let versionCode = null;
  const bodyCodeMatch = body.match(/versionCode\s*[:=]\s*(\d+)/i);
  const tagCodeMatch = tagName.match(/\+(\d+)$/);
  const assetCodeMatch = apkName.match(/-c(\d+)\.apk$/i);
  const semverMatch = tagName.match(/(\d+)\.(\d+)\.(\d+)/);

  if (bodyCodeMatch) {
    versionCode = Number.parseInt(bodyCodeMatch[1], 10);
  } else if (tagCodeMatch) {
    versionCode = Number.parseInt(tagCodeMatch[1], 10);
  } else if (assetCodeMatch) {
    versionCode = Number.parseInt(assetCodeMatch[1], 10);
  } else if (semverMatch) {
    const [, major, minor, patch] = semverMatch.map((n) => Number.parseInt(n, 10));
    versionCode = major * 10000 + minor * 100 + patch;
  }

  const versionName = tagName.replace(/^v/i, '').replace(/\+\d+$/, '') || String(release?.name || '1.0');
  const forceMarker = /forceUpdate\s*[:=]\s*true/i.test(body);
  const cleanedNotes = body.replace(/<!--[\s\S]*?-->/g, '').trim();

  return {
    latestVersionCode: Number.isInteger(versionCode) && versionCode > 0 ? versionCode : 1,
    latestVersionName: versionName,
    minVersionCode: Number.isInteger(minVersionCode) ? minVersionCode : 1,
    apkUrl: apkAsset?.browser_download_url || null,
    apkSizeBytes: typeof apkAsset?.size === 'number' ? apkAsset.size : null,
    releaseNotes: cleanedNotes,
    forceUpdate: Boolean(forceUpdateDefault || forceMarker),
    publishedAt: release?.published_at || null,
    source: 'github_releases',
  };
};

class AppService {
  async getLatestVersion({ bypassCache = false } = {}) {
    if (env.appUpdate.manualVersionCode && env.appUpdate.manualApkUrl) {
      return {
        latestVersionCode: env.appUpdate.manualVersionCode,
        latestVersionName: env.appUpdate.manualVersionName || String(env.appUpdate.manualVersionCode),
        minVersionCode: env.appUpdate.minVersionCode,
        apkUrl: env.appUpdate.manualApkUrl,
        apkSizeBytes: null,
        releaseNotes: env.appUpdate.manualReleaseNotes,
        forceUpdate: env.appUpdate.forceUpdate,
        publishedAt: null,
        source: 'env_override',
      };
    }

    const now = Date.now();
    if (!bypassCache && cachedVersionInfo && now - cachedAtMs < env.appUpdate.cacheTtlMs) {
      return cachedVersionInfo;
    }

    const url = `https://api.github.com/repos/${env.appUpdate.githubRepo}/releases/latest`;
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LifeOS-Backend',
      ...(env.appUpdate.githubToken ? { Authorization: `Bearer ${env.appUpdate.githubToken}` } : {}),
    };

    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });

      if (response.status === 404) {
        const emptyInfo = {
          latestVersionCode: 1,
          latestVersionName: '1.0',
          minVersionCode: env.appUpdate.minVersionCode,
          apkUrl: null,
          apkSizeBytes: null,
          releaseNotes: '',
          forceUpdate: false,
          publishedAt: null,
          source: 'none',
        };
        cachedVersionInfo = emptyInfo;
        cachedAtMs = now;
        return emptyInfo;
      }

      if (!response.ok) {
        throw new Error(`GitHub Releases API returned HTTP ${response.status}`);
      }

      const releaseJson = await response.json();
      const parsed = parseGitHubRelease(releaseJson);
      cachedVersionInfo = parsed;
      cachedAtMs = now;
      return parsed;
    } catch (error) {
      if (cachedVersionInfo) {
        return cachedVersionInfo;
      }
      console.warn(`[AppUpdate] Failed to check GitHub Releases: ${error.message}; using latest release fallback`);
      return {
        latestVersionCode: 8,
        latestVersionName: '1.7',
        minVersionCode: env.appUpdate.minVersionCode,
        apkUrl: 'https://github.com/RahulPal-crypto/Life-OS/releases/download/v1.7/LifeOS-v1.7-c8.apk',
        apkSizeBytes: 29500000,
        releaseNotes: 'My Connect Phase 2: Photos, videos, documents, and voice messages with waveform playback.',
        forceUpdate: false,
        publishedAt: new Date().toISOString(),
        source: 'fallback',
      };
    }
  }
}

export const appService = new AppService();
