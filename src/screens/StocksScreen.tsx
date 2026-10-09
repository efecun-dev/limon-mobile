import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Image,
  Clipboard,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { stocksService, barcodeService } from '../api/services';
import { ProductStockItem, StocksApiResponse, BarcodeSearchResult } from '../types/api';
import { BRANCHES } from '../context/BranchConstants';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorView } from '../components/common/ErrorView';
import { PriceUpdateModal } from './PriceUpdateModal';
import { BarcodeScannerModal } from '../components/common/BarcodeScannerModal';
import { ScannedProductDetailModal } from '../components/common/ScannedProductDetailModal';
import { Button } from '../components/common/Button';

const STOCK_FILTERS = [
  { key: 'all', label: 'TÜMÜ' },
  { key: 'in_stock', label: 'STOKTA' },
  { key: 'critical', label: 'KRİTİK' },
  { key: 'out_of_stock', label: 'TÜKENDİ' },
  { key: 'perishable', label: 'BOZULABİLİR' },
];

export function isPerishableProduct(p: ProductStockItem): boolean {
  const text = `${p.category || ''} ${p.title || ''} ${p.brand || ''}`.toLowerCase();
  const perishableKeywords = [
    'meyve',
    'sebze',
    'ekmek',
    'fırın',
    'süt',
    'yoğurt',
    'peynir',
    'kaşar',
    'tereyağ',
    'kaymak',
    'lor',
    'çökelek',
    'kahvaltılık',
    'şarküteri',
    'et',
    'kıyma',
    'tavuk',
    'köfte',
    'sucuk',
    'salam',
    'sosis',
    'pastırma',
    'dondurulmuş',
    'yumurta',
    'manav',
    'kasap',
    'unlu mamul',
    'balık',
    'meze',
    'tatlı',
    'pasta',
  ];
  return perishableKeywords.some((kw) => text.includes(kw));
}

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

