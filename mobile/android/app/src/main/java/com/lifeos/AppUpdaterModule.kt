package com.lifeos

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class AppUpdaterModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "AppUpdater"

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter compatibility
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter compatibility
  }

  @ReactMethod
  fun getAppVersion(promise: Promise) {
    try {
      val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        reactContext.packageManager.getPackageInfo(
          reactContext.packageName,
          android.content.pm.PackageManager.PackageInfoFlags.of(0)
        )
      } else {
        @Suppress("DEPRECATION")
        reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
      }

      val result = Arguments.createMap().apply {
        putString("versionName", packageInfo.versionName ?: "1.0")
        putDouble("versionCode", PackageInfoCompat.getLongVersionCode(packageInfo).toDouble())
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("VERSION_ERROR", "Unable to inspect installed app version.", e)
    }
  }

  @ReactMethod
  fun canRequestPackageInstalls(promise: Promise) {
    try {
      val allowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.packageManager.canRequestPackageInstalls()
      } else {
        true
      }
      promise.resolve(allowed)
    } catch (e: Exception) {
      promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun openUnknownSourcesSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${reactContext.packageName}")
        ).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SETTINGS_ERROR", "Unable to open app install permission settings.", e)
    }
  }

  @ReactMethod
  fun downloadAndInstallApk(downloadUrl: String, requestedFileName: String, promise: Promise) {
    if (!downloadUrl.startsWith("https://", ignoreCase = true)) {
      promise.reject("INVALID_URL", "APK updates must use a secure HTTPS download URL.")
      return
    }

    executor.execute {
      var connection: HttpURLConnection? = null
      try {
        val downloadDir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
          ?: throw IllegalStateException("App download directory is unavailable.")
        if (!downloadDir.exists()) {
          downloadDir.mkdirs()
        }

        // Remove older cached APK updates to save device storage
        downloadDir.listFiles()?.forEach { existing ->
          if (existing.isFile && existing.name.endsWith(".apk", ignoreCase = true)) {
            existing.delete()
          }
        }

        val safeName = sanitizeApkFileName(requestedFileName)
        val targetFile = File(downloadDir, safeName)
        val tempFile = File(downloadDir, "$safeName.part")
        if (tempFile.exists()) tempFile.delete()

        connection = openConnectionFollowingRedirects(downloadUrl)
        val statusCode = connection.responseCode
        if (statusCode !in 200..299) {
          throw IllegalStateException("Download failed with HTTP status $statusCode.")
        }

        val totalBytes = connection.contentLengthLong
        var downloadedBytes = 0L
        var lastEmittedProgress = -1
        var lastEmitTime = 0L

        connection.inputStream.use { input ->
          FileOutputStream(tempFile).use { output ->
            val buffer = ByteArray(16 * 1024)
            while (true) {
              val read = input.read(buffer)
              if (read == -1) break
              output.write(buffer, 0, read)
              downloadedBytes += read

              val now = System.currentTimeMillis()
              val progress = if (totalBytes > 0) {
                ((downloadedBytes * 100) / totalBytes).toInt().coerceIn(0, 100)
              } else {
                -1
              }

              if (progress != lastEmittedProgress && (now - lastEmitTime >= 150 || progress == 100)) {
                lastEmittedProgress = progress
                lastEmitTime = now
                emitProgress(progress, downloadedBytes, totalBytes)
              }
            }
            output.flush()
          }
        }

        if (!isValidApkFile(tempFile)) {
          tempFile.delete()
          throw IllegalStateException("Downloaded file is not a valid Android APK package.")
        }

        if (targetFile.exists()) targetFile.delete()
        if (!tempFile.renameTo(targetFile)) {
          throw IllegalStateException("Failed to finalize downloaded APK file.")
        }

        emitProgress(100, downloadedBytes, if (totalBytes > 0) totalBytes else downloadedBytes)

        val status = launchApkInstaller(targetFile)
        val result = Arguments.createMap().apply {
          putString("status", status)
          putString("fileName", safeName)
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("UPDATE_DOWNLOAD_ERROR", e.message ?: "Failed to download APK update.", e)
      } finally {
        connection?.disconnect()
      }
    }
  }

  @ReactMethod
  fun installDownloadedApk(requestedFileName: String, promise: Promise) {
    try {
      val downloadDir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        ?: throw IllegalStateException("App download directory is unavailable.")
      val safeName = sanitizeApkFileName(requestedFileName)
      val apkFile = File(downloadDir, safeName)

      if (!apkFile.exists() || !isValidApkFile(apkFile)) {
        promise.reject("APK_NOT_FOUND", "Downloaded APK file was not found.")
        return
      }

      val status = launchApkInstaller(apkFile)
      val result = Arguments.createMap().apply {
        putString("status", status)
        putString("fileName", safeName)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("INSTALL_ERROR", e.message ?: "Unable to launch APK installer.", e)
    }
  }

  private fun launchApkInstaller(apkFile: File): String {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !reactContext.packageManager.canRequestPackageInstalls()
    ) {
      return "permission_required"
    }

    val apkUri = FileProvider.getUriForFile(
      reactContext,
      "${reactContext.packageName}.fileprovider",
      apkFile
    )

    val installIntent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(apkUri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    reactContext.startActivity(installIntent)
    return "installer_opened"
  }

  private fun openConnectionFollowingRedirects(startUrl: String, maxRedirects: Int = 5): HttpURLConnection {
    var currentUrl = startUrl
    repeat(maxRedirects) {
      val conn = (URL(currentUrl).openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 20_000
        readTimeout = 30_000
        setRequestProperty("User-Agent", "LifeOS-Android-Updater")
      }
      val code = conn.responseCode
      if (code in 300..399) {
        val location = conn.getHeaderField("Location")
        conn.disconnect()
        if (location.isNullOrBlank()) {
          throw IllegalStateException("Redirect response missing Location header.")
        }
        currentUrl = URL(URL(currentUrl), location).toString()
        if (!currentUrl.startsWith("https://", ignoreCase = true)) {
          throw IllegalStateException("Blocked non-HTTPS APK redirect.")
        }
      } else {
        return conn
      }
    }
    throw IllegalStateException("Too many redirects while downloading APK update.")
  }

  private fun sanitizeApkFileName(rawName: String): String {
    val base = File(rawName).name.replace(Regex("[^a-zA-Z0-9._-]"), "_")
    val clean = if (base.isBlank()) "lifeos-update.apk" else base
    return if (clean.endsWith(".apk", ignoreCase = true)) clean else "$clean.apk"
  }

  private fun isValidApkFile(file: File): Boolean {
    if (!file.exists() || file.length() < 1024) return false
    val magic = ByteArray(2)
    FileInputStream(file).use { stream ->
      if (stream.read(magic) < 2) return false
    }
    // APK files are ZIP archives starting with 'PK' (0x50 0x4B)
    return magic[0] == 0x50.toByte() && magic[1] == 0x4B.toByte()
  }

  private fun emitProgress(progress: Int, bytesDownloaded: Long, totalBytes: Long) {
    if (!reactContext.hasActiveReactInstance()) return
    val params = Arguments.createMap().apply {
      putInt("progress", progress)
      putDouble("bytesDownloaded", bytesDownloaded.toDouble())
      putDouble("totalBytes", totalBytes.toDouble())
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("AppUpdateDownloadProgress", params)
  }

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }
}
