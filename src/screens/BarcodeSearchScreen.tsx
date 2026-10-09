import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Keyboard,
  Clipboard,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { barcodeService, stocksService } from '../api/services';
import { BarcodeSearchResult, ProductStockItem } from '../types/api';
import { BRANCHES } from '../context/BranchConstants';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { BarcodeScannerModal } from '../components/common/BarcodeScannerModal';
import { PriceUpdateModal } from './PriceUpdateModal';

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

export const BarcodeSearchScreen: React.FC<{
  onFindInStock?: (barcode: string) => void;
  onNavigateToProductCreate?: (prefill?: { barcode: string; title?: string; brand?: string; category?: string }) => void;
}> = ({ onFindInStock, onNavigateToProductCreate }) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalogResult, setCatalogResult] = useState<BarcodeSearchResult | null>(null);
  const [stockResult, setStockResult] = useState<ProductStockItem | null>(null);
  const [searched, setSearched] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductStockItem | null>(null);
  const [expandedBranches, setExpandedBranches] = useState(true);

  const handleCopyBarcode = (code: string) => {
    if (!code) return;
    Clipboard.setString(code);
    setCopiedBarcode(true);
    setTimeout(() => setCopiedBarcode(false), 2000);
  };

  const handleSearchWithBarcode = async (barcodeToSearch: string) => {
    Keyboard.dismiss();
    const clean = barcodeToSearch.trim();
    if (!clean) return;

    setLoading(true);
    setSearched(true);
    setCatalogResult(null);
    setStockResult(null);

    try {
      // 1. Eşzamanlı Açık Katalog ve Limon Stokları Sorgusu
      const [catRes, stocksRes] = await Promise.all([
        barcodeService.searchBarcode(clean).catch((err) => ({
          found: false,
          barcode: clean,
          error: err.response?.data?.error || 'Açık katalog servisine ulaşılamadı.',
        })),
        stocksService.getStocks({ barcode: clean, search: clean, all: true, size: 50, page: 0 }).catch(() => null),
      ]);

      setCatalogResult(catRes);

      // Limon stoklarında eşleşen ürünü bul
      const stockItems = extractProductItems(stocksRes);
      const matched = stockItems.find(
        (p) =>
          p.barcode?.trim() === clean ||
          p.barcode?.trim()?.replace(/^0+/, '') === clean.replace(/^0+/, '')
      ) || (stockItems.length > 0 ? stockItems[0] : null);

      setStockResult(matched);
    } catch {
      setCatalogResult({
        found: false,
        barcode: clean,
        error: 'Sorgulama sırasında bir hata oluştu.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    handleSearchWithBarcode(barcodeInput);
  };

  const handleScannedBarcode = (scannedCode: string) => {
    setBarcodeInput(scannedCode);
    handleSearchWithBarcode(scannedCode);
  };

  // Birleştirilmiş Görsel & Bilgiler
  const finalTitle = stockResult?.title || catalogResult?.title || 'Başlık Bilgisi Yok';
  const finalImage = stockResult?.imageUrl || catalogResult?.imageUrl || null;
  const finalBrand = stockResult?.brand || catalogResult?.brand || null;
  const finalCategory = stockResult?.category || catalogResult?.category || null;

  const totalStock = stockResult?.totalStock ?? 0;
  const isOutOfStock = stockResult ? totalStock === 0 : false;
  const isCritical = stockResult ? totalStock > 0 && totalStock <= 5 : false;

  const stockEntries = stockResult ? Object.entries(stockResult.stocks || {}) : [];
  const branchesWithStock = stockEntries.filter(([, s]) => (s.quantity ?? 0) > 0).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.searchCard}>
        <Text style={styles.cardTitle}>Barkod Arama & Doğrulama</Text>
        <Text style={styles.cardDesc}>
          Barkod numarasını kamerayla tarayarak veya manuel girerek hem ulusal açık katalog verilerini hem de Limon 12 şube stok ve fiyatlarını eşzamanlı sorgulayın.
        </Text>

        <Input
          label="Ürün Barkodu (EAN / UPC)"
          placeholder="Örn: 8690526097893"
          value={barcodeInput}
          onChangeText={setBarcodeInput}
          keyboardType="number-pad"
          onSubmitEditing={handleSearch}
          rightElement={
            <View style={styles.inputActionsRow}>
              <TouchableOpacity
                onPress={() => setScannerVisible(true)}
                style={styles.cameraIconBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="camera" size={18} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSearch} style={styles.searchIconBtn} activeOpacity={0.7}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          }
        />

        <View style={styles.actionsBtnRow}>
          <Button
            title="Kamera ile Tara"
            variant="secondary"
            size="md"
            onPress={() => setScannerVisible(true)}
            icon={<MaterialCommunityIcons name="camera-iris" size={16} color="#FFF" />}
            style={{ flex: 1 }}
          />
          <Button
            title={loading ? 'Sorgulanıyor...' : 'Sorgula'}
            variant="primary"
            size="md"
            loading={loading}
            onPress={handleSearch}
            icon={<MaterialCommunityIcons name="barcode-scan" size={16} color="#FFF" />}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      {/* Kamera Barkod Okuyucu Modalı */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScannedBarcode}
        title="ÜRÜN BARKODU TARA"
        subtitle="Barkodu çerçevenin ortasına denk getirin"
      />

      {/* Yükleniyor Göstergesi */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Açık katalog ve Limon şube stokları taranıyor...</Text>
        </View>
      ) : searched && (catalogResult?.found || stockResult) ? (
        <View>
          {/* 1. Ürün Ana Bilgi Kartı */}
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.badgeSuccess}>
                <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
                <Text style={styles.badgeSuccessText}>
                  {stockResult ? 'Limon Stoklarında Mevcut' : 'Açık Katalogda Kayıtlı'}
                </Text>
              </View>
              <Text style={styles.sourceText}>
                {stockResult ? 'Limon API & Trendyol Go' : `Kaynak: ${catalogResult?.source || 'Açık Katalog'}`}
              </Text>
            </View>

            {/* Görsel */}
            {finalImage ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: finalImage }} style={styles.productImage} resizeMode="contain" />
              </View>
            ) : (
              <View style={styles.noImageWrapper}>
                <MaterialCommunityIcons name="image-off-outline" size={32} color={colors.textMuted} />
                <Text style={styles.noImageText}>Görsel mevcut değil</Text>
              </View>
            )}

            {/* Ürün Detayları */}
            <Text style={styles.productTitle}>{finalTitle}</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Barkod:</Text>
              <View style={styles.barcodeValueWrap}>
                <Text style={styles.detailVal}>{barcodeInput.trim() || catalogResult?.barcode || stockResult?.barcode}</Text>
                <TouchableOpacity
                  onPress={() => handleCopyBarcode(catalogResult?.barcode || stockResult?.barcode || barcodeInput)}
                  style={styles.copyBtn}
                >
                  <MaterialCommunityIcons
                    name={copiedBarcode ? 'check' : 'content-copy'}
                    size={12}
                    color={copiedBarcode ? '#059669' : colors.textMuted}
                  />
                  <Text style={[styles.copyBtnText, copiedBarcode && { color: '#059669' }]}>
                    {copiedBarcode ? 'Kopyalandı' : 'Kopyala'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {finalBrand ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Marka:</Text>
                <Text style={styles.detailVal}>{finalBrand}</Text>
              </View>
            ) : null}

            {finalCategory ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kategori:</Text>
                <Text style={styles.detailVal}>{finalCategory}</Text>
              </View>
            ) : null}

            {stockResult?.stockCode ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Stok Kodu:</Text>
                <Text style={styles.detailVal}>{stockResult.stockCode}</Text>
              </View>
            ) : null}
          </Card>

          {/* 2. Limon Stok & Fiyat Matrisi (Varsa) */}
          {stockResult ? (
            <Card style={styles.stockMatrixCard}>
              <View style={styles.stockMatrixHeader}>
                <View style={styles.stockMatrixHeaderLeft}>
                  <MaterialCommunityIcons name="cube-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.stockMatrixTitle}>LİMON ŞUBE STOK & FİYAT DURUMU</Text>
                </View>
                <View
                  style={[
                    styles.stockBadge,
                    isOutOfStock ? styles.badgeRed : isCritical ? styles.badgeAmber : styles.badgeGreen,
                  ]}
                >
                  <Text
                    style={[
                      styles.stockBadgeText,
                      isOutOfStock ? styles.textRed : isCritical ? styles.textAmber : styles.textGreen,
                    ]}
                  >
                    {isOutOfStock
                      ? 'TÜKENDİ (0 ADET)'
                      : isCritical
                      ? `KRİTİK STOK (${totalStock})`
                      : `TOPLAM: ${totalStock} ADET`}
                  </Text>
                </View>
              </View>

              <Text style={styles.stockSubtitle}>
                {branchesWithStock} / {Object.keys(BRANCHES).length} Şubede Stok Mevcut
              </Text>

              {/* Şube Bazlı Tablo Aç/Kapa */}
              <TouchableOpacity
                onPress={() => setExpandedBranches(!expandedBranches)}
                style={styles.toggleBranchesBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleBranchesText}>12 Şube Detayını Göster</Text>
                <MaterialCommunityIcons
                  name={expandedBranches ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedBranches && (
                <View style={styles.branchTableList}>
                  {Object.entries(BRANCHES).map(([storeId, storeName]) => {
                    const info = stockResult.stocks?.[storeId];
                    const qty = info?.quantity ?? null;
                    const price = info?.sellingPrice ?? null;
                    const onSale = info?.onSale ?? false;

                    return (
                      <View key={storeId} style={styles.branchTableRow}>
                        <Text style={styles.branchNameCell} numberOfLines={1}>
                          {storeName}
                        </Text>
                        <View style={styles.branchValuesCell}>
                          <Text
                            style={[
                              styles.branchQtyCell,
                              qty === null || qty === 0 ? styles.qtyZero : qty <= 5 ? styles.qtyLow : styles.qtyOk,
                            ]}
                          >
                            {qty !== null ? `${qty} Ad` : '-'}
                          </Text>
                          <Text style={styles.branchPriceCell}>
                            {price !== null ? `${price.toFixed(2)} ₺` : '-'}
                          </Text>
                          <View
                            style={[
                              styles.onSaleDot,
                              { backgroundColor: onSale ? '#10B981' : '#EF4444' },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Aksiyon Butonları */}
              <View style={styles.stockActionsRow}>
                <Button
                  title="Fiyat & Stok Güncelle"
                  variant="primary"
                  size="md"
                  onPress={() => setEditingProduct(stockResult)}
                  icon={<MaterialCommunityIcons name="currency-try" size={16} color="#FFFFFF" />}
                  style={{ flex: 1 }}
                />

                {onFindInStock && (
                  <Button
                    title="Stok Ekranında Aç"
                    variant="outline"
                    size="md"
                    onPress={() => onFindInStock(stockResult.barcode)}
                    icon={<MaterialCommunityIcons name="arrow-right" size={16} color={colors.textPrimary} />}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </Card>
          ) : (
            /* Limon Stoklarında Olmayan Ürün Bildirimi */
            <Card style={styles.notInStockCard}>
              <View style={styles.notInStockHeader}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.warning} />
                <Text style={styles.notInStockTitle}>Limon Stoklarında Henüz Tanımlı Değil</Text>
              </View>
              <Text style={styles.notInStockDesc}>
                Bu ürün açık katalogda bulundu ancak Trendyol Go / Limon mağaza stoklarınızda kayıtlı değil.
              </Text>

              {onNavigateToProductCreate && (
                <Button
                  title="Bu Ürünü Limon Stoklarına Ekle"
                  variant="primary"
                  size="md"
                  onPress={() =>
                    onNavigateToProductCreate({
                      barcode: catalogResult?.barcode || barcodeInput,
                      title: catalogResult?.title || '',
                      brand: catalogResult?.brand || '',
                      category: catalogResult?.category || '',
                    })
                  }
                  icon={<MaterialCommunityIcons name="plus-box" size={16} color="#FFFFFF" />}
                  style={{ marginTop: 10 }}
                />
              )}
            </Card>
          )}
        </View>
      ) : searched && catalogResult && !catalogResult.found ? (
        <Card style={styles.notFoundCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.warning} />
          <Text style={styles.notFoundTitle}>Ürün Bulunamadı</Text>
          <Text style={styles.notFoundDesc}>
            {catalogResult.message || 'Bu barkoda ait ürün ne Limon stoklarında ne de açık veritabanlarında eşleşmedi.'}
          </Text>

          {onNavigateToProductCreate && (
            <Button
              title="Yeni Ürün Olarak Tanımla"
              variant="outline"
              size="sm"
              onPress={() =>
                onNavigateToProductCreate({
                  barcode: barcodeInput.trim(),
                })
              }
              icon={<MaterialCommunityIcons name="plus" size={14} color={colors.textPrimary} />}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      ) : null}

      {/* Fiyat Güncelleme Modalı */}
      {editingProduct && (
        <PriceUpdateModal
          visible={!!editingProduct}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            handleSearchWithBarcode(barcodeInput);
          }}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  searchCard: {
    marginBottom: 16,
  },
  cardTitle: {
    ...typography.h3,
    fontSize: 16,
    marginBottom: 4,
  },
  cardDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  inputActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cameraIconBtn: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIconBtn: {
    padding: 4,
  },
  actionsBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  loadingBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  resultCard: {
    marginBottom: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: layout.radiusSm,
    gap: 4,
  },
  badgeSuccessText: {
    ...typography.tiny,
    color: colors.success,
    fontWeight: '700',
  },
  sourceText: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  imageWrapper: {
    height: 180,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: layout.radiusSm,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageWrapper: {
    height: 120,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: layout.radiusSm,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 6,
  },
  noImageText: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  productTitle: {
    ...typography.h3,
    fontSize: 15,
    marginBottom: 10,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.surfaceSubtle,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailVal: {
    ...typography.bodyMedium,
    fontSize: 13,
  },
  barcodeValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 3,
  },
  copyBtnText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  stockMatrixCard: {
    marginBottom: 20,
  },
  stockMatrixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stockMatrixHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockMatrixTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  stockSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 10,
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: layout.radiusSm,
    borderWidth: 1,
  },
  badgeGreen: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  badgeAmber: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  badgeRed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  stockBadgeText: { fontSize: 10, fontWeight: '800' },
  textGreen: { color: '#047857' },
  textAmber: { color: '#B45309' },
  textRed: { color: '#B91C1C' },
  toggleBranchesBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  toggleBranchesText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  branchTableList: {
    backgroundColor: '#F9FAFB',
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  branchTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  branchNameCell: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  branchValuesCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  branchQtyCell: {
    fontSize: 11,
    fontWeight: '700',
  },
  qtyOk: { color: '#047857' },
  qtyLow: { color: '#B45309' },
  qtyZero: { color: '#B91C1C' },
  branchPriceCell: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  onSaleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  notInStockCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  notInStockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  notInStockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  notInStockDesc: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16,
  },
  notFoundCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 20,
  },
  notFoundTitle: {
    ...typography.h3,
    marginTop: 8,
    marginBottom: 4,
  },
  notFoundDesc: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
