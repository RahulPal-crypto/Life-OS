import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
  Linking,
  StatusBar,
} from 'react-native';
import { Text } from '../../../components';
import { colors, spacing, borderRadius } from '../../../theme';
import { ConnectConversation, ConnectMessage, ConnectMessageType } from '../types';
import { connectService } from '../services/connectService';
import { connectSocketService } from '../services/connectSocketService';
import { connectLocalStorage } from '../services/connectLocalStorage';
import {
  connectMediaNative,
  formatFileSize,
  getDocumentIcon,
  PickedLocalFile,
  formatDuration,
} from '../services/connectMediaNative';
import { AttachmentPickerModal, AttachmentOption } from '../components/AttachmentPickerModal';
import { MediaViewerModal } from '../components/MediaViewerModal';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { resolveMediaUrl } from '../../../config/apiConfig';

interface ConnectConversationScreenProps {
  conversation: ConnectConversation;
  currentUserId: string;
  onBack: () => void;
  onStartCall?: (
    callType: 'voice' | 'video',
    partner: { id: string; name: string; profileImage: string | null; headline?: string | null }
  ) => void;
}

export const ConnectConversationScreen: React.FC<ConnectConversationScreenProps> = ({
  conversation,
  currentUserId,
  onBack,
  onStartCall,
}) => {
  const [messages, setMessages] = useState<ConnectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Attachment & Media Viewers
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [selectedMediaMessage, setSelectedMediaMessage] = useState<ConnectMessage | null>(null);

  // Voice Note Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1. WhatsApp Instant Load: Read existing messages from local phone database (0ms latency)
    connectLocalStorage.getMessages(conversation.id, 50).then((localHistory) => {
      if (mounted && localHistory && localHistory.length > 0) {
        setMessages(localHistory);
        setLoading(false);
      }
    });

    // 2. Background Sync with Server Relay: fetch latest messages from cloud
    connectService
      .getMessages(conversation.id, { limit: 50 })
      .then(async (history) => {
        if (mounted) {
          setMessages(history);
          setLoading(false);
          // Persist all incoming history to local phone storage
          await connectLocalStorage.saveMessages(history);
          // Mark conversation read locally and on server
          connectService.markRead(conversation.id).catch(() => {});
          connectSocketService.emitMarkRead(conversation.id);
          await connectLocalStorage.markConversationRead(conversation.id);
        }
      })
      .catch(() => {
        // Silently use offline local storage if network fails
        if (mounted) {
          setLoading(false);
        }
      });

    // 3. Listen for incoming real-time messages
    const unsubMsg = connectSocketService.onMessage(async (newMsg) => {
      if (newMsg.conversationId === conversation.id) {
        // Save to local phone storage immediately
        await connectLocalStorage.saveMessage(newMsg);
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);

        // Acknowledge delivery & read status back to sender
        connectSocketService.emitDelivered(conversation.id, newMsg.id);
        connectSocketService.emitMarkRead(conversation.id);
        connectService.markRead(conversation.id).catch(() => {});
        await connectLocalStorage.markConversationRead(conversation.id);
      }
    });

    // 4. Listen for delivery receipts (updates single tick to double tick ✓✓)
    const unsubDelivery = connectSocketService.onDeliveryReceipt(async (payload) => {
      if (payload.conversationId === conversation.id) {
        await connectLocalStorage.updateMessageStatus(payload.messageId, 'delivered');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId && m.status === 'sent' ? { ...m, status: 'delivered' } : m
          )
        );
      }
    });

    // 5. Listen for typing events
    const unsubTyping = connectSocketService.onTyping((payload) => {
      if (payload.conversationId === conversation.id && payload.userId !== currentUserId) {
        setIsPartnerTyping(payload.isTyping);
      }
    });

    // 6. Listen for read receipts (updates double ticks to blue ✓✓)
    const unsubRead = connectSocketService.onReadReceipt(async (payload: { conversationId: string; readByUserId: string }) => {
      if (payload.conversationId === conversation.id) {
        await connectLocalStorage.markConversationRead(conversation.id);
        setMessages((prev) =>
          prev.map((m) => (m.isOutgoing ? { ...m, status: 'read' } : m))
        );
      }
    });

    return () => {
      mounted = false;
      unsubMsg();
      unsubDelivery();
      unsubTyping();
      unsubRead();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [conversation.id, currentUserId]);

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Emit live typing event
    connectSocketService.emitTyping(conversation.id, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      connectSocketService.emitTyping(conversation.id, false);
    }, 2000);
  };

  const handleSendMessage = async () => {
    const cleanContent = inputText.trim();
    if (!cleanContent || sending) return;

    setInputText('');
    setSending(true);

    const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tempMsg: ConnectMessage = {
      id: tempId,
      conversationId: conversation.id,
      senderId: currentUserId,
      senderName: 'You',
      senderAvatar: null,
      messageType: 'text',
      content: cleanContent,
      status: 'sent',
      replyToId: null,
      createdAt: new Date().toISOString(),
      isOutgoing: true,
    };

    // 1. WhatsApp Instant Save: Write directly to phone's local SQLite DB
    await connectLocalStorage.saveMessage(tempMsg);
    setMessages((prev) => [...prev, tempMsg]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    try {
      // 2. Authoritative persistence on server relay and live WebSocket broadcast
      const saved = await connectService.sendMessage(conversation.id, cleanContent);
      if (saved?.id) {
        await connectLocalStorage.deleteMessage(tempId);
        await connectLocalStorage.saveMessage(saved);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? saved : m))
        );
      }
    } catch {
      // Offline mode: message remains permanently saved in local SQLite with status 'sent'
    } finally {
      setSending(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Upload and dispatch media message
  const uploadAndSendMedia = async (
    file: PickedLocalFile,
    overrideType?: ConnectMessageType,
    durationSeconds?: number
  ) => {
    try {
      const detectedType: ConnectMessageType =
        overrideType ||
        (file.mediaType === 'photo'
          ? 'image'
          : file.mediaType === 'video'
          ? 'video'
          : file.mediaType === 'audio'
          ? 'audio'
          : 'document');

      setUploadingStatus(`Sending ${detectedType}...`);

      // Read local file as base64
      const base64Data = await connectMediaNative.readFileBase64(file.localUri);
      if (!base64Data) {
        throw new Error('Unable to read selected attachment file.');
      }

      // Upload to Life OS server
      const uploadRes = await connectService.uploadMedia({
        fileName: file.fileName,
        base64Data,
        mediaType: detectedType,
        mimeType: file.mimeType,
        duration: durationSeconds,
      });

      // Construct and dispatch message payload
      const payload = {
        content: '',
        messageType: detectedType,
        mediaUrl: uploadRes.mediaUrl,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
        mimeType: uploadRes.mimeType,
        mediaDuration: uploadRes.mediaDuration || durationSeconds || null,
      };

      // Optimistic message
      const tempMediaMsg: ConnectMessage = {
        id: `temp_media_${Date.now()}`,
        conversationId: conversation.id,
        senderId: currentUserId,
        senderName: 'You',
        senderAvatar: null,
        messageType: detectedType,
        content: '',
        mediaUrl: uploadRes.mediaUrl,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
        mimeType: uploadRes.mimeType,
        mediaDuration: uploadRes.mediaDuration || durationSeconds || null,
        status: 'sent',
        replyToId: null,
        createdAt: new Date().toISOString(),
        isOutgoing: true,
      };

      // 1. WhatsApp Local Storage: Save media message immediately
      await connectLocalStorage.saveMessage(tempMediaMsg);
      setMessages((prev) => [...prev, tempMediaMsg]);

      // 2. Transmit to server relay
      const savedMsg = await connectService.sendMessage(conversation.id, payload);
      if (savedMsg?.id) {
        await connectLocalStorage.deleteMessage(tempMediaMsg.id);
        await connectLocalStorage.saveMessage(savedMsg);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMediaMsg.id ? savedMsg : m))
        );
      }

      // Notify via socket
      connectSocketService.sendSocketMessage(conversation.id, payload);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Could not send attachment.');
    } finally {
      setUploadingStatus(null);
    }
  };

  const handleSelectAttachment = async (option: AttachmentOption) => {
    try {
      if (option === 'camera_photo') {
        const captured = await connectMediaNative.capturePhoto();
        if (captured) await uploadAndSendMedia(captured, 'image');
      } else if (option === 'camera_video') {
        const captured = await connectMediaNative.captureVideo();
        if (captured) await uploadAndSendMedia(captured, 'video');
      } else if (option === 'gallery_photo') {
        const picked = await connectMediaNative.pickPhotos();
        for (const file of picked) {
          await uploadAndSendMedia(file, 'image');
        }
      } else if (option === 'gallery_video') {
        const picked = await connectMediaNative.pickVideos();
        for (const file of picked) {
          await uploadAndSendMedia(file, 'video');
        }
      } else if (option === 'document') {
        const picked = await connectMediaNative.pickDocuments();
        for (const file of picked) {
          await uploadAndSendMedia(file, 'document');
        }
      } else if (option === 'audio') {
        const picked = await connectMediaNative.pickAudioFiles();
        for (const file of picked) {
          await uploadAndSendMedia(file, 'audio');
        }
      }
    } catch (err: any) {
      Alert.alert('Attachment Error', err?.message || 'Could not process attachment.');
    }
  };

  // Voice Note Recording
  const handleStartVoiceRecording = async () => {
    try {
      const started = await connectMediaNative.startVoiceRecording();
      if (!started) return;

      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert('Microphone Error', err?.message || 'Could not start audio recording.');
    }
  };

  const handleCancelVoiceRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    await connectMediaNative.stopVoiceRecording();
  };

  const handleSendVoiceRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const recordedSecs = recordingSeconds;
    setIsRecording(false);
    setRecordingSeconds(0);

    const voiceFile = await connectMediaNative.stopVoiceRecording();
    if (voiceFile) {
      await uploadAndSendMedia(voiceFile, 'audio', recordedSecs);
    }
  };

  const renderStatusTicks = (status: ConnectMessage['status']) => {
    if (status === 'sent') {
      return <Text style={styles.tickGrey}>✓</Text>;
    }
    if (status === 'delivered') {
      return <Text style={styles.tickGrey}>✓✓</Text>;
    }
    return <Text style={styles.tickBlue}>✓✓</Text>;
  };

  const renderMessageItem = ({ item }: { item: ConnectMessage }) => {
    if (item.messageType === 'system') {
      const isCallMsg =
        item.content.includes('call') || item.content.includes('📞') || item.content.includes('🎥');
      const isMissed =
        item.content.toLowerCase().includes('missed') || item.content.toLowerCase().includes('declined');

      return (
        <View style={[styles.systemBubble, isCallMsg && styles.callRecordBubble]}>
          <Text
            variant="caption"
            color={isCallMsg ? (isMissed ? '#EF4444' : '#0F172A') : '#64748B'}
            align="center"
            style={[styles.systemText, isCallMsg && styles.callRecordText]}
          >
            {item.content}
          </Text>
        </View>
      );
    }

    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isImage = item.messageType === 'image';
    const isVideo = item.messageType === 'video';
    const isAudio = item.messageType === 'audio';
    const isDocument = item.messageType === 'document';

    return (
      <View
        style={[
          styles.msgContainer,
          item.isOutgoing ? styles.msgOutgoingAlign : styles.msgIncomingAlign,
        ]}
      >
        <View
          style={[
            styles.bubble,
            item.isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming,
            (isImage || isVideo) && styles.bubbleMediaPadding,
          ]}
        >
          {conversation.isGroup && !item.isOutgoing && (
            <Text variant="caption" color="#7C3AED" style={styles.senderLabel}>
              {item.senderName}
            </Text>
          )}

          {/* 1. PHOTO MESSAGE */}
          {isImage && item.mediaUrl && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedMediaMessage(item)}
              style={styles.imageWrapper}
            >
              <Image
                source={{ uri: resolveMediaUrl(item.mediaUrl) || item.mediaUrl }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {/* 2. VIDEO MESSAGE */}
          {isVideo && item.mediaUrl && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedMediaMessage(item)}
              style={styles.imageWrapper}
            >
              <Image
                source={{ uri: resolveMediaUrl(item.mediaUrl) || item.mediaUrl }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
              <View style={styles.playOverlay}>
                <Text style={styles.playOverlayIcon}>▶</Text>
                {Boolean(item.mediaDuration) && (
                  <Text style={styles.playOverlayDuration}>
                    {formatDuration(item.mediaDuration || 0)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* 3. VOICE MESSAGE / AUDIO */}
          {isAudio && item.mediaUrl && (
            <VoiceNotePlayer
              mediaUrl={item.mediaUrl}
              duration={item.mediaDuration}
              isOutgoing={item.isOutgoing}
            />
          )}

          {/* 4. DOCUMENT MESSAGE */}
          {isDocument && item.mediaUrl && (
            <TouchableOpacity
              style={[
                styles.documentCard,
                item.isOutgoing ? styles.docCardOut : styles.docCardIn,
              ]}
              activeOpacity={0.8}
              onPress={() =>
                connectMediaNative.openDocument(item.mediaUrl!, item.mimeType)
              }
            >
              <View style={styles.docIconBox}>
                <Text style={styles.docEmoji}>
                  {getDocumentIcon(item.fileName, item.mimeType)}
                </Text>
              </View>
              <View style={styles.docInfo}>
                <Text
                  variant="caption"
                  color={item.isOutgoing ? '#FFFFFF' : '#0F172A'}
                  numberOfLines={1}
                  style={styles.docFileName}
                >
                  {item.fileName || 'Attachment Document'}
                </Text>
                <Text
                  variant="caption"
                  color={item.isOutgoing ? '#DDD6FE' : '#64748B'}
                  style={styles.docMeta}
                >
                  {formatFileSize(item.fileSize)}
                </Text>
              </View>
              <Text style={styles.docDownloadIcon}>↗</Text>
            </TouchableOpacity>
          )}

          {/* TEXT CONTENT / CAPTION */}
          {Boolean(item.content) && (
            <Text
              variant="caption"
              color={item.isOutgoing ? '#FFFFFF' : '#0F172A'}
              style={styles.messageText}
            >
              {item.content}
            </Text>
          )}

          {/* TIMESTAMP & TICKS */}
          <View style={styles.metaRow}>
            <Text
              variant="caption"
              color={item.isOutgoing ? '#DDD6FE' : '#94A3B8'}
              style={styles.metaTime}
            >
              {timeStr}
            </Text>
            {item.isOutgoing && renderStatusTicks(item.status)}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {conversation.displayName.slice(0, 1).toUpperCase()}
          </Text>
          {conversation.isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.headerInfo}>
          <Text variant="caption" color="#0F172A" numberOfLines={1} style={styles.headerName}>
            {conversation.displayName}
          </Text>
          <Text variant="caption" color="#64748B" numberOfLines={1} style={styles.headerStatus}>
            {isPartnerTyping
              ? 'typing...'
              : conversation.isOnline
              ? 'online'
              : conversation.displayHeadline === 'Phone Contact'
              ? 'mobile contact'
              : (conversation.displayHeadline || 'offline')}
          </Text>
        </View>

        {/* Phase 3 Calls */}
        <Pressable
          onPress={() => {
            if (onStartCall) {
              onStartCall('voice', {
                id: conversation.partnerUserId || conversation.id,
                name: conversation.displayName,
                profileImage: conversation.displayAvatar,
                headline: conversation.displayHeadline,
              });
            }
          }}
          style={styles.headerActionBtn}
        >
          <Text style={styles.actionIcon}>📞</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (onStartCall) {
              onStartCall('video', {
                id: conversation.partnerUserId || conversation.id,
                name: conversation.displayName,
                profileImage: conversation.displayAvatar,
                headline: conversation.displayHeadline,
              });
            }
          }}
          style={styles.headerActionBtn}
        >
          <Text style={styles.actionIcon}>🎥</Text>
        </Pressable>
      </View>

      {/* Uploading Banner */}
      {Boolean(uploadingStatus) && (
        <View style={styles.uploadingBanner}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.uploadingText}>{uploadingStatus}</Text>
        </View>
      )}

      {/* Phone Contact Info Banner */}
      {conversation.displayHeadline === 'Phone Contact' && (
        <View style={styles.phoneContactNotice}>
          <Text variant="caption" color="#6D28D9" style={styles.phoneContactNoticeText}>
            💬 Messages are saved here. Invite {conversation.displayName} to join Life OS
          </Text>
          <Pressable
            onPress={() => {
              const text = encodeURIComponent(
                `Hey ${conversation.displayName}! Let's chat on Life OS: https://github.com/RahulPal-crypto/Life-OS/releases`
              );
              Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
                Linking.openURL(`sms:?body=${text}`);
              });
            }}
            style={styles.inviteMiniPill}
          >
            <Text style={styles.inviteMiniPillText}>Invite</Text>
          </Pressable>
        </View>
      )}

      {/* Messages Canvas */}
      <View style={styles.wallpaper}>
        {loading ? (
          <View style={styles.loaderArea}>
            <ActivityIndicator size="small" color="#7C3AED" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Real-time Typing Bubble */}
        {isPartnerTyping && (
          <View style={styles.typingBubble}>
            <Text variant="caption" color="#7C3AED" style={styles.typingText}>
              ● ● ● typing...
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Input Toolbar */}
      <View style={styles.inputToolbar}>
        {isRecording ? (
          /* Live Voice Recording Toolbar */
          <View style={styles.recordingBar}>
            <View style={styles.recordingTimerGroup}>
              <View style={styles.redDot} />
              <Text style={styles.recordingTimeText}>
                {formatDuration(recordingSeconds)}
              </Text>
            </View>

            <View style={styles.recordingActionsGroup}>
              <TouchableOpacity
                onPress={handleCancelVoiceRecording}
                style={styles.recordingCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.recordingCancelText}>🗑️ Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendVoiceRecording}
                style={styles.recordingSendBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.recordingSendIcon}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Standard Input Bar with Attachments & Mic */
          <>
            {/* Attachment Button */}
            <Pressable
              onPress={() => setAttachmentModalVisible(true)}
              style={styles.attachBtn}
            >
              <Text style={styles.attachIcon}>📎</Text>
            </Pressable>

            {/* Message Input Box */}
            <TextInput
              value={inputText}
              onChangeText={handleInputChange}
              placeholder="Type a message..."
              placeholderTextColor="#94A3B8"
              multiline
              style={styles.textInput}
            />

            {/* Send OR Microphone Button */}
            {inputText.trim() ? (
              <Pressable
                onPress={handleSendMessage}
                disabled={sending}
                style={styles.sendBtn}
              >
                <Text style={styles.sendIcon}>🚀</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleStartVoiceRecording}
                style={styles.micBtn}
              >
                <Text style={styles.micIcon}>🎤</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Attachment Selection Sheet */}
      <AttachmentPickerModal
        visible={attachmentModalVisible}
        onClose={() => setAttachmentModalVisible(false)}
        onSelectOption={handleSelectAttachment}
      />

      {/* Fullscreen Media Viewer */}
      <MediaViewerModal
        visible={Boolean(selectedMediaMessage)}
        message={selectedMediaMessage}
        onClose={() => setSelectedMediaMessage(null)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  backArrow: {
    fontSize: 26,
    fontWeight: '300',
    color: '#0F172A',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  actionIcon: {
    fontSize: 18,
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 6,
    columnGap: 8,
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phoneContactNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E9D5FF',
  },
  phoneContactNoticeText: {
    fontSize: 11,
    flex: 1,
    marginRight: 8,
    fontWeight: '500',
  },
  inviteMiniPill: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inviteMiniPillText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  wallpaper: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loaderArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    rowGap: 8,
  },
  msgContainer: {
    width: '100%',
    flexDirection: 'row',
  },
  msgOutgoingAlign: {
    justifyContent: 'flex-end',
  },
  msgIncomingAlign: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleMediaPadding: {
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 6,
  },
  bubbleOutgoing: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  bubbleIncoming: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    columnGap: 4,
  },
  metaTime: {
    fontSize: 10,
    fontWeight: '500',
  },
  tickGrey: {
    fontSize: 11,
    color: '#DDD6FE',
  },
  tickBlue: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 4,
  },
  callRecordBubble: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginVertical: 6,
  },
  callRecordText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  systemText: {
    fontSize: 11,
  },
  typingBubble: {
    position: 'absolute',
    bottom: 8,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  /* Media elements */
  imageWrapper: {
    width: 240,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playOverlayIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  playOverlayDuration: {
    fontSize: 11,
    color: '#EDE9FE',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  /* Document card */
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    minWidth: 200,
    maxWidth: 260,
  },
  docCardOut: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  docCardIn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  docEmoji: {
    fontSize: 18,
  },
  docInfo: {
    flex: 1,
  },
  docFileName: {
    fontSize: 13,
    fontWeight: '600',
  },
  docMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  docDownloadIcon: {
    fontSize: 16,
    color: '#7C3AED',
    fontWeight: '700',
    marginLeft: 6,
  },
  /* Input Toolbar */
  inputToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  attachBtn: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 22,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    marginHorizontal: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 17,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 20,
  },
  /* Recording Toolbar */
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: '#FEF2F2',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  recordingTimerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  recordingActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  recordingCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recordingCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  recordingSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingSendIcon: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
