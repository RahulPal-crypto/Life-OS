package com.lifeos

import android.Manifest
import android.content.pm.PackageManager
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

class ConnectContactsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ConnectContacts"

  @ReactMethod
  fun hasPermission(promise: Promise) {
    val granted = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.READ_CONTACTS
    ) == PackageManager.PERMISSION_GRANTED
    promise.resolve(granted)
  }

  @ReactMethod
  fun getPhoneContacts(promise: Promise) {
    val granted = ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.READ_CONTACTS
    ) == PackageManager.PERMISSION_GRANTED

    if (!granted) {
      promise.reject("PERMISSION_DENIED", "READ_CONTACTS permission is not granted.")
      return
    }

    Thread {
      try {
        val resolver = reactContext.contentResolver
        val cursor = resolver.query(
          ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
          arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
          ),
          null,
          null,
          "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
        )

        val results: WritableArray = Arguments.createArray()
        val seenPhones = HashSet<String>()

        cursor?.use {
          val nameIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
          val numberIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)

          while (it.moveToNext()) {
            val name = if (nameIdx >= 0) it.getString(nameIdx) ?: "Unknown" else "Unknown"
            val rawNumber = if (numberIdx >= 0) it.getString(numberIdx) ?: "" else ""
            val cleanPhone = rawNumber.replace(Regex("[\\s\\-\\(\\)\\.]"), "")

            if (cleanPhone.length >= 7 && !seenPhones.contains(cleanPhone)) {
              seenPhones.add(cleanPhone)
              val map = Arguments.createMap().apply {
                putString("name", name)
                putString("phone", cleanPhone)
              }
              results.pushMap(map)
            }
          }
        }

        promise.resolve(results)
      } catch (e: Exception) {
        promise.reject("CONTACTS_FETCH_ERROR", e.message, e)
      }
    }.start()
  }
}
