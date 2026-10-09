import React, { useState, useEffect, useMemo } from 'react';
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
import { productsService, barcodeService, stocksService } from '../api/services';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { BarcodeScannerModal } from '../components/common/BarcodeScannerModal';

export const POPULAR_BRANDS = [
  'Eti',
  'Ülker',
  'Sütaş',
  'Pınar',
  'Torku',
  'Coca-Cola',
  'Pepsi',
  'Fanta',
  'Sprite',
  'Fairy',
  'Ariel',
  'Omo',
  'Domestos',
  'Cif',
  'Lipton',
  'Doğuş',
  'Çaykur',
  'Nescafe',
  'Kızılay',
  'Beypazarı',
  'Erikli',
  'Sırma',
  'Duru',
  'Komili',
  'Yudum',
  'Tat',
  'Öncü',
  'Barilla',
  'Filiz',
  'Pastavilla',
  'Knorr',
  'Calve',
  'Heinz',
  'Danone',
  'İçim',
  'Sek',
  'Yörsan',
  'Namet',
  'Cumhuriyet',
  'Polonez',
  'Şahin',
  'Banvit',
  'Şenpiliç',
  'Prima',
  'Sleepy',
  'Molfix',
  'Familia',
  'Papia',
  'Selpak',
  'Solo',
  'Sensodyne',
  'Colgate',
  'Signal',
  'Ipana',
  'Pantene',
  'Elidor',
  'Head & Shoulders',
  'Clear',
  'Dove',
  'Nivea',
  'Palmolive',
  'Rexona',
  'Gillette',
  'Finish',
  'Pril',
  'Vernel',
  'Yumoş',
  'Bingo',
  'Dardanel',
  'Dr. Oetker',
  'Kent',
  'Haribo',
  'Lay\'s',
  'Doritos',
  'Ruffles',
  'Pringles',
  'Çerezza',
  'Tadım',
  'Peyman',
  'Koska',
  'Nutella',
  'Balparmak',
];

export const TRENDYOL_CATEGORIES = [
  'Atıştırmalık',
  'Çikolata & Gofret',
  'Bisküvi & Kek',
  'Cips & Çerez',
  'Şekerleme & Sakız',
  'Süt & Kahvaltılık',
  'Süt & Ayran',
  'Peynir & Kaşar',
  'Yoğurt & Tereyağı',
  'Zeytin & Reçel & Bal',
  'Yumurta',
  'Temel Gıda',
  'Sıvı Yağ & Margarin',
  'Salça & Sos & Baharat',
  'Bakliyat & Pirinç',
  'Makarna & Erişte',
  'Un & Şeker & Tuz',
  'Hazır Çorba & Harç',
  'Konserve & Turşu',
  'Fırın & Ekmek & Pastane',
  'Ekmek & Unlu Mamuller',
  'Şarküteri & Et & Tavuk',
  'Sucuk, Salam & Sosis',
  'Kırmızı Et & Kıyma',
  'Tavuk & Hindi',
  'Meyve & Sebze',
  'Meyveler',
  'Sebzeler',
  'Yeşillik & Salata',
  'İçecekler',
  'Su & Maden Suyu',
  'Gazlı İçecek & Kola',
  'Meyve Suyu & Nektar',
  'Soğuk Çay & Kahve',
  'Çay & Bitki Çayı',
  'Kahve & Sıcak Çikolata',
  'Dondurulmuş & Hazır Yemek',
  'Dondurma',
  'Temizlik & Ev Bakımı',
  'Bulaşık Deterjanı',
  'Çamaşır Deterjanı & Yumuşatıcı',
  'Ev Temizliği & Hijyen',
  'Kağıt Havlu & Tuvalet Kağıdı',
  'Kişisel Bakım & Kozmetik',
  'Şampuan & Saç Bakımı',
  'Sabun & Duş Jeli',
  'Ağız & Diş Bakımı',
  'Deodorant & Parfüm',
  'Bebek & Anne',
  'Bebek Bezi & Islak Mendil',
  'Bebek Maması & Devam Sütü',
  'Evcil Hayvan',
];

