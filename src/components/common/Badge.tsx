import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, layout, typography } from '../../theme/colors';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', size = 'sm' }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successBg, text: colors.success, border: '#BBF7D0' };
      case 'warning':
        return { bg: colors.warningBg, text: colors.warning, border: '#FDE68A' };
      case 'danger':
        return { bg: colors.dangerBg, text: colors.danger, border: '#FECACA' };
      case 'info':
        return { bg: colors.infoBg, text: colors.info, border: '#BFDBFE' };
      case 'neutral':
        return { bg: colors.surfaceSubtle, text: colors.textSecondary, border: colors.border };
      default:
        return { bg: '#F1F5F9', text: colors.textPrimary, border: colors.border };
    }
  };

  const c = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color: c.text }, size === 'md' && styles.textMd]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: layout.radiusSm,
    borderWidth: layout.borderWidth,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: {
    ...typography.tiny,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  textMd: {
    fontSize: 12,
  },
});
