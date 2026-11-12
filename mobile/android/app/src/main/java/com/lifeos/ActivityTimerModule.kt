package com.lifeos

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ActivityTimerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var activeToneGenerator: ToneGenerator? = null
  private val scheduledRunnables = mutableListOf<Runnable>()

  override fun getName(): String = "ActivityTimer"

  @ReactMethod
  fun scheduleTimerAlarm(
    activityId: String,
    title: String,
    durationMinutes: Int,
    triggerAtMs: Double,
    promise: Promise
  ) {
    try {
      val triggerMs = triggerAtMs.toLong()
      if (triggerMs <= System.currentTimeMillis()) {
        promise.resolve(false)
        return
      }

      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val pendingIntent = buildAlarmPendingIntent(activityId, title, durationMinutes)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (alarmManager.canScheduleExactAlarms()) {
          alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
        } else {
          alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
        }
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
      } else {
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pendingIntent)
      }

      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SCHEDULE_ALARM_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun cancelTimerAlarm(activityId: String, promise: Promise) {
    try {
      val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val pendingIntent = buildAlarmPendingIntent(activityId, "", 0)
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CANCEL_ALARM_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun playCompletionBeep(promise: Promise) {
    try {
      stopInternalTone()

      val tone = ToneGenerator(AudioManager.STREAM_ALARM, 90)
      activeToneGenerator = tone

      // 3 distinct short alarm beeps (beep - pause - beep - pause - beep)
      val offsetsMs = longArrayOf(0L, 420L, 840L)
      offsetsMs.forEach { delay ->
        val r = Runnable {
          if (activeToneGenerator === tone) {
            try {
              tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 260)
            } catch (_: Exception) {
              // Ignore audio release race
            }
          }
        }
        scheduledRunnables.add(r)
        mainHandler.postDelayed(r, delay)
      }

      val releaseRunnable = Runnable {
        if (activeToneGenerator === tone) {
          stopInternalTone()
        }
      }
      scheduledRunnables.add(releaseRunnable)
      mainHandler.postDelayed(releaseRunnable, 1500L)

      triggerCompletionVibration()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("PLAY_BEEP_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun stopCompletionSound(promise: Promise) {
    try {
      stopInternalTone()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("STOP_BEEP_FAILED", e.message, e)
    }
  }

  private fun stopInternalTone() {
    scheduledRunnables.forEach { mainHandler.removeCallbacks(it) }
    scheduledRunnables.clear()
    try {
      activeToneGenerator?.stopTone()
      activeToneGenerator?.release()
    } catch (_: Exception) {
      // Ignore release exceptions
    } finally {
      activeToneGenerator = null
    }
  }

  @Suppress("DEPRECATION")
  private fun triggerCompletionVibration() {
    try {
      val pattern = longArrayOf(0, 260, 140, 260, 140, 340)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager =
          reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        vibratorManager.defaultVibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
      } else {
        val vibrator = reactContext.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
          vibrator.vibrate(pattern, -1)
        }
      }
    } catch (_: Exception) {
      // Vibration is best-effort
    }
  }

  private fun buildAlarmPendingIntent(
    activityId: String,
    title: String,
    durationMinutes: Int
  ): PendingIntent {
    val intent = Intent(reactContext, ActivityTimerReceiver::class.java).apply {
      action = "com.lifeos.ACTION_ACTIVITY_TIMER_COMPLETE"
      putExtra(ActivityTimerReceiver.EXTRA_ACTIVITY_ID, activityId)
      putExtra(ActivityTimerReceiver.EXTRA_TITLE, title)
      putExtra(ActivityTimerReceiver.EXTRA_DURATION_MINUTES, durationMinutes)
    }
    return PendingIntent.getBroadcast(
      reactContext,
      activityId.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  override fun invalidate() {
    stopInternalTone()
    super.invalidate()
  }
}