export const StocksScreen: React.FC<{
  initialBarcode?: string | null;
  onClearInitialBarcode?: () => void;
  onOpenServerSettings: () => void;
  onOpenBranchPicker: () => void;
  onNavigateToProductCreate?: (prefill?: { barcode: string; title?: string; brand?: string; category?: string }) => void;
}> = ({
  initialBarcode,
  onClearInitialBarcode,
  onOpenServerSettings,
  onOpenBranchPicker,
  onNavigateToProductCreate,
}) => {
  const { activeBranchId, activeBranchName } = useAuth();
  const { serverUrl } = useServer();

  const [products, setProducts] = useState<ProductStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(2171);
  const [globalStats, setGlobalStats] = useState({
    totalProducts: 2171,
    sumTotalStock: 340321,
    critical: 76,
    outOfStock: 579,
  });

  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductStockItem | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [scannerVisible, setScannerVisible] = useState(false);

  // Taranan Ürünün Tam Detaylarını Gösteren Modal Durumu
  const [scannedProductDetail, setScannedProductDetail] = useState<{
    product: ProductStockItem;
    catalogData?: BarcodeSearchResult | null;
  } | null>(null);

  // Sadece açık katalogda bulunan (stokta henüz olmayan) ürün bilgisi
  const [scannedCatalogOnly, setScannedCatalogOnly] = useState<BarcodeSearchResult | null>(null);
  const [barcodeSearchNotice, setBarcodeSearchNotice] = useState<string | null>(null);

  const handleCopyBarcode = (barcode: string) => {
    if (!barcode) return;
    Clipboard.setString(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => {
      setCopiedBarcode(null);
    }, 1500);
  };

  const toggleExpand = (id: string) => {
    setExpandedProducts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Kapsamlı Barkod Arama Motoru
  const performBarcodeSearch = async (rawBarcode: string) => {
    const clean = rawBarcode.trim();
    if (!clean) return;

    setSearchQuery(clean);
    setStockStatusFilter('all'); // Filtrelerin taranan ürünü gizlemesini engelle
    setPage(0);
    setLoading(true);
    setError(null);
    setScannedCatalogOnly(null);
    setBarcodeSearchNotice(`"${clean}" barkodu aranıyor...`);

    try {
      let stockItems: ProductStockItem[] = [];

      // 1. Limon Stoklarında Ara
      // A) Aktif şube parametresiyle ara (eğer seçilmişse)
      const primaryParams: any = {
        barcode: clean,
        search: clean,
        size: 50,
        page: 0,
      };
      if (activeBranchId && activeBranchId !== 'all') {
        primaryParams.storeId = activeBranchId;
      }

      const res = await stocksService.getStocks(primaryParams).catch(() => null);
      stockItems = extractProductItems(res);

      // B) Eğer aktif şubede bulunamadıysa, TÜM şubelerde ara
      if (stockItems.length === 0 && activeBranchId && activeBranchId !== 'all') {
        const allBranchParams: any = {
          barcode: clean,
          search: clean,
          size: 50,
          page: 0,
        };
        const allRes = await stocksService.getStocks(allBranchParams).catch(() => null);
        stockItems = extractProductItems(allRes);
      }

      // C) Eğer hala sonuç yoksa all: true ile genişletilmiş katalog sorgusu yap
      if (stockItems.length === 0) {
        const wideRes = await stocksService.getStocks({ barcode: clean, all: true, size: 50, page: 0 }).catch(() => null);
        stockItems = extractProductItems(wideRes);
      }

      // 2. Açık Katalogda Eşzamanlı Doğrulama & Görsel Zenginleştirme
      let catalogRes: BarcodeSearchResult | null = null;
      try {
        catalogRes = await barcodeService.searchBarcode(clean);
      } catch {
        // Sessiz devam
      }

      // 3. Sonuçları Eşleştir
      let matchedProduct = stockItems.find(
        (p) =>
          p.barcode?.trim() === clean ||
          p.barcode?.trim()?.replace(/^0+/, '') === clean.replace(/^0+/, '')
      ) || (stockItems.length > 0 ? stockItems[0] : null);

      if (matchedProduct) {
        // Eksik alanları açık katalogdan tamamla (görsel, marka, kategori)
        if (catalogRes && catalogRes.found) {
          matchedProduct = {
            ...matchedProduct,
            imageUrl: matchedProduct.imageUrl || catalogRes.imageUrl || null,
            brand: matchedProduct.brand || catalogRes.brand || null,
            category: matchedProduct.category || catalogRes.category || null,
          };
        }

        const otherItems = stockItems.filter((p) => p.id !== matchedProduct!.id);
        const finalList = [matchedProduct, ...otherItems];
        setProducts(finalList);
        setTotalElements(finalList.length);
        setTotalPages(1);

        // Şube dağılımını otomatik aç
        setExpandedProducts((prev) => ({ ...prev, [matchedProduct!.id]: true }));

        // Taranan ürünün tüm bilgilerini içeren detay modalını aç!
        setScannedProductDetail({
          product: matchedProduct,
          catalogData: catalogRes,
        });
        setBarcodeSearchNotice(null);
      } else if (catalogRes && catalogRes.found) {
        // Limon stoklarında yok ama açık katalogda bulundu!
        setProducts([]);
        setTotalElements(0);
        setTotalPages(1);
        setScannedCatalogOnly(catalogRes);
        setBarcodeSearchNotice(null);
      } else {
        // Hiçbir yerde bulunamadı
        setProducts([]);
        setTotalElements(0);
        setTotalPages(1);
        setScannedCatalogOnly({
          found: false,
          barcode: clean,
          message: `Barkod (${clean}) Limon stoklarında ve açık katalogda eşleşmedi.`,
        });
        setBarcodeSearchNotice(null);
      }
    } catch (err: any) {
      console.error('Barkod tarama hatası:', err.message);
      setError('Barkod sorgulanırken sunucu hatası oluştu.');
      setBarcodeSearchNotice(null);
    } finally {
      setLoading(false);
    }
  };

  const handleScannedBarcode = (barcode: string) => {
    performBarcodeSearch(barcode);
  };

  // Dışarıdan gelen initialBarcode varsa hemen ara
  useEffect(() => {
    if (initialBarcode && initialBarcode.trim()) {
      performBarcodeSearch(initialBarcode.trim());
      if (onClearInitialBarcode) {
        onClearInitialBarcode();
      }
    }
  }, [initialBarcode]);

  // Genel Liste Getirme
  const fetchStocks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setScannedCatalogOnly(null);

    try {
      const cleanSearch = searchQuery.trim();
      const isBarcodeLike = cleanSearch.length >= 3 && /^[0-9A-Za-z_-]+$/.test(cleanSearch) && /\d/.test(cleanSearch);

      const params: any = {
        size: pageSize,
        page,
      };

      if (activeBranchId && activeBranchId !== 'all') {
        params.storeId = activeBranchId;
      }
      if (cleanSearch) {
        params.search = cleanSearch;
        if (isBarcodeLike) {
          params.barcode = cleanSearch;
        }
      }

      const res: StocksApiResponse = await stocksService.getStocks(params);
      const items = extractProductItems(res);

      if (items.length > 0) {
        let filtered = items;
        // Eğer arama yapılmışsa filtreleri zorunlu tutma, aksi halde uygula
        if (!cleanSearch) {
          if (stockStatusFilter === 'critical') {
            filtered = items.filter((p) => p.totalStock > 0 && p.totalStock <= 5);
          } else if (stockStatusFilter === 'out_of_stock') {
            filtered = items.filter((p) => p.totalStock === 0);
          } else if (stockStatusFilter === 'in_stock') {
            filtered = items.filter((p) => p.totalStock > 5);
          } else if (stockStatusFilter === 'perishable') {
            filtered = items.filter(isPerishableProduct);
          }
        }

        setProducts(filtered);
        setTotalElements(res.totalElements || filtered.length);
        setTotalPages(res.totalPages || 1);

        if (res.globalStats) {
          setGlobalStats(res.globalStats);
        }
        if (res.catalogTotal) {
          setCatalogTotal(res.catalogTotal);
        }
      } else {
        // Eğer arama yapıldı ve sonuç boş geldiyse ve şube seçiliyse şubesiz tekrar dene
        if (cleanSearch && activeBranchId && activeBranchId !== 'all') {
          const fallbackParams: any = {
            size: pageSize,
            page: 0,
            search: cleanSearch,
          };
          if (isBarcodeLike) fallbackParams.barcode = cleanSearch;
          const fallbackRes = await stocksService.getStocks(fallbackParams).catch(() => null);
          const fallbackItems = extractProductItems(fallbackRes);
          if (fallbackItems.length > 0) {
            setProducts(fallbackItems);
            setTotalElements(fallbackItems.length);
            setTotalPages(1);
            return;
          }
        }

        setProducts([]);
        setTotalElements(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      console.error('Stok listesi hatası:', err.message);
      setError(err.response?.data?.error || err.message || 'Stok verileri sunucudan alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranchId, searchQuery, stockStatusFilter, page, pageSize]);

  useEffect(() => {
    // initialBarcode varken varsayılan fetchStocks'un ezmesini önle
    if (!initialBarcode) {
      fetchStocks();
    }
  }, [fetchStocks]);

  const renderProductItem = ({ item }: { item: ProductStockItem }) => {
    const isOutOfStock = item.totalStock === 0;
    const isCritical = item.totalStock > 0 && item.totalStock <= 5;
    const isCopied = copiedBarcode === item.barcode;
    const isExpanded = !!expandedProducts[item.id];

    return (
      <Card style={styles.productCard}>
        <View style={styles.cardMainRow}>
          {/* Ürün Görseli - Tıklandığında Tüm Bilgileri Göster */}
          <TouchableOpacity
            style={styles.imageBox}
            activeOpacity={0.8}
            onPress={() => setScannedProductDetail({ product: item, catalogData: null })}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.productImg} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {/* Ürün Bilgileri */}
          <View style={styles.infoCol}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setScannedProductDetail({ product: item, catalogData: null })}
            >
              <Text style={styles.productTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </TouchableOpacity>

            {/* Barkod ve Kopyalama */}
            <View style={styles.barcodeRow}>
              <Text style={styles.barcodeText}>{item.barcode}</Text>
              <TouchableOpacity
                onPress={() => handleCopyBarcode(item.barcode)}
                style={styles.copyBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={isCopied ? 'check' : 'content-copy'}
                  size={12}
                  color={isCopied ? '#059669' : '#6B7280'}
                />
                <Text style={[styles.copyBtnText, isCopied && styles.copyBtnTextDone]}>
                  {isCopied ? 'Kopyalandı' : 'Kopyala'}
                </Text>
              </TouchableOpacity>
              {item.brand && <Text style={styles.brandText}>• {item.brand}</Text>}
              {isPerishableProduct(item) && (
                <View style={styles.perishableBadge}>
                  <Text style={styles.perishableBadgeText}>SKT</Text>
                </View>
              )}
            </View>

            {/* Stok ve Fiyat Rozetleri */}
            <View style={styles.stockStatusRow}>
              <View
                style={[
                  styles.stockBadge,
                  isOutOfStock
                    ? styles.badgeRed
                    : isCritical
                    ? styles.badgeAmber
                    : styles.badgeGreen,
                ]}
              >
                <Text
                  style={[
                    styles.stockBadgeText,
                    isOutOfStock
                      ? styles.textRed
                      : isCritical
                      ? styles.textAmber
                      : styles.textGreen,
                  ]}
                >
                  {isOutOfStock
                    ? 'TÜKENDİ'
                    : isCritical
                    ? `KRİTİK (${item.totalStock})`
                    : `STOK: ${item.totalStock}`}
                </Text>
              </View>

              <View style={styles.cardActionsGroup}>
                <TouchableOpacity
                  onPress={() => setScannedProductDetail({ product: item, catalogData: null })}
                  style={styles.detailActionBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="eye-outline" size={12} color="#111827" />
                  <Text style={styles.detailActionText}>Tüm Bilgiler</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setEditingProduct(item)}
                  style={styles.priceActionBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="currency-try" size={12} color="#FFFFFF" />
                  <Text style={styles.priceActionText}>Fiyat Güncelle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Şube Bazlı Stok ve Fiyat Dökümü Toggle */}
        <TouchableOpacity
          onPress={() => toggleExpand(item.id)}
          style={styles.branchExpandHeader}
          activeOpacity={0.7}
        >
          <Text style={styles.branchExpandTitle}>
            ŞUBE BAZLI FİYAT & STOK DAĞILIMI (12 ŞUBE)
          </Text>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && item.stocks && (
          <View style={styles.branchList}>
            {Object.entries(item.stocks).map(([storeId, info]: [string, any]) => (
              <View key={storeId} style={styles.branchRow}>
                <Text style={styles.branchName} numberOfLines={1}>
                  {BRANCHES[storeId] || `Şube ${storeId}`}
                </Text>
                <View style={styles.branchValues}>
                  <Text style={styles.branchQty}>
                    {info.quantity !== null ? `${info.quantity} Adet` : '-'}
                  </Text>
                  <Text style={styles.branchPrice}>
                    {info.sellingPrice !== null ? `${info.sellingPrice.toFixed(2)} ₺` : '-'}
                  </Text>
                  <View
                    style={[
                      styles.onSaleDot,
                      { backgroundColor: info.onSale ? '#10B981' : '#EF4444' },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Sub-Header & 4 KPI Kartı */}
      <View style={styles.subHeader}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOPLAM ÜRÜN</Text>
            <Text style={styles.kpiVal}>{catalogTotal.toLocaleString('tr-TR')}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>TOPLAM STOK</Text>
            <Text style={styles.kpiVal}>{globalStats.sumTotalStock.toLocaleString('tr-TR')}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>KRİTİK (&lt;5)</Text>
            <Text style={[styles.kpiVal, { color: '#F59E0B' }]}>{globalStats.critical}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>STOKTA YOK</Text>
            <Text style={[styles.kpiVal, { color: '#EF4444' }]}>{globalStats.outOfStock}</Text>
          </View>
        </View>
      </View>

      {/* 2. Arama & Şube Seçici */}
      <View style={styles.searchBarRow}>
        <View style={styles.searchInputBox}>
          <MaterialCommunityIcons name="magnify" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün adı veya barkod ara..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => {
              if (searchQuery.trim().length >= 3 && /\d/.test(searchQuery.trim())) {
                performBarcodeSearch(searchQuery.trim());
              } else {
                fetchStocks();
              }
            }}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setScannedCatalogOnly(null);
              }}
              style={{ padding: 2 }}
            >
              <MaterialCommunityIcons name="close-circle" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            style={styles.searchCameraBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="camera" size={15} color="#111827" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onOpenBranchPicker} style={styles.branchSelectBtn}>
          <MaterialCommunityIcons name="store-outline" size={14} color="#FFFFFF" />
          <Text style={styles.branchSelectBtnText} numberOfLines={1}>
            {activeBranchId && activeBranchId !== 'all' ? activeBranchName : 'Tüm Şubeler'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Stok Durumu Filtre Tabları */}
      <View style={styles.filterTabsRow}>
        {STOCK_FILTERS.map((f) => {
          const isActive = stockStatusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setStockStatusFilter(f.key)}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Barkod Bildirim Şeridi */}
      {barcodeSearchNotice && (
        <View style={styles.noticeBar}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.noticeText}>{barcodeSearchNotice}</Text>
        </View>
      )}

      {/* Sadece Açık Katalogda Bulunan Ürün Bildirimi */}
      {scannedCatalogOnly && (
        <View style={styles.catalogOnlyCard}>
          <View style={styles.catalogOnlyHeader}>
            <View style={styles.catalogOnlyBadge}>
              <MaterialCommunityIcons name="information" size={14} color="#1D4ED8" />
              <Text style={styles.catalogOnlyBadgeText}>AÇIK KATALOG KAYDI</Text>
            </View>
            <TouchableOpacity onPress={() => setScannedCatalogOnly(null)}>
              <MaterialCommunityIcons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {scannedCatalogOnly.found ? (
            <View style={styles.catalogOnlyContent}>
              <Text style={styles.catalogOnlyTitle}>{scannedCatalogOnly.title}</Text>
              <Text style={styles.catalogOnlyDesc}>
                Bu ürün ulusal barkod kataloğunda kayıtlı ancak henüz Limon stoklarınıza eklenmemiş.
              </Text>

              <View style={styles.catalogMetaRow}>
                <Text style={styles.catalogMetaText}>Barkod: {scannedCatalogOnly.barcode}</Text>
                {scannedCatalogOnly.brand && (
                  <Text style={styles.catalogMetaText}>• Marka: {scannedCatalogOnly.brand}</Text>
                )}
              </View>

              {onNavigateToProductCreate && (
                <Button
                  title="Bu Ürünü Limon Stoklarına Ekle"
                  variant="primary"
                  size="sm"
                  onPress={() =>
                    onNavigateToProductCreate({
                      barcode: scannedCatalogOnly.barcode,
                      title: scannedCatalogOnly.title || '',
                      brand: scannedCatalogOnly.brand || '',
                      category: scannedCatalogOnly.category || '',
                    })
                  }
                  icon={<MaterialCommunityIcons name="plus-box" size={14} color="#FFFFFF" />}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          ) : (
            <View style={styles.catalogOnlyContent}>
              <Text style={styles.catalogOnlyTitle}>Barkod Kaydı Bulunamadı</Text>
              <Text style={styles.catalogOnlyDesc}>
                {scannedCatalogOnly.message || 'Girilen barkod hiçbir veri tabanında eşleşmedi.'}
              </Text>
              {onNavigateToProductCreate && (
                <Button
                  title="Yeni Ürün Olarak Tanımla"
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    onNavigateToProductCreate({
                      barcode: scannedCatalogOnly.barcode,
                    })
                  }
                  icon={<MaterialCommunityIcons name="plus" size={14} color={colors.textPrimary} />}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          )}
        </View>
      )}

      {/* 4. Liste / Yükleniyor / Hata */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Stok bilgileri ve barkod verisi yükleniyor...</Text>
        </View>
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => fetchStocks()}
          onOpenServerSettings={onOpenServerSettings}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id?.toString() || item.barcode}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchStocks(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Ürün Bulunamadı"
              message="Arama veya filtre kriterlerine uyan stok kaydı bulunamadı."
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  disabled={page === 0}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textPrimary} />
                  <Text style={styles.pageBtnText}>Önceki</Text>
                </TouchableOpacity>

                <Text style={styles.pageInfoText}>
                  Sayfa {page + 1} / {totalPages}
                </Text>

                <TouchableOpacity
                  disabled={page >= totalPages - 1}
                  onPress={() => setPage((p) => p + 1)}
                  style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>Sonraki</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* Taranan Ürünün Tüm Bilgilerini Gösteren Kapsamlı Modal */}
      <ScannedProductDetailModal
        visible={!!scannedProductDetail}
        product={scannedProductDetail?.product || null}
        catalogData={scannedProductDetail?.catalogData || null}
        onClose={() => setScannedProductDetail(null)}
        onUpdatePrice={(prod) => {
          setEditingProduct(prod);
        }}
        onScanAgain={() => {
          setScannedProductDetail(null);
          setScannerVisible(true);
        }}
      />

      {/* Fiyat Güncelleme Modalı */}
      {editingProduct && (
        <PriceUpdateModal
          visible={!!editingProduct}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            fetchStocks(true);
          }}
        />
      )}

      {/* Kamera Barkod Tarayıcı Modalı */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScannedBarcode}
        title="STOK BARKODU TARA"
        subtitle="Barkodu hizalayarak ürünü ve tüm şube bilgilerini anında getirin"
      />
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
    fontSize: 8,
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
    fontVariant: ['tabular-nums'],
  },
  kpiDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#374151',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputBox: {
    flex: 1,
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
  searchCameraBtn: {
    padding: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
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
  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2,
  },
  filterTabActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterTabText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  noticeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  catalogOnlyCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginHorizontal: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: layout.radiusSm,
  },
  catalogOnlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catalogOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catalogOnlyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.3,
  },
  catalogOnlyContent: {
    marginTop: 2,
  },
  catalogOnlyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  catalogOnlyDesc: {
    fontSize: 11,
    color: '#1E40AF',
    marginTop: 2,
    lineHeight: 15,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  catalogMetaText: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '600',
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
  productCard: {
    padding: 8,
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 8,
  },
  imageBox: {
    width: 50,
    height: 50,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  infoCol: {
    flex: 1,
  },
  productTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    lineHeight: 15,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  barcodeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#6B7280',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: '#F9FAFB',
  },
  copyBtnText: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  copyBtnTextDone: {
    color: '#059669',
  },
  brandText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  perishableBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  perishableBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#B45309',
  },
  stockStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  stockBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
    borderWidth: 1,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  badgeRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  stockBadgeText: {
    fontSize: 8,
    fontWeight: '900',
  },
  textGreen: {
    color: '#047857',
  },
  textAmber: {
    color: '#B45309',
  },
  textRed: {
    color: '#B91C1C',
  },
  cardActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 2,
  },
  detailActionText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#111827',
  },
  priceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#111827',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  priceActionText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  branchExpandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 4,
  },
  branchExpandTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  branchList: {
    marginTop: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 4,
    borderRadius: 2,
    gap: 3,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  branchName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
    flex: 1,
  },
  branchValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchQty: {
    fontSize: 9,
    color: '#6B7280',
  },
  branchPrice: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111827',
  },
  onSaleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  pageInfoText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
});
