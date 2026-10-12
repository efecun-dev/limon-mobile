import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Card } from '../components/common/Card';
import { getCancellationReason } from './OrdersScreen';

interface OrderDetailModalProps {
  order: any | null;
  visible: boolean;
  onClose: () => void;
}

export function getLineImage(line: any): string | null {
  if (!line) return null;
  if (line.imageUrl && typeof line.imageUrl === 'string') return line.imageUrl;
  if (line.image && typeof line.image === 'string') return line.image;
  if (line.product?.imageUrl && typeof line.product.imageUrl === 'string') return line.product.imageUrl;
  if (line.product?.image && typeof line.product.image === 'string') return line.product.image;
  if (Array.isArray(line.product?.imageUrls) && line.product.imageUrls[0]) return line.product.imageUrls[0];
  if (Array.isArray(line.product?.images) && line.product.images[0]) return line.product.images[0];
  if (Array.isArray(line.images) && line.images[0]) return line.images[0];
  return null;
}

export function getLinePreviousStock(line: any): number | null {
  if (!line) return null;
  if (typeof line.previousStock === 'number') return line.previousStock;
  if (typeof line.product?.previousStock === 'number') return line.product.previousStock;
  if (typeof line.product?.stock === 'number') return line.product.stock;
  if (typeof line.product?.currentStock === 'number') return line.product.currentStock;
  if (typeof line.merchantStock === 'number') return line.merchantStock;
  if (Array.isArray(line.items)) {
    for (const it of line.items) {
      if (typeof it?.previousStock === 'number') return it.previousStock;
      if (typeof it?.stock === 'number') return it.stock;
    }
  }
  return null;
}

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  Created: { label: 'Yeni Sipariş', dot: '#3B82F6', text: '#1D4ED8', bg: '#EFF6FF' },
  Picking: { label: 'Toplanıyor', dot: '#F59E0B', text: '#B45309', bg: '#FFFBEB' },
  Invoiced: { label: 'Faturalandı', dot: '#A855F7', text: '#7E22CE', bg: '#FAF5FF' },
  Shipped: { label: 'Yolda', dot: '#F97316', text: '#C2410C', bg: '#FFF7ED' },
  Delivered: { label: 'Teslim Edildi', dot: '#10B981', text: '#047857', bg: '#ECFDF5' },
  Cancelled: { label: 'İptal Edildi', dot: '#EF4444', text: '#B91C1C', bg: '#FEF2F2' },
  UnSupplied: { label: 'Tedarik Edilemedi', dot: '#B91C1C', text: '#991B1B', bg: '#FEF2F2' },
};

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, visible, onClose }) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!order) return null;

  const isCancelled = ['Cancelled', 'UnSupplied'].includes(order.packageStatus);
  const cancelReason = getCancellationReason ? getCancellationReason(order) : order.cancelReason || null;
  const statusCfg = STATUS_MAP[order.packageStatus] || {
    label: order.packageStatus,
    dot: '#6B7280',
    text: '#374151',
    bg: '#F3F4F6',
  };

  const formattedDate = order.orderDate
    ? new Date(order.orderDate).toLocaleString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  // Zaman Çizelgesi Adımları
  const orderSteps = [
    { key: 'Created', label: 'Sipariş Alındı', done: true },
    {
      key: 'Picking',
      label: 'Toplanıyor',
      done: ['Picking', 'Invoiced', 'Shipped', 'Delivered'].includes(order.packageStatus),
    },
    {
      key: 'Invoiced',
      label: 'Faturalandı',
      done: ['Invoiced', 'Shipped', 'Delivered'].includes(order.packageStatus),
    },
    {
      key: 'Shipped',
      label: 'Yola Çıktı',
      done: ['Shipped', 'Delivered'].includes(order.packageStatus),
    },
    {
      key: 'Delivered',
      label: 'Teslim Edildi',
      done: order.packageStatus === 'Delivered',
    },
  ];

  // Satıcı Promosyon Maliyeti
  let sellerPromoCost = 0;
  if (order.lines) {
    order.lines.forEach((line: any) => {
      line.items?.forEach((it: any) => {
        it.promotions?.forEach((p: any) => {
          if (p.sellerPaid || p.type === 'Seller' || p.type === 'SELLER') {
            sellerPromoCost += p.amount || 0;
          }
        });
      });
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.orderNumberRow}>
                <Text style={styles.orderNum}>Sipariş #{order.orderNumber}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.dot }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
                  <Text style={[styles.statusBadgeText, { color: statusCfg.text }]}>
                    {statusCfg.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderDate}>{formattedDate}</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 1. İptal Bilgilendirme Banner'ı */}
            {isCancelled && (
              <View style={styles.cancelBanner}>
                <View style={styles.cancelBannerLeft}>
                  <View style={styles.cancelIconCircle}>
                    <MaterialCommunityIcons name="close-circle" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.cancelTexts}>
                    <View style={styles.cancelTopRow}>
                      <Text style={styles.cancelTitle}>SİPARİŞ İPTAL EDİLDİ</Text>
                      {order.cancelInfo?.reasonType && (
                        <View style={styles.cancelTypeBadge}>
                          <Text style={styles.cancelTypeBadgeText}>
                            {order.cancelInfo.reasonType}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cancelReasonDesc}>
                      {cancelReason || 'İptal sebebi belirtilmemiş'}
                    </Text>
                  </View>
                </View>

                {order.cancelInfo?.agentName && (
                  <View style={styles.cancelAgentBox}>
                    <Text style={styles.cancelAgentLabel}>İptal Eden:</Text>
                    <Text style={styles.cancelAgentVal}>
                      {order.cancelInfo.agentName === 'Customer'
                        ? 'Müşteri'
                        : order.cancelInfo.agentName === 'TGO App'
                        ? 'Trendyol Go'
                        : order.cancelInfo.agentName}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 2. Zaman Çizelgesi (Timeline) */}
            <Card style={styles.timelineCard}>
              <Text style={styles.sectionHeaderTitle}>SİPARİŞ SÜRECİ VE ZAMAN ÇİZELGESİ</Text>
              <View style={styles.timelineRow}>
                {orderSteps.map((step, idx) => (
                  <View key={step.key} style={styles.timelineStep}>
                    <View style={[styles.timelineNode, step.done && styles.timelineNodeDone]}>
                      {step.done ? (
                        <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                      ) : (
                        <Text style={styles.timelineNodeNum}>{idx + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.timelineLabel, step.done && styles.timelineLabelDone]}>
                      {step.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* 3. Kurye ve Müşteri Durumu */}
            <Card style={styles.infoCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="moped" size={16} color={colors.textPrimary} />
                <Text style={styles.sectionTitle}>Kurye ve Müşteri Bilgisi</Text>
              </View>

              {/* Kurye Bilgisi - Sadece hazırlık aşamasında kurye yaklaştı yazar */}
              <View style={styles.courierBox}>
                {['Shipped', 'Delivered'].includes(order.packageStatus) ? (
                  <Text style={styles.courierStatusOk}>✓ Kurye paketi teslim aldı / yolda.</Text>
                ) : ['Cancelled', 'UnSupplied'].includes(order.packageStatus) ? (
                  <Text style={styles.courierStatusWait}>Sipariş iptal edildi / tamamlanmadı.</Text>
                ) : order.isCourierNearby ? (
                  <Text style={styles.courierStatusAlert}>
                    ⚡ Kurye Şubeye Yaklaştı — Siparişi Hazırlayın!
                  </Text>
                ) : (
                  <Text style={styles.courierStatusWait}>Kurye atanması bekleniyor...</Text>
                )}

                {order.courier?.name && (
                  <View style={styles.courierDetailRow}>
                    <Text style={styles.courierNameText}>Kurye: {order.courier.name}</Text>
                    {order.courier.phone && (
                      <Text style={styles.courierPhoneText}>Tel: {order.courier.phone}</Text>
                    )}
                  </View>
                )}
              </View>

              {/* Müşteri Notu */}
              {order.customer?.note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>MÜŞTERİ NOTU</Text>
                  <Text style={styles.noteText}>"{order.customer.note}"</Text>
                </View>
              ) : null}

              {/* Müşteri Bilgisi (Adres Kaldırıldı) */}
              <View style={styles.customerBox}>
                <Text style={styles.customerName}>
                  Alıcı: {order.customer?.firstName} {order.customer?.lastName}
                </Text>
              </View>
            </Card>

            {/* 4. Sipariş Kalemleri Tablosu (Görsel & Önceki Stok Dahil) */}
            <Card style={styles.itemsCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="shopping-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.sectionTitle}>
                  Sipariş Kalemleri ({order.lines?.length || 0})
                </Text>
              </View>

              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thText, { width: 50 }]}>GÖRSEL</Text>
                <Text style={[styles.thText, { flex: 2, paddingLeft: 6 }]}>ÜRÜN VE STOK</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>BİRİM / ADET</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>TOPLAM</Text>
              </View>

              {order.lines && order.lines.length > 0 ? (
                order.lines.map((line: any, idx: number) => {
                  const quantity = line.items?.length || line.amount || 1;
                  const unitPrice = line.price || 0;
                  const totalPrice = unitPrice * quantity;
                  
                  const countFromAltItems = line.items?.filter((it: any) => it.isAlternative).length || 0;
                  const isAltLine = Boolean(line.isAlternative || countFromAltItems > 0);
                  const altItemsCount = countFromAltItems > 0 ? countFromAltItems : (line.isAlternative ? quantity : 0);

                  const countFromCancelledItems = line.items?.filter((it: any) => it.isCancelled).length || 0;
                  const isCancelledLine = Boolean(line.causedCancel || line.isCancelled || countFromCancelledItems > 0);
                  const cancelledItemsCount = countFromCancelledItems > 0 ? countFromCancelledItems : (line.causedCancel ? quantity : 0);
                  const isCauseOfCancel = Boolean(line.causedCancel || line.items?.some((it: any) => it.causedCancel));

                  const img = getLineImage(line);
                  const prevStock = getLinePreviousStock(line);

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.itemRow,
                        isAltLine && styles.itemRowAlt,
                        isCancelledLine && !isAltLine && styles.itemRowCancelled,
                        isCauseOfCancel && styles.itemRowCancelCause,
                      ]}
                    >
                      {/* Ürün Fotoğrafı */}
                      <TouchableOpacity
                        style={[
                          styles.itemImageBtn,
                          isAltLine && { borderColor: '#F59E0B', borderWidth: 1 },
                        ]}
                        onPress={() => img && setSelectedImage(img)}
                        activeOpacity={img ? 0.7 : 1}
                      >
                        {img ? (
                          <Image source={{ uri: img }} style={styles.itemImage} resizeMode="contain" />
                        ) : (
                          <View style={[styles.itemImagePlaceholder, isAltLine && { backgroundColor: '#FEF3C7' }]}>
                            <MaterialCommunityIcons name="package-variant-closed" size={18} color={isAltLine ? '#D97706' : '#9CA3AF'} />
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={{ flex: 2, paddingLeft: 6 }}>
                        <Text
                          style={[
                            styles.itemName,
                            isAltLine && styles.itemNameAlt,
                            isCancelledLine && !isAltLine && styles.itemNameCancelled,
                          ]}
                        >
                          {line.product?.name || line.product?.productSaleName || 'Ürün'}
                        </Text>
                        <Text style={styles.itemBarcode}>{line.barcode || '-'}</Text>

                        {/* Alternatif Açıklaması */}
                        {isAltLine && (
                          <Text style={styles.altItemNoticeText}>
                            Müşteriye alternatif olarak temin edildi
                            {line.alternativeReason ? ` · ${line.alternativeReason}` : ''}
                          </Text>
                        )}

                        {/* Önceki Stok Bilgisi Rozeti */}
                        {prevStock !== null && (
                          <View style={styles.prevStockChip}>
                            <MaterialCommunityIcons name="history" size={10} color="#4B5563" />
                            <Text style={styles.prevStockChipText}>
                              Önceki Stok: <Text style={styles.prevStockChipBold}>{prevStock}</Text>
                            </Text>
                          </View>
                        )}

                        {/* Kalem Rozetleri */}
                        <View style={styles.lineBadgesRow}>
                          {isAltLine && (
                            <View style={styles.badgeAmber}>
                              <MaterialCommunityIcons name="swap-horizontal" size={10} color="#B45309" />
                              <Text style={styles.badgeAmberText}>
                                {altItemsCount === quantity ? 'Alternatif Ürün' : `${altItemsCount}/${quantity} Alt`}
                              </Text>
                            </View>
                          )}
                          {isCancelledLine && !isAltLine && (
                            <View style={styles.badgeRed}>
                              <MaterialCommunityIcons name="close" size={10} color="#B91C1C" />
                              <Text style={styles.badgeRedText}>
                                {cancelledItemsCount === quantity ? 'Tedarik Edilemedi' : `${cancelledItemsCount}/${quantity} İptal`}
                              </Text>
                            </View>
                          )}
                          {isCauseOfCancel && (
                            <View style={styles.badgeCauseCancel}>
                              <Text style={styles.badgeCauseCancelText}>
                                İptale Sebep Olan Ürün
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={[styles.itemUnitPrice, isCancelledLine && !isAltLine && styles.lineThroughText]}>
                          {quantity} × {unitPrice.toFixed(2)} ₺
                        </Text>
                      </View>

                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={[styles.itemTotalPrice, isCancelledLine && !isAltLine && styles.lineThroughText]}>
                          {totalPrice.toFixed(2)} ₺
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noItemsText}>Siparişe ait ürün kalemi bilgisi bulunamadı.</Text>
              )}
            </Card>

            {/* 5. Mali Döküm & Marketin Kazancı */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Müşteri Ödedi:</Text>
                <Text style={styles.summaryVal}>{(order.totalPrice || 0).toFixed(2)} ₺</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Trendyol İndirimi:</Text>
                <Text style={[styles.summaryVal, { color: '#059669' }]}>
                  + {(order.totalDiscount || 0).toFixed(2)} ₺
                </Text>
              </View>
              {order.totalCargo ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Teslimat Ücreti:</Text>
                  <Text style={styles.summaryVal}>{(order.totalCargo || 0).toFixed(2)} ₺</Text>
                </View>
              ) : null}
              {sellerPromoCost > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#DC2626' }]}>
                    Satıcı Promo Maliyeti:
                  </Text>
                  <Text style={[styles.summaryVal, { color: '#DC2626', fontWeight: 'bold' }]}>
                    - {sellerPromoCost.toFixed(2)} ₺
                  </Text>
                </View>
              )}

              {/* Marketin Kazancı (Brüt Net) */}
              <View style={styles.marketProfitBox}>
                <Text style={styles.marketProfitTitle}>MARKETİN KAZANCI</Text>
                <Text style={styles.marketProfitVal}>
                  {(order.grossAmount || order.totalPrice || 0).toFixed(2)} ₺
                </Text>
              </View>
            </Card>

            {/* 6. Ham API JSON İnceleyici Butonu */}
            <TouchableOpacity
              style={styles.rawJsonToggleBtn}
              onPress={() => setShowRawJson(!showRawJson)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={showRawJson ? 'code-tags-check' : 'code-json'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.rawJsonToggleText}>
                {showRawJson ? 'Ham JSON Gizle' : 'Ham API JSON Verisini Gör'}
              </Text>
            </TouchableOpacity>

            {showRawJson && (
              <View style={styles.rawJsonBox}>
                <Text style={styles.rawJsonText}>
                  {JSON.stringify(order, null, 2)}
                </Text>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>

      {/* Görsel Büyütme Modalı */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseBtn}
            onPress={() => setSelectedImage(null)}
          >
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalFull}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  orderDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  closeBtn: {
    backgroundColor: '#374151',
    padding: 4,
    borderRadius: 2,
  },
  content: {
    padding: 10,
  },
  // İptal Banner'ı
  cancelBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#EF4444',
    padding: 10,
    borderRadius: 3,
    marginBottom: 8,
    gap: 6,
  },
  cancelBannerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cancelIconCircle: {
    backgroundColor: '#DC2626',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelTexts: {
    flex: 1,
  },
  cancelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#B91C1C',
    letterSpacing: 0.5,
  },
  cancelTypeBadge: {
    backgroundColor: '#FECACA',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  cancelTypeBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#991B1B',
    textTransform: 'uppercase',
  },
  cancelReasonDesc: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7F1D1D',
    marginTop: 2,
  },
  cancelAgentBox: {
    borderTopWidth: 1,
    borderTopColor: '#FCA5A5',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelAgentLabel: {
    fontSize: 10,
    color: '#991B1B',
  },
  cancelAgentVal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7F1D1D',
  },
  // Timeline
  timelineCard: {
    padding: 10,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  timelineNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  timelineNodeDone: {
    backgroundColor: '#10B981',
  },
  timelineNodeNum: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  timelineLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '500',
  },
  timelineLabelDone: {
    color: '#111827',
    fontWeight: 'bold',
  },
  // Info & Kurye
  infoCard: {
    padding: 10,
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  courierBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    borderRadius: 3,
    marginBottom: 6,
  },
  courierStatusOk: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#047857',
  },
  courierStatusAlert: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#EA580C',
  },
  courierStatusWait: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  courierDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 4,
  },
  courierNameText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  courierPhoneText: {
    fontSize: 10,
    color: '#2563EB',
  },
  noteBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  noteLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  noteText: {
    fontSize: 11,
    color: '#78350F',
    fontStyle: 'italic',
    marginTop: 2,
  },
  customerBox: {
    paddingTop: 4,
  },
  customerName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  addressText: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 1,
  },
  addressDesc: {
    fontSize: 9,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  // Items
  itemsCard: {
    padding: 10,
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  thText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemRowAlt: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  itemRowCancelled: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  itemRowCancelCause: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  itemQty: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  itemName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  itemNameAlt: {
    color: '#78350F',
    fontWeight: '900',
  },
  itemNameCancelled: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  altItemNoticeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 1,
  },
  lineThroughText: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  itemBarcode: {
    fontSize: 9,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  lineBadgesRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  badgeAmber: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  badgeAmberText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#B45309',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  badgeRedText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#B91C1C',
  },
  badgeCauseCancel: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  badgeCauseCancelText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  itemUnitPrice: {
    fontSize: 10,
    color: '#6B7280',
  },
  itemTotalPrice: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  noItemsText: {
    fontSize: 10,
    color: '#9CA3AF',
    paddingVertical: 8,
    textAlign: 'center',
  },
  // Summary
  summaryCard: {
    padding: 10,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  summaryVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  marketProfitBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    marginTop: 6,
  },
  marketProfitTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
  },
  marketProfitVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#047857',
  },
  // Raw Json
  rawJsonToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 8,
    borderRadius: 3,
  },
  rawJsonToggleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
  },
  rawJsonBox: {
    backgroundColor: '#111827',
    padding: 8,
    borderRadius: 3,
    marginTop: 6,
  },
  rawJsonText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#34D399',
  },
  itemImageBtn: {
    width: 44,
    height: 44,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevStockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  prevStockChipText: {
    fontSize: 9,
    color: '#4B5563',
  },
  prevStockChipBold: {
    fontWeight: 'bold',
    color: '#111827',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  imageModalFull: {
    width: '90%',
    height: '70%',
  },
});
