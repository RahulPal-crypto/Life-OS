import { apiConfig } from '../../../config/apiConfig';
import { authService } from '../../auth/services/authService';

export interface DayMetrics {
  studyHours: number;
  workHours: number;
  activeSteps: number;
  sleepHours: number;
  mood: string;
  notes?: string | null;
}

export interface GlanceItem {
  id: string;
  title: string;
  time?: string;
  details?: string;
}

export interface TodayAtAGlanceData {
  meals: { count: number; badge: string; items: GlanceItem[] };
  conversations: { count: number; badge: string; items: GlanceItem[] };
  places: { count: number; badge: string; items: GlanceItem[] };
  activities: { count: number; badge: string };
}

export type TimerStatus = 'logged' | 'active' | 'completed';

export interface DayTimelineItem {
  id: string;
  time: string;
  timestamp: number;
  category: string;
  title: string;
  subtitle: string;
  meta?: string | null;
  icon: string;
  isAutoTracked?: boolean;
  durationMinutes?: number | null;
  endsAt?: number | null;
  endTime?: string | null;
  timerStatus?: TimerStatus;
}

export interface DaySnapshot {
  date: string;
  formattedDate: string;
  metrics: DayMetrics;
  todayAtAGlance: TodayAtAGlanceData;
  timeline: DayTimelineItem[];
}

export interface CreateActivityPayload {
  logDate?: string;
  category: string;
  title: string;
  details?: string;
  meta?: string;
  timeString?: string;
  icon?: string;
  durationMinutes?: number;
}

export interface UpdateMetricsPayload {
  logDate?: string;
  studyHours?: number;
  workHours?: number;
  activeSteps?: number;
  sleepHours?: number;
  mood?: string;
  notes?: string;
}

class MyDayService {
  /**
   * Delegate authenticated requests through authService for shared URL routing and automatic token refresh
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    return authService.authorizedRequest(endpoint, options);
  }

  /**
   * Fetch Day Snapshot for a given date (YYYY-MM-DD)
   */
  async fetchDaySnapshot(dateStr: string): Promise<DaySnapshot> {
    const json = await this.request(
      `${apiConfig.endpoints.myDay.snapshot}?date=${encodeURIComponent(dateStr)}`,
      { method: 'GET' }
    );
    return json.data;
  }

  /**
   * Create a new timeline activity
   */
  async createActivity(payload: CreateActivityPayload): Promise<DayTimelineItem> {
    const json = await this.request(apiConfig.endpoints.myDay.activities, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return json.data;
  }

  /**
   * Mark a timed activity as completed (either early stop or auto-finish at endsAt)
   */
  async stopActivityTimer(activityId: string, endsAt?: number): Promise<DayTimelineItem> {
    const json = await this.request(
      `${apiConfig.endpoints.myDay.activities}/${encodeURIComponent(activityId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          timerStatus: 'completed',
          ...(typeof endsAt === 'number' ? { endsAt } : {}),
        }),
      }
    );
    return json.data;
  }

  /**
   * Delete an activity
   */
  async deleteActivity(activityId: string): Promise<boolean> {
    const json = await this.request(
      `${apiConfig.endpoints.myDay.activities}/${encodeURIComponent(activityId)}`,
      { method: 'DELETE' }
    );
    return json.success;
  }

  /**
   * Update daily metrics
   */
  async updateMetrics(payload: UpdateMetricsPayload): Promise<DayMetrics> {
    const json = await this.request(apiConfig.endpoints.myDay.metrics, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return json.data;
  }
}

export const myDayService = new MyDayService();
