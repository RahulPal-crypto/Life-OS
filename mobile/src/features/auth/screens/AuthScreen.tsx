import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text, Button, ScreenContainer } from '../../../components';
import { InputField } from '../components/InputField';
import { SegmentedTab, AuthMode } from '../components/SegmentedTab';
import { authService, User } from '../services/authService';
import { appConfig } from '../../../config/appConfig';

interface AuthScreenProps {
  onBack: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onBack,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);

  // Keyboard & Scroll handling
  const scrollViewRef = useRef<any>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Forgot / Reset password modal state
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Dynamic keyboard listeners for automatic scroll & clearance
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToField = (yOffset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 120);
  };

  const clearErrors = () => setErrors({});

  const handleLogin = async () => {
    Keyboard.dismiss();
    clearErrors();
    const newErrors: Record<string, string> = {};

    if (!loginIdentifier.trim()) {
      newErrors.loginIdentifier = 'Enter your email or phone number';
    }
    if (!loginPassword) {
      newErrors.loginPassword = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const user = await authService.login({
        identifier: loginIdentifier,
        password: loginPassword,
      });

      onAuthSuccess(user);
    } catch (err: any) {
      Alert.alert('Unable to Sign In', err.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    clearErrors();
    const newErrors: Record<string, string> = {};

    if (!regName.trim()) {
      newErrors.regName = 'Enter your full name';
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      newErrors.regEmail = 'Enter a valid email address';
    }
    if (!regPhone.trim() || regPhone.length < 8) {
      newErrors.regPhone = 'Enter a valid phone number';
    }
    if (!regPassword || regPassword.length < 6) {
      newErrors.regPassword = 'Password must be at least 6 characters';
    }
    if (regPassword !== regConfirmPassword) {
      newErrors.regConfirmPassword = 'Passwords do not match';
    }
    if (!termsAccepted) {
      newErrors.termsAccepted = 'Please accept the Terms of Service & Privacy Policy';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const user = await authService.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        termsAccepted: true,
      });

      onAuthSuccess(user);
    } catch (err: any) {
      if (err.fieldErrors) {
        setErrors(err.fieldErrors);
      }
      Alert.alert('Registration Error', err.message || 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    Keyboard.dismiss();
    if (!forgotIdentifier.trim()) {
      Alert.alert('Required', 'Enter your registered email or phone');
      return;
    }

    setForgotLoading(true);
    try {
      const result = await authService.forgotPassword(forgotIdentifier);
      if (result.resetToken) {
        setResetToken(result.resetToken);
      }
      Alert.alert('Verification Link Sent', result.message, [
        {
          text: 'Enter New Password',
          onPress: () => setResetStep(2),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Reset Error', err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    Keyboard.dismiss();
    if (!resetToken.trim() || !newPassword || newPassword.length < 6) {
      Alert.alert('Input Error', 'Token and minimum 6-character new password required.');
      return;
    }

    setForgotLoading(true);
    try {
      const message = await authService.resetPassword(resetToken, newPassword);
      Alert.alert('Success', message, [
        {
          text: 'Sign In Now',
          onPress: () => {
            setForgotModalVisible(false);
            setResetStep(1);
            setResetToken('');
            setNewPassword('');
            setMode('login');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <ScreenContainer backgroundColor="#FAFAFC" barStyle="dark-content">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: keyboardVisible ? (Platform.OS === 'ios' ? 140 : 180) : 40 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={true}
          >
            {/* Top Bar with Minimal Back Action */}
            <View style={styles.topBar}>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  onBack();
                }}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text variant="caption" color={colors.textSecondary} style={styles.backText}>
                  ← Spaces
                </Text>
              </Pressable>

              <Text variant="caption" color={colors.textMuted} style={styles.categoryBadge}>
                Personal Space
              </Text>
            </View>

            {/* Editorial Heading */}
            <View style={styles.headerSection}>
              <Text variant="hero" color={colors.textPrimary} style={styles.titleText}>
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </Text>
              <Text variant="body" color={colors.textSecondary} style={styles.subtitleText}>
                {mode === 'login'
                  ? 'Sign in to access your day timeline and personal space.'
                  : 'Set up your private personal space to begin managing your life.'}
              </Text>
            </View>

            {/* Segmented Control */}
            <SegmentedTab
              mode={mode}
              onChangeMode={m => {
                clearErrors();
                setMode(m);
                Keyboard.dismiss();
              }}
            />

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {mode === 'login' ? (
                /* LOGIN */
                <View>
                  <InputField
                    label="Email or Phone"
                    placeholder="name@domain.com or phone"
                    value={loginIdentifier}
                    onChangeText={setLoginIdentifier}
                    keyboardType="email-address"
                    error={errors.loginIdentifier}
                    onFocus={() => scrollToField(40)}
                  />

                  <InputField
                    label="Password"
                    placeholder="Your password"
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    isPassword={true}
                    error={errors.loginPassword}
                    onFocus={() => scrollToField(120)}
                  />

                  <View style={styles.forgotRow}>
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                        setResetStep(1);
                        setForgotModalVisible(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text variant="caption" color={colors.textSecondary} style={styles.forgotText}>
                        Forgot password?
                      </Text>
                    </Pressable>
                  </View>

                  <Button
                    title="Sign In"
                    onPress={handleLogin}
                    loading={loading}
                    style={styles.actionButton}
                  />
                </View>
              ) : (
                /* REGISTER */
                <View>
                  <InputField
                    label="Full Name"
                    placeholder="e.g. Rahul Pal"
                    value={regName}
                    onChangeText={setRegName}
                    autoCapitalize="words"
                    error={errors.regName}
                    onFocus={() => scrollToField(20)}
                  />

                  <InputField
                    label="Email Address"
                    placeholder="you@domain.com"
                    value={regEmail}
                    onChangeText={setRegEmail}
                    keyboardType="email-address"
                    error={errors.regEmail}
                    onFocus={() => scrollToField(90)}
                  />

                  <InputField
                    label="Phone Number"
                    placeholder="+91 98765 43210"
                    value={regPhone}
                    onChangeText={setRegPhone}
                    keyboardType="phone-pad"
                    error={errors.regPhone}
                    onFocus={() => scrollToField(170)}
                  />

                  <InputField
                    label="Password"
                    placeholder="At least 6 characters"
                    value={regPassword}
                    onChangeText={setRegPassword}
                    isPassword={true}
                    error={errors.regPassword}
                    onFocus={() => scrollToField(250)}
                  />

                  <InputField
                    label="Confirm Password"
                    placeholder="Re-enter password"
                    value={regConfirmPassword}
                    onChangeText={setRegConfirmPassword}
                    isPassword={true}
                    error={errors.regConfirmPassword}
                    onFocus={() => scrollToField(330)}
                  />

                  {/* Terms & Privacy Acceptance Checkbox */}
                  <Pressable
                    onPress={() => setTermsAccepted(prev => !prev)}
                    style={styles.termsRow}
                  >
                    <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                      {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text variant="caption" color={colors.textSecondary} style={styles.termsText}>
                      I agree to the Terms of Service & Privacy Policy
                    </Text>
                  </Pressable>
                  {errors.termsAccepted && (
                    <Text variant="caption" color="#DC2626" style={styles.termsError}>
                      {errors.termsAccepted}
                    </Text>
                  )}

                  <Button
                    title="Create Account"
                    onPress={handleRegister}
                    loading={loading}
                    style={styles.actionButton}
                  />
                </View>
              )}
            </View>

            {/* Subtle Privacy Footnote */}
            <View style={styles.privacyFootnote}>
              <Text variant="caption" color={colors.textMuted} align="center" style={styles.privacyText}>
                Protected by 256-bit encryption. Your credentials and sessions are strictly private.
              </Text>
            </View>

            {/* Minimalist Developer Footer */}
            <View style={styles.footerSection}>
              <Text variant="caption" color={colors.textMuted} style={styles.creditText}>
                {appConfig.developerCredit}
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Forgot / Reset Password Modal */}
      <Modal
        visible={forgotModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setForgotModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.modalCard}>
              <Text variant="h2" color={colors.textPrimary} style={styles.modalTitle}>
                {resetStep === 1 ? 'Reset Password' : 'Set New Password'}
              </Text>
              <Text variant="body" color={colors.textSecondary} style={styles.modalDesc}>
                {resetStep === 1
                  ? 'Enter your registered email or phone to receive a verification reset link.'
                  : 'Enter your verification token and your new secure password.'}
              </Text>

              {resetStep === 1 ? (
                <InputField
                  label="Email or Phone"
                  placeholder="e.g. name@domain.com"
                  value={forgotIdentifier}
                  onChangeText={setForgotIdentifier}
                />
              ) : (
                <View>
                  <InputField
                    label="Verification Token"
                    placeholder="Paste reset token"
                    value={resetToken}
                    onChangeText={setResetToken}
                  />
                  <InputField
                    label="New Password"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    isPassword={true}
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    Keyboard.dismiss();
                    setForgotModalVisible(false);
                    setResetStep(1);
                  }}
                  style={styles.modalCancelButton}
                />
                <Button
                  title={resetStep === 1 ? 'Send Link' : 'Update Password'}
                  variant="primary"
                  loading={forgotLoading}
                  onPress={resetStep === 1 ? handleForgotPasswordSubmit : handleResetPasswordSubmit}
                  style={styles.modalSubmitButton}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  formContainer: {
    marginTop: spacing.xs,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  termsText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },
  termsError: {
    fontSize: 11,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  actionButton: {
    width: '100%',
    backgroundColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  privacyFootnote: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  privacyText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  creditText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#94A3B8',
  },
  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    marginRight: spacing.sm,
    height: 46,
  },
  modalSubmitButton: {
    flex: 1,
    marginLeft: spacing.sm,
    height: 46,
    backgroundColor: '#0F172A',
  },
});
