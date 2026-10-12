import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { healthService } from '../api/services';
import { HealthApiResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const MoreMenuScreen: React.FC<{
  onOpenServerSettings: () => void;
  onNavigateToLevels?: () => void;
  onNavigateToBranches?: () => void;
  onNavigateToClaims?: () => void;
  onNavigateToReviews?: () => void;
  onNavigateToProductCreate?: () => void;
  onNavigateToBarcode?: () => void;
  onNavigateToRawOrders?: () => void;
  onNavigateToCancellations?: () => void;
  onNavigateToPriceRadar?: () => void;
  onNavigateToBulkPrice?: () => void;
}> = ({
  onOpenServerSettings,
  onNavigateToLevels,
  onNavigateToBranches,
  onNavigateToClaims,
  onNavigateToReviews,
  onNavigateToProductCreate,
  onNavigateToBarcode,
  onNavigateToRawOrders,
  onNavigateToCancellations,
  onNavigateToPriceRadar,
  onNavigateToBulkPrice,
}) => {
  const { user, logout, activeBranchName } = useAuth();
  const { serverUrl, isConnected, latencyMs, testConnection } = useServer();

  const [health, setHealth] = useState<HealthApiResponse | null>(null);

  const fetchHealthInfo = async () => {
    try {
      const res = await healthService.checkHealth();
      setHealth(res);
    } catch {
      setHealth(null);
    }
  };

  useEffect(() => {
    fetchHealthInfo();
  }, [serverUrl]);

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Oturumunuzu kapatmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Evet, Çıkış Yap', style: 'destructive', onPress: logout },
    ]);
  };

  const formatUptime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hours} saat ${mins} dk`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Kullanıcı Profili Kartı */}
      <Card style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatarBox}>
            <MaterialCommunityIcons name="account-circle" size={36} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.name || 'Kullanıcı'}</Text>
            <Text style={styles.userRole}>
              Yetki: {user?.role || 'Kullanıcı'} • {activeBranchName}
            </Text>
            <Text style={styles.userUsername}>@{user?.username}</Text>
          </View>
        </View>
      </Card>

      {/* 2. Operasyon ve Panel Modülleri Izgarası */}
      <Card style={styles.toolsCard}>
        <Text style={styles.toolsHeaderTitle}>PANEL MODÜLLERİ VE OPERASYON</Text>
        <View style={styles.toolsGrid}>
          {onNavigateToLevels && (
            <TouchableOpacity onPress={onNavigateToLevels} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#EEF2FF' }]}>
                <MaterialCommunityIcons name="shield-star-outline" size={20} color="#4F46E5" />
              </View>
              <Text style={styles.toolTitle}>Seviye & Komisyon</Text>
              <Text style={styles.toolDesc}>Barajlar & hedefler</Text>
            </TouchableOpacity>
          )}

          {onNavigateToBranches && (
            <TouchableOpacity onPress={onNavigateToBranches} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="store-cog-outline" size={20} color="#059669" />
              </View>
              <Text style={styles.toolTitle}>Şube Yönetimi</Text>
              <Text style={styles.toolDesc}>12 şube açık/kapalı</Text>
            </TouchableOpacity>
          )}

          {onNavigateToClaims && (
            <TouchableOpacity onPress={onNavigateToClaims} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#FEF2F2' }]}>
                <MaterialCommunityIcons name="clipboard-arrow-left-outline" size={20} color="#DC2626" />
              </View>
              <Text style={styles.toolTitle}>İade Yönetimi</Text>
              <Text style={styles.toolDesc}>Müşteri talepleri</Text>
            </TouchableOpacity>
          )}

          {onNavigateToReviews && (
            <TouchableOpacity onPress={onNavigateToReviews} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#FFFBEB' }]}>
                <MaterialCommunityIcons name="star-outline" size={20} color="#D97706" />
              </View>
              <Text style={styles.toolTitle}>Yorum Yönetimi</Text>
              <Text style={styles.toolDesc}>Müşteri puanları</Text>
            </TouchableOpacity>
          )}

          {onNavigateToProductCreate && (
            <TouchableOpacity onPress={onNavigateToProductCreate} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="plus-box-outline" size={20} color="#2563EB" />
              </View>
              <Text style={styles.toolTitle}>Ürün Ekleme</Text>
              <Text style={styles.toolDesc}>Trendyol Go push</Text>
            </TouchableOpacity>
          )}

          {onNavigateToBarcode && (
            <TouchableOpacity onPress={onNavigateToBarcode} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#FAF5FF' }]}>
                <MaterialCommunityIcons name="barcode-scan" size={20} color="#9333EA" />
              </View>
              <Text style={styles.toolTitle}>Barkod Sorgu</Text>
              <Text style={styles.toolDesc}>Katalog taraması</Text>
            </TouchableOpacity>
          )}

          {onNavigateToCancellations && (
            <TouchableOpacity onPress={onNavigateToCancellations} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#FEE2E2' }]}>
                <MaterialCommunityIcons name="close-circle-multiple-outline" size={20} color="#DC2626" />
              </View>
              <Text style={styles.toolTitle}>İptal Analizi</Text>
              <Text style={styles.toolDesc}>Kök neden & ciro kaybı</Text>
            </TouchableOpacity>
          )}

          {onNavigateToPriceRadar && (
            <TouchableOpacity onPress={onNavigateToPriceRadar} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#F3E8FF' }]}>
                <MaterialCommunityIcons name="radar" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.toolTitle}>Fiyat Radarı</Text>
              <Text style={styles.toolDesc}>12 şube uçurum tespiti</Text>
            </TouchableOpacity>
          )}

          {onNavigateToBulkPrice && (
            <TouchableOpacity onPress={onNavigateToBulkPrice} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="layers-triple-outline" size={20} color="#059669" />
              </View>
              <Text style={styles.toolTitle}>Toplu Fiyat</Text>
              <Text style={styles.toolDesc}>12 şube toplu güncelle</Text>
            </TouchableOpacity>
          )}

          {onNavigateToRawOrders && (
            <TouchableOpacity onPress={onNavigateToRawOrders} style={styles.toolItem}>
              <View style={[styles.toolIconBox, { backgroundColor: '#F3F4F6' }]}>
                <MaterialCommunityIcons name="code-json" size={20} color="#374151" />
              </View>
              <Text style={styles.toolTitle}>Ham API Verisi</Text>
              <Text style={styles.toolDesc}>Canlı JSON testi</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>

      {/* 3. VPS ve Sunucu Durumu Kartı */}
      <Card style={styles.systemCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <MaterialCommunityIcons name="server" size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>LİMON CENTRAL API (VPS)</Text>
          </View>
          <Badge
            label={isConnected ? 'AKTİF' : 'ERİŞİLEMEZ'}
            variant={isConnected ? 'success' : 'danger'}
          />
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sunucu URL:</Text>
          <Text style={styles.detailVal} numberOfLines={1}>
            {serverUrl}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Gecikme (Ping):</Text>
          <Text style={styles.detailVal}>{latencyMs !== null ? `${latencyMs} ms` : '-'}</Text>
        </View>

        {health && (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Çalışma Süresi (Uptime):</Text>
              <Text style={styles.detailVal}>{formatUptime(health.uptime)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sürüm:</Text>
              <Text style={styles.detailVal}>v{health.version}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Redis Önbellek:</Text>
              <Text style={[styles.detailVal, { color: colors.success }]}>
                {health.integrations?.redis || 'Bağlı'}
              </Text>
            </View>
          </>
        )}

        <View style={styles.systemBtnRow}>
          <Button
            title="VPS Ayarlarını Değiştir"
            variant="outline"
            size="sm"
            onPress={onOpenServerSettings}
            icon={<MaterialCommunityIcons name="cog-outline" size={14} color={colors.textPrimary} />}
          />
          <Button
            title="Bağlantıyı Sına"
            variant="secondary"
            size="sm"
            onPress={() => testConnection()}
            icon={<MaterialCommunityIcons name="wifi-sync" size={14} color="#FFF" />}
          />
        </View>
      </Card>

      {/* 4. Çıkış Butonu */}
      <View style={styles.logoutWrapper}>
        <Button
          title="Oturumu Kapat"
          variant="outline"
          size="md"
          onPress={handleLogout}
          icon={<MaterialCommunityIcons name="logout" size={16} color={colors.danger} />}
          style={styles.logoutBtn}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 10,
    gap: 8,
  },
  profileCard: {
    padding: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  userRole: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  userUsername: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  toolsCard: {
    padding: 10,
  },
  toolsHeaderTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 4,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    borderRadius: 3,
    alignItems: 'flex-start',
  },
  toolIconBox: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  toolTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  toolDesc: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 1,
  },
  systemCard: {
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 6,
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  detailVal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
    maxWidth: '65%',
  },
  systemBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  logoutWrapper: {
    marginTop: 4,
  },
  logoutBtn: {
    borderColor: '#FCA5A5',
  },
});
