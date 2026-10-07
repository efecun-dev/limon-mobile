import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { ordersService } from '../api/services';

export const RawOrdersModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRaw = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ordersService.getOrders({ size: 10, fetchDays: 2 });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchRaw();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>HAM API VERİSİ GÖRÜNTÜLEYİCİ</Text>
              <Text style={styles.subtitle}>GET /api/siparisler (Canlı Yanıt)</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={fetchRaw} style={styles.retryBtn}>
                <MaterialCommunityIcons name="refresh" size={14} color="#FFF" />
                <Text style={styles.retryBtnText}>Tekrar İstek At</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.content}>
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.loadingText}>API Yanıtı Bekleniyor...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>API Hatası:</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <ScrollView style={styles.jsonScroll}>
                <Text style={styles.jsonText}>{JSON.stringify(data, null, 2)}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#94A3B8',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  retryBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeBtn: {
    padding: 2,
  },
  content: {
    flex: 1,
    padding: 10,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: '#7F1D1D',
    padding: 10,
    borderRadius: 3,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FECACA',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 10,
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  jsonScroll: {
    flex: 1,
  },
  jsonText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#34D399',
    lineHeight: 14,
  },
});
