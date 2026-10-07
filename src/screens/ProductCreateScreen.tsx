import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { productsService, barcodeService } from '../api/services';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { BarcodeScannerModal } from '../components/common/BarcodeScannerModal';

const POPULAR_BRANDS = ['Eti', 'Ülker', 'Sütaş', 'Pınar', 'Torku', 'Coca-Cola', 'Fairy', 'Ariel', 'Lipton'];
const POPULAR_CATEGORIES = ['Çikolata', 'Bisküvi', 'Süt', 'Cips', 'Deterjan', 'Peynir', 'Çay', 'Kahve', 'Su'];

export const ProductCreateScreen: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [barcode, setBarcode] = useState('');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [vatRate, setVatRate] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Kameradan Barkod Tarandı
  const handleScannedBarcode = async (scanned: string) => {
    setBarcode(scanned);
    setSearchingBarcode(true);
    try {
      const res = await barcodeService.searchBarcode(scanned);
      if (res && res.found) {
        if (res.title) setTitle(res.title);
        if (res.brand) setBrand(res.brand);
        if (res.category) setCategory(res.category);
        Alert.alert('Bilgi Bulundu', `Ürün bilgileri otomatik dolduruldu: ${res.title || ''}`);
      }
    } catch {
      // sessizce geç
    } finally {
      setSearchingBarcode(false);
    }
  };

  // Rastgele Barkod Üret
  const handleGenerateBarcode = () => {
    const randomEan = '869' + Math.floor(1000000000 + Math.random() * 9000000000).toString().slice(0, 10);
    setBarcode(randomEan);
  };

  // Barkoddan Otomatik Doldur
  const handleAutoFillFromBarcode = async () => {
    Keyboard.dismiss();
    const clean = barcode.trim();
    if (!clean) {
      Alert.alert('Uyarı', 'Lütfen önce bir barkod girin.');
      return;
    }

    setSearchingBarcode(true);
    try {
      const res = await barcodeService.searchBarcode(clean);
      if (res && res.found) {
        if (res.title) setTitle(res.title);
        if (res.brand) setBrand(res.brand);
        if (res.category) setCategory(res.category);
        Alert.alert('Bilgi Bulundu', `Açık katalogdan ürün bilgileri getirildi: ${res.title || ''}`);
      } else {
        Alert.alert('Bulunamadı', 'Bu barkoda ait hazır ürün kaydı bulunamadı. Lütfen manuel giriniz.');
      }
    } catch {
      Alert.alert('Hata', 'Barkod sorgulanamadı.');
    } finally {
      setSearchingBarcode(false);
    }
  };

  const handleCreate = async () => {
    if (!barcode.trim()) {
      Alert.alert('Hata', 'Barkod alanı zorunludur.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Hata', 'Ürün adı zorunludur.');
      return;
    }
    const parsedPrice = parseFloat(price.replace(',', '.'));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Hata', 'Geçerli bir satış fiyatı giriniz.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        barcode: barcode.trim(),
        title: title.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        sellingPrice: parsedPrice,
        quantity: parseInt(quantity, 10) || 0,
        vatRate,
      };

      const res = await productsService.createProduct(payload);

      if (res && res.success) {
        Alert.alert('Başarılı', res.message || 'Ürün Trendyol Go kataloğuna eklendi.');
        // Formu temizle
        setBarcode('');
        setTitle('');
        setBrand('');
        setCategory('');
        setPrice('');
        if (onSuccess) onSuccess();
      } else {
        Alert.alert('Uyarı', res?.message || 'Ürün ekleme işlemi tamamlanamadı.');
      }
    } catch (err: any) {
      Alert.alert('Sunucu Hatası', err.response?.data?.message || err.message || 'Ürün eklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <View style={styles.formHeader}>
          <MaterialCommunityIcons name="cube-send" size={20} color={colors.textPrimary} />
          <Text style={styles.formTitle}>Trendyol Go Yeni Ürün Ekle</Text>
        </View>

        {/* Barkod Alanı & Kısayollar */}
        <Input
          label="Ürün Barkodu (EAN / UPC)"
          placeholder="8690000000000"
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="number-pad"
        />

        <View style={styles.barcodeActionsRow}>
          <TouchableOpacity onPress={() => setScannerVisible(true)} style={styles.smallActionBtn}>
            <MaterialCommunityIcons name="camera" size={13} color={colors.textPrimary} />
            <Text style={styles.smallActionText}>Kamera ile Tara</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleGenerateBarcode} style={styles.smallActionBtn}>
            <MaterialCommunityIcons name="auto-fix" size={13} color={colors.textPrimary} />
            <Text style={styles.smallActionText}>Barkod Üret</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleAutoFillFromBarcode} style={styles.smallActionBtn}>
            {searchingBarcode ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="cloud-search-outline" size={13} color={colors.textPrimary} />
                <Text style={styles.smallActionText}>Katalogda Ara</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Ürün Adı */}
        <Input
          label="Ürün Adı / Başlığı"
          placeholder="Örn: Eti Karam Gurme 50 Gr"
          value={title}
          onChangeText={setTitle}
        />

        {/* Marka & Öneriler */}
        <Input
          label="Marka"
          placeholder="Örn: Eti, Ülker, Pınar"
          value={brand}
          onChangeText={setBrand}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {POPULAR_BRANDS.map((b, idx) => (
            <TouchableOpacity key={idx} onPress={() => setBrand(b)} style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Kategori & Öneriler */}
        <Input
          label="Kategori"
          placeholder="Örn: Çikolata, Bisküvi"
          value={category}
          onChangeText={setCategory}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {POPULAR_CATEGORIES.map((c, idx) => (
            <TouchableOpacity key={idx} onPress={() => setCategory(c)} style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Fiyat ve Stok */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Input
              label="Satış Fiyatı (₺)"
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.col}>
            <Input
              label="Başlangıç Stoğu"
              placeholder="10"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* KDV Oranı Seçimi */}
        <Text style={styles.vatLabel}>KDV Oranı</Text>
        <View style={styles.vatRow}>
          {[1, 10, 20].map((rate) => (
            <TouchableOpacity
              key={rate}
              onPress={() => setVatRate(rate)}
              style={[styles.vatChip, vatRate === rate && styles.vatChipActive]}
            >
              <Text style={[styles.vatChipText, vatRate === rate && styles.vatChipTextActive]}>
                %{rate}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ekle Butonu */}
        <Button
          title="Trendyol Go Kataloğuna Gönder"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
          style={styles.submitBtn}
          icon={<MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#FFF" />}
        />
      </Card>

      {/* Kamera Barkod Tarayıcı Modalı */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScannedBarcode}
        title="ÜRÜN BARKODU TARA"
        subtitle="Barkodu hizalayarak ürün bilgilerini otomatik doldurun"
      />
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
  formCard: {
    marginBottom: 24,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.surfaceSubtle,
  },
  formTitle: {
    ...typography.h3,
    fontSize: 16,
  },
  barcodeActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -6,
    marginBottom: 12,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radiusSm,
    gap: 4,
  },
  smallActionText: {
    ...typography.tiny,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  suggestionsScroll: {
    flexDirection: 'row',
    marginTop: -8,
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: layout.radiusSm,
    marginRight: 6,
  },
  suggestionText: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  vatLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  vatRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  vatChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: layout.radiusSm,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  vatChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  vatChipText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  vatChipTextActive: {
    color: '#FFF',
  },
  submitBtn: {
    marginTop: 6,
  },
});
