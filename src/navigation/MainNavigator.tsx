import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { Header } from '../components/common/Header';
import { ServerConfigModal } from '../components/common/ServerConfigModal';
import { BranchPickerModal } from '../components/common/BranchPickerModal';
import { ordersService, claimsService } from '../api/services';

// Ekranlar
import { DashboardScreen } from '../screens/DashboardScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { RevenueScreen } from '../screens/RevenueScreen';
import { SeviyeAnaliziScreen } from '../screens/SeviyeAnaliziScreen';
import { StocksScreen } from '../screens/StocksScreen';
import { BranchesScreen } from '../screens/BranchesScreen';
import { ClaimsScreen } from '../screens/ClaimsScreen';
import { ReviewsScreen } from '../screens/ReviewsScreen';
import { ProductCreateScreen } from '../screens/ProductCreateScreen';
import { BarcodeSearchScreen } from '../screens/BarcodeSearchScreen';
import { MoreMenuScreen } from '../screens/MoreMenuScreen';
import { RawOrdersModal } from '../screens/RawOrdersModal';
import { CancellationAnalysisScreen } from '../screens/CancellationAnalysisScreen';
import { PriceAnomalyRadarScreen } from '../screens/PriceAnomalyRadarScreen';

type MainTabKey = 'dashboard' | 'orders' | 'revenue' | 'levels' | 'stocks' | 'more';
type SubScreenKey =
  | 'branches'
  | 'claims'
  | 'reviews'
  | 'product_create'
  | 'barcode'
  | 'cancellations'
  | 'price_radar'
  | null;

interface TabItem {
  key: MainTabKey;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  badgeKey?: 'orders' | 'returns';
}

const TABS: TabItem[] = [
  { key: 'dashboard', label: 'Ana Sayfa', icon: 'view-dashboard-outline' },
  { key: 'orders', label: 'Siparişler', icon: 'shopping-outline', badgeKey: 'orders' },
  { key: 'revenue', label: 'Ciro', icon: 'chart-box-outline' },
  { key: 'levels', label: 'Seviye', icon: 'shield-star-outline' },
  { key: 'stocks', label: 'Stoklar', icon: 'cube-outline' },
  { key: 'more', label: 'Yönetim', icon: 'tune-vertical' },
];

