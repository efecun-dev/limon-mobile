# 🍋 Limon Mobile (Enterprise Expo App)

Limon Central API ile tam entegre, **Trendyol Go Hızlı Market** operasyonları için geliştirilmiş resmi, beyaz temalı, kurumsal mobil uygulamadır.

---

## 🏛 Tasarım İlkeleri
- **Kurumsal & Resmi Beyaz Tema:** Zemin `#FFFFFF` ve `#F8FAFC`, başlıklar ve birincil aksiyonlar koyu kurumsal slate (`#0F172A`).
- **Gölgesiz & Keskin Hatlar:** Aşırı yuvarlak hap butonlar veya yoğun `box-shadow` kullanılmamıştır; yerine net, zarif `1px` kurumsal sınır çizgileri (`#E2E8F0`) ve `borderRadius: 4-6px` kullanılmıştır.
- **Sıfır Mock Veri:** Uygulamadaki hiçbir veri sahte (mock) değildir. Tüm siparişler, şubeler, stoklar, iadeler ve fiyat güncellemeleri doğrudan Limon Server API'sinden çekilir.

---

## 🚀 Çalıştırma

### Kök Dizinden:
```bash
npm run mobile:start
```

### `mobile` Dizininden:
```bash
cd mobile
npx expo start
```

- **Android Cihaz/Emülatör:** `a` tuşuna basın.
- **iOS Simülatör (macOS):** `i` tuşuna basın.
- **Fiziksel Cihazda Test:** Telefonunuzda **Expo Go** uygulamasını açıp QR kodu taratın.
- **Web Tarayıcı:** `w` tuşuna basın.

---

## 🌐 VPS Sunucu Bağlantısı & Dağıtım

1. Uygulama açılışında sağ üstteki **"Sunucu Ayarları"** (Çark / IP Rozeti) butonuna tıklayın.
2. VPS sunucunuzun IP ve portunu girin:
   - Örn: `http://192.168.1.50:3001` veya `https://api.siteniz.com`
   - Android Emülatör için: `http://10.0.2.2:3001`
   - Web / iOS Simülatör için: `http://localhost:3001`
3. **"Bağlantıyı Sına"** butonuna basarak anlık gecikme (ms) ve sağlık durumunu test edin.
4. **"Kaydet ve Uygula"** butonuna bastığınızda ayar cihaz hafızasında kalıcı olarak saklanır.

---

## 📱 Özellikler
1. **Canlı Sipariş Yönetimi (`OrdersScreen`):**
   - Trendyol Go paket siparişleri, durum filtreleri (`Created`, `Picking`, `Shipped`, `Delivered`, `Cancelled`).
   - Müşteri notu, sepet kalemleri, kurye yakınlık rozeti (`isCourierNearby`).
2. **12 Şube Açık / Kapalı Kontrolü (`BranchesScreen`):**
   - Şubelerin anlık açık/kapalı durumu, teslimat süreleri.
   - Tek tuşla anlık şubeyi açma / kapatma yetkisi (`PUT /api/subeler`).
3. **Stok & Fiyat Matrisi (`StocksScreen`):**
   - Çoklu şube stok adedi ve fiyat matriksi.
   - Kritik stok (≤5) ve tükenenler (0) filtreleri.
   - **Anlık Fiyat & Stok Güncelleme:** Trendyol Go API'ye anlık fiyat push etme.
4. **İade Talepleri (`ClaimsScreen`):**
   - Müşteri iade sebepleri, SKT/hasar fotoğrafları, onay durumları.
5. **Barkod Sorgulama (`BarcodeSearchScreen`):**
   - Barkoddan açık veritabanları üzerinden ürün fotoğrafı, isim ve marka sorgulama.
6. **Sistem Sağlığı & Ayarlar (`MoreMenuScreen`):**
   - Gerçek zamanlı VPS uptime, Redis durumu, versiyon ve bağlantı gecikmesi (latency).
