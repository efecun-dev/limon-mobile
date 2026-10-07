import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { claimsService } from '../api/services';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  Created: { label: 'Oluşturuldu', dot: '#EAB308', text: '#A16207', bg: '#FEFCE8', border: '#FEF08A' },
  WaitingInAction: { label: 'Bekliyor', dot: '#3B82F6', text: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  Accepted: { label: 'Kabul Edildi', dot: '#16A34A', text: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  Rejected: { label: 'Reddedildi', dot: '#EF4444', text: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  Unresolved: { label: 'İhtilaflı', dot: '#F97316', text: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  Cancelled: { label: 'İptal Edildi', dot: '#6B7280', text: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'TÜMÜ' },
  { key: 'Created', label: 'OLUŞTURULDU' },
  { key: 'WaitingInAction', label: 'BEKLİYOR' },
  { key: 'Accepted', label: 'KABUL EDİLDİ' },
  { key: 'Rejected', label: 'REDDEDİLDİ' },
  { key: 'Unresolved', label: 'İHTİLAFLI' },
  { key: 'Cancelled', label: 'İPTAL EDİLDİ' },
];

export const ClaimsScreen: React.FC<{
  onOpenServerSettings: () => void;
  onOpenBranchPicker: () => void;
}> = ({ onOpenServerSettings, onOpenBranchPicker }) => {
  const { activeBranchId, activeBranchName } = useAuth();
  const { serverUrl } = useServer();

  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchClaims = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await claimsService.getClaims();

      if (res && Array.isArray(res.content)) {
        setClaims(res.content);
      } else {
        setClaims([]);
      }
    } catch (err: any) {
      console.error('İade çekme hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'İade talepleri sunucudan alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Durum sayaçları
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: claims.length };
    claims.forEach((c) => {
      const status = c.claimItems?.[0]?.claimItemStatus?.name || 'Created';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [claims]);

  // Filtrelenmiş İadeler
  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      const itemStatus = c.claimItems?.[0]?.claimItemStatus?.name;
      if (statusFilter !== 'all' && itemStatus !== statusFilter) return false;
      if (activeBranchId && activeBranchId !== 'all' && c.storeId?.toString() !== activeBranchId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = c.orderNumber && c.orderNumber.toLowerCase().includes(q);
        const nameMatch =
          (c.customerFirstName && c.customerFirstName.toLowerCase().includes(q)) ||
          (c.customerLastName && c.customerLastName.toLowerCase().includes(q));
        if (!numMatch && !nameMatch) return false;
      }
      return true;
    });
  }, [claims, statusFilter, activeBranchId, searchQuery]);

  const renderClaimItem = ({ item }: { item: any }) => {
    const firstClaimItem = item.claimItems?.[0];
    const statusKey = firstClaimItem?.claimItemStatus?.name || 'Created';
    const cfg = STATUS_MAP[statusKey] || {
      label: statusKey,
      dot: '#6B7280',
      text: '#4B5563',
      bg: '#F3F4F6',
      border: '#E5E7EB',
    };

    const reason = firstClaimItem?.customerClaimItemReason?.name || 'Belirtilmedi';
    const customerNote = firstClaimItem?.customerNote;
    const hasImages = firstClaimItem?.imageUrls && firstClaimItem.imageUrls.length > 0;
    const branchName = item.storeId ? BRANCHES[item.storeId.toString()] || `Şube ${item.storeId}` : '';

    const formattedDate = item.claimDate
      ? new Date(item.claimDate).toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

    return (
      <Card style={styles.claimCard}>
        {/* Üst Kısım: Sipariş No & Durum */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.orderNumber}>Sipariş #{item.orderNumber}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.dateText}>{formattedDate}</Text>
              {branchName ? <Text style={styles.branchNameText}>• {branchName}</Text> : null}
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
            <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* İade Nedeni Kutusu */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonTitle}>İADE NEDENİ:</Text>
          <Text style={styles.reasonDesc}>{reason}</Text>
        </View>

        {/* Müşteri Notu */}
        {customerNote ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>MÜŞTERİ AÇIKLAMASI:</Text>
            <Text style={styles.noteText}>"{customerNote}"</Text>
          </View>
        ) : null}

        {/* İade Fotoğrafları */}
        {hasImages && (
          <View style={styles.imagesRow}>
            {firstClaimItem.imageUrls.map((url: string, idx: number) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedImage(url)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: url }} style={styles.claimThumb} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Alt Satır: Müşteri Bilgisi */}
        <View style={styles.footerRow}>
          <Text style={styles.customerName}>
            Müşteri: {item.customerFirstName} {item.customerLastName || ''}
          </Text>
          {item.orderDetails?.grossAmount ? (
            <Text style={styles.orderAmountText}>
              Sipariş Tutarı: {item.orderDetails.grossAmount.toFixed(2)} ₺
            </Text>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header & Arama */}
      <View style={styles.subHeader}>
        <View style={styles.searchInputBox}>
          <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sipariş no veya müşteri ara..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity onPress={onOpenBranchPicker} style={styles.branchSelectBtn}>
          <MaterialCommunityIcons name="store-outline" size={13} color="#FFFFFF" />
          <Text style={styles.branchSelectBtnText} numberOfLines={1}>
            {activeBranchId && activeBranchId !== 'all' ? activeBranchName : 'Tüm Şubeler'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Durum Filtre Tabları */}
      <View style={styles.filterScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isSelected = statusFilter === item.key;
            const count = statusCounts[item.key] || 0;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setStatusFilter(item.key)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                  {item.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, isSelected && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, isSelected && styles.filterBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 3. Liste / Yükleniyor / Hata */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>İade talepleri taranıyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchClaims(true)}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={filteredClaims}
          keyExtractor={(item, idx) => item.id?.toString() || item.orderNumber || idx.toString()}
          renderItem={renderClaimItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchClaims(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="İade Talebi Bulunmuyor"
              message="Seçilen filtre ve şube kriterlerine uyan iade talebi bulunmamaktadır."
            />
          }
        />
      )}

      {/* Görsel Büyütme Modalı */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <TouchableOpacity
          style={styles.imageModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalFull}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  subHeader: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 3,
    paddingHorizontal: 8,
    height: 32,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  branchSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 3,
    maxWidth: 100,
  },
  branchSelectBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  filterScrollWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 6,
  },
  filterList: {
    paddingHorizontal: 8,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
    letterSpacing: 0.5,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  filterBadgeActive: {
    backgroundColor: '#374151',
  },
  filterBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#111827',
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  listContent: {
    padding: 8,
    gap: 6,
  },
  claimCard: {
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 6,
    marginBottom: 6,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  branchNameText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reasonBox: {
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    padding: 6,
    borderRadius: 2,
    marginBottom: 6,
  },
  reasonTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  reasonDesc: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 1,
  },
  noteBox: {
    backgroundColor: '#FFFBEB',
    padding: 6,
    borderRadius: 2,
    marginBottom: 6,
  },
  noteLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#B45309',
  },
  noteText: {
    fontSize: 10,
    color: '#78350F',
    fontStyle: 'italic',
    marginTop: 1,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  claimThumb: {
    width: 48,
    height: 48,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  customerName: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  orderAmountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageModalFull: {
    width: '100%',
    height: '80%',
  },
});
