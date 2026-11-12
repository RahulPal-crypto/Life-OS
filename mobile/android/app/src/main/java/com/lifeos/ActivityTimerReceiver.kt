package com.lifeos

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

class ActivityTimerReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val activityId = intent.getStringExtra(EXTRA_ACTIVITY_ID) ?: "timer"
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "Activity"
    val durationMinutes = intent.getIntExtra(EXTRA_DURATION_MINUTES, 0)

    ensureNotificationChannel(context)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        activityId.hashCode(),
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val body = if (durationMinutes > 0) {
      "$title (${durationMinutes} min) has finished and stopped automatically."
    } else {
      "$title has finished and stopped automatically."
    }

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Timer Completed - $title")
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setAutoCancel(true)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
      .setContentIntent(contentIntent)
      .build()

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(activityId.hashCode(), notification)
  }

  private fun ensureNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    val audioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Activity Timer Alerts",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Plays an alarm notification when a timed My Day activity finishes."
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 350, 200, 350, 200, 450)
      setSound(alarmSound, audioAttributes)
    }

    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "lifeos_timer_alerts"
    const val EXTRA_ACTIVITY_ID = "extra_activity_id"
    const val EXTRA_TITLE = "extra_title"
    const val EXTRA_DURATION_MINUTES = "extra_duration_minutes"
  }
}