export function resolveCategoryName(rawCategory: any, rawCategoryName?: any): string {
  if (rawCategoryName && typeof rawCategoryName === 'string' && rawCategoryName.trim()) {
    return rawCategoryName.trim();
  }
  if (!rawCategory) return '';
  const str = String(rawCategory).trim();
  if (!str) return '';

  const exactMatch = TRENDYOL_CATEGORIES.find((c) => c.toLowerCase() === str.toLowerCase());
  if (exactMatch) return exactMatch;

  const numeric = str.replace(/[^0-9]/g, '');
  if (numeric) {
    const codeMap: Record<string, string> = {
      '408': 'Atıştırmalık',
      '409': 'Çikolata & Gofret',
      '410': 'Bisküvi & Kek',
      '411': 'İçecekler',
      '412': 'Süt & Kahvaltılık',
      '413': 'Temel Gıda',
      '414': 'Meyve & Sebze',
      '415': 'Fırın & Ekmek & Pastane',
      '416': 'Şarküteri & Et & Tavuk',
      '417': 'Temizlik & Ev Bakımı',
      '418': 'Kişisel Bakım & Kozmetik',
      '419': 'Bebek & Anne',
      '420': 'Dondurulmuş & Hazır Yemek',
    };
    if (codeMap[numeric]) return codeMap[numeric];
  }

  if (/^\d+$/.test(str)) {
    return 'Temel Gıda';
  }

  return str;
}

