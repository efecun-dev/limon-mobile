import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { Button } from './Button';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_BOX_SIZE = Math.min(SCREEN_WIDTH * 0.75, 260);

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'BARKOD TARA',
  subtitle = 'Barkodu çerçevenin içine hizalayın',
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const isScanningLockedRef = useRef(false);

  // Reset scan state when modal opens
  useEffect(() => {
    if (visible) {
      isScanningLockedRef.current = false;
      setIsScanned(false);
      setTorchEnabled(false);
    } else {
      isScanningLockedRef.current = true;
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string; type?: string }) => {
    if (isScanningLockedRef.current || isScanned || !data) return;

    const cleanBarcode = data.trim();
    if (cleanBarcode.length < 3) return; // avoid false positive noise

    isScanningLockedRef.current = true;
    setIsScanned(true);

    // Haptic feedback
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics optional
    }

    onClose();
    onScan(cleanBarcode);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header Koyu Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSub}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setTorchEnabled(!torchEnabled)}
            style={[styles.headerBtn, torchEnabled && styles.headerBtnActive]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={torchEnabled ? 'flashlight' : 'flashlight-off'}
              size={22}
              color={torchEnabled ? '#FACC15' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {/* Kamera Görüntüsü / İzin Durumu */}
        {!permission ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permText}>Kamera izin durumu kontrol ediliyor...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <View style={styles.permIconCircle}>
              <MaterialCommunityIcons name="camera-off-outline" size={48} color={colors.danger} />
            </View>
            <Text style={styles.permTitle}>Kamera İzni Gerekli</Text>
            <Text style={styles.permDesc}>
              Barkodları doğrudan kamera ile taramak için uygulamanın kamera erişimine izin vermeniz gerekmektedir.
            </Text>
            <Button
              title="Kamera İznini Etkinleştir"
              variant="primary"
              size="md"
              onPress={requestPermission}
              icon={<MaterialCommunityIcons name="camera" size={16} color="#FFF" />}
              style={styles.permBtn}
            />
            <Button
              title="Vazgeç"
              variant="outline"
              size="sm"
              onPress={onClose}
              style={{ marginTop: 10, minWidth: 140 }}
            />
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchEnabled}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                  'code93',
                  'itf14',
                  'qr',
                ],
              }}
              onBarcodeScanned={isScanned ? undefined : handleBarcodeScanned}
            />

            {/* Karartılmış Maske & Hedefleme Çerçevesi */}
            <View style={styles.overlay}>
              {/* Üst Karartma */}
              <View style={styles.maskTop} />

              {/* Orta Satır */}
              <View style={styles.maskMiddleRow}>
                <View style={styles.maskSide} />

                {/* Hedefleme Vizörü */}
                <View style={styles.scanBox}>
                  {/* Köşebentler */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />

                  {/* Kırmızı/Yeşil Lazer Çizgisi */}
                  <View style={[styles.laserLine, isScanned && styles.laserSuccess]} />
                </View>

                <View style={styles.maskSide} />
              </View>

              {/* Alt Karartma & İpuçları */}
              <View style={styles.maskBottom}>
                <View style={styles.hintCard}>
                  <MaterialCommunityIcons name="information-outline" size={16} color="#9CA3AF" />
                  <Text style={styles.hintText}>
                    Kamerayı ürün barkoduna dik tutun. Barkod okunduğunda cihaz titreyecek ve arama otomatik başlayacaktır.
                  </Text>
                </View>

                <TouchableOpacity onPress={onClose} style={styles.cancelActionBtn} activeOpacity={0.8}>
                  <Text style={styles.cancelActionText}>Taramayı İptal Et</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
  },
  headerBtnActive: {
    backgroundColor: '#374151',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  maskMiddleRow: {
    flexDirection: 'row',
    height: SCAN_BOX_SIZE,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#10B981',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderLeftWidth: 3,
    borderTopWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderRightWidth: 3,
    borderTopWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  laserLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  laserSuccess: {
    backgroundColor: '#10B981',
  },
  maskBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    maxWidth: 320,
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    color: '#D1D5DB',
    lineHeight: 16,
  },
  cancelActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 4,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  cancelActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // İzin İsteme Ekranı
  permissionBox: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permIconCircle: {
    width: 80,
    height: 80,
    borderRadius: layout.radiusSm,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  permDesc: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  permBtn: {
    minWidth: 220,
  },
  permText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
