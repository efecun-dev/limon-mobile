import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, layout } from '../../theme/colors';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, noPadding = false, ...props }) => {
  return (
    <View style={[styles.card, noPadding && styles.noPadding, style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: layout.radiusMd,
    padding: 14,
    marginBottom: 10,
  },
  noPadding: {
    padding: 0,
  },
});
