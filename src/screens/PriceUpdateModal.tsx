import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { ProductStockItem } from '../types/api';
import { stocksService } from '../api/services';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

interface PriceUpdateModalProps {
  product: ProductStockItem | null;
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  targetStoreId?: string;
}

export const PriceUpdateModal: React.FC<PriceUpdateModalProps> = ({
  product,
  visible,
  onClose,
  onSuccess,
  targetStoreId,
}) => {
  if (!product) return null;

  // Mevcut ilk fiyatı bul
  const currentPrice = Object.values(product.stocks || {}).find((s) => s.sellingPrice)?.sellingPrice || 0;
  const currentQty = Object.values(product.stocks || {}).find((s) => typeof s.quantity === 'number')?.quantity || 0;

  const [priceInput, setPriceInput] = useState('');
  const [stockInput, setStockInput] = useState('');
  const [onSale, setOnSale] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && product) {
      setPriceInput(currentPrice ? currentPrice.toString() : '');
      setStockInput(currentQty ? currentQty.toString() : '');
      setOnSale(true);
    }
  }, [visible, product]);

  const handleApplyPercentage = (percent: number) => {
    const base = parseFloat(priceInput) || currentPrice || 0;
    if (base > 0) {
      const newPrice = (base * (1 + percent / 100)).toFixed(2);
      setPriceInput(newPrice);
    }
  };

  const handleUpdate = async () => {
    const parsedPrice = parseFloat(priceInput.replace(',', '.'));
    const parsedQty = stockInput ? parseInt(stockInput, 10) : undefined;

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Geçersiz Fiyat', 'Lütfen 0 dan büyük geçerli bir satış fiyatı girin.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        barcode: product.barcode,
        sellingPrice: parsedPrice,
        onSale,
      };

      if (parsedQty !== undefined && !isNaN(parsedQty)) {
        payload.quantity = parsedQty;
      }

      const res = await stocksService.updatePrice([payload]);

      if (res.success) {
        Alert.alert('Başarılı', `Fiyat güncelleme isteği Trendyol Go kuyruğuna alındı. (Batch: ${res.batchRequestId || 'Tamamlandı'})`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        Alert.alert('Hata', res.message || 'Fiyat güncellenemedi.');
      }
    } catch (err: any) {
      Alert.alert('Sunucu Hatası', err.response?.data?.error || err.message || 'İstek gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Başlık */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="tag-edit-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.title}>Fiyat & Stok Güncelle</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Ürün Künyesi */}
            <View style={styles.productInfoBox}>
              <Text style={styles.productTitle}>{product.title}</Text>
              <View style={styles.barcodeRow}>
                <Text style={styles.barcodeText}>Barkod: {product.barcode}</Text>
                {product.brand && <Text style={styles.brandText}>• {product.brand}</Text>}
              </View>
            </View>

            {/* Fiyat Girişi */}
            <Input
              label="Yeni Satış Fiyatı (₺)"
              placeholder="0.00"
              value={priceInput}
              onChangeText={setPriceInput}
              keyboardType="decimal-pad"
            />

            {/* Hızlı Yüzde Butonları */}
            <View style={styles.quickPercentRow}>
              <TouchableOpacity onPress={() => handleApplyPercentage(5)} style={styles.percentBtn}>
                <Text style={styles.percentText}>+%5</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleApplyPercentage(10)} style={styles.percentBtn}>
                <Text style={styles.percentText}>+%10</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleApplyPercentage(20)} style={styles.percentBtn}>
                <Text style={styles.percentText}>+%20</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleApplyPercentage(-5)} style={styles.percentBtn}>
                <Text style={styles.percentText}>-%5</Text>
              </TouchableOpacity>
            </View>

            {/* Stok Girişi */}
            <Input
              label="Stok Adedi (Boş bırakılırsa mevcut stok korunur)"
              placeholder="Adet girin..."
              value={stockInput}
              onChangeText={setStockInput}
              keyboardType="number-pad"
            />

            {/* Satışta mı Switch */}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Satış Durumu</Text>
                <Text style={styles.switchSub}>{onSale ? 'Ürün Trendyol üzerinde aktif satışta' : 'Ürün satışa kapalı (Gizli)'}</Text>
              </View>
              <Switch
                value={onSale}
                onValueChange={setOnSale}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* Kaydet Butonu */}
            <Button
              title="Trendyol Go'ya Gönder"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={handleUpdate}
              style={styles.submitBtn}
              icon={<MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#FFF" />}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: layout.radiusMd,
    borderTopRightRadius: layout.radiusMd,
    maxHeight: '85%',
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...typography.h3,
    fontSize: 16,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  productInfoBox: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: layout.radiusSm,
    padding: 12,
    marginBottom: 16,
  },
  productTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  barcodeText: {
    ...typography.tiny,
    fontFamily: 'monospace',
    color: colors.textMuted,
  },
  brandText: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  quickPercentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -4,
    marginBottom: 14,
  },
  percentBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: layout.radiusSm,
  },
  percentText: {
    ...typography.tiny,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.surfaceSubtle,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.surfaceSubtle,
    marginVertical: 12,
  },
  switchLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  switchSub: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 8,
    marginBottom: 20,
  },
});
