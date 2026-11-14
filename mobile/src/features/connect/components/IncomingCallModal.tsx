import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { Text } from '../../../components';
import { colors, spacing, borderRadius } from '../../../theme';
import { ConnectActiveCall } from '../types';
import { connectCallNative } from '../services/connectCallNative';

interface IncomingCallModalProps {
  call: ConnectActiveCall | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  call,
  onAccept,
  onDecline,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!call) return;

    // Start audible ringtone and vibration
    connectCallNative.startRinging(true);

    // Pulsing circle animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      connectCallNative.stopRinging();
    };
  }, [call, pulseAnim]);

  if (!call) return null;

  const isVideo = call.callType === 'video';
  const partnerName = call.caller.name || 'Unknown Contact';
  const partnerAvatar = call.caller.profileImage;
  const partnerHeadline = call.caller.headline || 'Life OS Contact';

  const handleDecline = () => {
    connectCallNative.stopRinging();
    onDecline();
  };

  const handleAccept = () => {
    connectCallNative.stopRinging();
    onAccept();
  };

  return (
    <Modal visible={Boolean(call)} animationType="slide" transparent={false}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Top Info Banner */}
        <View style={styles.topArea}>
          <View style={styles.callTypePill}>
            <Text style={styles.callTypeIcon}>{isVideo ? '🎥' : '📞'}</Text>
            <Text variant="caption" color="#CBD5E1" style={styles.callTypeText}>
              Incoming {isVideo ? 'Video' : 'Voice'} Call
            </Text>
          </View>
          <Text variant="caption" color="#94A3B8" style={styles.encryptedText}>
            🔒 End-to-end encrypted
          </Text>
        </View>

        {/* Center Caller Profile */}
        <View style={styles.centerArea}>
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

          <Text variant="body" color="#FFFFFF" align="center" style={styles.callerName}>
            {partnerName}
          </Text>
          <Text variant="caption" color="#94A3B8" align="center" style={styles.callerSub}>
            {partnerHeadline}
          </Text>
          <Text variant="caption" color="#38BDF8" align="center" style={styles.ringingStatus}>
            Ringing...
          </Text>
        </View>

        {/* Bottom Actions Bar (WhatsApp Decline & Accept) */}
        <View style={styles.bottomArea}>
          {/* Decline Button */}
          <View style={styles.actionCol}>
            <Pressable
              onPress={handleDecline}
              style={[styles.actionBtn, styles.declineBtn]}
              android_ripple={{ color: '#F87171', borderless: true }}
            >
              <Text style={styles.actionBtnIcon}>✕</Text>
            </Pressable>
            <Text variant="caption" color="#CBD5E1" style={styles.actionLabel}>
              Decline
            </Text>
          </View>

          {/* Accept Button */}
          <View style={styles.actionCol}>
            <Pressable
              onPress={handleAccept}
              style={[styles.actionBtn, styles.acceptBtn]}
              android_ripple={{ color: '#34D399', borderless: true }}
            >
              <Text style={styles.actionBtnIcon}>{isVideo ? '📹' : '📞'}</Text>
            </Pressable>
            <Text variant="caption" color="#CBD5E1" style={styles.actionLabel}>
              Accept
            </Text>
          </View>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 40,
    paddingBottom: 48,
    paddingHorizontal: spacing.lg,
  },
  topArea: {
    alignItems: 'center',
    gap: 6,
  },
  callTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    columnGap: 8,
  },
  callTypeIcon: {
    fontSize: 16,
  },
  callTypeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  encryptedText: {
    fontSize: 11,
  },
  centerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 'auto',
  },
  avatarPulseRing: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#38BDF8',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  callerName: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  callerSub: {
    fontSize: 14,
    marginBottom: 14,
  },
  ringingStatus: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomArea: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  actionCol: {
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  actionBtnIcon: {
    fontSize: 26,
    color: '#FFFFFF',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
