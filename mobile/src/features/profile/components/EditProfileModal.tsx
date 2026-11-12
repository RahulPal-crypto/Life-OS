import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text, Button } from '../../../components';
import { InputField } from '../../auth/components/InputField';
import { User } from '../../auth/services/authService';
import { UpdateProfilePayload } from '../services/profileService';
import { AVATAR_PRESETS } from '../utils/avatarHelper';

interface EditProfileModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (payload: UpdateProfilePayload) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  user,
  onClose,
  onSave,
}) => {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [dailyFocusGoal, setDailyFocusGoal] = useState('8');
  const [dailyStepsGoal, setDailyStepsGoal] = useState('8000');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible && user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setHeadline(user.headline || '');
      setLocation(user.location || '');
      setBio(user.bio || '');
      setProfileImage(user.profileImage || '');
      setDailyFocusGoal(String(user.dailyFocusGoal ?? 8));
      setDailyStepsGoal(String(user.dailyStepsGoal ?? 8000));
      setErrors({});
    }
  }, [visible, user]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToY = (y: number) => {
    setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 120);
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    const nextErrors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      nextErrors.name = 'Full name must be at least 2 characters.';
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      nextErrors.phone = 'Enter a valid phone number (8 to 15 digits).';
    }

    const focusNum = Number(dailyFocusGoal.trim());
    if (!Number.isFinite(focusNum) || focusNum < 0.5 || focusNum > 24) {
      nextErrors.dailyFocusGoal = 'Focus goal must be between 0.5 and 24 hours.';
    }

    const stepsNum = Number(dailyStepsGoal.trim());
    if (!Number.isInteger(stepsNum) || stepsNum < 500 || stepsNum > 100000) {
      nextErrors.dailyStepsGoal = 'Steps goal must be a whole number (500 - 100,000).';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        headline: headline.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
        profileImage: profileImage.trim() || null,
        dailyFocusGoal: Math.round(focusNum * 10) / 10,
        dailyStepsGoal: stepsNum,
      });
      onClose();
    } catch (err: any) {
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setErrors(err.fieldErrors);
      } else {
        setErrors({ _form: err?.message || 'Unable to save profile changes.' });
      }
    } finally {
      setSaving(false);
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
              Edit Profile
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
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scrollContent}
          >
            {errors._form ? (
              <View style={styles.formErrorBanner}>
                <Text variant="bodySmall" color="#DC2626">
                  {errors._form}
                </Text>
              </View>
            ) : null}

            {/* Avatar Presets */}
            <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
              AVATAR BADGE
            </Text>
            <View style={styles.avatarStrip}>
              <Pressable
                onPress={() => setProfileImage('')}
                style={[
                  styles.avatarOption,
                  !profileImage ? styles.avatarOptionActive : null,
                ]}
              >
                <Text variant="caption" color={!profileImage ? '#6D28D9' : '#64748B'} style={styles.initialOptionText}>
                  Aa
                </Text>
              </Pressable>

              {AVATAR_PRESETS.map((preset) => {
                const isSelected = profileImage === preset.value;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => setProfileImage(preset.value)}
                    style={[
                      styles.avatarOption,
                      { backgroundColor: preset.bgColor },
                      isSelected && styles.avatarOptionActive,
                    ]}
                  >
                    <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  </Pressable>
                );
              })}
            </View>

            <InputField
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              error={errors.name}
              onFocus={() => scrollToY(40)}
            />

            <InputField
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 9876543210"
              keyboardType="phone-pad"
              error={errors.phone}
              onFocus={() => scrollToY(110)}
            />

            <InputField
              label="Headline"
              value={headline}
              onChangeText={setHeadline}
              placeholder="e.g., Full-Stack Builder • CS Learner"
              autoCapitalize="sentences"
              error={errors.headline}
              onFocus={() => scrollToY(180)}
            />

            <InputField
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., Bengaluru, India"
              autoCapitalize="words"
              error={errors.location}
              onFocus={() => scrollToY(250)}
            />

            {/* Bio multiline */}
            <View style={styles.fieldGroup}>
              <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                BIO
              </Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Share a quick note about your goals or focus..."
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={250}
                onFocus={() => scrollToY(330)}
                style={styles.bioInput}
              />
              {errors.bio ? (
                <Text variant="caption" color="#DC2626" style={styles.inlineError}>
                  {errors.bio}
                </Text>
              ) : null}
            </View>

            {/* Daily Targets */}
            <View style={styles.goalsRow}>
              <View style={styles.goalCol}>
                <InputField
                  label="Focus Goal (Hrs)"
                  value={dailyFocusGoal}
                  onChangeText={setDailyFocusGoal}
                  placeholder="8"
                  keyboardType="decimal-pad"
                  error={errors.dailyFocusGoal}
                  onFocus={() => scrollToY(450)}
                />
              </View>
              <View style={styles.goalGap} />
              <View style={styles.goalCol}>
                <InputField
                  label="Steps Goal"
                  value={dailyStepsGoal}
                  onChangeText={setDailyStepsGoal}
                  placeholder="8000"
                  keyboardType="number-pad"
                  error={errors.dailyStepsGoal}
                  onFocus={() => scrollToY(450)}
                />
              </View>
            </View>

            <Button
              title={saving ? 'Saving Changes...' : 'Save Profile'}
              onPress={handleSave}
              loading={saving}
              style={styles.saveBtn}
            />

            {keyboardHeight > 0 && <View style={{ height: keyboardHeight + 24 }} />}
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
    paddingBottom: spacing.lg,
    maxHeight: '90%',
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
  formErrorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  avatarStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  avatarOption: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionActive: {
    borderColor: '#6D28D9',
  },
  initialOptionText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'none',
  },
  presetEmoji: {
    fontSize: 20,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  bioInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: 76,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#0F172A',
  },
  inlineError: {
    marginTop: 4,
    fontSize: 11,
    textTransform: 'none',
  },
  goalsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  goalCol: {
    flex: 1,
  },
  goalGap: {
    width: spacing.sm + 4,
  },
  saveBtn: {
    marginTop: spacing.xs,
  },
});
