import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { colors, layout, typography } from '../../theme/colors';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  style,
  disabled,
  ...props
}) => {
  const getButtonStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: colors.surfaceSubtle,
          border: colors.border,
          text: colors.textPrimary,
        };
      case 'outline':
        return {
          bg: colors.surface,
          border: colors.borderStrong,
          text: colors.textPrimary,
        };
      case 'danger':
        return {
          bg: colors.danger,
          border: colors.danger,
          text: '#FFFFFF',
        };
      default:
        return {
          bg: colors.primary,
          border: colors.primary,
          text: colors.primaryText,
        };
    }
  };

  const c = getButtonStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.button,
        size === 'sm' && styles.btnSm,
        size === 'lg' && styles.btnLg,
        {
          backgroundColor: disabled ? colors.surfaceSubtle : c.bg,
          borderColor: disabled ? colors.border : c.border,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.text} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text
            style={[
              styles.text,
              { color: disabled ? colors.textDisabled : c.text },
              size === 'sm' && styles.textSm,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: layout.radiusSm,
    borderWidth: layout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  btnLg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginRight: 6,
  },
  text: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 12,
  },
});
