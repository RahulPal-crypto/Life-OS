package com.lifeos

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * WhatsApp-style On-Device Local SQLite Database for My Connect.
 * Stores all chats, messages, and contacts locally on the phone's private storage.
 */
class ConnectStorageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val dbHelper = ConnectDatabaseHelper(reactContext)

  override fun getName(): String = "ConnectStorage"

  // 1. Save or update a single conversation
  @ReactMethod
  fun saveConversation(conv: ReadableMap, promise: Promise) {
    Thread {
      try {
        val db = dbHelper.writableDatabase
        val values = ContentValues().apply {
          put("id", conv.getString("id"))
          put("type", conv.getString("type"))
          put("name", if (conv.hasKey("displayName") && !conv.isNull("displayName")) conv.getString("displayName") else null)
          put("avatar", if (conv.hasKey("displayAvatar") && !conv.isNull("displayAvatar")) conv.getString("displayAvatar") else null)
          put("headline", if (conv.hasKey("displayHeadline") && !conv.isNull("displayHeadline")) conv.getString("displayHeadline") else null)
          put("partner_user_id", if (conv.hasKey("partnerUserId") && !conv.isNull("partnerUserId")) conv.getString("partnerUserId") else null)
          put("last_message_text", if (conv.hasKey("lastMessage") && !conv.isNull("lastMessage")) conv.getString("lastMessage") else null)
          put("last_message_at", if (conv.hasKey("lastMessageAt") && !conv.isNull("lastMessageAt")) conv.getString("lastMessageAt") else null)
          put("unread_count", if (conv.hasKey("unreadCount")) conv.getInt("unreadCount") else 0)
          put("is_pinned", if (conv.hasKey("isPinned") && conv.getBoolean("isPinned")) 1 else 0)
          put("is_favorite", if (conv.hasKey("isFavorite") && conv.getBoolean("isFavorite")) 1 else 0)
          put("updated_at", if (conv.hasKey("updatedAt") && !conv.isNull("updatedAt")) conv.getString("updatedAt") else System.currentTimeMillis().toString())
        }
        db.insertWithOnConflict("connect_conversations", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      }
    }.start()
  }

  // 2. Batch save conversations
  @ReactMethod
  fun saveConversations(convs: ReadableArray, promise: Promise) {
    Thread {
      val db = dbHelper.writableDatabase
      db.beginTransaction()
      try {
        for (i in 0 until convs.size()) {
          val conv = convs.getMap(i) ?: continue
          val values = ContentValues().apply {
            put("id", conv.getString("id"))
            put("type", conv.getString("type"))
            put("name", if (conv.hasKey("displayName") && !conv.isNull("displayName")) conv.getString("displayName") else null)
            put("avatar", if (conv.hasKey("displayAvatar") && !conv.isNull("displayAvatar")) conv.getString("displayAvatar") else null)
            put("headline", if (conv.hasKey("displayHeadline") && !conv.isNull("displayHeadline")) conv.getString("displayHeadline") else null)
            put("partner_user_id", if (conv.hasKey("partnerUserId") && !conv.isNull("partnerUserId")) conv.getString("partnerUserId") else null)
            put("last_message_text", if (conv.hasKey("lastMessage") && !conv.isNull("lastMessage")) conv.getString("lastMessage") else null)
            put("last_message_at", if (conv.hasKey("lastMessageAt") && !conv.isNull("lastMessageAt")) conv.getString("lastMessageAt") else null)
            put("unread_count", if (conv.hasKey("unreadCount")) conv.getInt("unreadCount") else 0)
            put("is_pinned", if (conv.hasKey("isPinned") && conv.getBoolean("isPinned")) 1 else 0)
            put("is_favorite", if (conv.hasKey("isFavorite") && conv.getBoolean("isFavorite")) 1 else 0)
            put("updated_at", if (conv.hasKey("updatedAt") && !conv.isNull("updatedAt")) conv.getString("updatedAt") else System.currentTimeMillis().toString())
          }
          db.insertWithOnConflict("connect_conversations", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        }
        db.setTransactionSuccessful()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      } finally {
        db.endTransaction()
      }
    }.start()
  }

  // 3. Load all conversations from local phone database (Instant 0ms)
  @ReactMethod
  fun getConversations(promise: Promise) {
    Thread {
      try {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
          "SELECT * FROM connect_conversations ORDER BY is_pinned DESC, COALESCE(last_message_at, updated_at) DESC",
          null
        )
        val list: WritableArray = Arguments.createArray()
        cursor.use { c ->
          while (c.moveToNext()) {
            val item = Arguments.createMap().apply {
              putString("id", c.getString(c.getColumnIndexOrThrow("id")))
              putString("type", c.getString(c.getColumnIndexOrThrow("type")))
              putString("displayName", c.getString(c.getColumnIndexOrThrow("name")))
              putString("displayAvatar", c.getString(c.getColumnIndexOrThrow("avatar")))
              putString("displayHeadline", c.getString(c.getColumnIndexOrThrow("headline")))
              putString("partnerUserId", c.getString(c.getColumnIndexOrThrow("partner_user_id")))
              putString("lastMessage", c.getString(c.getColumnIndexOrThrow("last_message_text")))
              putString("lastMessageAt", c.getString(c.getColumnIndexOrThrow("last_message_at")))
              putInt("unreadCount", c.getInt(c.getColumnIndexOrThrow("unread_count")))
              putBoolean("isPinned", c.getInt(c.getColumnIndexOrThrow("is_pinned")) == 1)
              putBoolean("isFavorite", c.getInt(c.getColumnIndexOrThrow("is_favorite")) == 1)
              putBoolean("isGroup", c.getString(c.getColumnIndexOrThrow("type")) == "group")
              putString("updatedAt", c.getString(c.getColumnIndexOrThrow("updated_at")))
            }
            list.pushMap(item)
          }
        }
        promise.resolve(list)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      }
    }.start()
  }

  // 4. Save a single message locally & update conversation last message
  @ReactMethod
  fun saveMessage(msg: ReadableMap, promise: Promise) {
    Thread {
      val db = dbHelper.writableDatabase
      db.beginTransaction()
      try {
        val convId = msg.getString("conversationId") ?: ""
        val content = if (msg.hasKey("content") && !msg.isNull("content")) msg.getString("content") else ""
        val msgType = if (msg.hasKey("messageType") && !msg.isNull("messageType")) msg.getString("messageType") else "text"
        val createdAt = if (msg.hasKey("createdAt") && !msg.isNull("createdAt")) msg.getString("createdAt") else System.currentTimeMillis().toString()

        val values = ContentValues().apply {
          put("id", msg.getString("id"))
          put("conversation_id", convId)
          put("sender_id", msg.getString("senderId"))
          put("sender_name", if (msg.hasKey("senderName") && !msg.isNull("senderName")) msg.getString("senderName") else null)
          put("sender_avatar", if (msg.hasKey("senderAvatar") && !msg.isNull("senderAvatar")) msg.getString("senderAvatar") else null)
          put("message_type", msgType)
          put("content", content)
          put("media_url", if (msg.hasKey("mediaUrl") && !msg.isNull("mediaUrl")) msg.getString("mediaUrl") else null)
          put("local_uri", if (msg.hasKey("localUri") && !msg.isNull("localUri")) msg.getString("localUri") else null)
          put("file_name", if (msg.hasKey("fileName") && !msg.isNull("fileName")) msg.getString("fileName") else null)
          put("file_size", if (msg.hasKey("fileSize") && !msg.isNull("fileSize")) msg.getDouble("fileSize").toLong() else null)
          put("mime_type", if (msg.hasKey("mimeType") && !msg.isNull("mimeType")) msg.getString("mimeType") else null)
          put("media_duration", if (msg.hasKey("mediaDuration") && !msg.isNull("mediaDuration")) msg.getDouble("mediaDuration") else null)
          put("thumbnail_url", if (msg.hasKey("thumbnailUrl") && !msg.isNull("thumbnailUrl")) msg.getString("thumbnailUrl") else null)
          put("status", if (msg.hasKey("status") && !msg.isNull("status")) msg.getString("status") else "sent")
          put("reply_to_id", if (msg.hasKey("replyToId") && !msg.isNull("replyToId")) msg.getString("replyToId") else null)
          put("created_at", createdAt)
          put("is_outgoing", if (msg.hasKey("isOutgoing") && msg.getBoolean("isOutgoing")) 1 else 0)
        }
        db.insertWithOnConflict("connect_messages", null, values, SQLiteDatabase.CONFLICT_REPLACE)

        // Determine snippet
        var snippet = content
        if (msgType == "image") snippet = if (!content.isNullOrEmpty()) "📷 $content" else "📷 Photo"
        else if (msgType == "video") snippet = if (!content.isNullOrEmpty()) "🎥 $content" else "🎥 Video"
        else if (msgType == "audio") snippet = "🎤 Voice note"
        else if (msgType == "document") {
          val fName = if (msg.hasKey("fileName") && !msg.isNull("fileName")) msg.getString("fileName") else "Document"
          snippet = "📄 $fName"
        }

        // Update conversation summary
        val convValues = ContentValues().apply {
          put("last_message_text", snippet)
          put("last_message_at", createdAt)
          put("updated_at", createdAt)
        }
        db.update("connect_conversations", convValues, "id = ?", arrayOf(convId))

        db.setTransactionSuccessful()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      } finally {
        db.endTransaction()
      }
    }.start()
  }

  // 5. Batch save messages (e.g. initial sync or conversation history fetch)
  @ReactMethod
  fun saveMessages(msgs: ReadableArray, promise: Promise) {
    Thread {
      val db = dbHelper.writableDatabase
      db.beginTransaction()
      try {
        for (i in 0 until msgs.size()) {
          val msg = msgs.getMap(i) ?: continue
          val values = ContentValues().apply {
            put("id", msg.getString("id"))
            put("conversation_id", msg.getString("conversationId"))
            put("sender_id", msg.getString("senderId"))
            put("sender_name", if (msg.hasKey("senderName") && !msg.isNull("senderName")) msg.getString("senderName") else null)
            put("sender_avatar", if (msg.hasKey("senderAvatar") && !msg.isNull("senderAvatar")) msg.getString("senderAvatar") else null)
            put("message_type", if (msg.hasKey("messageType") && !msg.isNull("messageType")) msg.getString("messageType") else "text")
            put("content", if (msg.hasKey("content") && !msg.isNull("content")) msg.getString("content") else "")
            put("media_url", if (msg.hasKey("mediaUrl") && !msg.isNull("mediaUrl")) msg.getString("mediaUrl") else null)
            put("local_uri", if (msg.hasKey("localUri") && !msg.isNull("localUri")) msg.getString("localUri") else null)
            put("file_name", if (msg.hasKey("fileName") && !msg.isNull("fileName")) msg.getString("fileName") else null)
            put("file_size", if (msg.hasKey("fileSize") && !msg.isNull("fileSize")) msg.getDouble("fileSize").toLong() else null)
            put("mime_type", if (msg.hasKey("mimeType") && !msg.isNull("mimeType")) msg.getString("mimeType") else null)
            put("media_duration", if (msg.hasKey("mediaDuration") && !msg.isNull("mediaDuration")) msg.getDouble("mediaDuration") else null)
            put("thumbnail_url", if (msg.hasKey("thumbnailUrl") && !msg.isNull("thumbnailUrl")) msg.getString("thumbnailUrl") else null)
            put("status", if (msg.hasKey("status") && !msg.isNull("status")) msg.getString("status") else "sent")
            put("reply_to_id", if (msg.hasKey("replyToId") && !msg.isNull("replyToId")) msg.getString("replyToId") else null)
            put("created_at", if (msg.hasKey("createdAt") && !msg.isNull("createdAt")) msg.getString("createdAt") else System.currentTimeMillis().toString())
            put("is_outgoing", if (msg.hasKey("isOutgoing") && msg.getBoolean("isOutgoing")) 1 else 0)
          }
          db.insertWithOnConflict("connect_messages", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        }
        db.setTransactionSuccessful()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      } finally {
        db.endTransaction()
      }
    }.start()
  }

  // 6. Get messages for a conversation (Fast local SQLite lookup)
  @ReactMethod
  fun getMessages(conversationId: String, limit: Int, beforeCreatedAt: String?, promise: Promise) {
    Thread {
      try {
        val db = dbHelper.readableDatabase
        val safeLimit = if (limit in 1..200) limit else 50
        val query: String
        val args: Array<String>

        if (!beforeCreatedAt.isNullOrEmpty()) {
          query = "SELECT * FROM connect_messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT $safeLimit"
          args = arrayOf(conversationId, beforeCreatedAt)
        } else {
          query = "SELECT * FROM connect_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT $safeLimit"
          args = arrayOf(conversationId)
        }

        val cursor = db.rawQuery(query, args)
        val list: WritableArray = Arguments.createArray()
        cursor.use { c ->
          while (c.moveToNext()) {
            val item = Arguments.createMap().apply {
              putString("id", c.getString(c.getColumnIndexOrThrow("id")))
              putString("conversationId", c.getString(c.getColumnIndexOrThrow("conversation_id")))
              putString("senderId", c.getString(c.getColumnIndexOrThrow("sender_id")))
              putString("senderName", c.getString(c.getColumnIndexOrThrow("sender_name")))
              putString("senderAvatar", c.getString(c.getColumnIndexOrThrow("sender_avatar")))
              putString("messageType", c.getString(c.getColumnIndexOrThrow("message_type")))
              putString("content", c.getString(c.getColumnIndexOrThrow("content")))
              putString("mediaUrl", c.getString(c.getColumnIndexOrThrow("media_url")))
              putString("localUri", c.getString(c.getColumnIndexOrThrow("local_uri")))
              putString("fileName", c.getString(c.getColumnIndexOrThrow("file_name")))
              if (!c.isNull(c.getColumnIndexOrThrow("file_size"))) {
                putDouble("fileSize", c.getLong(c.getColumnIndexOrThrow("file_size")).toDouble())
              }
              putString("mimeType", c.getString(c.getColumnIndexOrThrow("mime_type")))
              if (!c.isNull(c.getColumnIndexOrThrow("media_duration"))) {
                putDouble("mediaDuration", c.getDouble(c.getColumnIndexOrThrow("media_duration")))
              }
              putString("thumbnailUrl", c.getString(c.getColumnIndexOrThrow("thumbnail_url")))
              putString("status", c.getString(c.getColumnIndexOrThrow("status")))
              putString("replyToId", c.getString(c.getColumnIndexOrThrow("reply_to_id")))
              putString("createdAt", c.getString(c.getColumnIndexOrThrow("created_at")))
              putBoolean("isOutgoing", c.getInt(c.getColumnIndexOrThrow("is_outgoing")) == 1)
            }
            list.pushMap(item)
          }
        }
        // Reverse so oldest is first for FlatList display
        val reversed: WritableArray = Arguments.createArray()
        for (i in list.size() - 1 downTo 0) {
          reversed.pushMap(list.getMap(i))
        }
        promise.resolve(reversed)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      }
    }.start()
  }

  // 7. Update status of a message (e.g. 'sent' -> 'delivered' -> 'read')
  @ReactMethod
  fun updateMessageStatus(messageId: String, status: String, promise: Promise) {
    Thread {
      try {
        val db = dbHelper.writableDatabase
        val values = ContentValues().apply {
          put("status", status)
        }
        db.update("connect_messages", values, "id = ?", arrayOf(messageId))
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      }
    }.start()
  }

  // 8. Mark all incoming messages in a conversation as read and reset unread count
  @ReactMethod
  fun markConversationRead(conversationId: String, promise: Promise) {
    Thread {
      val db = dbHelper.writableDatabase
      db.beginTransaction()
      try {
        // Reset unread counter on conversation
        val convValues = ContentValues().apply {
          put("unread_count", 0)
        }
        db.update("connect_conversations", convValues, "id = ?", arrayOf(conversationId))

        // Mark incoming messages as read
        val msgValues = ContentValues().apply {
          put("status", "read")
        }
        db.update("connect_messages", msgValues, "conversation_id = ? AND is_outgoing = 0", arrayOf(conversationId))

        db.setTransactionSuccessful()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      } finally {
        db.endTransaction()
      }
    }.start()
  }

  // 9. Delete a message locally
  @ReactMethod
  fun deleteMessage(messageId: String, promise: Promise) {
    Thread {
      try {
        val db = dbHelper.writableDatabase
        db.delete("connect_messages", "id = ?", arrayOf(messageId))
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      }
    }.start()
  }

  // 10. Clear conversation
  @ReactMethod
  fun clearConversation(conversationId: String, promise: Promise) {
    Thread {
      try {
        val db = dbHelper.writableDatabase
        db.delete("connect_messages", "conversation_id = ?", arrayOf(conversationId))
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("DB_ERROR", e.message, e)
      }
    }.start()
  }
}

/**
 * Android SQLiteOpenHelper creating WhatsApp-style local tables
 */
private class ConnectDatabaseHelper(context: Context) :
  SQLiteOpenHelper(context, "MyConnect.db", null, 1) {

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS connect_conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        avatar TEXT,
        headline TEXT,
        partner_user_id TEXT,
        last_message_text TEXT,
        last_message_at TEXT,
        unread_count INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );
      """.trimIndent()
    )

    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS connect_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        sender_avatar TEXT,
        message_type TEXT NOT NULL,
        content TEXT,
        media_url TEXT,
        local_uri TEXT,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,
        media_duration REAL,
        thumbnail_url TEXT,
        status TEXT NOT NULL,
        reply_to_id TEXT,
        created_at TEXT NOT NULL,
        is_outgoing INTEGER NOT NULL
      );
      """.trimIndent()
    )

    db.execSQL(
      "CREATE INDEX IF NOT EXISTS idx_connect_msg_conv_time ON connect_messages(conversation_id, created_at);"
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    // Migration logic for future schema changes
  }
}
