import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  Image,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { Text } from '../../../components';
import { spacing } from '../../../theme';
import { ConnectActiveCall } from '../types';
import { connectCallNative } from '../services/connectCallNative';

interface ActiveCallModalProps {
  call: ConnectActiveCall | null;
  onEndCall: (durationSeconds: number) => void;
  onToggleCallType?: (newType: 'voice' | 'video') => void;
}

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  call,
  onEndCall,
  onToggleCallType,
}) => {
  const [duration, setDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(call?.callType === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!call) {
      setDuration(0);
      return;
    }

    setIsVideoEnabled(call.callType === 'video');

    // Switch Android audio routing to in-communication mode
    connectCallNative.setCallMode(true);

    // If caller and status is ringing, play ringback tone
    if (call.isOutgoing && call.status === 'ringing') {
      connectCallNative.startRinging(false);
    }

    // Start timer if call is ongoing
    if (call.status === 'ongoing') {
      connectCallNative.stopRinging();
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      connectCallNative.stopRinging();
      connectCallNative.setCallMode(false);
    };
  }, [call?.status, call?.isOutgoing, call?.callType, pulseAnim]);

  if (!call) return null;

  const partner = call.isOutgoing ? call.receiver : call.caller;
  const partnerName = partner.name || 'Contact';
  const partnerAvatar = partner.profileImage;
  const isVideo = isVideoEnabled;

  const formatTimer = (totalSecs: number): string => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}`;
  };

  const handleToggleSpeaker = async () => {
    const nextVal = !isSpeakerOn;
    setIsSpeakerOn(nextVal);
    await connectCallNative.setSpeakerphoneOn(nextVal);
  };

  const handleToggleMute = async () => {
    const nextVal = !isMuted;
    setIsMuted(nextVal);
    await connectCallNative.setMicrophoneMute(nextVal);
  };

  const handleToggleVideo = () => {
    const next = !isVideoEnabled;
    setIsVideoEnabled(next);
    if (onToggleCallType) {
      onToggleCallType(next ? 'video' : 'voice');
    }
  };

  const handleFlipCamera = () => {
    setIsFrontCamera((prev) => !prev);
  };

  const handleEnd = () => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    connectCallNative.stopRinging();
    connectCallNative.setCallMode(false);
    onEndCall(duration);
  };

  const statusText =
    call.status === 'ongoing'
      ? formatTimer(duration)
      : call.status === 'ringing'
      ? call.isOutgoing
        ? 'Ringing...'
        : 'Connecting...'
      : 'Connecting...';

  return (
    <Modal visible={Boolean(call)} animationType="fade" transparent={false}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerArea}>
          <View style={styles.encryptionPill}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text variant="caption" color="#CBD5E1" style={styles.encryptedText}>
              End-to-end encrypted
            </Text>
          </View>
          <Text variant="body" color="#FFFFFF" align="center" style={styles.contactName}>
            {partnerName}
          </Text>
          <Text variant="caption" color={call.status === 'ongoing' ? '#34D399' : '#38BDF8'} align="center" style={styles.statusLabel}>
            {statusText}
          </Text>
        </View>

        {/* Video Canvas OR Voice Center Avatar */}
        {isVideo ? (
          <View style={styles.videoCanvas}>
            {/* Remote Feed simulation / wallpaper */}
            <View style={styles.remoteVideoWrapper}>
              {partnerAvatar ? (
                <Image source={{ uri: partnerAvatar }} style={styles.remoteVideoBg} blurRadius={15} />
              ) : (
                <View style={[styles.remoteVideoBg, { backgroundColor: '#1E293B' }]} />
              )}
              <View style={styles.remoteVideoCenter}>
                <View style={styles.videoAvatarBox}>
                  {partnerAvatar ? (
                    <Image source={{ uri: partnerAvatar }} style={styles.videoAvatarImg} />
                  ) : (
                    <Text style={styles.videoAvatarText}>
                      {partnerName.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text variant="caption" color="#E2E8F0" style={styles.videoLiveText}>
                  {partnerName} • Live HD
                </Text>
              </View>
            </View>

            {/* PiP Local Preview Window */}
            <View style={styles.pipWindow}>
              <View style={styles.pipInner}>
                <Text style={styles.pipCameraIcon}>{isFrontCamera ? '🤳' : '📷'}</Text>
                <Text style={styles.pipLabel}>You</Text>
              </View>
              <Pressable onPress={handleFlipCamera} style={styles.pipFlipBtn}>
                <Text style={styles.pipFlipIcon}>🔄</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.voiceCenterArea}>
            <Animated.View style={[styles.avatarPulseRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.avatarBox}>
                {partnerAvatar ? (
                  <Image source={{ uri: partnerAvatar }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {partnerName.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
            </Animated.View>
            <Text variant="caption" color="#94A3B8" align="center">
              Life OS HD Voice
            </Text>
          </View>
        )}

        {/* Floating Bottom Control Bar (WhatsApp Style) */}
        <View style={styles.controlsBar}>
          {/* Speaker Toggle */}
          <Pressable
            onPress={handleToggleSpeaker}
            style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
          >
            <Text style={styles.controlIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
            <Text style={styles.controlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
          </Pressable>

          {/* Video Switch Toggle */}
          <Pressable
            onPress={handleToggleVideo}
            style={[styles.controlBtn, isVideoEnabled && styles.controlBtnActive]}
          >
            <Text style={styles.controlIcon}>{isVideoEnabled ? '📹' : '🎥'}</Text>
            <Text style={styles.controlLabel}>{isVideoEnabled ? 'Video On' : 'Switch Video'}</Text>
          </Pressable>

          {/* Microphone Mute Toggle */}
          <Pressable
            onPress={handleToggleMute}
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
            <Text style={styles.controlLabel}>{isMuted ? 'Muted' : 'Mute'}</Text>
          </Pressable>

          {/* End Call Button */}
          <Pressable onPress={handleEnd} style={styles.endCallBtn}>
            <Text style={styles.endCallIcon}>📞</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 36,
    paddingBottom: 36,
  },
  headerArea: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  encryptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 4,
  },
  lockIcon: {
    fontSize: 12,
  },
  encryptedText: {
    fontSize: 11,
    fontWeight: '500',
  },
  contactName: {
    fontSize: 24,
    fontWeight: '800',
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  voiceCenterArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 'auto',
  },
  avatarPulseRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarBox: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#A78BFA',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  /* Video Canvas */
  videoCanvas: {
    flex: 1,
    marginVertical: 14,
    marginHorizontal: 12,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#020617',
  },
  remoteVideoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideoBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  remoteVideoCenter: {
    alignItems: 'center',
    gap: 12,
  },
  videoAvatarBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  videoAvatarImg: {
    width: '100%',
    height: '100%',
  },
  videoAvatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  videoLiveText: {
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pipWindow: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 90,
    height: 130,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 6,
    elevation: 8,
  },
  pipInner: {
    alignItems: 'center',
    marginTop: 18,
  },
  pipCameraIcon: {
    fontSize: 24,
  },
  pipLabel: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '700',
    marginTop: 4,
  },
  pipFlipBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  pipFlipIcon: {
    fontSize: 14,
  },
  /* Floating Bottom Control Bar */
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    gap: 4,
  },
  controlBtnActive: {
    opacity: 0.6,
  },
  controlIcon: {
    fontSize: 22,
  },
  controlLabel: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  endCallBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  endCallIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});
