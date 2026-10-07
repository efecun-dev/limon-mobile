import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useServer } from '../../context/ServerContext';

interface HeaderProps {
  onOpenServerSettings?: () => void;
  onOpenBranchPicker?: () => void;
  quickStats?: {
    activeOrders?: number;
    todayRevenue?: number;
    avgRating?: string;
  };
}

export const Header: React.FC<HeaderProps> = ({
  onOpenServerSettings,
  onOpenBranchPicker,
  quickStats,
}) => {
  const { user, activeBranchName } = useAuth();
  const { isConnected, latencyMs } = useServer();

  return (
    <View style={styles.headerWrapper}>
      {/* 1. Üst Koyu Şerit (Panel Top Bar: bg-gray-900 text-white) */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.brandIconBox}>
            <MaterialCommunityIcons name="shield-check" size={13} color="#FFFFFF" />
          </View>
          <Text style={styles.panelTitle}>LİMON PANEL</Text>
          <Text style={styles.panelSubtitle}>• MERKEZİ OPERASYON</Text>
        </View>

        {/* VPS Durum Göstergesi */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenServerSettings}
          style={styles.vpsStatusBox}
        >
          <View
            style={[
              styles.vpsDot,
              { backgroundColor: isConnected ? '#10B981' : '#EF4444' },
            ]}
          />
          <Text style={styles.vpsText}>
            {isConnected ? (latencyMs ? `${latencyMs}ms` : 'VPS') : 'KOPUK'}
          </Text>
          <MaterialCommunityIcons name="cog-outline" size={12} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* 2. Alt Bilgi Çubuğu (Şube Seçici & Hızlı Metrikler) */}
      <View style={styles.subBar}>
        {onOpenBranchPicker ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onOpenBranchPicker}
            style={styles.branchPickerBtn}
          >
            <MaterialCommunityIcons name="store-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.branchNameText} numberOfLines={1}>
              {activeBranchName}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.userBadge}>
            <Text style={styles.userNameText}>{user?.name || 'Sistem Yöneticisi'}</Text>
          </View>
        )}

        {/* Hızlı Özet Göstergesi */}
        {quickStats && (
          <View style={styles.quickStatsRow}>
            {quickStats.activeOrders !== undefined && (
              <View style={styles.statChip}>
                <Text style={styles.statChipVal}>{quickStats.activeOrders}</Text>
                <Text style={styles.statChipLabel}>Aktif</Text>
              </View>
            )}
            {quickStats.todayRevenue !== undefined && (
              <View style={styles.statChip}>
                <Text style={styles.statChipVal}>{quickStats.todayRevenue.toLocaleString('tr-TR')} ₺</Text>
                <Text style={styles.statChipLabel}>Bugün</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.border,
  },
  topBar: {
    backgroundColor: colors.headerDark,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.headerDarkBorder,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIconBox: {
    width: 18,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    ...typography.tiny,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  panelSubtitle: {
    ...typography.tiny,
    color: '#9CA3AF',
    fontSize: 9,
  },
  vpsStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: layout.borderWidth,
    borderColor: '#374151',
    gap: 4,
  },
  vpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vpsText: {
    ...typography.mono,
    fontSize: 10,
    color: '#D1D5DB',
    fontWeight: '600',
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  branchPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radiusSm,
    gap: 4,
    maxWidth: 200,
  },
  branchNameText: {
    ...typography.bodyMedium,
    fontSize: 12,
  },
  userBadge: {
    paddingVertical: 2,
  },
  userNameText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: layout.radiusSm,
    gap: 4,
  },
  statChipVal: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statChipLabel: {
    ...typography.tiny,
    fontSize: 9,
    color: colors.textMuted,
  },
});
