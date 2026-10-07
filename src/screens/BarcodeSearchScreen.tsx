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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { barcodeService } from '../api/services';
import { BarcodeSearchResult } from '../types/api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { BarcodeScannerModal } from '../components/common/BarcodeScannerModal';

export const BarcodeSearchScreen: React.FC<{
  onFindInStock?: (barcode: string) => void;
}> = ({ onFindInStock }) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BarcodeSearchResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const handleSearchWithBarcode = async (barcodeToSearch: string) => {
    Keyboard.dismiss();
    const clean = barcodeToSearch.trim();
    if (!clean) return;

    setLoading(true);
    setSearched(true);
    setResult(null);

    try {
      const res = await barcodeService.searchBarcode(clean);
      setResult(res);
    } catch (err: any) {
      setResult({
        found: false,
        barcode: clean,
        error: err.response?.data?.error || 'Arama servisine ulaşılamadı.',
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.searchCard}>
        <Text style={styles.cardTitle}>Barkod Arama & Doğrulama</Text>
        <Text style={styles.cardDesc}>
          Barkod numarasını kamerayla tarayarak veya manuel girerek ürünün görselini, başlığını ve marka bilgisini açık veritabanlarından sorgulayın.
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

      {/* Sonuç Alanı */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Ürün bilgisi ve görsel aranıyor...</Text>
        </View>
      ) : result && result.found ? (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.badgeSuccess}>
              <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
              <Text style={styles.badgeSuccessText}>Kayıt Bulundu</Text>
            </View>
            <Text style={styles.sourceText}>Kaynak: {result.source || 'Açık Katalog'}</Text>
          </View>

          {/* Görsel */}
          {result.imageUrl ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: result.imageUrl }} style={styles.productImage} resizeMode="contain" />
            </View>
          ) : (
            <View style={styles.noImageWrapper}>
              <MaterialCommunityIcons name="image-off-outline" size={32} color={colors.textMuted} />
              <Text style={styles.noImageText}>Görsel mevcut değil</Text>
            </View>
          )}

          {/* Ürün Detayları */}
          <Text style={styles.productTitle}>{result.title || 'Başlık Bilgisi Yok'}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Barkod:</Text>
            <Text style={styles.detailVal}>{result.barcode}</Text>
          </View>

          {result.brand ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Marka:</Text>
              <Text style={styles.detailVal}>{result.brand}</Text>
            </View>
          ) : null}

          {result.category ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kategori:</Text>
              <Text style={styles.detailVal}>{result.category}</Text>
            </View>
          ) : null}

          {onFindInStock && (
            <Button
              title="Bu Ürünü Limon Stoklarında Göster"
              variant="outline"
              size="md"
              onPress={() => onFindInStock(result.barcode)}
              style={styles.stockActionBtn}
              icon={<MaterialCommunityIcons name="cube-scan" size={16} color={colors.textPrimary} />}
            />
          )}
        </Card>
      ) : searched && result && !result.found ? (
        <Card style={styles.notFoundCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.warning} />
          <Text style={styles.notFoundTitle}>Ürün Bulunamadı</Text>
          <Text style={styles.notFoundDesc}>
            {result.message || 'Bu barkoda ait ürün açık veritabanlarında eşleşmedi.'}
          </Text>
        </Card>
      ) : null}
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
    marginBottom: 20,
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
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  stockActionBtn: {
    marginTop: 14,
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