export const MainNavigator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTabKey>('dashboard');
  const [subScreen, setSubScreen] = useState<SubScreenKey>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showRawOrdersModal, setShowRawOrdersModal] = useState(false);

  // Ekranlar arası barkod ve ürün aktarımı
  const [targetStockBarcode, setTargetStockBarcode] = useState<string | null>(null);
  const [prefillProductData, setPrefillProductData] = useState<{
    barcode?: string;
    title?: string;
    brand?: string;
    category?: string;
  } | null>(null);

  // Canlı Bildirim Sayaçları (Panel Navbar'daki stats gibi)
  const [stats, setStats] = useState({ orders: 0, returns: 0 });

  useEffect(() => {
    const fetchCounters = async () => {
      try {
        const [ordersRes, claimsRes] = await Promise.all([
          ordersService.getOrders({ size: 100, fetchDays: 2 }).catch(() => null),
          claimsService.getClaims().catch(() => null),
        ]);

        let activeOrdersCount = 0;
        if (ordersRes?.content) {
          activeOrdersCount = ordersRes.content.filter((o: any) =>
            ['Created', 'Picking', 'Invoiced', 'Shipped'].includes(o.packageStatus)
          ).length;
        }

        let activeClaimsCount = 0;
        if (claimsRes?.content) {
          activeClaimsCount = claimsRes.content.filter((c: any) => {
            const status = c.claimItems?.[0]?.claimItemStatus?.name;
            return ['Created', 'WaitingInAction', 'Unresolved'].includes(status);
          }).length;
        }

        setStats({ orders: activeOrdersCount, returns: activeClaimsCount });
      } catch {
        // Sessiz devam
      }
    };

    fetchCounters();
    const interval = setInterval(fetchCounters, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTabPress = (tabKey: MainTabKey) => {
    setActiveTab(tabKey);
    setSubScreen(null);
  };

  const renderActiveScreen = () => {
    // 1. Alt Ekranlar (Yönetim veya Dashboard İçinden Açılanlar)
    if (subScreen === 'branches') {
      return (
        <View style={styles.subScreenContainer}>
          <View style={styles.subHeader}>
            <TouchableOpacity onPress={() => setSubScreen(null)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>Şube Yönetimi (12 Şube)</Text>
            <View style={{ width: 40 }} />
          </View>
          <BranchesScreen onOpenServerSettings={() => setShowServerModal(true)} />
        </View>
      );
    }

    if (subScreen === 'claims') {
      return (
        <View style={styles.subScreenContainer}>
          <View style={styles.subHeader}>
            <TouchableOpacity onPress={() => setSubScreen(null)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>İade Talepleri Yönetimi</Text>
            <View style={{ width: 40 }} />
          </View>
          <ClaimsScreen
            onOpenServerSettings={() => setShowServerModal(true)}
            onOpenBranchPicker={() => setShowBranchModal(true)}
          />
        </View>
      );
    }

    if (subScreen === 'reviews') {
      return (
        <View style={styles.subScreenContainer}>
          <View style={styles.subHeader}>
            <TouchableOpacity onPress={() => setSubScreen(null)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>Müşteri Değerlendirmeleri</Text>
            <View style={{ width: 40 }} />
          </View>
          <ReviewsScreen
            onOpenServerSettings={() => setShowServerModal(true)}
            onOpenBranchPicker={() => setShowBranchModal(true)}
          />
        </View>
      );
    }

    if (subScreen === 'product_create') {
      return (
        <View style={styles.subScreenContainer}>
          <View style={styles.subHeader}>
            <TouchableOpacity onPress={() => setSubScreen(null)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>Trendyol Ürün Ekleme</Text>
            <View style={{ width: 40 }} />
          </View>
          <ProductCreateScreen
            initialData={prefillProductData}
            onSuccess={() => {
              setPrefillProductData(null);
              setSubScreen(null);
            }}
          />
        </View>
      );
    }

    if (subScreen === 'barcode') {
      return (
        <View style={styles.subScreenContainer}>
          <View style={styles.subHeader}>
            <TouchableOpacity onPress={() => setSubScreen(null)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>Barkod Doğrulama</Text>
            <View style={{ width: 40 }} />
          </View>
          <BarcodeSearchScreen
            onFindInStock={(barcode) => {
              setTargetStockBarcode(barcode);
              setSubScreen(null);
              setActiveTab('stocks');
            }}
            onNavigateToProductCreate={(prefill) => {
              setPrefillProductData(prefill || null);
              setSubScreen('product_create');
            }}
          />
        </View>
      );
    }

    if (subScreen === 'cancellations') {
      return (
        <View style={styles.subScreenContainer}>
          <View style={styles.subHeader}>
            <TouchableOpacity onPress={() => setSubScreen(null)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>İptal & Kök Neden Analizi</Text>
            <View style={{ width: 40 }} />
          </View>
          <CancellationAnalysisScreen
            onOpenServerSettings={() => setShowServerModal(true)}
            onNavigateToStockProduct={(barcode: string) => {
              setTargetStockBarcode(barcode);
              setSubScreen(null);
              setActiveTab('stocks');
            }}
          />
        </View>
      );
    }

    if (subScreen === 'price_radar') {
      return (
        <View style={styles.subScreenContainer}>
          <View style={styles.subHeader}>
            <TouchableOpacity onPress={() => setSubScreen(null)} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>Fiyat Anomali Radarı (12 Şube)</Text>
            <View style={{ width: 40 }} />
          </View>
          <PriceAnomalyRadarScreen onOpenServerSettings={() => setShowServerModal(true)} />
        </View>
      );
    }

    // 2. Ana Sekmeler
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onOpenServerSettings={() => setShowServerModal(true)}
            onNavigateToOrders={() => setActiveTab('orders')}
            onNavigateToRevenue={() => setActiveTab('revenue')}
            onNavigateToStocks={() => setActiveTab('stocks')}
            onNavigateToClaims={() => setSubScreen('claims')}
            onNavigateToReviews={() => setSubScreen('reviews')}
            onNavigateToLevels={() => setActiveTab('levels')}
            onNavigateToCancellations={() => setSubScreen('cancellations')}
          />
        );
      case 'orders':
        return (
          <OrdersScreen
            onOpenServerSettings={() => setShowServerModal(true)}
            onOpenBranchPicker={() => setShowBranchModal(true)}
          />
        );
      case 'revenue':
        return <RevenueScreen onOpenServerSettings={() => setShowServerModal(true)} />;
      case 'levels':
        return <SeviyeAnaliziScreen onOpenServerSettings={() => setShowServerModal(true)} />;
      case 'stocks':
        return (
          <StocksScreen
            initialBarcode={targetStockBarcode}
            onClearInitialBarcode={() => setTargetStockBarcode(null)}
            onOpenServerSettings={() => setShowServerModal(true)}
            onOpenBranchPicker={() => setShowBranchModal(true)}
            onNavigateToProductCreate={(prefill) => {
              setPrefillProductData(prefill || null);
              setSubScreen('product_create');
            }}
          />
        );
      case 'more':
        return (
          <MoreMenuScreen
            onOpenServerSettings={() => setShowServerModal(true)}
            onNavigateToLevels={() => setActiveTab('levels')}
            onNavigateToBranches={() => setSubScreen('branches')}
            onNavigateToClaims={() => setSubScreen('claims')}
            onNavigateToReviews={() => setSubScreen('reviews')}
            onNavigateToProductCreate={() => setSubScreen('product_create')}
            onNavigateToBarcode={() => setSubScreen('barcode')}
            onNavigateToRawOrders={() => setShowRawOrdersModal(true)}
            onNavigateToCancellations={() => setSubScreen('cancellations')}
            onNavigateToPriceRadar={() => setSubScreen('price_radar')}
          />
        );
      default:
        return null;
    }
  };

  const showBranchPicker =
    subScreen === null &&
    (activeTab === 'orders' || activeTab === 'stocks');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <Header
        onOpenServerSettings={() => setShowServerModal(true)}
        onOpenBranchPicker={showBranchPicker ? () => setShowBranchModal(true) : undefined}
      />

      {/* Aktif Ekran */}
      <View style={styles.screenContainer}>{renderActiveScreen()}</View>

      {/* Alt Kurumsal Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key && subScreen === null;
          const badgeCount =
            tab.badgeKey === 'orders'
              ? stats.orders
              : tab.badgeKey === 'returns'
              ? stats.returns
              : 0;

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => handleTabPress(tab.key)}
              style={styles.tabItem}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={19}
                  color={isActive ? '#111827' : '#6B7280'}
                />
                {badgeCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Global Modallar */}
      <ServerConfigModal visible={showServerModal} onClose={() => setShowServerModal(false)} />
      <BranchPickerModal visible={showBranchModal} onClose={() => setShowBranchModal(false)} />
      <RawOrdersModal visible={showRawOrdersModal} onClose={() => setShowRawOrdersModal(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  subScreenContainer: {
    flex: 1,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subHeaderTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 5,
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '800',
    color: '#111827',
  },
  activeIndicator: {
    position: 'absolute',
    top: -5,
    width: 24,
    height: 2,
    backgroundColor: '#111827',
    borderRadius: 1,
  },
});
