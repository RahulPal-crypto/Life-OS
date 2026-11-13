import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { ConnectMessage } from '../types';
import { resolveMediaUrl } from '../../../config/apiConfig';
import { connectMediaNative, formatFileSize } from '../services/connectMediaNative';

interface MediaViewerModalProps {
  visible: boolean;
  message: ConnectMessage | null;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  visible,
  message,
  onClose,
}) => {
  if (!message || !message.mediaUrl) return null;

  const resolvedUrl = resolveMediaUrl(message.mediaUrl) || message.mediaUrl;
  const isVideo = message.messageType === 'video';

  const handleOpenExternal = async () => {
    await connectMediaNative.openDocument(resolvedUrl, message.mimeType);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.navButton} onPress={onClose}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.senderTitle} numberOfLines={1}>
              {message.senderName || 'Attachment'}
            </Text>
            <Text style={styles.dateSub}>
              {message.createdAt ? new Date(message.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
            </Text>
          </View>

          <TouchableOpacity style={styles.navButton} onPress={handleOpenExternal}>
            <Text style={styles.actionIcon}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content Area */}
        <View style={styles.mediaContainer}>
          {isVideo ? (
            <TouchableOpacity
              style={styles.videoWrapper}
              activeOpacity={0.85}
              onPress={handleOpenExternal}
            >
              <Image
                source={{ uri: resolvedUrl }}
                style={styles.mediaImage}
                resizeMode="contain"
              />
              <View style={styles.playBadgeLarge}>
                <Text style={styles.playBadgeIcon}>▶</Text>
                <Text style={styles.playBadgeLabel}>Play Video</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Image
              source={{ uri: resolvedUrl }}
              style={styles.mediaImage}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Bottom Details Bar */}
        <View style={styles.bottomBar}>
          {Boolean(message.content) && (
            <Text style={styles.captionText}>{message.content}</Text>
          )}
          <View style={styles.fileMetaRow}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {message.fileName || (isVideo ? 'Video' : 'Photo')}
            </Text>
            {Boolean(message.fileSize) && (
              <Text style={styles.fileSizeText}>
                {formatFileSize(message.fileSize)}
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0914',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 12, 28, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#EDE9FE',
    fontWeight: '700',
  },
  actionIcon: {
    fontSize: 20,
    color: '#EDE9FE',
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 14,
  },
  senderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateSub: {
    fontSize: 12,
    color: '#A78BFA',
    marginTop: 2,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playBadgeLarge: {
    position: 'absolute',
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  playBadgeIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  playBadgeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(15, 12, 28, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  captionText: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 20,
  },
  fileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileNameText: {
    fontSize: 13,
    color: '#C4B5FD',
    flex: 1,
    marginRight: 12,
  },
  fileSizeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
