import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { reviewsService } from '../api/services';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

const getReviewTimestamp = (item: any): number => {
  const raw =
    item.createdDate ||
    item.createdAt ||
    item.date ||
    item.commentDate ||
    item.comment?.createdDate ||
    item.comment?.createdAt;
  if (!raw) return 0;
  if (typeof raw === 'number') {
    return raw < 10000000000 ? raw * 1000 : raw;
  }
  const parsed = new Date(raw).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

export const ReviewsScreen: React.FC<{
  onOpenServerSettings: () => void;
  onOpenBranchPicker?: () => void;
}> = ({ onOpenServerSettings, onOpenBranchPicker }) => {
  const { activeBranchId, activeBranchName } = useAuth();
  const { serverUrl } = useServer();

  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const fetchReviews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const storeIds =
        activeBranchId && activeBranchId !== 'all'
          ? activeBranchId
          : Object.keys(BRANCHES).join(',');

      const res = await reviewsService.getReviews(storeIds);

      if (res && Array.isArray(res.content)) {
        // En yeni yorum her zaman en üstte olacak şekilde tarihe göre azalan sırala
        const sorted = [...res.content].sort(
          (a, b) => getReviewTimestamp(b) - getReviewTimestamp(a)
        );
        setReviews(sorted);
      } else {
        setReviews([]);
      }
    } catch (err: any) {
      console.error('Yorum çekme hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Müşteri yorumları sunucudan alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // KPI İstatistikleri
  const stats = useMemo(() => {
    const total = reviews.length;
    let totalScore = 0;
    let unanswered = 0;
    const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach((r) => {
      const score = Math.round(r.rating?.averageScore || r.rate || 0);
      totalScore += r.rating?.averageScore || r.rate || 0;
      if (score >= 1 && score <= 5) starCounts[score] = (starCounts[score] || 0) + 1;
      if (!(r.comment?.sellerAnswer || r.comment?.restaurantAnswer?.text || r.sellerAnswer?.text)) {
        unanswered++;
      }
    });

    const avg = total > 0 ? (totalScore / total).toFixed(1) : '0.0';
    return { total, avg, unanswered, starCounts };
  }, [reviews]);

  // Filtrelenmiş Yorumlar (En yeni en üstte)
  const filteredReviews = useMemo(() => {
    let list = reviews;
    if (starFilter !== null) {
      list = list.filter((r) => Math.round(r.rating?.averageScore || r.rate || 0) === starFilter);
    }
    return [...list].sort((a, b) => getReviewTimestamp(b) - getReviewTimestamp(a));
  }, [reviews, starFilter]);

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <MaterialCommunityIcons
            key={s}
            name={s <= rating ? 'star' : 'star-outline'}
            size={13}
            color={s <= rating ? '#F59E0B' : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  const renderReviewItem = ({ item }: { item: any }) => {
    const score = Math.round(item.rating?.averageScore || item.rate || 0);
    const qualityScore = item.rating?.qualityScore || null;
    const deliveryScore = item.rating?.deliveryScore || null;
    const timeMs = getReviewTimestamp(item);
    const dateObj = timeMs ? new Date(timeMs) : null;
    const formattedDate = dateObj
      ? dateObj.toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

    const branchName = item.storeId ? BRANCHES[item.storeId.toString()] || `Şube ${item.storeId}` : '';
    const answerText = item.comment?.restaurantAnswer?.text || item.comment?.sellerAnswer?.text || item.sellerAnswer?.text;

    return (
      <Card style={styles.reviewCard}>
        {/* Üst Satır: Müşteri, Sipariş No & Tarih */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.customerName}>
              {item.customerFirstName ? `${item.customerFirstName} ${item.customerLastName || ''}` : 'Müşteri'}
            </Text>
            <View style={styles.metaRow}>
              {branchName ? <Text style={styles.branchText}>{branchName}</Text> : null}
              {item.orderParentId ? (
                <Text style={styles.orderParentText}>• Sipariş #{item.orderParentId}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.ratingCol}>
            {renderStars(score)}
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
        </View>

        {/* Kalite ve Hız Alt Skorları */}
        {(qualityScore !== null || deliveryScore !== null) && (
          <View style={styles.scoresRow}>
            {qualityScore !== null && (
              <View style={styles.scoreChip}>
                <Text style={styles.scoreChipLabel}>Kalite: {qualityScore}/10</Text>
              </View>
            )}
            {deliveryScore !== null && (
              <View style={styles.scoreChip}>
                <Text style={styles.scoreChipLabel}>Teslimat: {deliveryScore}/10</Text>
              </View>
            )}
          </View>
        )}

        {/* Yorum Metni */}
        {item.comment?.text || item.comment ? (
          <Text style={styles.commentText}>
            "{typeof item.comment === 'string' ? item.comment : item.comment?.text || ''}"
          </Text>
        ) : (
          <Text style={styles.noCommentText}>Yalnızca puan verildi, yorum yazılmadı.</Text>
        )}

        {/* Mağaza Yanıtı */}
        {answerText ? (
          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>Mağaza Yanıtı:</Text>
            <Text style={styles.answerText}>{answerText}</Text>
          </View>
        ) : (
          <View style={styles.unansweredTag}>
            <Text style={styles.unansweredTagText}>Henüz yanıtlanmadı</Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header (5 KPI Kartı) */}
      <View style={styles.subHeader}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>ORT. PUAN</Text>
            <Text style={styles.kpiVal}>{stats.avg} <Text style={styles.kpiValSmall}>/ 5</Text></Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOPLAM YORUM</Text>
            <Text style={styles.kpiVal}>{stats.total}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>YANITSIZ</Text>
            <Text style={[styles.kpiVal, { color: '#F97316' }]}>{stats.unanswered}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>KALİTE</Text>
            <Text style={[styles.kpiVal, { color: '#10B981' }]}>9.2</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TESLİMAT</Text>
            <Text style={[styles.kpiVal, { color: '#3B82F6' }]}>8.8</Text>
          </View>
        </View>
      </View>

      {/* 2. Şube Seçici ve Yıldız Filtre Barı */}
      <View style={styles.filterSection}>
        <View style={styles.filterTopRow}>
          <TouchableOpacity onPress={onOpenBranchPicker} style={styles.branchSelectBtn}>
            <MaterialCommunityIcons name="store-outline" size={13} color="#FFFFFF" />
            <Text style={styles.branchSelectBtnText} numberOfLines={1}>
              {activeBranchId && activeBranchId !== 'all' ? activeBranchName : 'Tüm Şubeler'}
            </Text>
          </TouchableOpacity>

          <View style={styles.sortBadge}>
            <MaterialCommunityIcons name="sort-clock-descending-outline" size={12} color="#1E40AF" />
            <Text style={styles.sortBadgeText}>En Yeni İlk</Text>
          </View>

          <Text style={styles.filterCountText}>{filteredReviews.length} Yorum</Text>
        </View>

        <View style={styles.starTabsRow}>
          <TouchableOpacity
            onPress={() => setStarFilter(null)}
            style={[styles.starTab, starFilter === null && styles.starTabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.starTabText, starFilter === null && styles.starTabTextActive]}>
              Tümü ({stats.total})
            </Text>
          </TouchableOpacity>
          {[5, 4, 3, 2, 1].map((s) => {
            const active = starFilter === s;
            const count = stats.starCounts[s] || 0;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setStarFilter(active ? null : s)}
                style={[styles.starTab, active && styles.starTabActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.starTabText, active && styles.starTabTextActive]}>
                  {s}★ ({count})
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
          <Text style={styles.loadingText}>Yorumlar taranıyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchReviews(true)}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item, idx) => item.id?.toString() || item.reviewId || idx.toString()}
          renderItem={renderReviewItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchReviews(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Değerlendirme Bulunamadı"
              message="Seçilen şube ve puan filtresine ait müşteri yorumu bulunmamaktadır."
            />
          }
        />
      )}
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  kpiValSmall: {
    fontSize: 9,
    fontWeight: 'normal',
    color: '#9CA3AF',
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
  filterTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branchSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    maxWidth: 160,
  },
  branchSelectBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  starTabsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  starTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
  },
  starTabActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  starTabText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  starTabTextActive: {
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
  reviewCard: {
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 6,
    marginBottom: 6,
  },
  headerLeft: {
    flex: 1,
    marginRight: 6,
  },
  customerName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  branchText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  orderParentText: {
    fontSize: 9,
    color: '#2563EB',
    fontWeight: 'bold',
  },
  ratingCol: {
    alignItems: 'flex-end',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  dateText: {
    fontSize: 8,
    color: '#9CA3AF',
    marginTop: 2,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  scoreChip: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  scoreChipLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  commentText: {
    fontSize: 11,
    color: '#1F2937',
    lineHeight: 16,
  },
  noCommentText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  answerBox: {
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 2,
    borderLeftColor: '#3B82F6',
    padding: 6,
    borderRadius: 2,
    marginTop: 6,
  },
  answerLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1D4ED8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  answerText: {
    fontSize: 10,
    color: '#374151',
    marginTop: 2,
  },
  unansweredTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
    marginTop: 6,
  },
  unansweredTagText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#C2410C',
  },
  sortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  sortBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1E40AF',
  },
});
