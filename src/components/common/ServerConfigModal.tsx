import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { useServer } from '../../context/ServerContext';
import { Input } from './Input';
import { Button } from './Button';

interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({ visible, onClose }) => {
  const { serverUrl, serverKey, saveConfig, testConnection } = useServer();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [inputKey, setInputKey] = useState(serverKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setInputUrl(serverUrl);
      setInputKey(serverKey);
      setTestResult(null);
    }
  }, [visible, serverUrl, serverKey]);

  const handleTest = async () => {
    if (!inputUrl.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir VPS Sunucu adresi girin.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(inputUrl, inputKey);
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    if (!inputUrl.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir VPS Sunucu adresi girin.');
      return;
    }
    const success = await saveConfig(inputUrl, inputKey);
    if (success) {
      Alert.alert('Başarılı', 'VPS Sunucu bağlantısı başarıyla kaydedildi.');
      onClose();
    } else {
      Alert.alert('Uyarı', 'Ayarlar kaydedildi ancak sunucuya ulaşılamadı. Sunucunuzun açık olduğundan emin olun.');
      onClose();
    }
  };

  const handleSetLocalhost = () => {
    setInputUrl('http://localhost:3001');
  };

  const handleSetAndroidEmulator = () => {
    setInputUrl('http://10.0.2.2:3001');
  };

  const handleSetLan = () => {
    setInputUrl('http://192.168.1.116:3001');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Başlık Barı */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="server" size={20} color={colors.textPrimary} />
              <Text style={styles.title}>VPS Sunucu Ayarları</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.desc}>
              Mobil uygulamanın bağlanacağı Limon Central API sunucusunun IP veya Domain adresini belirleyin.
            </Text>

            <Input
              label="Sunucu URL (VPS IP veya Domain)"
              placeholder="http://123.45.67.89:3001"
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Hızlı Kısayollar */}
            <View style={styles.shortcutsRow}>
              <TouchableOpacity onPress={handleSetLan} style={styles.shortcutBadge}>
                <Text style={styles.shortcutText}>Yerel Wi-Fi: 192.168.1.116:3001</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSetLocalhost} style={styles.shortcutBadge}>
                <Text style={styles.shortcutText}>localhost:3001</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSetAndroidEmulator} style={styles.shortcutBadge}>
                <Text style={styles.shortcutText}>Emülatör: 10.0.2.2:3001</Text>
              </TouchableOpacity>
            </View>

            <Input
              label="X-Server-Key (API Güvenlik Anahtarı)"
              placeholder="limon_sec_k98f234_main_server_key_2026"
              value={inputKey}
              onChangeText={setInputKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            {/* Test Sonucu Kutusu */}
            {testResult && (
              <View
                style={[
                  styles.resultBox,
                  testResult.success ? styles.resultSuccess : styles.resultError,
                ]}
              >
                <MaterialCommunityIcons
                  name={testResult.success ? 'check-circle' : 'alert-circle'}
                  size={18}
                  color={testResult.success ? colors.success : colors.danger}
                />
                <View style={styles.resultTextCol}>
                  <Text
                    style={[
                      styles.resultTitle,
                      { color: testResult.success ? colors.success : colors.danger },
                    ]}
                  >
                    {testResult.success
                      ? `Bağlantı Başarılı (${testResult.latency} ms)`
                      : 'Bağlantı Başarısız'}
                  </Text>
                  {testResult.error && (
                    <Text style={styles.resultErrorDesc}>{testResult.error}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Butonlar */}
            <View style={styles.btnRow}>
              <Button
                title={testing ? 'Test Ediliyor...' : 'Bağlantıyı Sına'}
                variant="outline"
                size="md"
                onPress={handleTest}
                loading={testing}
                style={styles.actionBtn}
                icon={<MaterialCommunityIcons name="lightning-bolt" size={16} color={colors.textPrimary} />}
              />
              <Button
                title="Kaydet ve Uygula"
                variant="primary"
                size="md"
                onPress={handleSave}
                style={styles.actionBtn}
                icon={<MaterialCommunityIcons name="content-save" size={16} color="#FFF" />}
              />
            </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: layout.radiusMd,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  desc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
    marginTop: -6,
  },
  shortcutBadge: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: layout.radiusSm,
  },
  shortcutText: {
    ...typography.tiny,
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: layout.radiusSm,
    borderWidth: layout.borderWidth,
    marginBottom: 16,
    gap: 10,
  },
  resultSuccess: {
    backgroundColor: colors.successBg,
    borderColor: '#BBF7D0',
  },
  resultError: {
    backgroundColor: colors.dangerBg,
    borderColor: '#FECACA',
  },
  resultTextCol: {
    flex: 1,
  },
  resultTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    fontSize: 13,
  },
  resultErrorDesc: {
    ...typography.tiny,
    color: colors.danger,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  actionBtn: {
    width: '100%',
  },
});
