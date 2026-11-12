import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

interface ActivityTimerNativeModule {
  scheduleTimerAlarm: (
    activityId: string,
    title: string,
    durationMinutes: number,
    triggerAtMs: number
  ) => Promise<boolean>;
  cancelTimerAlarm: (activityId: string) => Promise<boolean>;
  playCompletionBeep: () => Promise<boolean>;
  stopCompletionSound: () => Promise<boolean>;
}

const nativeTimer: ActivityTimerNativeModule | undefined =
  Platform.OS === 'android' ? NativeModules.ActivityTimer : undefined;

function isJestEnvironment(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return Boolean(proc?.env?.JEST_WORKER_ID);
}

/**
 * Ask Android 13+ notification permission once when user starts a timed activity
 * so background timer completion alarms can show a sound/alert notification.
 */
export async function requestAlertPermissionIfNeeded(): Promise<boolean> {
  if (Platform.OS !== 'android' || isJestEnvironment()) return false;
  if (Number(Platform.Version) < 33) return true;

  try {
    const result = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function scheduleCompletionAlarm(
  activityId: string,
  title: string,
  durationMinutes: number,
  endsAtMs: number
): Promise<boolean> {
  if (!nativeTimer || isJestEnvironment()) return false;
  if (!Number.isFinite(endsAtMs) || endsAtMs <= Date.now()) return false;

  try {
    await requestAlertPermissionIfNeeded();
    return await nativeTimer.scheduleTimerAlarm(activityId, title, durationMinutes, endsAtMs);
  } catch {
    return false;
  }
}

export async function cancelCompletionAlarm(activityId: string): Promise<boolean> {
  if (!nativeTimer || isJestEnvironment()) return false;
  try {
    return await nativeTimer.cancelTimerAlarm(activityId);
  } catch {
    return false;
  }
}

export async function playTimerEndBeep(): Promise<boolean> {
  if (!nativeTimer || isJestEnvironment()) return false;
  try {
    return await nativeTimer.playCompletionBeep();
  } catch {
    return false;
  }
}

export async function stopTimerEndSound(): Promise<boolean> {
  if (!nativeTimer || isJestEnvironment()) return false;
  try {
    return await nativeTimer.stopCompletionSound();
  } catch {
    return false;
  }
}

export function formatCountdown(remainingMs: number): string {
  const clampedSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(clampedSeconds / 3600);
  const mins = Math.floor((clampedSeconds % 3600) / 60);
  const secs = clampedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatClockTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}
