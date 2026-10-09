import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Clipboard,
  Platform,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { ProductStockItem, BarcodeSearchResult } from '../../types/api';
import { BRANCHES } from '../../context/BranchConstants';
import { Button } from './Button';

interface ScannedProductDetailModalProps {
  visible: boolean;
  product: ProductStockItem | null;
  catalogData?: BarcodeSearchResult | null;
  onClose: () => void;
  onUpdatePrice?: (product: ProductStockItem) => void;
  onScanAgain?: () => void;
}

export const ScannedProductDetailModal: React.FC<ScannedProductDetailModalProps> = ({
  visible,
  product,
  catalogData,
  onClose,
  onUpdatePrice,
  onScanAgain,
}) => {
  const [copied, setCopied] = useState(false);

  if (!product) return null;

  const totalStock = product.totalStock ?? 0;
  const isOutOfStock = totalStock === 0;
  const isCritical = totalStock > 0 && totalStock <= 5;

  // Görsel: Önce ürünün kendi görseli, yoksa katalogdan gelen görsel
  const displayImage = product.imageUrl || catalogData?.imageUrl || null;
  const displayBrand = product.brand || catalogData?.brand || null;
  const displayCategory = product.category || catalogData?.category || null;

  // Şube hesaplamaları
  const stockEntries = Object.entries(product.stocks || {});
  const branchesWithStock = stockEntries.filter(([, s]) => (s.quantity ?? 0) > 0).length;
  const branchesOnSale = stockEntries.filter(([, s]) => s.onSale).length;

  const validPrices = stockEntries
    .map(([, s]) => s.sellingPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0);

  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : null;
  const avgPrice =
    validPrices.length > 0
      ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length
      : null;

  const handleCopyBarcode = () => {
    if (!product.barcode) return;
    Clipboard.setString(product.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareProduct = async () => {
    try {
      await Share.share({
        message: `${product.title}\nBarkod: ${product.barcode}\nToplam Stok: ${totalStock} Adet`,
        title: product.title,
      });
    } catch {
      // Hata yok
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>TARANAN ÜRÜN DETAYI</Text>
            <Text style={styles.headerSub}>Tüm Şube Stok ve Fiyat Verileri</Text>
          </View>
          <TouchableOpacity onPress={handleShareProduct} style={styles.headerBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="share-variant-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* 1. Ürün Hero Kartı */}
          <View style={styles.heroCard}>
            <View style={styles.imageContainer}>
              {displayImage ? (
                <Image
                  source={{ uri: displayImage }}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.noImageBox}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={48}
                    color={colors.textMuted}
                  />
                  <Text style={styles.noImageText}>Ürün Görseli Yok</Text>
                </View>
              )}

              {/* Sol Üst Kaynak Rozeti */}
              <View style={styles.sourceBadge}>
                <MaterialCommunityIcons name="check-decagram" size={12} color="#FFFFFF" />
                <Text style={styles.sourceBadgeText}>
                  {catalogData?.found ? 'Doğrulanmış Katalog' : 'Limon Stok Sistemi'}
                </Text>
              </View>

              {/* Sağ Üst Stok Durum Rozeti */}
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
                    ? `KRİTİK STOK (${totalStock})`
                    : `STOKTA (${totalStock})`}
                </Text>
              </View>
            </View>

            {/* Ürün Başlığı & Marka */}
            <View style={styles.heroInfo}>
              <Text style={styles.productTitle}>{product.title}</Text>

              <View style={styles.tagsRow}>
                {displayBrand ? (
                  <View style={styles.brandTag}>
                    <MaterialCommunityIcons name="tag-outline" size={12} color={colors.textPrimary} />
                    <Text style={styles.brandTagText}>{displayBrand}</Text>
                  </View>
                ) : null}

                {displayCategory ? (
                  <View style={styles.categoryTag}>
                    <MaterialCommunityIcons name="shape-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.categoryTagText}>{displayCategory}</Text>
                  </View>
                ) : null}
              </View>

              {/* Barkod Kutusu */}
              <View style={styles.barcodeBox}>
                <View style={styles.barcodeLeft}>
                  <MaterialCommunityIcons name="barcode-scan" size={18} color={colors.textPrimary} />
                  <View>
                    <Text style={styles.barcodeLabel}>BARKOD (EAN / UPC)</Text>
                    <Text style={styles.barcodeValue}>{product.barcode}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCopyBarcode}
                  style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={copied ? 'check' : 'content-copy'}
                    size={14}
                    color={copied ? '#059669' : colors.textPrimary}
                  />
                  <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Ek Kod Bilgileri (Varsa) */}
              {(product.stockCode || product.contentId) && (
                <View style={styles.metaRow}>
                  {product.stockCode ? (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Stok Kodu:</Text>
                      <Text style={styles.metaVal}>{product.stockCode}</Text>
                    </View>
                  ) : null}
                  {product.contentId ? (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>İçerik ID:</Text>
                      <Text style={styles.metaVal}>{product.contentId}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </View>

          {/* 2. KPI İstatistik Kartları */}
          <View style={styles.kpiCard}>
            <Text style={styles.sectionHeaderTitle}>STOK & FİYAT ÖZETİ</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCol}>
                <Text style={styles.kpiMetricLabel}>TOPLAM STOK</Text>
                <Text style={[styles.kpiMetricVal, { color: isOutOfStock ? colors.danger : colors.textPrimary }]}>
                  {totalStock} Adet
                </Text>
              </View>

              <View style={styles.kpiDividerV} />

              <View style={styles.kpiCol}>
                <Text style={styles.kpiMetricLabel}>STOKLU ŞUBE</Text>
                <Text style={styles.kpiMetricVal}>
                  {branchesWithStock} / {Object.keys(BRANCHES).length}
                </Text>
              </View>

              <View style={styles.kpiDividerV} />

              <View style={styles.kpiCol}>
                <Text style={styles.kpiMetricLabel}>SATIŞTA AÇIK</Text>
                <Text style={[styles.kpiMetricVal, { color: colors.success }]}>
                  {branchesOnSale} Şube
                </Text>
              </View>
            </View>

            {/* Fiyat Aralık Satırı */}
            <View style={styles.priceSummaryRow}>
              <View style={styles.priceSummaryCol}>
                <Text style={styles.priceSummaryLabel}>En Düşük Fiyat</Text>
                <Text style={styles.priceSummaryVal}>
                  {minPrice !== null ? `${minPrice.toFixed(2)} ₺` : '-'}
                </Text>
              </View>
              <View style={styles.priceSummaryCol}>
                <Text style={styles.priceSummaryLabel}>Ortalama Fiyat</Text>
                <Text style={[styles.priceSummaryVal, { color: colors.textPrimary, fontWeight: '700' }]}>
                  {avgPrice !== null ? `${avgPrice.toFixed(2)} ₺` : '-'}
                </Text>
              </View>
              <View style={styles.priceSummaryCol}>
                <Text style={styles.priceSummaryLabel}>En Yüksek Fiyat</Text>
                <Text style={styles.priceSummaryVal}>
                  {maxPrice !== null ? `${maxPrice.toFixed(2)} ₺` : '-'}
                </Text>
              </View>
            </View>
          </View>

          {/* 3. 12 Şube Detay Dağılım Tablosu */}
          <View style={styles.branchCard}>
            <View style={styles.branchCardHeader}>
              <View style={styles.branchCardHeaderLeft}>
                <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.sectionHeaderTitle}>TÜM ŞUBELERİN STOK & FİYAT DAĞILIMI</Text>
              </View>
              <Text style={styles.branchCountText}>12 Şube</Text>
            </View>

            {/* Başlık Başlık Satırı */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeadCell, { flex: 2.2 }]}>ŞUBE ADI</Text>
              <Text style={[styles.tableHeadCell, { flex: 1.2, textAlign: 'center' }]}>STOK</Text>
              <Text style={[styles.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>FİYAT</Text>
              <Text style={[styles.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>DURUM</Text>
            </View>

            {/* 12 Şubenin Listesi */}
            {Object.entries(BRANCHES).map(([storeId, storeName]) => {
              const info = product.stocks?.[storeId];
              const qty = info?.quantity ?? null;
              const price = info?.sellingPrice ?? null;
              const onSale = info?.onSale ?? false;
              const hasQty = qty !== null && qty > 0;

              return (
                <View key={storeId} style={styles.branchTableRow}>
                  <View style={{ flex: 2.2 }}>
                    <Text style={styles.branchRowName} numberOfLines={1}>
                      {storeName}
                    </Text>
                    <Text style={styles.branchRowId}>ID: {storeId}</Text>
                  </View>

                  {/* Stok Adedi */}
                  <View style={{ flex: 1.2, alignItems: 'center' }}>
                    <View
                      style={[
                        styles.qtyBadge,
                        qty === null || qty === 0
                          ? styles.qtyBadgeZero
                          : qty <= 5
                          ? styles.qtyBadgeLow
                          : styles.qtyBadgeOk,
                      ]}
                    >
                      <Text
                        style={[
                          styles.qtyBadgeText,
                          qty === null || qty === 0
                            ? styles.qtyTextZero
                            : qty <= 5
                            ? styles.qtyTextLow
                            : styles.qtyTextOk,
                        ]}
                      >
                        {qty !== null ? `${qty} Ad` : '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Fiyat */}
                  <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                    <Text style={styles.priceCellText}>
                      {price !== null ? `${price.toFixed(2)} ₺` : '-'}
                    </Text>
                  </View>

                  {/* Satışta Açık / Kapalı */}
                  <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                    <View style={[styles.saleDotWrapper, onSale ? styles.saleDotOpen : styles.saleDotClosed]}>
                      <View style={[styles.saleDot, { backgroundColor: onSale ? '#10B981' : '#EF4444' }]} />
                      <Text style={[styles.saleText, { color: onSale ? '#065F46' : '#991B1B' }]}>
                        {onSale ? 'Açık' : 'Kapalı'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Açık Katalog Karşılaştırması / Doğrulama Kutusu */}
          {catalogData?.found && (
            <View style={styles.catalogCard}>
              <View style={styles.catalogHeader}>
                <MaterialCommunityIcons name="database-check-outline" size={16} color={colors.info} />
                <Text style={styles.catalogTitle}>Açık Katalog Doğrulaması</Text>
              </View>
              <Text style={styles.catalogDesc}>
                Bu ürün ulusal açık barkod veri tabanı ile eşleştirilmiştir. Görsel ve marka bilgileri teyit edilmiştir.
              </Text>
              {catalogData.source ? (
                <Text style={styles.catalogSource}>Kaynak: {catalogData.source}</Text>
              ) : null}
            </View>
          )}

          {/* Aksiyon Butonları */}
          <View style={styles.actionsWrap}>
            {onUpdatePrice && (
              <Button
                title="Fiyat & Stok Güncelle"
                variant="primary"
                size="lg"
                onPress={() => onUpdatePrice(product)}
                icon={<MaterialCommunityIcons name="currency-try" size={18} color="#FFFFFF" />}
                style={{ marginBottom: 10 }}
              />
            )}

            <View style={styles.secActionsRow}>
              {onScanAgain && (
                <Button
                  title="Tekrar Barkod Tara"
                  variant="secondary"
                  size="md"
                  onPress={onScanAgain}
                  icon={<MaterialCommunityIcons name="barcode-scan" size={16} color="#FFFFFF" />}
                  style={{ flex: 1 }}
                />
              )}
              <Button
                title="Kapat"
                variant="outline"
                size="md"
                onPress={onClose}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerBtn: {
    padding: 6,
    borderRadius: layout.radiusSm,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: layout.radiusMd,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 12,
  },
  imageContainer: {
    height: 200,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  heroImage: {
    width: '90%',
    height: '90%',
  },
  noImageBox: {
    alignItems: 'center',
    gap: 6,
  },
  noImageText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  sourceBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radiusSm,
    gap: 4,
  },
  sourceBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  stockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: layout.radiusSm,
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
    fontSize: 11,
    fontWeight: '800',
  },
  textGreen: { color: '#047857' },
  textAmber: { color: '#B45309' },
  textRed: { color: '#B91C1C' },
  heroInfo: {
    padding: 14,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  brandTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryTagText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  barcodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  barcodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barcodeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  barcodeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 4,
  },
  copyBtnSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  copyBtnTextSuccess: {
    color: '#059669',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaItem: {
    flexDirection: 'row',
    gap: 4,
  },
  metaLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metaVal: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: layout.radiusMd,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: layout.radiusSm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDividerV: {
    width: 1,
    height: 26,
    backgroundColor: '#E5E7EB',
  },
  kpiMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  kpiMetricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  priceSummaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  priceSummaryLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  priceSummaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 2,
  },
  branchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: layout.radiusMd,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  branchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  branchCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 6,
    borderRadius: layout.radiusSm,
  },
  tableHeadCell: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  branchTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  branchRowName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  branchRowId: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  qtyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: layout.radiusSm,
    borderWidth: 1,
  },
  qtyBadgeOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  qtyBadgeLow: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  qtyBadgeZero: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  qtyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  qtyTextOk: { color: '#047857' },
  qtyTextLow: { color: '#B45309' },
  qtyTextZero: { color: '#B91C1C' },
  priceCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saleDotWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: layout.radiusSm,
    gap: 4,
  },
  saleDotOpen: {
    backgroundColor: '#ECFDF5',
  },
  saleDotClosed: {
    backgroundColor: '#FEF2F2',
  },
  saleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  saleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  catalogCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: layout.radiusMd,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginBottom: 14,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  catalogTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  catalogDesc: {
    fontSize: 11,
    color: '#1E3A8A',
    lineHeight: 16,
  },
  catalogSource: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3B82F6',
    marginTop: 4,
  },
  actionsWrap: {
    marginTop: 4,
  },
  secActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
