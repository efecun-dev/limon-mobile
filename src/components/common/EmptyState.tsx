import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  message?: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  actionTitle?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  message,
  iconName = 'database-off-outline',
  actionTitle,
  onAction,
}) => {
  const descText = description || message;
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={iconName} size={32} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {descText && <Text style={styles.description}>{descText}</Text>}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          variant="outline"
          size="sm"
          onPress={onAction}
          style={styles.actionBtn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: layout.radiusSm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  actionBtn: {
    marginTop: 16,
  },
});
