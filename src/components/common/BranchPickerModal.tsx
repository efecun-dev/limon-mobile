import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, typography } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export const BRANCH_LIST = [
  { id: 'all', name: 'Tüm Şubeler' },
  { id: '479045', name: 'Atakum Gross' },
  { id: '479052', name: 'Barış' },
  { id: '479048', name: 'Denizevleri' },
  { id: '479063', name: 'Duruşehir' },
  { id: '479042', name: 'Kanije' },
  { id: '479054', name: 'Körfez 2' },
  { id: '479061', name: 'Liman' },
  { id: '479064', name: 'Nikah' },
  { id: '157108', name: 'Limon 1' },
  { id: '156829', name: 'Limon 2' },
  { id: '157111', name: 'Limon 3' },
  { id: '157109', name: 'Limon 5' },
];

interface BranchPickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BranchPickerModal: React.FC<BranchPickerModalProps> = ({ visible, onClose }) => {
  const { activeBranchId, setActiveBranch } = useAuth();

  const handleSelect = (id: string, name: string) => {
    setActiveBranch(id, name);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="store-cog-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.title}>Aktif Şube Seçimi</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={BRANCH_LIST}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = activeBranchId === item.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleSelect(item.id, item.name)}
                  style={[styles.itemRow, isSelected && styles.itemRowActive]}
                >
                  <View style={styles.itemInfo}>
                    <MaterialCommunityIcons
                      name={item.id === 'all' ? 'view-grid-outline' : 'store-outline'}
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.itemText, isSelected && styles.itemTextActive]}>
                      {item.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
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
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: layout.radiusMd,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    maxHeight: '80%',
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
    fontSize: 15,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.surfaceSubtle,
  },
  itemRowActive: {
    backgroundColor: colors.surfaceSubtle,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemTextActive: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
