import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

export type AttachmentOption =
  | 'camera_photo'
  | 'camera_video'
  | 'gallery_photo'
  | 'gallery_video'
  | 'document'
  | 'audio';

interface AttachmentPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: AttachmentOption) => void;
}

export const AttachmentPickerModal: React.FC<AttachmentPickerModalProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const options = [
    {
      id: 'document' as AttachmentOption,
      label: 'Document',
      icon: '📄',
      bgColor: '#5B21B6', // deep purple
    },
    {
      id: 'camera_photo' as AttachmentOption,
      label: 'Camera',
      icon: '📸',
      bgColor: '#D946EF', // fuchsia
    },
    {
      id: 'gallery_photo' as AttachmentOption,
      label: 'Gallery',
      icon: '🖼️',
      bgColor: '#8B5CF6', // purple
    },
    {
      id: 'camera_video' as AttachmentOption,
      label: 'Video Rec',
      icon: '🎥',
      bgColor: '#EF4444', // red
    },
    {
      id: 'audio' as AttachmentOption,
      label: 'Audio File',
      icon: '🎵',
      bgColor: '#F59E0B', // amber
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.dragHandle} />
              <Text style={styles.sheetTitle}>Share Attachment</Text>

              <View style={styles.grid}>
                {options.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.optionItem}
                    activeOpacity={0.75}
                    onPress={() => {
                      onClose();
                      onSelectOption(item.id);
                    }}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: item.bgColor }]}>
                      <Text style={styles.iconEmoji}>{item.icon}</Text>
                    </View>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1E1B2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167, 139, 250, 0.25)',
  },
  dragHandle: {
    width: 44,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EDE9FE',
    marginBottom: 20,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 18,
    marginBottom: 20,
  },
  optionItem: {
    alignItems: 'center',
    width: 90,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  iconEmoji: {
    fontSize: 26,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D8B4FE',
    textAlign: 'center',
  },
  cancelButton: {
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A78BFA',
  },
});
