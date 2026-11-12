import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { spacing, borderRadius } from '../../../theme';
import { Text, Button } from '../../../components';
import { InputField } from '../../auth/components/InputField';
import { ChangePasswordPayload } from '../services/profileService';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: ChangePasswordPayload) => Promise<void>;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    }
  }, [visible]);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const nextErrors: Record<string, string> = {};

    if (!currentPassword) {
      nextErrors.currentPassword = 'Enter your current password.';
    }
    if (!newPassword || newPassword.length < 6) {
      nextErrors.newPassword = 'New password must be at least 6 characters.';
    } else if (newPassword === currentPassword) {
      nextErrors.newPassword = 'New password must be different from current password.';
    }
    if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await onSubmit({ currentPassword, newPassword });
      onClose();
    } catch (err: any) {
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setErrors(err.fieldErrors);
      } else {
        setErrors({ _form: err?.message || 'Unable to change password.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        Keyboard.dismiss();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text variant="h2" color="#1E1B4B" style={styles.headerTitle}>
              Change Password
            </Text>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="caption" color="#6B7280" style={styles.closeText}>
                Close
              </Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {errors._form ? (
              <View style={styles.errorBanner}>
                <Text variant="bodySmall" color="#DC2626">
                  {errors._form}
                </Text>
              </View>
            ) : null}

            <InputField
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              isPassword
              error={errors.currentPassword}
            />

            <InputField
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 6 characters"
              isPassword
              error={errors.newPassword}
            />

            <InputField
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              isPassword
              error={errors.confirmPassword}
            />

            <Text variant="caption" color="#6B7280" style={styles.securityNote}>
              Other logged-in devices will be signed out automatically while keeping this session active.
            </Text>

            <Button
              title={loading ? 'Updating Password...' : 'Update Password'}
              onPress={handleSubmit}
              loading={loading}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontWeight: '800',
  },
  closeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'none',
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  securityNote: {
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0.1,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
});
