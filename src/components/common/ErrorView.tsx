import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { Button } from './Button';

interface ErrorViewProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  onOpenServerSettings?: () => void;
  serverUrl?: string;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  title = 'Bağlantı Hatası',
  message = 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı ve VPS sunucu adresini kontrol edin.',
  onRetry,
  onOpenSettings,
  onOpenServerSettings,
  serverUrl,
}) => {
  const handleSettings = onOpenSettings || onOpenServerSettings;
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="server-network-off" size={36} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{message}</Text>
      {serverUrl ? (
        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Hedef VPS Sunucu:</Text>
          <Text style={styles.urlText}>{serverUrl}</Text>
        </View>
      ) : null}

      <View style={styles.btnRow}>
        {onRetry && (
          <Button
            title="Tekrar Dene"
            variant="primary"
            size="sm"
            onPress={onRetry}
            style={styles.btn}
            icon={<MaterialCommunityIcons name="refresh" size={16} color="#FFF" />}
          />
        )}
        {handleSettings && (
          <Button
            title="Sunucu Ayarları"
            variant="outline"
            size="sm"
            onPress={handleSettings}
            style={styles.btn}
            icon={<MaterialCommunityIcons name="cog-outline" size={16} color={colors.textPrimary} />}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: layout.radiusMd,
    margin: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: layout.radiusSm,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  urlBox: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: layout.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  urlLabel: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  urlText: {
    ...typography.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    minWidth: 120,
  },
});
