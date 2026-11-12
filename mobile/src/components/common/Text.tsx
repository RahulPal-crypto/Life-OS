import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
} from 'react-native';
import { colors, typography } from '../../theme';

export interface TextProps extends RNTextProps {
  variant?: keyof typeof typography;
  color?: string;
  align?: TextStyle['textAlign'];
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = colors.textPrimary,
  align = 'left',
  style,
  children,
  ...props
}) => {
  return (
    <RNText
      style={[
        typography[variant],
        { color, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};

