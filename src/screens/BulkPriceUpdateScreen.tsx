import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { stocksService } from '../api/services';
import { ProductStockItem } from '../types/api';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';

function extractProductItems(res: any): ProductStockItem[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.content)) return res.content;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.products)) return res.products;
  if (res.product && typeof res.product === 'object') return [res.product];
  return [];
}

export const BulkPriceUpdateScreen: React.FC<{
  onOpenServerSettings?: () => void;
  onNavigateToPriceRadar?: () => void;
  onBack?: () => void;
}> = ({ onOpenServerSettings, onNavigateToPriceRadar, onBack }) => {
  const [products, setProducts] = useState<ProductStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arama & Marka Filtresi
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);

  // Seçili Ürün Barkodları & Şubeler
  const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    new Set(Object.keys(BRANCHES))
  );

  // Fiyat Hesaplama / Hedef Fiyatlar
  const [targetPrices, setTargetPrices] = useState<Record<string, string>>({});
  const [bulkPriceInput, setBulkPriceInput] = useState('');
  const [bulkPercentInput, setBulkPercentInput] = useState('');

  // Güncelleme İlerlemesi
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ current: number; total: number } | null>(null);

  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await stocksService.getStocks({ all: true, size: 500, refresh: isRefresh });
      const items = extractProductItems(res);
      setProducts(items);
    } catch (err: any) {
      console.error('Ürünler çekilemedi:', err.message);
      setError(err.response?.data?.error || err.message || 'Ürün kataloğu sunucudan alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Mevcut Markaların Listesi
  const availableBrands = useMemo(() => {
    const bSet = new Set<string>();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) {
        bSet.add(p.brand.trim());
      }
    });
    return Array.from(bSet).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [products]);

  // Filtrelenmiş Ürün Listesi
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedBrand !== 'ALL' && p.brand !== selectedBrand) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchBarcode = (p.barcode || '').includes(q);
        const matchBrand = (p.brand || '').toLowerCase().includes(q);
        if (!matchTitle && !matchBarcode && !matchBrand) return false;
      }
      return true;
    });
  }, [products, selectedBrand, searchQuery]);

  // Seçim İşlemleri
  const toggleSelectBarcode = (barcode: string) => {
    setSelectedBarcodes((prev) => {
      const next = new Set(prev);
      if (next.has(barcode)) next.delete(barcode);
      else next.add(barcode);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedBarcodes.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedBarcodes(new Set());
    } else {
      setSelectedBarcodes(new Set(filteredProducts.map((p) => p.barcode)));
    }
  };

  const toggleBranch = (bId: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(bId)) {
        if (next.size > 1) next.delete(bId); // En az 1 şube seçili kalmalı
      } else {
        next.add(bId);
      }
      return next;
    });
  };

  const handleSelectAllBranches = () => {
    if (selectedBranches.size === Object.keys(BRANCHES).length) {
      // Sadece ilk şubeyi bırak
      setSelectedBranches(new Set([Object.keys(BRANCHES)[0]]));
    } else {
      setSelectedBranches(new Set(Object.keys(BRANCHES)));
    }
  };

  // Toplu Sabit Fiyat Uygula
  const applyBulkFixedPrice = () => {
    const val = parseFloat(bulkPriceInput.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert('Geçersiz Fiyat', 'Lütfen geçerli bir fiyat girin.');
      return;
    }
    const newTargets = { ...targetPrices };
    selectedBarcodes.forEach((barcode) => {
      newTargets[barcode] = val.toFixed(2);
    });
    setTargetPrices(newTargets);
    Alert.alert('Uygulandı', `Seçili ${selectedBarcodes.size} ürüne ₺${val.toFixed(2)} hedef fiyat atandı.`);
  };

  // Toplu Yüzdesel Fiyat Değişimi (+10%, -5% vb.)
  const applyBulkPercentChange = (pctValue?: number) => {
    const pct = pctValue !== undefined ? pctValue : parseFloat(bulkPercentInput.replace(',', '.'));
    if (isNaN(pct) || pct === 0) {
      Alert.alert('Geçersiz Yüzde', 'Lütfen geçerli bir yüzde girin (örn: 10 veya -5).');
      return;
    }

    const newTargets = { ...targetPrices };
    selectedBarcodes.forEach((barcode) => {
      const prod = products.find((p) => p.barcode === barcode);
      if (prod && prod.stocks) {
        // Ürünün ortalama veya ilk geçerli satış fiyatını referans al
        const currentPrices = Object.values(prod.stocks)
          .map((s) => s.sellingPrice)
          .filter((p): p is number => typeof p === 'number' && p > 0);

        const basePrice = currentPrices.length > 0 ? currentPrices[0] : 0;
        if (basePrice > 0) {
          const newPrice = Math.max(0.1, basePrice * (1 + pct / 100));
          newTargets[barcode] = newPrice.toFixed(2);
        }
      }
    });

    setTargetPrices(newTargets);
    Alert.alert('Uygulandı', `Seçili ${selectedBarcodes.size} ürüne %${pct > 0 ? '+' : ''}${pct} fiyat değişimi uygulandı.`);
  };

  // Fiyatları Trendyol'a Aktar
  const handlePushPrices = async () => {
    if (selectedBarcodes.size === 0) {
      Alert.alert('Ürün Seçilmedi', 'Lütfen en az bir ürün seçin.');
      return;
    }
    if (selectedBranches.size === 0) {
      Alert.alert('Şube Seçilmedi', 'Lütfen en az bir şube seçin.');
      return;
    }

    // Hedef fiyatı olan ürünleri hazırla
    const payloadItems: Array<{
      barcode: string;
      storeId: string;
      sellingPrice: number;
    }> = [];

    selectedBarcodes.forEach((barcode) => {
      const priceStr = targetPrices[barcode];
      const parsedPrice = priceStr ? parseFloat(priceStr.replace(',', '.')) : NaN;
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        selectedBranches.forEach((branchId) => {
          payloadItems.push({
            barcode,
            storeId: branchId,
            sellingPrice: parsedPrice,
          });
        });
      }
    });

    if (payloadItems.length === 0) {
      Alert.alert(
        'Hedef Fiyat Bulunamadı',
        'Seçili ürünlerin hiçbirine hedef fiyat atanmamış. Lütfen toplu veya tekil hedef fiyat belirleyin.'
      );
      return;
    }

    Alert.alert(
      'Fiyat Güncelleme Onayı',
      `${selectedBarcodes.size} ürün için ${selectedBranches.size} şubeye toplam ${payloadItems.length} fiyat güncelleme isteği Trendyol Go'ya gönderilecek. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Güncelle',
          onPress: async () => {
            setIsUpdating(true);
            setUpdateProgress({ current: 0, total: payloadItems.length });

            try {
              // 100'erlik parçalar halinde gönder
              const chunkSize = 100;
              let sentCount = 0;

              for (let i = 0; i < payloadItems.length; i += chunkSize) {
                const chunk = payloadItems.slice(i, i + chunkSize);
                await stocksService.updatePrice(chunk);
                sentCount += chunk.length;
                setUpdateProgress({ current: sentCount, total: payloadItems.length });
              }

              Alert.alert(
                'Başarılı',
                `Toplam ${payloadItems.length} fiyat güncellemesi Trendyol kuyruğuna başarıyla iletildi.`
              );
              fetchProducts(true);
            } catch (err: any) {
              console.error('Toplu fiyat güncelleme hatası:', err.message);
              Alert.alert('Hata', err.response?.data?.error || err.message || 'Güncelleme yapılamadı.');
            } finally {
              setIsUpdating(false);
              setUpdateProgress(null);
            }
          },
        },
      ]
    );
  };

  const renderProductRow = ({ item }: { item: ProductStockItem }) => {
    const isSelected = selectedBarcodes.has(item.barcode);
    const target = targetPrices[item.barcode] || '';

    // İlk mevcut fiyat
    const currentPrice = Object.values(item.stocks || {}).find(
      (s) => typeof s.sellingPrice === 'number' && s.sellingPrice > 0
    )?.sellingPrice;

    return (
      <View style={[styles.itemCard, isSelected && styles.itemCardSelected]}>
        <TouchableOpacity
          onPress={() => toggleSelectBarcode(item.barcode)}
          style={styles.checkboxTouch}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={22}
            color={isSelected ? colors.primary : '#9CA3AF'}
          />
        </TouchableOpacity>

        <View style={styles.itemThumbWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} resizeMode="contain" />
          ) : (
            <MaterialCommunityIcons name="cube-outline" size={20} color="#9CA3AF" />
          )}
        </View>

        <View style={styles.itemInfoCol}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.itemMetaRow}>
            <Text style={styles.itemBarcode}>{item.barcode}</Text>
            {item.brand && <Text style={styles.itemBrand}>• {item.brand}</Text>}
          </View>
          <Text style={styles.currentPriceText}>
            Mevcut: {currentPrice != null ? `₺${currentPrice.toFixed(2)}` : 'Tanımsız'}
          </Text>
        </View>

        <View style={styles.targetInputCol}>
          <Text style={styles.targetInputLabel}>Hedef Fiyat:</Text>
          <View style={styles.targetInputBox}>
            <Text style={styles.currencyPrefix}>₺</Text>
            <TextInput
              style={styles.targetTextInput}
              placeholder={currentPrice != null ? currentPrice.toFixed(2) : '0.00'}
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={target}
              onChangeText={(val) => {
                setTargetPrices((prev) => ({ ...prev, [item.barcode]: val }));
                if (!isSelected) {
                  // Fiyat yazıldığında otomatik seç
                  toggleSelectBarcode(item.barcode);
                }
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Sekme / Kontrol Barı */}
      <View style={styles.topControlBar}>
        <View style={styles.titleRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.screenTitle}>TOPLU FİYAT GÜNCELLEME</Text>
          {onNavigateToPriceRadar && (
            <TouchableOpacity onPress={onNavigateToPriceRadar} style={styles.radarNavBtn}>
              <MaterialCommunityIcons name="radar" size={14} color="#7C3AED" />
              <Text style={styles.radarNavBtnText}>Fiyat Radarı</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Arama Inputu */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ürün adı, barkod veya marka ara..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Marka Seçici */}
          <TouchableOpacity
            onPress={() => setShowBrandModal(true)}
            style={[styles.brandSelectorBtn, selectedBrand !== 'ALL' && styles.brandSelectorBtnActive]}
          >
            <MaterialCommunityIcons name="tag-outline" size={14} color={selectedBrand !== 'ALL' ? '#FFFFFF' : '#4B5563'} />
            <Text
              style={[styles.brandSelectorBtnText, selectedBrand !== 'ALL' && styles.brandSelectorBtnTextActive]}
              numberOfLines={1}
            >
              {selectedBrand === 'ALL' ? 'Marka' : selectedBrand}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 12 Şube Seçimi */}
        <View style={styles.branchesSection}>
          <View style={styles.branchesHeaderRow}>
            <Text style={styles.branchesSectionTitle}>
              HEDEF ŞUBELER ({selectedBranches.size}/12)
            </Text>
            <TouchableOpacity onPress={handleSelectAllBranches}>
              <Text style={styles.selectAllBranchesText}>
                {selectedBranches.size === 12 ? 'Temizle' : 'Tümünü Seç'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchChipsScroll}>
            {Object.entries(BRANCHES).map(([id, name]) => {
              const isChecked = selectedBranches.has(id);
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => toggleBranch(id)}
                  style={[styles.branchChip, isChecked && styles.branchChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.branchChipText, isChecked && styles.branchChipTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Toplu Aksiyon Paneli */}
        <View style={styles.bulkActionPanel}>
          <View style={styles.selectionCountRow}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllBtn}>
              <MaterialCommunityIcons
                name={
                  selectedBarcodes.size === filteredProducts.length && filteredProducts.length > 0
                    ? 'checkbox-marked'
                    : 'checkbox-blank-outline'
                }
                size={18}
                color={colors.primary}
              />
              <Text style={styles.selectAllBtnText}>
                Tümünü Seç ({selectedBarcodes.size}/{filteredProducts.length})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bulkInputsRow}>
            {/* Sabit Fiyat Input */}
            <View style={styles.bulkInputItem}>
              <TextInput
                style={styles.bulkTextInput}
                placeholder="Sabit ₺"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={bulkPriceInput}
                onChangeText={setBulkPriceInput}
              />
              <TouchableOpacity onPress={applyBulkFixedPrice} style={styles.applyBtn}>
                <Text style={styles.applyBtnText}>Uygula</Text>
              </TouchableOpacity>
            </View>

            {/* Hızlı Yüzde Butonları */}
            <View style={styles.percentBtnGroup}>
              <TouchableOpacity onPress={() => applyBulkPercentChange(5)} style={styles.quickPercentBtn}>
                <Text style={styles.quickPercentBtnText}>+5%</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => applyBulkPercentChange(10)} style={styles.quickPercentBtn}>
                <Text style={styles.quickPercentBtnText}>+10%</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => applyBulkPercentChange(-5)} style={styles.quickPercentBtn}>
                <Text style={styles.quickPercentBtnText}>-5%</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Ürün Listesi */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Ürün katalog verileri yükleniyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchProducts(true)}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.barcode}
          renderItem={renderProductRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchProducts(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Ürün Bulunamadı"
              message="Arama ve marka kriterlerine uygun ürün kaydı bulunmamaktadır."
            />
          }
        />
      )}

      {/* 3. Sabit Alt Bar: Trendyol'a Aktar Butonu */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInfo}>
          <Text style={styles.bottomBarCount}>
            {selectedBarcodes.size} ürün • {selectedBranches.size} şube
          </Text>
          <Text style={styles.bottomBarSub}>
            {isUpdating ? `Aktarılıyor: ${updateProgress?.current}/${updateProgress?.total}` : 'Trendyol Go Hazır'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handlePushPrices}
          disabled={isUpdating || selectedBarcodes.size === 0}
          style={[
            styles.pushBtn,
            (isUpdating || selectedBarcodes.size === 0) && styles.pushBtnDisabled,
          ]}
          activeOpacity={0.8}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="cloud-upload" size={18} color="#FFFFFF" />
              <Text style={styles.pushBtnText}>Trendyol'a Aktar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Marka Seçim Modalı */}
      {showBrandModal && (
        <View style={styles.brandModalOverlay}>
          <View style={styles.brandModalBox}>
            <View style={styles.brandModalHeader}>
              <Text style={styles.brandModalTitle}>Marka Seçimi</Text>
              <TouchableOpacity onPress={() => setShowBrandModal(false)}>
                <MaterialCommunityIcons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.brandSearchInput}
              placeholder="Marka filtrele..."
              placeholderTextColor="#9CA3AF"
              value={brandSearchQuery}
              onChangeText={setBrandSearchQuery}
            />

            <ScrollView style={styles.brandListScroll}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedBrand('ALL');
                  setShowBrandModal(false);
                }}
                style={[styles.brandItem, selectedBrand === 'ALL' && styles.brandItemActive]}
              >
                <Text style={[styles.brandItemText, selectedBrand === 'ALL' && styles.brandItemTextActive]}>
                  TÜM MARKALAR
                </Text>
              </TouchableOpacity>

              {availableBrands
                .filter((b) => b.toLowerCase().includes(brandSearchQuery.toLowerCase()))
                .map((b) => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => {
                      setSelectedBrand(b);
                      setShowBrandModal(false);
                    }}
                    style={[styles.brandItem, selectedBrand === b && styles.brandItemActive]}
                  >
                    <Text style={[styles.brandItemText, selectedBrand === b && styles.brandItemTextActive]}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topControlBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 4,
    marginRight: 6,
  },
  screenTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    flex: 1,
  },
  radarNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 4,
  },
  radarNavBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 4,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  brandSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 4,
    maxWidth: 120,
  },
  brandSelectorBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  brandSelectorBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  brandSelectorBtnTextActive: {
    color: '#FFFFFF',
  },
  branchesSection: {
    gap: 4,
  },
  branchesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchesSectionTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  selectAllBranchesText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.primary,
  },
  branchChipsScroll: {
    flexDirection: 'row',
  },
  branchChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 4,
  },
  branchChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  branchChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
  },
  branchChipTextActive: {
    color: '#FFFFFF',
  },
  bulkActionPanel: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 6,
    gap: 6,
  },
  selectionCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectAllBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bulkInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkInputItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 3,
    height: 30,
    overflow: 'hidden',
  },
  bulkTextInput: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 0,
    color: colors.textPrimary,
  },
  applyBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  percentBtnGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  quickPercentBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    height: 30,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPercentBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
  },
  listContent: {
    padding: 8,
    gap: 6,
    paddingBottom: 70,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    gap: 8,
  },
  itemCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FEFCE8',
  },
  checkboxTouch: {
    padding: 2,
  },
  itemThumbWrap: {
    width: 38,
    height: 38,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemInfoCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  itemBarcode: {
    fontSize: 9,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  itemBrand: {
    fontSize: 9,
    color: '#4F46E5',
    fontWeight: '600',
  },
  currentPriceText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  targetInputCol: {
    alignItems: 'flex-end',
    width: 85,
  },
  targetInputLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 2,
  },
  targetInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 3,
    height: 28,
    paddingHorizontal: 4,
  },
  currencyPrefix: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginRight: 2,
  },
  targetTextInput: {
    width: 55,
    fontSize: 11,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'right',
    paddingVertical: 0,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomBarInfo: {
    flex: 1,
  },
  bottomBarCount: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  bottomBarSub: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 1,
  },
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  pushBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#9CA3AF',
  },
  pushBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  brandModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 100,
  },
  brandModalBox: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  brandModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandModalTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  brandSearchInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 8,
    height: 32,
    fontSize: 11,
  },
  brandListScroll: {
    maxHeight: 250,
  },
  brandItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  brandItemActive: {
    backgroundColor: '#EFF6FF',
  },
  brandItemText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  brandItemTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
});
