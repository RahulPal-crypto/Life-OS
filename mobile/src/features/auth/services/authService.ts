import { apiConfig } from '../../../config/apiConfig';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  dailyFocusGoal?: number;
  dailyStepsGoal?: number;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  accountStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  termsAccepted: boolean;
}

export interface LoginPayload {
  identifier: string; // email or phone
  password: string;
}

class AuthService {
  private currentUser: User | null = null;
  private tokens: AuthTokens | null = null;
  private workingBaseUrl: string = apiConfig.baseUrl;

  /**
   * Helper to perform fetch across candidate backend URLs
   * (handles adb reverse localhost, Wi-Fi IP, and emulator)
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const urlsToTry = [
      this.workingBaseUrl,
      ...apiConfig.fallbackUrls.filter(u => u !== this.workingBaseUrl),
    ];

    let lastError: any = null;

    for (const base of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeoutMs);
        let response: Response;

        try {
          response = await fetch(`${base}${endpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...(options.headers || {}),
            },
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const rawBody = await response.text();
        let json: any = null;
        try {
          json = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          const parseErr: any = new Error(
            response.status >= 500
              ? 'Server is starting up or temporarily unavailable. Please try again in a few seconds.'
              : 'Received an unexpected response from the server.'
          );
          parseErr.code = response.status >= 500 ? 'SERVER_UNAVAILABLE' : 'INVALID_RESPONSE';
          throw parseErr;
        }

        // If connected and responded, record this working base URL
        this.workingBaseUrl = base;

        if (!response.ok || !json?.success) {
          const errorMsg = json?.error?.message || 'Server request failed.';
          const err: any = new Error(errorMsg);
          err.code = json?.error?.code || 'REQUEST_FAILED';
          err.fieldErrors = json?.error?.details || {};
          throw err;
        }

        return json;
      } catch (err: any) {
        lastError = err;
        // If the server actually responded with validation or 4xx/5xx error, don't try other URLs
        if (err.code || err.fieldErrors) {
          throw err;
        }
        // If it was a network failure, try the next URL candidate
        console.warn(`[AuthService] Could not reach ${base}${endpoint}, trying next candidate...`);
      }
    }

    if (lastError?.name === 'AbortError') {
      throw new Error(
        'Request timed out while connecting to the LIFE OS server. If the server is waking up, please wait a few seconds and try again.'
      );
    }

    throw new Error(
      __DEV__
        ? 'Cannot connect to LIFE OS server. Verify your internet connection, Render URL, or local backend (`npm run dev`).'
        : 'Unable to reach the LIFE OS server. Please check your internet connection and try again.'
    );
  }

  async register(payload: RegisterPayload): Promise<User> {
    const json = await this.request(apiConfig.endpoints.register, {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        termsAccepted: payload.termsAccepted,
        deviceName: 'Android Mobile Client',
      }),
    });

    this.currentUser = json.data.user;
    this.tokens = json.data.tokens;

    return this.currentUser!;
  }

  async login(payload: LoginPayload): Promise<User> {
    const json = await this.request(apiConfig.endpoints.login, {
      method: 'POST',
      body: JSON.stringify({
        identifier: payload.identifier,
        password: payload.password,
        deviceName: 'Android Mobile Client',
      }),
    });

    this.currentUser = json.data.user;
    this.tokens = json.data.tokens;

    return this.currentUser!;
  }

  async refreshToken(): Promise<AuthTokens | null> {
    if (!this.tokens?.refreshToken) return null;

    try {
      const json = await this.request(apiConfig.endpoints.refreshToken, {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
      });

      this.tokens = json.data;
      return this.tokens;
    } catch {
      return null;
    }
  }

  async forgotPassword(identifier: string): Promise<{ message: string; resetToken?: string }> {
    const json = await this.request(apiConfig.endpoints.forgotPassword, {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });

    return {
      message: json.message,
      resetToken: json.data?.resetToken,
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<string> {
    const json = await this.request(apiConfig.endpoints.resetPassword, {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });

    return json.message;
  }

  async getProfile(): Promise<User | null> {
    if (!this.tokens?.accessToken) return this.currentUser;

    try {
      const json = await this.authorizedRequest(apiConfig.endpoints.profile, {
        method: 'GET',
      });

      this.currentUser = json.data;
    } catch {
      // return cached
    }
    return this.currentUser;
  }

  async updateProfile(data: { name?: string; phone?: string; profileImage?: string }): Promise<User | null> {
    if (!this.tokens?.accessToken) {
      return this.currentUser;
    }

    const json = await this.authorizedRequest(apiConfig.endpoints.profile, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    this.currentUser = json.data;
    return this.currentUser;
  }

  async logout(): Promise<void> {
    if (this.tokens?.refreshToken) {
      try {
        await this.request(apiConfig.endpoints.logout, {
          method: 'POST',
          body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
        });
      } catch {
        // silent
      }
    }
    this.currentUser = null;
    this.tokens = null;
  }

  /**
   * Perform an authenticated request, automatically refreshing expired access tokens once.
   */
  async authorizedRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.tokens?.accessToken) {
      const err: any = new Error('Please sign in to access your profile.');
      err.code = 'NO_TOKEN_PROVIDED';
      throw err;
    }

    const withAuthHeaders = (token: string): RequestInit => ({
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    try {
      return await this.request(endpoint, withAuthHeaders(this.tokens.accessToken));
    } catch (err: any) {
      if (err?.code === 'INVALID_OR_EXPIRED_TOKEN' && this.tokens?.refreshToken) {
        const refreshed = await this.refreshToken();
        if (refreshed?.accessToken) {
          return await this.request(endpoint, withAuthHeaders(refreshed.accessToken));
        }
      }
      throw err;
    }
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getTokens(): AuthTokens | null {
    return this.tokens;
  }
}

export const authService = new AuthService();
