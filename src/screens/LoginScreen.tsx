import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { authService } from '../api/services';
import { UserProfile } from '../types/api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ServerConfigModal } from '../components/common/ServerConfigModal';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { serverUrl, isConnected, latencyMs } = useServer();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // API'den gelen kullanıcılar (Hızlı seçim için)
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // VPS ayar modalı
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Sunucudan kullanıcı listesini çek (Sıfır mock)
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await authService.getUsers();
      if (res && res.users) {
        setUsersList(res.users);
      }
    } catch (err: any) {
      console.warn('Kullanıcı listesi alınamadı:', err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [serverUrl]);

  const handleSelectUser = (u: UserProfile) => {
    setSelectedUser(u);
    setUsername(u.username);
    setErrorMessage(null);
  };

  const handleLogin = async () => {
    const ident = username.trim() || (selectedUser ? selectedUser.username : '');
    if (!ident) {
      setErrorMessage('Lütfen kullanıcı adı girin veya listeden seçin.');
      return;
    }
    if (!password) {
      setErrorMessage('Lütfen şifrenizi girin.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const result = await login({
      username: ident,
      userId: selectedUser?.id,
      password,
    });

    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.message || 'Giriş yapılamadı.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Üst Bar: VPS Durumu ve Ayarlar Butonu */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.serverStatusBtn}
              onPress={() => setShowConfigModal(true)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? colors.success : colors.danger },
                ]}
              />
              <Text style={styles.serverStatusText} numberOfLines={1}>
                {serverUrl.replace(/^https?:\/\//, '')}
              </Text>
              <MaterialCommunityIcons name="cog-outline" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Logo & Kurumsal Başlık */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="shield-check" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.brandTitle}>LİMON MARKET</Text>
            <Text style={styles.brandSubtitle}>Merkezi Operasyon & Entegrasyon Sistemi</Text>
          </View>

          {/* Giriş Kartı */}
          <View style={styles.loginCard}>
            <Text style={styles.cardTitle}>Kurumsal Oturum</Text>
            <Text style={styles.cardDesc}>
              Devam etmek için personel profilinizi seçin veya bilgilerinizi girin.
            </Text>

            {/* API'den Çekilen Hızlı Kullanıcı Seçimi */}
            {usersList.length > 0 && (
              <View style={styles.userSelectionSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Kayıtlı Personel / Rol</Text>
                  {loadingUsers && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.usersScroll}>
                  {usersList.map((u) => {
                    const isSelected = (selectedUser?.id === u.id) || (username === u.username);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        activeOpacity={0.7}
                        onPress={() => handleSelectUser(u)}
                        style={[styles.userChip, isSelected && styles.userChipActive]}
                      >
                        <MaterialCommunityIcons
                          name={u.role === 'ADMIN' ? 'shield-account' : 'account-tie'}
                          size={15}
                          color={isSelected ? '#FFF' : colors.textPrimary}
                        />
                        <View style={styles.userChipTexts}>
                          <Text style={[styles.userChipName, isSelected && styles.userChipTextActive]}>
                            {u.name}
                          </Text>
                          <Text style={[styles.userChipRole, isSelected && styles.userChipTextActive]}>
                            {u.role}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Kullanıcı Adı Girişi */}
            <Input
              label="Kullanıcı Adı"
              placeholder="admin veya personel kullanıcı adı"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setSelectedUser(null);
                setErrorMessage(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Şifre Girişi */}
            <Input
              label="Şifre"
              placeholder="••••••••"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrorMessage(null);
              }}
              secureTextEntry
              autoCapitalize="none"
            />

            {/* Hata Mesajı */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Giriş Butonu */}
            <Button
              title="Güvenli Giriş Yap"
              variant="primary"
              size="lg"
              loading={loading}
              onPress={handleLogin}
              style={styles.loginBtn}
              icon={<MaterialCommunityIcons name="lock-open-outline" size={18} color="#FFF" />}
            />
          </View>

          {/* Alt Bilgi */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Limon Entegrasyon v1.0 • Trendyol Go Hızlı Market</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ServerConfigModal visible={showConfigModal} onClose={() => setShowConfigModal(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
  },
  topBar: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  serverStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: layout.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  serverStatusText: {
    ...typography.mono,
    fontSize: 11,
    color: colors.textSecondary,
    maxWidth: 160,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: layout.radiusSm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    ...typography.h1,
    letterSpacing: 1.2,
    fontSize: 20,
    marginBottom: 4,
  },
  brandSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  loginCard: {
    backgroundColor: colors.surface,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: layout.radiusMd,
    padding: 20,
  },
  cardTitle: {
    ...typography.h2,
    fontSize: 16,
    marginBottom: 4,
  },
  cardDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 16,
  },
  userSelectionSection: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    ...typography.tiny,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  usersScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: layout.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
  },
  userChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userChipTexts: {
    flexDirection: 'column',
  },
  userChipName: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  userChipRole: {
    ...typography.tiny,
    fontSize: 9,
    color: colors.textMuted,
  },
  userChipTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerBg,
    borderWidth: layout.borderWidth,
    borderColor: '#FECACA',
    borderRadius: layout.radiusSm,
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  loginBtn: {
    marginTop: 6,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    ...typography.tiny,
    color: colors.textMuted,
  },
});