export const ProductCreateScreen: React.FC<{
  onSuccess?: () => void;
  initialData?: {
    barcode?: string;
    title?: string;
    brand?: string;
    category?: string;
  } | null;
}> = ({ onSuccess, initialData }) => {
  const [barcode, setBarcode] = useState(initialData?.barcode || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [vatRate, setVatRate] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Combobox durumları
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    if (initialData) {
      if (initialData.barcode) setBarcode(initialData.barcode);
      if (initialData.title) setTitle(initialData.title);
      if (initialData.brand) setBrand(initialData.brand);
      if (initialData.category) setCategory(resolveCategoryName(initialData.category));
    }
  }, [initialData]);

  // Filtrelenmiş Markalar
  const filteredBrands = useMemo(() => {
    const q = brand.trim().toLowerCase();
    if (!q) return POPULAR_BRANDS;
    return POPULAR_BRANDS.filter((b) => b.toLowerCase().includes(q));
  }, [brand]);

  // Filtrelenmiş Kategoriler
  const filteredCategories = useMemo(() => {
    const q = category.trim().toLowerCase();
    if (!q) return TRENDYOL_CATEGORIES;
    return TRENDYOL_CATEGORIES.filter((c) => c.toLowerCase().includes(q));
  }, [category]);

  // Barkoddan Otomatik Doldur
  const handleAutoFillFromBarcode = async (customBarcode?: string) => {
    Keyboard.dismiss();
    const clean = (customBarcode || barcode).trim();
    if (!clean) {
      Alert.alert('Uyarı', 'Lütfen önce bir barkod girin.');
      return;
    }

    setSearchingBarcode(true);
    try {
      // 1. Barkod arama servisi
      const res = await barcodeService.searchBarcode(clean);
      if (res && res.found) {
        if (res.title) setTitle(res.title);
        if (res.brand) setBrand(res.brand);
        const resolved = resolveCategoryName(res.category, (res as any).categoryName);
        if (resolved) setCategory(resolved);
        Alert.alert('Bilgi Bulundu', `Açık katalogdan ürün bilgileri getirildi:\n${res.title || ''}`);
        return;
      }

      // 2. Limon Stoklarında Ara
      const stockRes = await stocksService.getStocks({ barcode: clean, size: 5, page: 0 }).catch(() => null);
      const items = (stockRes as any)?.content || (Array.isArray(stockRes) ? stockRes : []);
      if (items.length > 0 && items[0]) {
        const item = items[0];
        if (item.title) setTitle(item.title);
        if (item.brand) setBrand(item.brand);
        if (item.category) setCategory(resolveCategoryName(item.category));
        Alert.alert('Bilgi Bulundu', `Mevcut mağaza stoğundan ürün bilgileri getirildi:\n${item.title || ''}`);
        return;
      }

      Alert.alert('Bulunamadı', 'Bu barkoda ait hazır ürün kaydı bulunamadı. Lütfen manuel doldurunuz.');
    } catch {
      Alert.alert('Hata', 'Barkod sorgulanamadı.');
    } finally {
      setSearchingBarcode(false);
    }
  };

  // Kameradan Barkod Tarandı
  const handleScannedBarcode = async (scanned: string) => {
    setScannerVisible(false);
    setBarcode(scanned);
    await handleAutoFillFromBarcode(scanned);
  };

  // Rastgele Barkod Üret
  const handleGenerateBarcode = () => {
    const randomEan = '869' + Math.floor(1000000000 + Math.random() * 9000000000).toString().slice(0, 10);
    setBarcode(randomEan);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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

        {/* Ekrana Tam Sığan 3'lü Eşit Buton Sırası */}
        <View style={styles.barcodeActionsRow}>
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            style={styles.smallActionBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="camera" size={13} color={colors.textPrimary} />
            <Text style={styles.smallActionText} numberOfLines={1}>
              Kamera Tara
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGenerateBarcode}
            style={styles.smallActionBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="auto-fix" size={13} color={colors.textPrimary} />
            <Text style={styles.smallActionText} numberOfLines={1}>
              Barkod Üret
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleAutoFillFromBarcode()}
            style={styles.smallActionBtn}
            disabled={searchingBarcode}
            activeOpacity={0.7}
          >
            {searchingBarcode ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="cloud-search-outline" size={13} color={colors.textPrimary} />
                <Text style={styles.smallActionText} numberOfLines={1}>
                  Katalogda Ara
                </Text>
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

        {/* Marka Combobox */}
        <View style={styles.comboboxWrapper}>
          <Input
            label="Marka"
            placeholder="Marka seçin veya yazın..."
            value={brand}
            onChangeText={(txt) => {
              setBrand(txt);
              setBrandDropdownOpen(true);
            }}
            onFocus={() => setBrandDropdownOpen(true)}
            rightElement={
              <TouchableOpacity
                onPress={() => setBrandDropdownOpen(!brandDropdownOpen)}
                style={styles.comboboxToggleBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={brandDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            }
          />
          {brandDropdownOpen && filteredBrands.length > 0 && (
            <View style={styles.dropdownContainer}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                style={styles.dropdownScroll}
              >
                {filteredBrands.slice(0, 15).map((b, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setBrand(b);
                      setBrandDropdownOpen(false);
                      Keyboard.dismiss();
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text style={styles.dropdownItemText}>{b}</Text>
                    {brand.toLowerCase() === b.toLowerCase() && (
                      <MaterialCommunityIcons name="check" size={14} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Hızlı Marka Çipleri */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {POPULAR_BRANDS.slice(0, 8).map((b, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                setBrand(b);
                setBrandDropdownOpen(false);
              }}
              style={[styles.suggestionChip, brand === b && styles.suggestionChipActive]}
            >
              <Text style={[styles.suggestionText, brand === b && styles.suggestionTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Kategori Combobox */}
        <View style={styles.comboboxWrapper}>
          <Input
            label="Kategori"
            placeholder="Kategori seçin veya arayın..."
            value={category}
            onChangeText={(txt) => {
              setCategory(txt);
              setCategoryDropdownOpen(true);
            }}
            onFocus={() => setCategoryDropdownOpen(true)}
            rightElement={
              <TouchableOpacity
                onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                style={styles.comboboxToggleBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            }
          />
          {categoryDropdownOpen && filteredCategories.length > 0 && (
            <View style={styles.dropdownContainer}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                style={styles.dropdownScroll}
              >
                {filteredCategories.slice(0, 15).map((c, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setCategory(c);
                      setCategoryDropdownOpen(false);
                      Keyboard.dismiss();
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text style={styles.dropdownItemText}>{c}</Text>
                    {category.toLowerCase() === c.toLowerCase() && (
                      <MaterialCommunityIcons name="check" size={14} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Hızlı Kategori Çipleri */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {TRENDYOL_CATEGORIES.slice(0, 8).map((c, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                setCategory(c);
                setCategoryDropdownOpen(false);
              }}
              style={[styles.suggestionChip, category === c && styles.suggestionChipActive]}
            >
              <Text style={[styles.suggestionText, category === c && styles.suggestionTextActive]}>{c}</Text>
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

        {/* KDV Oranı Seçimi (%0, %1, %10, %20) */}
        <Text style={styles.vatLabel}>KDV Oranı</Text>
        <View style={styles.vatRow}>
          {[0, 1, 10, 20].map((rate) => (
            <TouchableOpacity
              key={rate}
              onPress={() => setVatRate(rate)}
              style={[styles.vatChip, vatRate === rate && styles.vatChipActive]}
              activeOpacity={0.7}
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
        subtitle="Barkodu çerçevenin içine hizalayarak tarayın"
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
    padding: 14,
    paddingBottom: 30,
  },
  formCard: {
    marginBottom: 20,
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
    fontSize: 15,
  },
  barcodeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
  },
  smallActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: 4,
    paddingVertical: 7,
    borderRadius: layout.radiusSm,
    gap: 4,
  },
  smallActionText: {
    ...typography.tiny,
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  comboboxWrapper: {
    position: 'relative',
    marginBottom: 2,
    zIndex: 10,
  },
  comboboxToggleBtn: {
    padding: 4,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radiusSm,
    marginTop: -8,
    marginBottom: 10,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    ...typography.body,
    fontSize: 12,
    color: colors.textPrimary,
  },
  suggestionsScroll: {
    flexDirection: 'row',
    marginTop: 0,
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
  suggestionChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  suggestionText: {
    ...typography.tiny,
    color: colors.textSecondary,
  },
  suggestionTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
