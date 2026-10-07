import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useServer } from '../context/ServerContext';
import { branchesService } from '../api/services';
import { BranchItem, BranchesApiResponse } from '../types/api';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Pazartesi',
  TUESDAY: 'Salı',
  WEDNESDAY: 'Çarşamba',
  THURSDAY: 'Perşembe',
  FRIDAY: 'Cuma',
  SATURDAY: 'Cumartesi',
  SUNDAY: 'Pazar',
};

export const BranchesScreen: React.FC<{ onOpenServerSettings: () => void }> = ({
  onOpenServerSettings,
}) => {
  const { serverUrl } = useServer();

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [selectedHoursBranch, setSelectedHoursBranch] = useState<BranchItem | null>(null);

  const fetchBranches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response: BranchesApiResponse = await branchesService.getBranches(isRefresh);
      if (response && Array.isArray(response.stores)) {
        setBranches(response.stores);
        setOpenCount(response.openCount || response.stores.filter((s) => s.workingStatus === 'OPEN').length);
        setClosedCount(response.closedCount || response.stores.filter((s) => s.workingStatus !== 'OPEN').length);
      } else {
        setBranches([]);
      }
    } catch (err: any) {
      console.error('Şube verisi hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Şube bilgileri sunucudan çekilemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const filteredBranches = useMemo(() => {
    let list = branches;
    if (statusFilter !== 'ALL') {
      list = list.filter((b) => b.workingStatus === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          (b.name && b.name.toLowerCase().includes(q)) ||
          (b.shortName && b.shortName.toLowerCase().includes(q)) ||
          b.id.toString().includes(q)
      );
    }
    return list;
  }, [branches, statusFilter, searchQuery]);

  const handleToggleStatus = (branch: BranchItem) => {
    const isCurrentlyOpen = branch.workingStatus === 'OPEN';
    const targetStatus: 'OPEN' | 'CLOSED' = isCurrentlyOpen ? 'CLOSED' : 'OPEN';
    const actionText = isCurrentlyOpen ? 'KAPATMAK' : 'AÇMAK';

    Alert.alert(
      'Şube Durumu Güncelleme',
      `${branch.shortName || branch.name} şubesini ${actionText} istediğinize emin misiniz? Trendyol Go üzerinde anlık güncellenecektir.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Güncelle',
          style: isCurrentlyOpen ? 'destructive' : 'default',
          onPress: async () => {
            setUpdatingId(branch.id);
            try {
              const res = await branchesService.updateBranchStatus(branch.id, targetStatus);
              if (res.success) {
                setBranches((prev) =>
                  prev.map((b) => (b.id === branch.id ? { ...b, workingStatus: targetStatus } : b))
                );
                if (targetStatus === 'OPEN') {
                  setOpenCount((c) => c + 1);
                  setClosedCount((c) => Math.max(0, c - 1));
                } else {
                  setOpenCount((c) => Math.max(0, c - 1));
                  setClosedCount((c) => c + 1);
                }
              }
            } catch (err: any) {
              Alert.alert('Hata', err.response?.data?.error || 'Durum güncellenirken hata oluştu.');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const renderBranchItem = ({ item }: { item: BranchItem }) => {
    const isOpen = item.workingStatus === 'OPEN';
    const isUpdating = updatingId === item.id;

    return (
      <Card style={styles.branchCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.branchTitle}>{item.shortName || item.name}</Text>
            <Text style={styles.storeIdText}>Store ID: #{item.id}</Text>
          </View>
          <View style={[styles.statusBadge, isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? '#10B981' : '#EF4444' }]} />
            <Text style={[styles.statusBadgeText, { color: isOpen ? '#047857' : '#B91C1C' }]}>
              {isOpen ? 'AÇIK' : 'KAPALI'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetailsRow}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {item.averageDeliveryInterval || `${item.minDeliveryTimeInMin || 20}-${item.maxDeliveryTimeInMin || 40} dk`}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{item.deliveryType || 'Hızlı Market'}</Text>
          </View>
        </View>

        <View style={styles.cardActionRow}>
          <TouchableOpacity
            style={styles.hoursBtn}
            onPress={() => setSelectedHoursBranch(item)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="calendar-clock" size={14} color={colors.primary} />
            <Text style={styles.hoursBtnText}>Çalışma Saatleri</Text>
          </TouchableOpacity>

          <Button
            title={isOpen ? 'Şubeyi Kapat' : 'Şubeyi Aç'}
            variant={isOpen ? 'outline' : 'primary'}
            size="sm"
            loading={isUpdating}
            onPress={() => handleToggleStatus(item)}
            style={styles.toggleBtn}
            icon={
              <MaterialCommunityIcons
                name={isOpen ? 'power' : 'check'}
                size={14}
                color={isOpen ? colors.danger : '#FFF'}
              />
            }
          />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header (3 KPI Kutusu) */}
      <View style={styles.subHeader}>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>TOPLAM ŞUBE</Text>
          <Text style={styles.kpiVal}>{branches.length}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>AÇIK ŞUBELER</Text>
          <Text style={[styles.kpiVal, { color: '#34D399' }]}>{openCount}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>KAPALI ŞUBELER</Text>
          <Text style={[styles.kpiVal, { color: '#F87171' }]}>{closedCount}</Text>
        </View>
      </View>

      {/* 2. Arama & Durum Filtreleri */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Şube adı veya ID ile ara..."
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

        <View style={styles.statusTabsRow}>
          {(['ALL', 'OPEN', 'CLOSED'] as const).map((st) => {
            const isActive = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[styles.statusTabBtn, isActive && styles.statusTabBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.statusTabText, isActive && styles.statusTabTextActive]}>
                  {st === 'ALL' ? 'Tümü' : st === 'OPEN' ? 'Açık' : 'Kapalı'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Liste / Yükleniyor / Hata */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Şubeler yükleniyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchBranches(true)}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={filteredBranches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderBranchItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchBranches(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Şube Bulunamadı"
              message="Arama veya filtre kriterlerine uyan şube kaydı bulunamadı."
            />
          }
        />
      )}

      {/* 4. Çalışma Saatleri Modalı */}
      <Modal
        visible={!!selectedHoursBranch}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedHoursBranch(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>ÇALIŞMA SAATLERİ</Text>
                <Text style={styles.modalSub}>{selectedHoursBranch?.shortName || selectedHoursBranch?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedHoursBranch(null)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedHoursBranch?.deliveryHours && selectedHoursBranch.deliveryHours.length > 0 ? (
                <View style={styles.hoursTable}>
                  {selectedHoursBranch.deliveryHours.map((h: any, idx: number) => (
                    <View key={idx} style={styles.hoursRow}>
                      <Text style={styles.dayLabel}>
                        {DAY_LABELS[h.dayOfWeek as string] || h.dayOfWeek}
                      </Text>
                      <Text style={styles.hoursVal}>
                        {h.openingTime || h.startTime || '08:30'} - {h.closingTime || h.endTime || '23:30'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noHoursText}>
                  Bu şube için özel çalışma saati tanımı bulunamadı (Standart: 08:30 - 23:30).
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  kpiDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#374151',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 3,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  statusTabsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  statusTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
  },
  statusTabBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  statusTabText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  statusTabTextActive: {
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
  branchCard: {
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  branchTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
  },
  storeIdText: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  statusBadgeOpen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgeClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
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
  cardDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: '#6B7280',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  hoursBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    backgroundColor: '#F9FAFB',
  },
  hoursBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  toggleBtn: {
    minWidth: 110,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: '60%',
    padding: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
  },
  modalSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    marginTop: 8,
  },
  hoursTable: {
    gap: 4,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  hoursVal: {
    fontSize: 11,
    color: '#4B5563',
    fontVariant: ['tabular-nums'],
  },
  noHoursText: {
    fontSize: 11,
    color: '#6B7280',
    paddingVertical: 12,
    textAlign: 'center',
  },
});
