import { NativeModules, Platform } from 'react-native';

export const API_URL = 'https://life-os-h9b8.onrender.com/api/v1';

const getDevHostUrl = (): string | null => {
  if (!__DEV__) return null;
  try {
    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    const match = scriptURL?.match(/^https?:\/\/([^/:]+)(?::\d+)?\//i);
    const host = match?.[1];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:5000/api/v1`;
    }
  } catch {
    // Ignore native module inspection errors
  }
  return null;
};

// Production / Release APK uses the Render HTTPS API exclusively; __DEV__ keeps local fallbacks
const rawUrls = __DEV__
  ? [
      API_URL,
      'http://127.0.0.1:5000/api/v1',
      'http://localhost:5000/api/v1',
      getDevHostUrl(),
      Platform.OS === 'android' ? 'http://10.0.2.2:5000/api/v1' : null,
    ]
  : [API_URL];

export const API_URLS = Array.from(new Set(rawUrls.filter((u): u is string => Boolean(u))));

export const apiConfig = {
  baseUrl: API_URL,
  fallbackUrls: API_URLS,
  // Allow enough window for Render free-tier cold start wake-ups
  timeoutMs: 35000,
  endpoints: {
    appVersion: '/app/version',
    register: '/auth/register',
    login: '/auth/login',
    refreshToken: '/auth/refresh-token',
    logout: '/auth/logout',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    profile: '/auth/profile',
    sessions: '/auth/sessions',
    profileModule: {
      overview: '/profile',
      update: '/profile',
      password: '/profile/password',
      sessions: '/profile/sessions',
    },
    myDay: {
      snapshot: '/my-day',
      activities: '/my-day/activities',
      metrics: '/my-day/metrics',
      history: '/my-day/history',
    },
    memories: {
      overview: '/memories',
      folders: '/memories/folders',
      items: '/memories/items',
      bulk: '/memories/items/bulk',
      vaultSetup: '/memories/vault/setup',
      vaultUnlock: '/memories/vault/unlock',
      vaultUnlockBiometric: '/memories/vault/unlock-biometric',
    },
    connect: {
      securityStatus: '/connect/security/status',
      setupPin: '/connect/security/setup-pin',
      verifyPin: '/connect/security/verify-pin',
      contactsSync: '/connect/contacts/sync',
      contactsSearch: '/connect/contacts/search',
      conversations: '/connect/conversations',
    },
  },
};

export const getConnectWsUrl = (token: string): string => {
  const wsBase = API_URL.replace(/^http/, 'ws');
  return `${wsBase}/connect-ws?token=${encodeURIComponent(token)}`;
};
