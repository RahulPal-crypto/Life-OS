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
} from 'react-native';
import { Text } from '../../../components';
import { colors, spacing, borderRadius } from '../../../theme';
import { ConnectConversation, ConnectMessage } from '../types';
import { connectService } from '../services/connectService';
import { connectSocketService } from '../services/connectSocketService';

interface ConnectConversationScreenProps {
  conversation: ConnectConversation;
  currentUserId: string;
  onBack: () => void;
}

export const ConnectConversationScreen: React.FC<ConnectConversationScreenProps> = ({
  conversation,
  currentUserId,
  onBack,
}) => {
  const [messages, setMessages] = useState<ConnectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1. Fetch initial message history
    connectService
      .getMessages(conversation.id, { limit: 50 })
      .then((history) => {
        if (mounted) {
          setMessages(history);
          setLoading(false);
          // Mark conversation read
          connectService.markRead(conversation.id);
          connectSocketService.emitMarkRead(conversation.id);
        }
      })
      .catch((err) => {
        if (mounted) {
          setLoading(false);
          Alert.alert('Chat Error', err?.message || 'Could not load messages.');
        }
      });

    // 2. Listen for incoming real-time messages
    const unsubMsg = connectSocketService.onMessage((newMsg) => {
      if (newMsg.conversationId === conversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Mark incoming message as read
        connectService.markRead(conversation.id);
        connectSocketService.emitMarkRead(conversation.id);
      }
    });

    // 3. Listen for typing events
    const unsubTyping = connectSocketService.onTyping((payload) => {
      if (payload.conversationId === conversation.id && payload.userId !== currentUserId) {
        setIsPartnerTyping(payload.isTyping);
      }
    });

    // 4. Listen for read receipts (update double ticks to blue)
    const unsubRead = connectSocketService.onReadReceipt((payload) => {
      if (payload.conversationId === conversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.isOutgoing ? { ...m, status: 'read' } : m))
        );
      }
    });

    return () => {
      mounted = false;
      unsubMsg();
      unsubTyping();
      unsubRead();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversation.id, currentUserId]);

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Emit typing indicator to socket
    const recipientIds = conversation.partnerUserId ? [conversation.partnerUserId] : [];
    if (recipientIds.length > 0) {
      connectSocketService.emitTyping(conversation.id, recipientIds, true);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        connectSocketService.emitTyping(conversation.id, recipientIds, false);
      }, 2000);
    }
  };

  const handleSendMessage = async () => {
    const cleanContent = inputText.trim();
    if (!cleanContent || sending) return;

    setInputText('');
    setSending(true);

    // Optimistic message in list
    const tempMsg: ConnectMessage = {
      id: `temp_${Date.now()}`,
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

    setMessages((prev) => [...prev, tempMsg]);

    try {
      // Send via socket first for ultra-low latency, or fallback to REST
      const socketSuccess = connectSocketService.sendSocketMessage(conversation.id, cleanContent);
      if (!socketSuccess) {
        const saved = await connectService.sendMessage(conversation.id, cleanContent);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMsg.id ? saved : m))
        );
      }
    } catch {
      // Keep optimistic message or mark failed
    } finally {
      setSending(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
      return (
        <View style={styles.systemBubble}>
          <Text variant="caption" color="#64748B" align="center" style={styles.systemText}>
            {item.content}
          </Text>
        </View>
      );
    }

    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

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
          ]}
        >
          {conversation.isGroup && !item.isOutgoing && (
            <Text variant="caption" color="#7C3AED" style={styles.senderLabel}>
              {item.senderName}
            </Text>
          )}

          <Text
            variant="caption"
            color={item.isOutgoing ? '#FFFFFF' : '#0F172A'}
            style={styles.messageText}
          >
            {item.content}
          </Text>

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
              : conversation.displayHeadline}
          </Text>
        </View>

        {/* Phase 3 Placeholders: Audio & Video Call */}
        <Pressable
          onPress={() => Alert.alert('Voice Call', 'HD Voice Calls are arriving in Phase 3!')}
          style={styles.headerActionBtn}
        >
          <Text style={styles.actionIcon}>📞</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert('Video Call', 'HD Video Calls are arriving in Phase 3!')}
          style={styles.headerActionBtn}
        >
          <Text style={styles.actionIcon}>🎥</Text>
        </Pressable>
      </View>

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
        {/* Attachment Button */}
        <Pressable
          onPress={() =>
            Alert.alert(
              'Attachments',
              'Photos, documents, audio & Safe Vault sharing are arriving in Phase 2!'
            )
          }
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

        {/* Send Button */}
        <Pressable
          onPress={handleSendMessage}
          disabled={!inputText.trim() || sending}
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
        >
          <Text style={styles.sendIcon}>🚀</Text>
        </Pressable>
      </View>
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
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  headerStatus: {
    fontSize: 11,
  },
  headerActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionIcon: {
    fontSize: 18,
  },
  wallpaper: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loaderArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 6,
  },
  systemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  msgContainer: {
    marginVertical: 3,
    maxWidth: '82%',
  },
  msgOutgoingAlign: {
    alignSelf: 'flex-end',
  },
  msgIncomingAlign: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 14,
  },
  bubbleOutgoing: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 2,
  },
  bubbleIncoming: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 3,
  },
  metaTime: {
    fontSize: 10,
    fontWeight: '600',
  },
  tickGrey: {
    fontSize: 11,
    color: '#DDD6FE',
  },
  tickBlue: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '800',
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typingText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  inputToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  attachBtn: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13.5,
    maxHeight: 100,
    color: '#0F172A',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendIcon: {
    fontSize: 16,
  },
});
