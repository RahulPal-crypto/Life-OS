package com.lifeos

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ConnectCallModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  private val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
  private var currentRingtone: Ringtone? = null
  private var toneGenerator: ToneGenerator? = null
  private var proximityWakeLock: PowerManager.WakeLock? = null
  private var vibrator: Vibrator? = null

  init {
    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val vibratorManager = reactContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
      vibratorManager?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      reactContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  override fun getName(): String = "ConnectCall"

  @ReactMethod
  fun startRinging(isIncoming: Boolean, promise: Promise) {
    try {
      stopRingingInternal()

      if (isIncoming) {
        // Play system incoming call ringtone
        val ringtoneUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        currentRingtone = RingtoneManager.getRingtone(reactContext, ringtoneUri)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          currentRingtone?.audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        }
        currentRingtone?.play()

        // Repeating vibration pattern for incoming call: wait 0ms, vibrate 1000ms, pause 1000ms
        val pattern = longArrayOf(0, 1000, 1000)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
          @Suppress("DEPRECATION")
          vibrator?.vibrate(pattern, 0)
        }
      } else {
        // Play outgoing phone ringback tone ("Tring... tring...")
        toneGenerator = ToneGenerator(AudioManager.STREAM_VOICE_CALL, 75)
        toneGenerator?.startTone(ToneGenerator.TONE_SUP_RINGTONE)
      }

      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CALL_RING_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun stopRinging(promise: Promise) {
    try {
      stopRingingInternal()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CALL_STOP_RING_ERROR", e.message, e)
    }
  }

  private fun stopRingingInternal() {
    try {
      currentRingtone?.stop()
      currentRingtone = null

      toneGenerator?.stopTone()
      toneGenerator?.release()
      toneGenerator = null

      vibrator?.cancel()
    } catch (e: Exception) {
      // Ignore cleanup errors
    }
  }

  @ReactMethod
  fun setCallMode(inCall: Boolean, promise: Promise) {
    try {
      stopRingingInternal()
      audioManager?.let { am ->
        if (inCall) {
          am.mode = AudioManager.MODE_IN_COMMUNICATION
          acquireProximity()
        } else {
          am.mode = AudioManager.MODE_NORMAL
          am.isSpeakerphoneOn = false
          am.isMicrophoneMute = false
          releaseProximity()
        }
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("AUDIO_MODE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun setSpeakerphoneOn(on: Boolean, promise: Promise) {
    try {
      audioManager?.let { am ->
        am.isSpeakerphoneOn = on
        if (on) {
          releaseProximity()
        } else {
          acquireProximity()
        }
      }
      promise.resolve(on)
    } catch (e: Exception) {
      promise.reject("SPEAKER_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun isSpeakerphoneOn(promise: Promise) {
    val isOn = audioManager?.isSpeakerphoneOn ?: false
    promise.resolve(isOn)
  }

  @ReactMethod
  fun setMicrophoneMute(muted: Boolean, promise: Promise) {
    try {
      audioManager?.isMicrophoneMute = muted
      promise.resolve(muted)
    } catch (e: Exception) {
      promise.reject("MUTE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun isMicrophoneMute(promise: Promise) {
    val isMuted = audioManager?.isMicrophoneMute ?: false
    promise.resolve(isMuted)
  }

  private fun acquireProximity() {
    try {
      if (proximityWakeLock == null && powerManager != null) {
        val field = PowerManager::class.java.getField("PROXIMITY_SCREEN_OFF_WAKE_LOCK")
        val flag = field.getInt(null)
        proximityWakeLock = powerManager.newWakeLock(flag, "LifeOS:CallProximity")
      }
      if (proximityWakeLock?.isHeld == false) {
        proximityWakeLock?.acquire(3600000) // Max 1 hour
      }
    } catch (e: Exception) {
      // Proximity sensor not available on some tablets/devices
    }
  }

  private fun releaseProximity() {
    try {
      if (proximityWakeLock?.isHeld == true) {
        proximityWakeLock?.release()
      }
    } catch (e: Exception) {
      // Ignore
    }
  }
}
