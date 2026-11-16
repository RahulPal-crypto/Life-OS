import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Text } from '../../../components';
import { spacing, borderRadius } from '../../../theme';
import { connectService } from '../services/connectService';

interface ConnectSecurityModalProps {
  visible: boolean;
  isConfigured: boolean;
  biometricEnabled: boolean;
  onUnlocked: () => void;
  onClose: () => void;
}

export const ConnectSecurityModal: React.FC<ConnectSecurityModalProps> = ({
  visible,
  isConfigured,
  onUnlocked,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSetupStepConfirm, setIsSetupStepConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setPin('');
      setConfirmPin('');
      setIsSetupStepConfirm(false);
      setError('');
      setBusy(false);
      return;
    }

  }, [visible, isConfigured]);

  const handleKeyPress = (digit: string) => {
    setError('');
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);

      // Six-digit PINs submit automatically; four-digit PINs use the Unlock button.
      if (isConfigured && nextPin.length === 6) {
        verifyPinDirect(nextPin);
      }
    }
  };

  const handleDeletePress = () => {
    setError('');
    if (pin.length > 0) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const verifyPinDirect = async (pinToVerify: string) => {
    setBusy(true);
    try {
      const ok = await connectService.verifyPin(pinToVerify);
      if (ok) {
        onUnlocked();
      } else {
        setError('Could not unlock Connect. Please try your PIN again.');
        setPin('');
      }
    } catch (err: any) {
      setError(err?.message || 'Incorrect PIN.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const handleSetupSubmit = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4 to 6 digits.');
      return;
    }

    if (!isSetupStepConfirm) {
      setIsSetupStepConfirm(true);
      setConfirmPin('');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match. Try again.');
      setConfirmPin('');
      return;
    }

    setBusy(true);
    try {
      await connectService.setupPin({
        pin,
        biometricEnabled: false,
        autoLockDelay: 'immediate',
      });
      onUnlocked();
    } catch (err: any) {
      setError(err?.message || 'Failed to setup PIN.');
    } finally {
      setBusy(false);
    }
  };

  const renderPinDots = () => {
    const activePin = isSetupStepConfirm ? confirmPin : pin;
    return (
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const filled = idx < activePin.length;
          return <View key={idx} style={[styles.dot, filled && styles.dotFilled]} />;
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Branding */}
        <View style={styles.topArea}>
          <Image
            source={require('../../../assets/images/logo.jpg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="h2" color="#FFFFFF" style={styles.title}>
            {isConfigured
              ? 'My Connect 🔒'
              : isSetupStepConfirm
              ? 'Confirm PIN'
              : 'Set Connect PIN'}
          </Text>
          <Text variant="caption" color="#94A3B8" align="center" style={styles.subTitle}>
            {isConfigured
              ? 'Enter your PIN to unlock chats'
              : isSetupStepConfirm
              ? 'Re-enter your 4 to 6 digit PIN to confirm'
              : 'Create a 4 to 6 digit security PIN to protect your chats'}
          </Text>
        </View>

        {/* PIN Dots */}
        {renderPinDots()}

        {/* Error message */}
        {Boolean(error) && (
          <Text variant="caption" color="#EF4444" align="center" style={styles.errorText}>
            {error}
          </Text>
        )}

        <Text variant="caption" color="#94A3B8" align="center">
          PIN verification protects Connect sessions on the server.
        </Text>

        {/* First time setup next / confirm button */}
        {!isConfigured && (
          <Pressable
            onPress={handleSetupSubmit}
            disabled={busy || (isSetupStepConfirm ? confirmPin.length < 4 : pin.length < 4)}
            style={[
              styles.actionBtn,
              (isSetupStepConfirm ? confirmPin.length < 4 : pin.length < 4) &&
                styles.actionBtnDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text variant="caption" color="#FFFFFF" style={styles.actionBtnText}>
                {isSetupStepConfirm ? 'Confirm & Unlock' : 'Continue ›'}
              </Text>
            )}
          </Pressable>
        )}

        {isConfigured && (
          <Pressable
            onPress={() => verifyPinDirect(pin)}
            disabled={busy || pin.length < 4}
            style={[styles.actionBtn, pin.length < 4 && styles.actionBtnDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text variant="caption" color="#FFFFFF" style={styles.actionBtnText}>
                Unlock Connect
              </Text>
            )}
          </Pressable>
        )}

        {/* Number Pad */}
        <View style={styles.numPad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', '⌫'],
          ].map((row, rowIdx) => (
            <View key={rowIdx} style={styles.padRow}>
              {row.map((digit, colIdx) => {
                if (digit === '') {
                  return <View key={colIdx} style={styles.padKeyEmpty} />;
                }
                const isDel = digit === '⌫';
                return (
                  <Pressable
                    key={colIdx}
                    onPress={() => {
                      if (isDel) {
                        if (isSetupStepConfirm) {
                          setConfirmPin((p) => p.slice(0, -1));
                        } else {
                          handleDeletePress();
                        }
                      } else {
                        if (isSetupStepConfirm) {
                          if (confirmPin.length < 6) setConfirmPin((p) => p + digit);
                        } else {
                          handleKeyPress(digit);
                        }
                      }
                    }}
                    style={({ pressed }) => [
                      styles.padKey,
                      pressed && styles.padKeyPressed,
                    ]}
                  >
                    <Text
                      variant="h2"
                      color={isDel ? '#EF4444' : '#FFFFFF'}
                      style={styles.keyText}
                    >
                      {digit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Cancel / Back Button */}
        <Pressable onPress={onClose} style={styles.cancelBtn}>
          <Text variant="caption" color="#94A3B8" style={styles.cancelText}>
            ‹ Back to Dashboard
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  topArea: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 14,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 12.5,
    paddingHorizontal: spacing.md,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: spacing.md,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#7C3AED',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: spacing.md,
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
  },
  bioIcon: {
    fontSize: 20,
  },
  bioText: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  numPad: {
    paddingHorizontal: spacing.md,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  padKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyPressed: {
    backgroundColor: '#334155',
  },
  padKeyEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
