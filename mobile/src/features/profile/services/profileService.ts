import { apiConfig } from '../../../config/apiConfig';
import { authService, User } from '../../auth/services/authService';

export interface ProfileStats {
  daysTracked: number;
  totalActivities: number;
  totalStudyHours: number;
  totalWorkHours: number;
  avgSleepHours: number;
  activeSessionsCount: number;
}

export interface DeviceSession {
  id: string;
  deviceName: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface ProfileOverview {
  user: User;
  stats: ProfileStats;
  sessions: DeviceSession[];
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  profileImage?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  dailyFocusGoal?: number;
  dailyStepsGoal?: number;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

class ProfileService {
  async fetchOverview(): Promise<ProfileOverview> {
    const json = await authService.authorizedRequest(
      apiConfig.endpoints.profileModule.overview,
      { method: 'GET' }
    );
    if (json.data?.user) {
      authService.setCurrentUser(json.data.user);
    }
    return json.data;
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const json = await authService.authorizedRequest(
      apiConfig.endpoints.profileModule.update,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    authService.setCurrentUser(json.data);
    return json.data;
  }

  async changePassword(payload: ChangePasswordPayload): Promise<string> {
    const tokens = authService.getTokens();
    const json = await authService.authorizedRequest(
      apiConfig.endpoints.profileModule.password,
      {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: payload.currentPassword,
          newPassword: payload.newPassword,
          currentRefreshToken: tokens?.refreshToken,
        }),
      }
    );
    return json.message;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await authService.authorizedRequest(
      `${apiConfig.endpoints.profileModule.sessions}/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' }
    );
  }

  async revokeOtherSessions(): Promise<{ revokedCount: number; message: string }> {
    const tokens = authService.getTokens();
    if (!tokens?.refreshToken) {
      throw new Error('Refresh token missing. Please re-login to manage device sessions.');
    }
    const json = await authService.authorizedRequest(
      apiConfig.endpoints.profileModule.sessions,
      {
        method: 'DELETE',
        body: JSON.stringify({ currentRefreshToken: tokens.refreshToken }),
      }
    );
    return {
      revokedCount: json.data?.revokedCount || 0,
      message: json.message,
    };
  }
}

export const profileService = new ProfileService();
