import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text, Button } from '../../../components';
import { memoriesNative } from '../services/memoriesNative';
import { memoriesService } from '../services/memoriesService';

interface SafeVaultModalProps {
  visible: boolean;
  isConfigured: boolean;
  biometricEnabled: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

export const SafeVaultModal: React.FC<SafeVaultModalProps> = ({
  visible,
  isConfigured,
  biometricEnabled,
  onClose,
  onUnlocked,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enableBiometric, setEnableBiometric] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setPin('');
      setConfirmPin('');
      setError('');
      setBusy(false);
      return;
    }

    memoriesNative.canUseBiometric().then((avail) => {
      setBiometricAvailable(avail);
    });
  }, [visible]);

  const handleBiometricUnlock = async () => {
    setBusy(true);
    setError('');
    try {
      const bioKey = await memoriesNative.unlockWithBiometric();
      await memoriesService.unlockVaultBiometric(bioKey);
      onUnlocked();
    } catch (err: any) {
      setError(err?.message || 'Fingerprint verification canceled. Enter Vault PIN.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitPin = async () => {
    const cleanPin = pin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      setError('Enter a 4 to 6 digit numeric PIN.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      if (!isConfigured) {
        if (cleanPin !== confirmPin.trim()) {
          setError('PINs do not match.');
          setBusy(false);
          return;
        }
        const setupRes = await memoriesService.setupVaultPin({
          pin: cleanPin,
          biometricEnabled: enableBiometric && biometricAvailable,
        });
        if (setupRes.biometricKey && enableBiometric && biometricAvailable) {
          await memoriesNative.storeBiometricKey(setupRes.biometricKey);
        }
        onUnlocked();
        return;
      }

      await memoriesService.unlockVaultPin(cleanPin);
      onUnlocked();
    } catch (err: any) {
      setError(err?.message || 'Unable to verify Vault PIN.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>

          <Text variant="h2" color={colors.textPrimary} align="center" style={styles.title}>
            {isConfigured ? 'Unlock Safe Vault' : 'Create Safe Vault PIN'}
          </Text>
          <Text variant="caption" color={colors.textSecondary} align="center" style={styles.subtitle}>
            {isConfigured
              ? 'Safe files are AES-256 encrypted and hidden from gallery, recents & search.'
              : 'Protect private photos, folders and IDs with AES encryption & screen lock.'}
          </Text>

          <TextInput
            value={pin}
            onChangeText={(t) => {
              setPin(t.replace(/[^0-9]/g, '').slice(0, 6));
              if (error) setError('');
            }}
            placeholder="Enter 4-6 digit PIN"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            style={styles.pinInput}
          />

          {!isConfigured && (
            <TextInput
              value={confirmPin}
              onChangeText={(t) => {
                setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 6));
                if (error) setError('');
              }}
              placeholder="Confirm PIN"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.pinInput}
            />
          )}

          {!isConfigured && biometricAvailable && (
            <View style={styles.bioToggleRow}>
              <Text variant="caption" color={colors.textPrimary} style={styles.bioToggleLabel}>
                Enable Fingerprint / Face Unlock
              </Text>
              <Switch value={enableBiometric} onValueChange={setEnableBiometric} />
            </View>
          )}

          {error ? (
            <Text variant="caption" color="#DC2626" align="center" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : (
            <>
              <Button
                title={isConfigured ? 'Unlock Vault' : 'Set PIN & Open Vault'}
                onPress={handleSubmitPin}
                style={styles.primaryBtn}
              />

              {isConfigured && biometricEnabled && biometricAvailable && (
                <Pressable onPress={handleBiometricUnlock} style={styles.bioBtn}>
                  <Text variant="caption" color="#0F766E" style={styles.bioBtnText}>
                    👆 Unlock with Fingerprint / Face
                  </Text>
                </Pressable>
              )}

              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text variant="caption" color={colors.textSecondary} style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  lockBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  lockIcon: {
    fontSize: 24,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: borderRadius.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginBottom: spacing.sm,
  },
  bioToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
    paddingHorizontal: 4,
  },
  bioToggleLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  loader: {
    marginVertical: spacing.md,
  },
  primaryBtn: {
    marginTop: spacing.xs,
    backgroundColor: '#0F172A',
    height: 46,
  },
  bioBtn: {
    marginTop: spacing.sm,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: borderRadius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  bioBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
