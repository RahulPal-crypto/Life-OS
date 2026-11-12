import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardTypeOptions,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Text } from '../../../components';

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isPassword?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  isPassword = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  onFocus,
  onBlur,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) onBlur();
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text variant="caption" color={isFocused ? colors.primary : colors.textSecondary} style={styles.label}>
          {label}
        </Text>
      </View>

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={styles.textInput}
        />

        {isPassword && (
          <Pressable
            onPress={() => setShowPassword(prev => !prev)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.toggleButton}
          >
            <Text variant="caption" color={colors.textSecondary} style={styles.toggleText}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <Text variant="caption" color="#DC2626" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: '#0F172A',
    borderWidth: 1.5,
  },
  inputWrapperError: {
    borderColor: '#DC2626',
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '500',
  },
  toggleButton: {
    paddingLeft: spacing.sm,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  errorText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'none',
  },
});
