package com.lifeos

import android.app.Activity
import android.app.RecoverableSecurityException
import android.content.ClipData
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MemoriesVaultModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var pendingPickerPromise: Promise? = null
  private var pendingCapturePromise: Promise? = null
  private var pendingCaptureFile: File? = null
  private var pendingCaptureKind: String = "photo"
  private var pendingDeletePromise: Promise? = null
  private var pendingDeletePromptCount: Int = 0
  private var pendingDeleteAlreadyDeleted: Int = 0
  private var pendingDeleteAlreadyFailed: Int = 0

  private var mediaRecorder: MediaRecorder? = null
  private var activeRecordingFile: File? = null
  private var mediaPlayer: MediaPlayer? = null

  private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?
    ) {
      if (requestCode == REQ_PICK_FILES) {
        val promise = pendingPickerPromise
        pendingPickerPromise = null
        if (promise == null) return

        if (resultCode != Activity.RESULT_OK || data == null) {
          promise.resolve(Arguments.createArray())
          return
        }

        val uris = collectUrisFromIntent(data)
        if (uris.isEmpty()) {
          promise.resolve(Arguments.createArray())
          return
        }

        // Copy picked content URIs off the main UI thread so multi-photo/video imports stay responsive
        Thread {
          try {
            val results: WritableArray = Arguments.createArray()
            uris.forEach { uri ->
              results.pushMap(importContentUriToAppStorage(uri))
            }
            promise.resolve(results)
          } catch (e: Exception) {
            promise.reject("PICK_FAILED", e.message, e)
          }
        }.start()
      } else if (requestCode == REQ_CAPTURE_MEDIA) {
        val promise = pendingCapturePromise
        val tempFile = pendingCaptureFile
        val kind = pendingCaptureKind
        pendingCapturePromise = null
        pendingCaptureFile = null
        if (promise == null) return

        if (resultCode != Activity.RESULT_OK || tempFile == null || !tempFile.exists() || tempFile.length() == 0L) {
          tempFile?.delete()
          promise.resolve(null)
          return
        }

        try {
          val ext = if (kind == "video") "mp4" else "jpg"
          val mimeType = if (kind == "video") "video/mp4" else "image/jpeg"
          val mediaType = if (kind == "video") "video" else "photo"
          val destName = "capture_${System.currentTimeMillis()}.$ext"
          val destFile = File(ensureRegularDir(), "${UUID.randomUUID()}_$destName")
          tempFile.copyTo(destFile, overwrite = true)
          tempFile.delete()

          val map = Arguments.createMap().apply {
            putString("fileName", destName)
            putString("mediaType", mediaType)
            putString("mimeType", mimeType)
            putDouble("sizeBytes", destFile.length().toDouble())
            putString("localUri", Uri.fromFile(destFile).toString())
            putNull("sourceUri")
          }
          promise.resolve(map)
        } catch (e: Exception) {
          tempFile.delete()
          promise.reject("CAPTURE_FAILED", e.message, e)
        }
      } else if (requestCode == REQ_DELETE_SOURCE) {
        val promise = pendingDeletePromise
        val promptCount = pendingDeletePromptCount
        val deletedSoFar = pendingDeleteAlreadyDeleted
        val failedSoFar = pendingDeleteAlreadyFailed
        pendingDeletePromise = null
        pendingDeletePromptCount = 0
        pendingDeleteAlreadyDeleted = 0
        pendingDeleteAlreadyFailed = 0
        if (promise == null) return

        val approved = resultCode == Activity.RESULT_OK
        val result = Arguments.createMap().apply {
          putInt("deletedCount", deletedSoFar + if (approved) promptCount else 0)
          putBoolean("promptRequired", true)
          putInt("failedCount", failedSoFar + if (approved) 0 else promptCount)
        }
        promise.resolve(result)
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "MemoriesVault"

  @ReactMethod
  fun pickFiles(mode: String, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current activity is unavailable.")
      return
    }
    if (pendingPickerPromise != null) {
      promise.reject("PICKER_BUSY", "File picker is already open.")
      return
    }

    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        when (mode) {
          "photo" -> {
            type = "image/*"
          }
          "video" -> {
            type = "video/*"
          }
          "audio" -> {
            type = "audio/*"
          }
          "document" -> {
            type = "*/*"
            putExtra(
              Intent.EXTRA_MIME_TYPES,
              arrayOf(
                "application/pdf",
                "text/*",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/zip"
              )
            )
          }
          else -> {
            type = "*/*"
          }
        }
      }

      pendingPickerPromise = promise
      activity.startActivityForResult(intent, REQ_PICK_FILES)
    } catch (e: Exception) {
      pendingPickerPromise = null
      promise.reject("PICK_INTENT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun captureMedia(kind: String, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current activity is unavailable.")
      return
    }
    if (pendingCapturePromise != null) {
      promise.reject("CAPTURE_BUSY", "Camera capture already in progress.")
      return
    }

    try {
      val isVideo = kind == "video"
      val ext = if (isVideo) ".mp4" else ".jpg"
      val tmpFile = File.createTempFile("lifeos_cap_", ext, reactContext.cacheDir)
      val contentUri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        tmpFile
      )

      val intent = Intent(
        if (isVideo) MediaStore.ACTION_VIDEO_CAPTURE else MediaStore.ACTION_IMAGE_CAPTURE
      ).apply {
        putExtra(MediaStore.EXTRA_OUTPUT, contentUri)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      pendingCapturePromise = promise
      pendingCaptureFile = tmpFile
      pendingCaptureKind = if (isVideo) "video" else "photo"
      activity.startActivityForResult(intent, REQ_CAPTURE_MEDIA)
    } catch (e: Exception) {
      pendingCapturePromise = null
      pendingCaptureFile?.delete()
      pendingCaptureFile = null
      promise.reject("CAPTURE_INTENT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun startVoiceRecording(promise: Promise) {
    try {
      releaseRecorderSafely()
      val dir = ensureRegularDir()
      val outFile = File(dir, "voice_${System.currentTimeMillis()}.m4a")
      @Suppress("DEPRECATION")
      val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        MediaRecorder(reactContext)
      } else {
        MediaRecorder()
      }
      recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
      recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      recorder.setAudioEncodingBitRate(128000)
      recorder.setAudioSamplingRate(44100)
      recorder.setOutputFile(outFile.absolutePath)
      recorder.prepare()
      recorder.start()

      mediaRecorder = recorder
      activeRecordingFile = outFile
      promise.resolve(true)
    } catch (e: Exception) {
      releaseRecorderSafely()
      promise.reject("RECORD_START_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun stopVoiceRecording(promise: Promise) {
    val file = activeRecordingFile
    val recorder = mediaRecorder
    mediaRecorder = null
    activeRecordingFile = null

    try {
      recorder?.stop()
      recorder?.release()
    } catch (_: Exception) {
      // Ignore short recording stop errors
    }

    if (file == null || !file.exists() || file.length() == 0L) {
      file?.delete()
      promise.resolve(null)
      return
    }

    val map = Arguments.createMap().apply {
      putString("fileName", file.name)
      putString("mediaType", "audio")
      putString("mimeType", "audio/mp4")
      putDouble("sizeBytes", file.length().toDouble())
      putString("localUri", Uri.fromFile(file).toString())
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun playAudio(pathOrUri: String, promise: Promise) {
    try {
      stopAudioInternal()
      val player = MediaPlayer()
      if (pathOrUri.startsWith("http://") || pathOrUri.startsWith("https://")) {
        player.setDataSource(pathOrUri)
        player.setOnPreparedListener {
          it.start()
        }
        player.setOnCompletionListener {
          stopAudioInternal()
        }
        player.prepareAsync()
        mediaPlayer = player
        promise.resolve(true)
        return
      }

      val file = resolveLocalFile(pathOrUri)
        ?: throw IllegalArgumentException("Audio file not found.")
      player.setDataSource(file.absolutePath)
      player.setOnCompletionListener {
        stopAudioInternal()
      }
      player.prepare()
      player.start()
      mediaPlayer = player
      promise.resolve(true)
    } catch (e: Exception) {
      stopAudioInternal()
      promise.reject("AUDIO_PLAY_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setAudioSpeed(speed: Float, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        mediaPlayer?.let { player ->
          if (player.isPlaying) {
            val params = player.playbackParams
            params.speed = speed
            player.playbackParams = params
          }
        }
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SET_SPEED_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun isAudioPlaying(promise: Promise) {
    try {
      val isPlaying = mediaPlayer?.isPlaying == true
      promise.resolve(isPlaying)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun readFileAsBase64(pathOrUri: String, promise: Promise) {
    Thread {
      try {
        val file = resolveLocalFile(pathOrUri)
          ?: throw IllegalArgumentException("File not found locally: $pathOrUri")
        val bytes = file.readBytes()
        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        promise.resolve(base64)
      } catch (e: Exception) {
        promise.reject("READ_BASE64_FAILED", e.message, e)
      }
    }.start()
  }

  @ReactMethod
  fun saveBase64ToFile(base64Data: String, fileName: String, promise: Promise) {
    Thread {
      try {
        val cleanName = fileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val dir = ensureRegularDir()
        val destFile = File(dir, "${System.currentTimeMillis()}_$cleanName")
        val pureB64 = if (base64Data.contains(",")) {
          base64Data.substringAfter(",")
        } else {
          base64Data
        }
        val bytes = Base64.decode(pureB64, Base64.NO_WRAP)
        destFile.writeBytes(bytes)
        val map = Arguments.createMap().apply {
          putString("localUri", Uri.fromFile(destFile).toString())
          putString("filePath", destFile.absolutePath)
          putString("fileName", cleanName)
          putDouble("sizeBytes", destFile.length().toDouble())
        }
        promise.resolve(map)
      } catch (e: Exception) {
        promise.reject("SAVE_BASE64_FAILED", e.message, e)
      }
    }.start()
  }

  @ReactMethod
  fun stopAudio(promise: Promise) {
    stopAudioInternal()
    promise.resolve(true)
  }

  @ReactMethod
  fun encryptFileToVault(pathOrUri: String, itemId: String, deleteSource: Boolean, promise: Promise) {
    try {
      val srcFile = resolveLocalFile(pathOrUri)
        ?: throw IllegalArgumentException("Source file does not exist locally.")
      val vaultDir = ensureVaultDir()
      val safeId = itemId.replace(Regex("[^a-zA-Z0-9_-]"), "_")
      val destFile = File(vaultDir, "${safeId}_${System.currentTimeMillis()}.enc")

      val secretKey = getOrCreateAesKey()
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, secretKey)
      val iv = cipher.iv

      FileOutputStream(destFile).use { fos ->
        fos.write(iv.size)
        fos.write(iv)
        CipherOutputStream(fos, cipher).use { cos ->
          FileInputStream(srcFile).use { fis ->
            fis.copyTo(cos)
          }
        }
      }

      val plainSize = srcFile.length()
      if (deleteSource && isAppManagedPath(srcFile)) {
        srcFile.delete()
      }

      val result = Arguments.createMap().apply {
        putString("vaultUri", Uri.fromFile(destFile).toString())
        putDouble("sizeBytes", plainSize.toDouble())
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("VAULT_ENCRYPT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun decryptVaultFileToPreview(vaultPathOrUri: String, fileName: String, promise: Promise) {
    try {
      val encFile = resolveLocalFile(vaultPathOrUri)
        ?: throw IllegalArgumentException("Encrypted vault file missing.")
      val previewDir = ensurePreviewDir()
      val cleanName = sanitizeFileName(fileName)
      val outFile = File(previewDir, "${System.currentTimeMillis()}_$cleanName")

      decryptFile(encFile, outFile)

      val result = Arguments.createMap().apply {
        putString("previewUri", Uri.fromFile(outFile).toString())
        putString("previewPath", outFile.absolutePath)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("VAULT_DECRYPT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun decryptVaultFileToRegular(vaultPathOrUri: String, fileName: String, promise: Promise) {
    try {
      val encFile = resolveLocalFile(vaultPathOrUri)
        ?: throw IllegalArgumentException("Encrypted vault file missing.")
      val regularDir = ensureRegularDir()
      val cleanName = sanitizeFileName(fileName)
      val outFile = File(regularDir, "${UUID.randomUUID()}_$cleanName")

      decryptFile(encFile, outFile)
      encFile.delete()

      val result = Arguments.createMap().apply {
        putString("localUri", Uri.fromFile(outFile).toString())
        putDouble("sizeBytes", outFile.length().toDouble())
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("VAULT_RESTORE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun clearVaultPreviewCache(promise: Promise) {
    try {
      val dir = File(reactContext.cacheDir, "vault_preview")
      if (dir.exists()) {
        dir.listFiles()?.forEach { it.deleteRecursively() }
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CLEAR_PREVIEW_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun openFileExternally(pathOrUri: String, mimeType: String?, promise: Promise) {
    try {
      val file = resolveLocalFile(pathOrUri)
        ?: throw IllegalArgumentException("File not found locally.")
      val shareableFile = ensureShareableFile(file)
      val uri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        shareableFile
      )
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mimeType ?: "*/*")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OPEN_EXTERNAL_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun shareFiles(pathsOrUris: ReadableArray, mimeType: String?, promise: Promise) {
    try {
      val uriList = ArrayList<Uri>()
      for (i in 0 until pathsOrUris.size()) {
        val raw = pathsOrUris.getString(i) ?: continue
        val file = resolveLocalFile(raw) ?: continue
        val shareable = ensureShareableFile(file)
        uriList.add(
          FileProvider.getUriForFile(
            reactContext,
            "${reactContext.packageName}.fileprovider",
            shareable
          )
        )
      }

      if (uriList.isEmpty()) {
        promise.reject("SHARE_EMPTY", "No local files available to share.")
        return
      }

      val intent = if (uriList.size == 1) {
        Intent(Intent.ACTION_SEND).apply {
          type = mimeType ?: "*/*"
          putExtra(Intent.EXTRA_STREAM, uriList[0])
        }
      } else {
        Intent(Intent.ACTION_SEND_MULTIPLE).apply {
          type = mimeType ?: "*/*"
          putParcelableArrayListExtra(Intent.EXTRA_STREAM, uriList)
        }
      }.apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      val chooser = Intent.createChooser(intent, "Share from Life OS Memories").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(chooser)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SHARE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun deleteLocalFile(pathOrUri: String, promise: Promise) {
    try {
      val file = resolveLocalFile(pathOrUri)
      if (file != null && file.exists() && isAppManagedPath(file)) {
        file.delete()
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("DELETE_LOCAL_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun getLocalStorageStats(promise: Promise) {
    try {
      val regularBytes = sumDirectoryBytes(ensureRegularDir())
      val vaultBytes = sumDirectoryBytes(ensureVaultDir())
      val map = Arguments.createMap().apply {
        putDouble("regularBytes", regularBytes.toDouble())
        putDouble("vaultBytes", vaultBytes.toDouble())
        putDouble("totalBytes", (regularBytes + vaultBytes).toDouble())
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("STATS_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setScreenSecure(enabled: Boolean, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      try {
        if (enabled) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("FLAG_SECURE_FAILED", e.message, e)
      }
    }
  }

  @ReactMethod
  fun canUseBiometric(promise: Promise) {
    try {
      val manager = BiometricManager.from(reactContext)
      val status = manager.canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
          BiometricManager.Authenticators.BIOMETRIC_WEAK
      )
      promise.resolve(status == BiometricManager.BIOMETRIC_SUCCESS)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun storeBiometricKey(key: String, promise: Promise) {
    try {
      val secretKey = getOrCreateAesKey()
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, secretKey)
      val encrypted = cipher.doFinal(key.toByteArray(Charsets.UTF_8))
      val ivB64 = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
      val dataB64 = Base64.encodeToString(encrypted, Base64.NO_WRAP)

      reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(PREF_BIO_IV, ivB64)
        .putString(PREF_BIO_DATA, dataB64)
        .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("STORE_BIO_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun unlockWithBiometric(title: String, subtitle: String, promise: Promise) {
    val activity = reactContext.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.reject("NO_FRAGMENT_ACTIVITY", "Biometric prompt requires active screen.")
      return
    }

    val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val ivB64 = prefs.getString(PREF_BIO_IV, null)
    val dataB64 = prefs.getString(PREF_BIO_DATA, null)
    if (ivB64.isNullOrEmpty() || dataB64.isNullOrEmpty()) {
      promise.reject("NO_STORED_BIO_KEY", "Set up Safe Vault PIN on this device first.")
      return
    }

    activity.runOnUiThread {
      try {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
          activity,
          executor,
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              try {
                val iv = Base64.decode(ivB64, Base64.NO_WRAP)
                val data = Base64.decode(dataB64, Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, getOrCreateAesKey(), GCMParameterSpec(128, iv))
                val decrypted = String(cipher.doFinal(data), Charsets.UTF_8)
                promise.resolve(decrypted)
              } catch (e: Exception) {
                promise.reject("BIO_DECRYPT_FAILED", e.message, e)
              }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              promise.reject("BIO_ERROR", errString.toString())
            }

            override fun onAuthenticationFailed() {
              // BiometricPrompt stays open for retry
            }
          }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
          .setTitle(title)
          .setSubtitle(subtitle)
          .setNegativeButtonText("Use Vault PIN")
          .setAllowedAuthenticators(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
              BiometricManager.Authenticators.BIOMETRIC_WEAK
          )
          .build()

        prompt.authenticate(promptInfo)
      } catch (e: Exception) {
        promise.reject("BIO_PROMPT_FAILED", e.message, e)
      }
    }
  }

  @ReactMethod
  fun deleteSourceUris(sourceUris: ReadableArray, promise: Promise) {
    val resolver = reactContext.contentResolver
    val uris = mutableListOf<Uri>()
    for (i in 0 until sourceUris.size()) {
      val raw = sourceUris.getString(i)
      if (!raw.isNullOrBlank()) {
        uris.add(Uri.parse(raw))
      }
    }

    if (uris.isEmpty()) {
      promise.resolve(
        Arguments.createMap().apply {
          putInt("deletedCount", 0)
          putBoolean("promptRequired", false)
          putInt("failedCount", 0)
        }
      )
      return
    }

    var silentDeleted = 0
    var failedCount = 0
    val promptUris = mutableListOf<Uri>()

    uris.forEach { srcUri ->
      var removed = false
      if (DocumentsContract.isDocumentUri(reactContext, srcUri)) {
        try {
          if (DocumentsContract.deleteDocument(resolver, srcUri)) {
            removed = true
            silentDeleted++
          }
        } catch (_: Exception) {
          // Document providers for MediaStore require MediaStore delete flow below
        }
      }

      if (!removed) {
        val mediaUri = resolveDeletableMediaUri(srcUri)
        if (mediaUri != null) {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promptUris.add(mediaUri)
          } else {
            try {
              val deletedRows = resolver.delete(mediaUri, null, null)
              if (deletedRows > 0) {
                silentDeleted++
              } else {
                failedCount++
              }
            } catch (sec: SecurityException) {
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && sec is RecoverableSecurityException) {
                promptUris.add(mediaUri)
              } else {
                failedCount++
              }
            } catch (_: Exception) {
              failedCount++
            }
          }
        } else {
          failedCount++
        }
      }
    }

    if (promptUris.isEmpty()) {
      promise.resolve(
        Arguments.createMap().apply {
          putInt("deletedCount", silentDeleted)
          putBoolean("promptRequired", false)
          putInt("failedCount", failedCount)
        }
      )
      return
    }

    val activity = reactContext.currentActivity
    if (activity == null || pendingDeletePromise != null) {
      promise.resolve(
        Arguments.createMap().apply {
          putInt("deletedCount", silentDeleted)
          putBoolean("promptRequired", false)
          putInt("failedCount", failedCount + promptUris.size)
        }
      )
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      try {
        val deleteIntent = MediaStore.createDeleteRequest(resolver, promptUris)
        pendingDeletePromise = promise
        pendingDeletePromptCount = promptUris.size
        pendingDeleteAlreadyDeleted = silentDeleted
        pendingDeleteAlreadyFailed = failedCount
        activity.startIntentSenderForResult(
          deleteIntent.intentSender,
          REQ_DELETE_SOURCE,
          null,
          0,
          0,
          0
        )
        return
      } catch (_: Exception) {
        pendingDeletePromise = null
        pendingDeletePromptCount = 0
        pendingDeleteAlreadyDeleted = 0
        pendingDeleteAlreadyFailed = 0
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val firstUri = promptUris.first()
      val remainingCount = promptUris.size - 1
      try {
        resolver.delete(firstUri, null, null)
        promise.resolve(
          Arguments.createMap().apply {
            putInt("deletedCount", silentDeleted + 1)
            putBoolean("promptRequired", false)
            putInt("failedCount", failedCount + remainingCount)
          }
        )
        return
      } catch (rse: RecoverableSecurityException) {
        try {
          pendingDeletePromise = promise
          pendingDeletePromptCount = 1
          pendingDeleteAlreadyDeleted = silentDeleted
          pendingDeleteAlreadyFailed = failedCount + remainingCount
          activity.startIntentSenderForResult(
            rse.userAction.actionIntent.intentSender,
            REQ_DELETE_SOURCE,
            null,
            0,
            0,
            0
          )
          return
        } catch (_: Exception) {
          pendingDeletePromise = null
          pendingDeletePromptCount = 0
          pendingDeleteAlreadyDeleted = 0
          pendingDeleteAlreadyFailed = 0
        }
      } catch (_: Exception) {
      }
    }

    promise.resolve(
      Arguments.createMap().apply {
        putInt("deletedCount", silentDeleted)
        putBoolean("promptRequired", false)
        putInt("failedCount", failedCount + promptUris.size)
      }
    )
  }

  private fun resolveDeletableMediaUri(uri: Uri): Uri? {
    if (uri.authority == MediaStore.AUTHORITY) {
      return uri
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        val mapped = MediaStore.getMediaUri(reactContext, uri)
        if (mapped != null) return mapped
      } catch (_: Exception) {
      }
    }

    if (DocumentsContract.isDocumentUri(reactContext, uri) &&
      uri.authority == "com.android.providers.media.documents"
    ) {
      val docId = DocumentsContract.getDocumentId(uri)
      val parts = docId.split(":", limit = 2)
      if (parts.size == 2) {
        val type = parts[0]
        val id = parts[1].toLongOrNull() ?: return null
        return when (type) {
          "image" -> ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
          "video" -> ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)
          "audio" -> ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
          else -> ContentUris.withAppendedId(MediaStore.Files.getContentUri("external"), id)
        }
      }
    }

    return null
  }

  private fun collectUrisFromIntent(data: Intent): List<Uri> {
    val result = mutableListOf<Uri>()
    val clipData: ClipData? = data.clipData
    if (clipData != null) {
      for (i in 0 until clipData.itemCount) {
        clipData.getItemAt(i)?.uri?.let { result.add(it) }
      }
    } else {
      data.data?.let { result.add(it) }
    }
    return result
  }

  private fun importContentUriToAppStorage(uri: Uri): WritableMap {
    val resolver = reactContext.contentResolver
    var displayName = "file_${System.currentTimeMillis()}"
    var reportedSize = -1L

    resolver.query(uri, null, null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (nameIdx >= 0) {
          cursor.getString(nameIdx)?.let { if (it.isNotBlank()) displayName = it }
        }
        if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) {
          reportedSize = cursor.getLong(sizeIdx)
        }
      }
    }

    val mimeType = resolver.getType(uri) ?: guessMimeFromName(displayName)
    val mediaType = classifyMediaType(mimeType, displayName)
    val safeName = sanitizeFileName(displayName)
    val destFile = File(ensureRegularDir(), "${UUID.randomUUID()}_$safeName")

    resolver.openInputStream(uri)?.use { input ->
      FileOutputStream(destFile).use { output ->
        input.copyTo(output)
      }
    } ?: throw IllegalStateException("Unable to read selected file.")

    val finalSize = if (destFile.length() > 0) destFile.length() else maxOf(0L, reportedSize)

    return Arguments.createMap().apply {
      putString("fileName", displayName)
      putString("mediaType", mediaType)
      putString("mimeType", mimeType)
      putDouble("sizeBytes", finalSize.toDouble())
      putString("localUri", Uri.fromFile(destFile).toString())
      putString("sourceUri", uri.toString())
    }
  }

  private fun classifyMediaType(mimeType: String, fileName: String): String {
    val lowerMime = mimeType.lowercase()
    val lowerName = fileName.lowercase()
    if (lowerMime.startsWith("image/") || lowerName.matches(Regex(".*\\.(jpg|jpeg|png|gif|webp|heic)$"))) {
      return "photo"
    }
    if (lowerMime.startsWith("video/") || lowerName.matches(Regex(".*\\.(mp4|mov|mkv|avi|webm|3gp)$"))) {
      return "video"
    }
    if (lowerMime.startsWith("audio/") || lowerName.matches(Regex(".*\\.(mp3|m4a|aac|wav|ogg|flac)$"))) {
      return "audio"
    }
    if (
      lowerMime.contains("pdf") ||
      lowerMime.startsWith("text/") ||
      lowerMime.contains("document") ||
      lowerMime.contains("word") ||
      lowerMime.contains("sheet") ||
      lowerMime.contains("zip") ||
      lowerName.matches(Regex(".*\\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip)$"))
    ) {
      return "document"
    }
    return "other"
  }

  private fun guessMimeFromName(name: String): String {
    val lower = name.lowercase()
    return when {
      lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
      lower.endsWith(".png") -> "image/png"
      lower.endsWith(".webp") -> "image/webp"
      lower.endsWith(".mp4") -> "video/mp4"
      lower.endsWith(".mp3") -> "audio/mpeg"
      lower.endsWith(".m4a") -> "audio/mp4"
      lower.endsWith(".pdf") -> "application/pdf"
      lower.endsWith(".txt") -> "text/plain"
      else -> "application/octet-stream"
    }
  }

  private fun ensureRegularDir(): File = File(reactContext.filesDir, "memories_files").apply {
    if (!exists()) mkdirs()
    val noMedia = File(this, ".nomedia")
    if (!noMedia.exists()) noMedia.createNewFile()
  }

  private fun ensureVaultDir(): File = File(reactContext.filesDir, "memories_vault").apply {
    if (!exists()) mkdirs()
    val noMedia = File(this, ".nomedia")
    if (!noMedia.exists()) noMedia.createNewFile()
  }

  private fun ensurePreviewDir(): File = File(reactContext.cacheDir, "vault_preview").apply {
    if (!exists()) mkdirs()
    val noMedia = File(this, ".nomedia")
    if (!noMedia.exists()) noMedia.createNewFile()
  }

  private fun getOrCreateAesKey(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val existing = ks.getKey(KEYSTORE_ALIAS, null) as? SecretKey
    if (existing != null) return existing

    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    val spec = KeyGenParameterSpec.Builder(
      KEYSTORE_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build()
    generator.init(spec)
    return generator.generateKey()
  }

  private fun decryptFile(encFile: File, outFile: File) {
    val secretKey = getOrCreateAesKey()
    FileInputStream(encFile).use { fis ->
      val ivLen = fis.read()
      if (ivLen <= 0 || ivLen > 32) {
        throw IllegalStateException("Corrupted encrypted vault header.")
      }
      val iv = ByteArray(ivLen)
      var offset = 0
      while (offset < ivLen) {
        val read = fis.read(iv, offset, ivLen - offset)
        if (read < 0) throw IllegalStateException("Unexpected end of vault file.")
        offset += read
      }

      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(128, iv))
      CipherInputStream(fis, cipher).use { cis ->
        FileOutputStream(outFile).use { fos ->
          cis.copyTo(fos)
        }
      }
    }
  }

  private fun resolveLocalFile(pathOrUri: String): File? {
    if (pathOrUri.isBlank()) return null
    return if (pathOrUri.startsWith("file://")) {
      val path = Uri.parse(pathOrUri).path ?: return null
      File(path).takeIf { it.exists() }
    } else {
      File(pathOrUri).takeIf { it.exists() }
    }
  }

  private fun ensureShareableFile(file: File): File {
    val cacheRoot = reactContext.cacheDir.canonicalPath
    val regularRoot = ensureRegularDir().canonicalPath
    val target = file.canonicalPath
    if (target.startsWith(cacheRoot) || target.startsWith(regularRoot)) {
      return file
    }
    val tmpCopy = File(ensurePreviewDir(), file.name)
    file.copyTo(tmpCopy, overwrite = true)
    return tmpCopy
  }

  private fun isAppManagedPath(file: File): Boolean {
    val target = file.canonicalPath
    return target.startsWith(reactContext.filesDir.canonicalPath) ||
      target.startsWith(reactContext.cacheDir.canonicalPath)
  }

  private fun sanitizeFileName(name: String): String =
    name.replace(Regex("[^a-zA-Z0-9._-]"), "_").takeLast(120)

  private fun sumDirectoryBytes(dir: File): Long {
    if (!dir.exists()) return 0L
    return dir.walkTopDown().filter { it.isFile && it.name != ".nomedia" }.sumOf { it.length() }
  }

  private fun releaseRecorderSafely() {
    try {
      mediaRecorder?.stop()
    } catch (_: Exception) {
    }
    try {
      mediaRecorder?.release()
    } catch (_: Exception) {
    }
    mediaRecorder = null
    activeRecordingFile?.delete()
    activeRecordingFile = null
  }

  private fun stopAudioInternal() {
    try {
      mediaPlayer?.stop()
    } catch (_: Exception) {
    }
    try {
      mediaPlayer?.release()
    } catch (_: Exception) {
    }
    mediaPlayer = null
  }

  override fun invalidate() {
    reactContext.removeActivityEventListener(activityEventListener)
    releaseRecorderSafely()
    stopAudioInternal()
    super.invalidate()
  }

  companion object {
    private const val REQ_PICK_FILES = 9101
    private const val REQ_CAPTURE_MEDIA = 9102
    private const val REQ_DELETE_SOURCE = 9103
    private const val KEYSTORE_ALIAS = "lifeos_safe_vault_aes_key"
    private const val PREFS_NAME = "lifeos_vault_prefs"
    private const val PREF_BIO_IV = "bio_iv"
    private const val PREF_BIO_DATA = "bio_data"
  }
}
