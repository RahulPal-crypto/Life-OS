import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ScreenContainer, Text } from '../../../components';
import { spacing, borderRadius } from '../../../theme';
import { User } from '../../auth';
import {
  formatBytes,
  getMediaTypeIcon,
  LocalStorageStats,
  memoriesNative,
  NativeMediaType,
  PickedLocalFile,
  PickMode,
} from '../services/memoriesNative';
import {
  memoriesService,
  MemoryFolder,
  MemoryItem,
  MemorySort,
  MemoryStats,
} from '../services/memoriesService';
import { SafeVaultModal } from '../components/SafeVaultModal';
import { CreateFolderModal, FolderDestinationModal } from '../components/FolderPickerModal';
import { MemoryViewerModal } from '../components/MemoryViewerModal';

interface MyMemoriesScreenProps {
  user: User | null;
  onBackToDashboard: () => void;
}

const SORT_LABELS: Record<MemorySort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  name_asc: 'Name A-Z',
  size_desc: 'Largest',
  type: 'Type',
};

const SORT_ORDER: MemorySort[] = ['newest', 'oldest', 'name_asc', 'size_desc', 'type'];

const DEFAULT_STATS: MemoryStats = {
  totalItems: 0,
  totalBytes: 0,
  photoCount: 0,
  videoCount: 0,
  documentCount: 0,
  audioCount: 0,
  favoriteCount: 0,
  trashedCount: 0,
  largeCount: 0,
  unsortedCount: 0,
  vaultCount: 0,
  vaultBytes: 0,
  vaultConfigured: false,
  biometricEnabled: true,
};

export const MyMemoriesScreen: React.FC<MyMemoriesScreenProps> = ({
  onBackToDashboard,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Navigation & Filter States
  const [isVaultMode, setIsVaultMode] = useState(false);
  const [isTrashMode, setIsTrashMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NativeMediaType | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [largeOnly, setLargeOnly] = useState(false);
  const [unsortedOnly, setUnsortedOnly] = useState(false);
  const [folderStack, setFolderStack] = useState<MemoryFolder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<MemorySort>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Data States
  const [stats, setStats] = useState<MemoryStats>(DEFAULT_STATS);
  const [localStats, setLocalStats] = useState<LocalStorageStats>({
    regularBytes: 0,
    vaultBytes: 0,
    totalBytes: 0,
  });
  const [folders, setFolders] = useState<MemoryFolder[]>([]);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [onThisDay, setOnThisDay] = useState<MemoryItem[]>([]);

  // Selection & Modal States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [vaultModalVisible, setVaultModalVisible] = useState(false);
  const [destModalAction, setDestModalAction] = useState<'move' | 'copy' | null>(null);
  const [viewerItem, setViewerItem] = useState<MemoryItem | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [importingMessage, setImportingMessage] = useState<string | null>(null);
  const isExternalFlowActiveRef = useRef(false);

  const runWithoutAutoLock = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    isExternalFlowActiveRef.current = true;
    try {
      return await fn();
    } finally {
      // Keep isExternalFlowActiveRef true until Android fully returns to active
      setTimeout(() => {
        if (AppState.currentState === 'active') {
          isExternalFlowActiveRef.current = false;
        }
      }, 1500);
    }
  }, []);

  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;
  const inSelectionMode = selectedIds.size > 0;

  const isHomeOverview =
    !isVaultMode &&
    !isTrashMode &&
    !activeCategory &&
    !favoritesOnly &&
    !largeOnly &&
    !unsortedOnly &&
    !currentFolder &&
    searchQuery.trim().length === 0;

  const lockSafeVault = useCallback(async () => {
    memoriesService.clearVaultSession();
    await memoriesNative.setScreenSecure(false);
    await memoriesNative.clearVaultPreviewCache();
    setIsVaultMode(false);
    setFolderStack([]);
    setSelectedIds(new Set());
    setViewerItem(null);
  }, []);

  // Auto-lock Safe Vault when app minimizes or screen locks (skip while system picker/camera/dialogs are open)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Returned to foreground from picker, camera, or delete dialog
        setTimeout(() => {
          isExternalFlowActiveRef.current = false;
        }, 1000);
        return;
      }

      if (
        nextState === 'background' &&
        !isExternalFlowActiveRef.current &&
        memoriesService.isVaultUnlocked()
      ) {
        lockSafeVault();
      }
    });
    return () => {
      sub.remove();
      lockSafeVault();
    };
  }, [lockSafeVault]);

  const loadMemories = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const [data, disk] = await Promise.all([
          memoriesService.fetchOverview({
            folderId: currentFolder?.id || null,
            category: activeCategory,
            search: searchQuery,
            sort: sortMode,
            vault: isVaultMode,
            trashed: isTrashMode,
            favoritesOnly,
            largeOnly,
            unsortedOnly,
          }),
          memoriesNative.getLocalStorageStats(),
        ]);

        setStats(data.stats);
        setOnThisDay(data.onThisDay || []);
        setFolders(data.folders || []);
        setItems(data.items || []);
        setLocalStats(disk);
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        if (
          !memoriesService.isVaultUnlocked() ||
          (msg.includes('vault') && (msg.includes('locked') || msg.includes('expired')))
        ) {
          setIsVaultMode(false);
          setVaultModalVisible(true);
        } else {
          Alert.alert('Unable to Load Memories', err?.message || 'Please check connection.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      currentFolder?.id,
      activeCategory,
      searchQuery,
      sortMode,
      isVaultMode,
      isTrashMode,
      favoritesOnly,
      largeOnly,
      unsortedOnly,
    ]
  );

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  // Subfolders visible at current folder depth
  const visibleFolders = useMemo(() => {
    if (isTrashMode) return folders;
    if (activeCategory || favoritesOnly || largeOnly || unsortedOnly || searchQuery.trim()) {
      return [];
    }
    const parentId = currentFolder?.id || null;
    return folders.filter((f) => (f.parentId || null) === parentId);
  }, [
    folders,
    isTrashMode,
    activeCategory,
    favoritesOnly,
    largeOnly,
    unsortedOnly,
    searchQuery,
    currentFolder?.id,
  ]);

  const resetAllFilters = () => {
    setIsTrashMode(false);
    setActiveCategory(null);
    setFavoritesOnly(false);
    setLargeOnly(false);
    setUnsortedOnly(false);
    setFolderStack([]);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  const handleOpenVaultCard = () => {
    if (memoriesService.isVaultUnlocked()) {
      resetAllFilters();
      setIsVaultMode(true);
      memoriesNative.setScreenSecure(true);
      return;
    }
    setVaultModalVisible(true);
  };

  const handleVaultUnlocked = async () => {
    setVaultModalVisible(false);
    resetAllFilters();
    setIsVaultMode(true);
    await memoriesNative.setScreenSecure(true);
  };

  const persistPickedFiles = async (files: PickedLocalFile[]) => {
    if (!files.length) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const sourceUrisToRemove: string[] = [];

    setImportingMessage(
      isVaultMode
        ? `Encrypting ${files.length} file${files.length > 1 ? 's' : ''} into Safe Vault...`
        : `Saving ${files.length} file${files.length > 1 ? 's' : ''} to My Memories...`
    );

    try {
      for (const file of files) {
        let localUri: string | null = file.localUri;
        let vaultUri: string | null = null;
        let finalSize = file.sizeBytes || 0;

        if (isVaultMode) {
          const tempId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const encrypted = await memoriesNative.encryptFileToVault(file.localUri, tempId, true);
          if (encrypted) {
            vaultUri = encrypted.vaultUri;
            localUri = null;
            finalSize = encrypted.sizeBytes || finalSize;
            if (file.sourceUri) {
              sourceUrisToRemove.push(file.sourceUri);
            }
          }
        }

        await memoriesService.createItem({
          folderId: currentFolder?.id || null,
          title: file.fileName.replace(/\.[^/.]+$/, '') || file.fileName,
          fileName: file.fileName,
          mediaType: file.mediaType,
          mimeType: file.mimeType,
          sizeBytes: finalSize,
          localUri,
          vaultUri,
          memoryDate: todayStr,
          isVault: isVaultMode,
        });
      }

      // Automatically remove originals from Gallery when imported into Safe Vault
      if (isVaultMode && sourceUrisToRemove.length > 0) {
        setImportingMessage('Removing original files from Gallery...');
        isExternalFlowActiveRef.current = true;
        const delRes = await memoriesNative.deleteSourceUris(sourceUrisToRemove);
        if (delRes.failedCount > 0 && delRes.deletedCount === 0) {
          Alert.alert(
            'Saved to Safe Vault',
            'Your files are encrypted in Safe Vault, but Android did not allow automatic removal from Gallery. You can delete the originals from Gallery manually.'
          );
        } else if (delRes.failedCount > 0) {
          Alert.alert(
            'Saved to Safe Vault',
            `${delRes.deletedCount} original file(s) removed from Gallery. ${delRes.failedCount} could not be removed automatically.`
          );
        }
      }

      loadMemories(true);
    } finally {
      setImportingMessage(null);
    }
  };

  const handleImportFiles = async (mode: PickMode) => {
    setAddSheetVisible(false);
    try {
      await runWithoutAutoLock(async () => {
        const picked = await memoriesNative.pickFiles(mode);
        if (picked.length > 0) {
          await persistPickedFiles(picked);
        }
      });
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Unable to import selected files.');
    }
  };

  const handleCameraCapture = async (kind: 'photo' | 'video') => {
    setAddSheetVisible(false);
    try {
      await runWithoutAutoLock(async () => {
        const captured = await memoriesNative.captureMedia(kind);
        if (captured) {
          await persistPickedFiles([captured]);
        }
      });
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Unable to capture media.');
    }
  };

  const handleToggleVoiceRecord = async () => {
    try {
      if (!isRecordingAudio) {
        await memoriesNative.startVoiceRecording();
        setIsRecordingAudio(true);
        setAddSheetVisible(false);
        return;
      }
      const recorded = await memoriesNative.stopVoiceRecording();
      setIsRecordingAudio(false);
      if (recorded) {
        await persistPickedFiles([recorded]);
      }
    } catch (err: any) {
      setIsRecordingAudio(false);
      Alert.alert('Recording Error', err?.message || 'Could not record audio.');
    }
  };

  const handleCreateFolder = async (payload: {
    name: string;
    icon: string;
    color: string;
    isPinned: boolean;
  }) => {
    try {
      await memoriesService.createFolder({
        ...payload,
        parentId: currentFolder?.id || null,
        isVault: isVaultMode,
      });
      loadMemories(true);
    } catch (err: any) {
      Alert.alert('Folder Error', err?.message || 'Could not create folder.');
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunBulkAction = async (
    action: Parameters<typeof memoriesService.bulkAction>[0],
    targetFolderId: string | null = null
  ) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      // Handle local encryption/decryption if moving into or out of Safe Vault
      if (action === 'move-to-vault') {
        const selectedItems = items.filter((it) => selectedIds.has(it.id));
        for (const it of selectedItems) {
          if (!it.vaultUri && it.localUri) {
            const enc = await memoriesNative.encryptFileToVault(it.localUri, it.id, true);
            if (enc) {
              await memoriesService.updateItem(it.id, {
                vaultUri: enc.vaultUri,
                localUri: null,
                isVault: true,
                folderId: null,
              });
              continue;
            }
          }
          await memoriesService.updateItem(it.id, { isVault: true, folderId: null });
        }
      } else if (action === 'remove-from-vault') {
        const selectedItems = items.filter((it) => selectedIds.has(it.id));
        for (const it of selectedItems) {
          if (it.vaultUri) {
            const dec = await memoriesNative.decryptVaultFileToRegular(it.vaultUri, it.fileName);
            if (dec) {
              await memoriesService.updateItem(it.id, {
                localUri: dec.localUri,
                vaultUri: null,
                isVault: false,
                folderId: null,
              });
              continue;
            }
          }
          await memoriesService.updateItem(it.id, { isVault: false, folderId: null });
        }
      } else {
        const res = await memoriesService.bulkAction(action, ids, targetFolderId);
        if (action === 'delete-forever' && res.urisToDelete?.length) {
          for (const uri of res.urisToDelete) {
            await memoriesNative.deleteLocalFile(uri);
          }
        }
      }

      setSelectedIds(new Set());
      loadMemories(true);
    } catch (err: any) {
      Alert.alert('Operation Failed', err?.message || 'Could not apply bulk operation.');
    }
  };

  const handleFolderLongPress = (folder: MemoryFolder) => {
    Alert.alert(folder.name, `${folder.itemCount} items • ${formatBytes(folder.totalBytes)}`, [
      {
        text: folder.isPinned ? 'Unpin Folder' : 'Pin Folder',
        onPress: async () => {
          await memoriesService.updateFolder(folder.id, { isPinned: !folder.isPinned });
          loadMemories(true);
        },
      },
      {
        text: isTrashMode ? 'Restore Folder' : 'Move Folder to Trash',
        style: isTrashMode ? 'default' : 'destructive',
        onPress: async () => {
          if (isTrashMode) {
            await memoriesService.updateFolder(folder.id, { isTrashed: false });
          } else {
            await memoriesService.deleteFolder(folder.id, false);
          }
          loadMemories(true);
        },
      },
      ...(isTrashMode
        ? [
            {
              text: 'Delete Permanently',
              style: 'destructive' as const,
              onPress: async () => {
                await memoriesService.deleteFolder(folder.id, true);
                loadMemories(true);
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMoveSingleVaultToggle = async (item: MemoryItem) => {
    if (!item.isVault && !stats.vaultConfigured) {
      setViewerItem(null);
      setVaultModalVisible(true);
      return;
    }
    if (item.isVault && !memoriesService.isVaultUnlocked()) {
      setVaultModalVisible(true);
      return;
    }

    try {
      if (item.isVault) {
        if (item.vaultUri) {
          const dec = await memoriesNative.decryptVaultFileToRegular(item.vaultUri, item.fileName);
          await memoriesService.updateItem(item.id, {
            isVault: false,
            folderId: null,
            localUri: dec?.localUri || item.localUri,
            vaultUri: null,
          });
        } else {
          await memoriesService.updateItem(item.id, { isVault: false, folderId: null });
        }
      } else {
        if (item.localUri) {
          const enc = await memoriesNative.encryptFileToVault(item.localUri, item.id, true);
          await memoriesService.updateItem(item.id, {
            isVault: true,
            folderId: null,
            vaultUri: enc?.vaultUri || null,
            localUri: null,
          });
        } else {
          await memoriesService.updateItem(item.id, { isVault: true, folderId: null });
        }
      }
      setViewerItem(null);
      loadMemories(true);
    } catch (err: any) {
      Alert.alert('Vault Move Failed', err?.message || 'Could not update Safe Vault status.');
    }
  };

  const cycleSort = () => {
    const idx = SORT_ORDER.indexOf(sortMode);
    setSortMode(SORT_ORDER[(idx + 1) % SORT_ORDER.length]);
  };

  const activeFilterTitle = isVaultMode
    ? 'Safe Vault (Encrypted)'
    : isTrashMode
      ? 'Trash (30-Day Bin)'
      : activeCategory
        ? `${getMediaTypeIcon(activeCategory)} ${activeCategory.toUpperCase()}`
        : favoritesOnly
          ? '⭐ Starred Memories'
          : largeOnly
            ? '📦 Large Files (>20 MB)'
            : unsortedOnly
              ? '🗂️ Unsorted Files'
              : currentFolder
                ? `${currentFolder.icon} ${currentFolder.name}`
                : 'My Memories';

  return (
    <ScreenContainer backgroundColor={isVaultMode ? '#0F172A' : '#F8FAFC'} barStyle={isVaultMode ? 'light-content' : 'dark-content'}>
      <View style={[styles.container, isVaultMode && styles.vaultContainer]}>
        {/* Top Header */}
        <View style={[styles.topHeader, isVaultMode && styles.vaultHeader]}>
          <Pressable
            onPress={() => {
              if (currentFolder) {
                setFolderStack((prev) => prev.slice(0, -1));
                setSelectedIds(new Set());
              } else if (!isHomeOverview || isVaultMode) {
                if (isVaultMode) {
                  lockSafeVault();
                } else {
                  resetAllFilters();
                }
              } else {
                onBackToDashboard();
              }
            }}
            style={styles.backBtn}
          >
            <Text variant="caption" color={isVaultMode ? '#FFFFFF' : '#1E1B4B'} style={styles.backBtnText}>
              {currentFolder || !isHomeOverview || isVaultMode ? '← Back' : '← Home'}
            </Text>
          </Pressable>

          <Text
            variant="h3"
            color={isVaultMode ? '#FFFFFF' : '#1E1B4B'}
            numberOfLines={1}
            style={styles.headerTitle}
          >
            {activeFilterTitle}
          </Text>

          <Pressable
            onPress={() => {
              if (isVaultMode) lockSafeVault();
              else handleOpenVaultCard();
            }}
            style={[styles.vaultTopPill, isVaultMode && styles.vaultTopPillActive]}
          >
            <Text variant="caption" color={isVaultMode ? '#FFFFFF' : '#6D28D9'} style={styles.vaultPillText}>
              {isVaultMode ? 'Lock 🔒' : 'Vault 🔒'}
            </Text>
          </Pressable>
        </View>

        {/* Live Voice Recording Banner */}
        {isRecordingAudio && (
          <View style={styles.recordingBanner}>
            <Text variant="caption" color="#FFFFFF" style={styles.recordingText}>
              🎙️ Recording voice memory... Tap Stop to save.
            </Text>
            <Pressable onPress={handleToggleVoiceRecord} style={styles.recordingStopBtn}>
              <Text variant="caption" color="#DC2626" style={styles.recordingStopText}>
                Stop & Save
              </Text>
            </Pressable>
          </View>
        )}

        {/* Import / Encryption Progress Banner */}
        {importingMessage && (
          <View style={styles.importingBanner}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text variant="caption" color="#FFFFFF" style={styles.importingText}>
              {importingMessage}
            </Text>
          </View>
        )}

        {/* Search & View/Sort Controls */}
        <View style={styles.searchBarRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search files, stories, #tags, places..."
            placeholderTextColor="#94A3B8"
            style={[styles.searchInput, isVaultMode && styles.searchInputDark]}
          />
          <Pressable onPress={cycleSort} style={styles.toolBtn}>
            <Text variant="caption" color="#475569" style={styles.toolBtnText}>
              ⇅ {SORT_LABELS[sortMode]}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
            style={styles.toolBtn}
          >
            <Text variant="caption" color="#475569" style={styles.toolBtnText}>
              {viewMode === 'grid' ? '☰' : '⊞'}
            </Text>
          </Pressable>
        </View>

        {/* Multi-Select Toolbar */}
        {inSelectionMode && (
          <View style={styles.selectionBar}>
            <Text variant="caption" color="#FFFFFF" style={styles.selectionCount}>
              {selectedIds.size} selected
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectionActions}>
              {!isTrashMode && (
                <>
                  <Pressable onPress={() => setDestModalAction('move')} style={styles.selPill}>
                    <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>Move</Text>
                  </Pressable>
                  <Pressable onPress={() => setDestModalAction('copy')} style={styles.selPill}>
                    <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>Copy</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleRunBulkAction(isVaultMode ? 'remove-from-vault' : 'move-to-vault')
                    }
                    style={styles.selPill}
                  >
                    <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>
                      {isVaultMode ? 'Unlock' : 'To Safe 🔒'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => handleRunBulkAction('favorite')} style={styles.selPill}>
                    <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>⭐ Star</Text>
                  </Pressable>
                  <Pressable onPress={() => handleRunBulkAction('trash')} style={styles.selPillDanger}>
                    <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>Trash</Text>
                  </Pressable>
                </>
              )}
              {isTrashMode && (
                <>
                  <Pressable onPress={() => handleRunBulkAction('restore')} style={styles.selPill}>
                    <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>Restore</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRunBulkAction('delete-forever')}
                    style={styles.selPillDanger}
                  >
                    <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>Delete Forever</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => setSelectedIds(new Set())} style={styles.selPill}>
                <Text variant="caption" color="#FFFFFF" style={styles.selPillText}>Clear</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadMemories(true);
              }}
            />
          }
        >
          {/* Breadcrumb when inside nested folder */}
          {currentFolder && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breadcrumbBar}>
              <Pressable onPress={() => setFolderStack([])} style={styles.crumbItem}>
                <Text variant="caption" color={isVaultMode ? '#93C5FD' : '#7C3AED'} style={styles.crumbText}>
                  {isVaultMode ? 'Safe Root' : 'Memories'} ›
                </Text>
              </Pressable>
              {folderStack.map((f, idx) => (
                <Pressable
                  key={f.id}
                  onPress={() => setFolderStack((prev) => prev.slice(0, idx + 1))}
                  style={styles.crumbItem}
                >
                  <Text variant="caption" color={isVaultMode ? '#E2E8F0' : '#1E1B4B'} style={styles.crumbText}>
                    {f.name} {idx < folderStack.length - 1 ? '›' : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Home Files Dashboard */}
          {isHomeOverview && (
            <>
              {/* Storage & Backup Summary Card */}
              <View style={styles.storageCard}>
                <View style={styles.storageTop}>
                  <Text variant="caption" color="#1E1B4B" style={styles.storageTitle}>
                    Device Memories Storage
                  </Text>
                  <Text variant="caption" color="#6D28D9" style={styles.storageValue}>
                    {formatBytes(localStats.totalBytes || stats.totalBytes)} • {stats.totalItems} items
                  </Text>
                </View>
                <Text variant="caption" color="#64748B" style={styles.storageSub}>
                  Offline-ready on device • Safe Vault holds {stats.vaultCount} encrypted file(s) ({formatBytes(localStats.vaultBytes || stats.vaultBytes)})
                </Text>
              </View>

              {/* 2x3 File Manager Categories Grid */}
              <View style={styles.catGrid}>
                {[
                  { label: 'Photos', icon: '🖼️', count: stats.photoCount, onPress: () => setActiveCategory('photo') },
                  { label: 'Videos', icon: '🎥', count: stats.videoCount, onPress: () => setActiveCategory('video') },
                  { label: 'Documents', icon: '📄', count: stats.documentCount, onPress: () => setActiveCategory('document') },
                  { label: 'Audio', icon: '🎙️', count: stats.audioCount, onPress: () => setActiveCategory('audio') },
                  { label: 'Starred', icon: '⭐', count: stats.favoriteCount, onPress: () => setFavoritesOnly(true) },
                  { label: 'Trash', icon: '🗑️', count: stats.trashedCount, onPress: () => setIsTrashMode(true) },
                ].map((cat) => (
                  <Pressable key={cat.label} onPress={cat.onPress} style={styles.catCard}>
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <Text variant="caption" color="#1E1B4B" style={styles.catLabel}>
                      {cat.label}
                    </Text>
                    <Text variant="caption" color="#64748B" style={styles.catCount}>
                      {cat.count}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Smart Cleanup Quick Chips */}
              <View style={styles.cleanupRow}>
                <Pressable onPress={() => setLargeOnly(true)} style={styles.cleanupChip}>
                  <Text variant="caption" color="#475569" style={styles.cleanupText}>
                    📦 Large Files ({stats.largeCount})
                  </Text>
                </Pressable>
                <Pressable onPress={() => setUnsortedOnly(true)} style={styles.cleanupChip}>
                  <Text variant="caption" color="#475569" style={styles.cleanupText}>
                    🗂️ Unsorted ({stats.unsortedCount})
                  </Text>
                </Pressable>
              </View>

              {/* On This Day Banner */}
              {onThisDay.length > 0 && (
                <Pressable onPress={() => setViewerItem(onThisDay[0])} style={styles.onThisDayBanner}>
                  <Text style={styles.onThisDayIcon}>✨</Text>
                  <View style={styles.onThisDayCopy}>
                    <Text variant="caption" color="#9A3412" style={styles.onThisDayTitle}>
                      On This Day ({onThisDay[0].memoryDate})
                    </Text>
                    <Text variant="caption" color="#C2410C" numberOfLines={1} style={styles.onThisDaySub}>
                      {onThisDay[0].title}
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* Locked Safe Vault Card */}
              <Pressable onPress={handleOpenVaultCard} style={styles.safeBanner}>
                <View style={styles.safeIconBox}>
                  <Text style={styles.safeIcon}>🔒</Text>
                </View>
                <View style={styles.safeTextBox}>
                  <Text variant="caption" color="#FFFFFF" style={styles.safeTitle}>
                    Safe Vault ({stats.vaultCount} locked)
                  </Text>
                  <Text variant="caption" color="#CBD5E1" style={styles.safeSub}>
                    {stats.vaultConfigured
                      ? 'AES-256 encrypted • Hidden from gallery & search'
                      : 'Tap to create Vault PIN & Fingerprint lock'}
                  </Text>
                </View>
                <Text variant="caption" color="#A78BFA" style={styles.safeArrow}>
                  Open ›
                </Text>
              </Pressable>
            </>
          )}

          {/* Folders Section */}
          {(visibleFolders.length > 0 || isVaultMode || currentFolder) && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHead}>
                <Text
                  variant="caption"
                  color={isVaultMode ? '#94A3B8' : '#475569'}
                  style={styles.sectionLabel}
                >
                  FOLDERS ({visibleFolders.length})
                </Text>
                <Pressable onPress={() => setCreateFolderVisible(true)}>
                  <Text variant="caption" color="#7C3AED" style={styles.newFolderText}>
                    + New Folder
                  </Text>
                </Pressable>
              </View>

              {visibleFolders.map((folder) => (
                <Pressable
                  key={folder.id}
                  onPress={() => {
                    setFolderStack((prev) => [...prev, folder]);
                    setSelectedIds(new Set());
                  }}
                  onLongPress={() => handleFolderLongPress(folder)}
                  style={[styles.folderRow, isVaultMode && styles.folderRowDark]}
                >
                  <View style={[styles.folderBadge, { backgroundColor: `${folder.color}20` }]}>
                    <Text style={styles.folderEmoji}>{folder.icon}</Text>
                  </View>
                  <View style={styles.folderInfo}>
                    <Text
                      variant="caption"
                      color={isVaultMode ? '#FFFFFF' : '#1E1B4B'}
                      style={styles.folderName}
                    >
                      {folder.isPinned ? '📌 ' : ''}
                      {folder.name}
                    </Text>
                    <Text variant="caption" color="#64748B" style={styles.folderMeta}>
                      {folder.itemCount} items • {formatBytes(folder.totalBytes)}
                    </Text>
                  </View>
                  <Text variant="caption" color="#94A3B8">›</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Files / Memories Section */}
          <View style={styles.sectionBlock}>
            <Text
              variant="caption"
              color={isVaultMode ? '#94A3B8' : '#475569'}
              style={styles.sectionLabel}
            >
              {isHomeOverview ? 'RECENT & UNSORTED FILES' : 'FILES'} ({items.length})
            </Text>

            {loading ? (
              <ActivityIndicator size="small" color="#7C3AED" style={styles.loader} />
            ) : items.length === 0 ? (
              <View style={[styles.emptyBox, isVaultMode && styles.emptyBoxDark]}>
                <Text style={styles.emptyIcon}>{isVaultMode ? '🔐' : '📂'}</Text>
                <Text variant="h3" color={isVaultMode ? '#FFFFFF' : '#1E1B4B'} style={styles.emptyTitle}>
                  {isVaultMode ? 'Safe Vault is empty' : 'No files here yet'}
                </Text>
                <Text variant="caption" color="#64748B" align="center" style={styles.emptySub}>
                  Tap + below to import photos, videos, PDFs, camera shots or voice notes.
                </Text>
              </View>
            ) : viewMode === 'grid' ? (
              <View style={styles.filesGrid}>
                {items.map((item) => {
                  const selected = selectedIds.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        if (inSelectionMode) toggleSelectItem(item.id);
                        else setViewerItem(item);
                      }}
                      onLongPress={() => toggleSelectItem(item.id)}
                      style={[
                        styles.gridCard,
                        isVaultMode && styles.gridCardDark,
                        selected && styles.cardSelected,
                      ]}
                    >
                      {item.mediaType === 'photo' && item.localUri && !item.isVault ? (
                        <Image source={{ uri: item.localUri }} style={styles.gridThumb} />
                      ) : (
                        <View style={styles.gridIconArea}>
                          <Text style={styles.gridTypeEmoji}>
                            {item.isVault ? '🔒' : getMediaTypeIcon(item.mediaType)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.gridMeta}>
                        <Text
                          variant="caption"
                          color={isVaultMode ? '#FFFFFF' : '#1E1B4B'}
                          numberOfLines={1}
                          style={styles.gridTitle}
                        >
                          {item.isFavorite ? '⭐ ' : ''}
                          {item.title}
                        </Text>
                        <Text variant="caption" color="#64748B" numberOfLines={1} style={styles.gridSub}>
                          {formatBytes(item.sizeBytes)} • {String(item.memoryDate).slice(0, 10)}
                        </Text>
                      </View>
                      {selected && (
                        <View style={styles.checkBadge}>
                          <Text variant="caption" color="#FFFFFF" style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              items.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (inSelectionMode) toggleSelectItem(item.id);
                      else setViewerItem(item);
                    }}
                    onLongPress={() => toggleSelectItem(item.id)}
                    style={[
                      styles.listRow,
                      isVaultMode && styles.folderRowDark,
                      selected && styles.cardSelected,
                    ]}
                  >
                    <Text style={styles.listIcon}>
                      {item.isVault ? '🔒' : getMediaTypeIcon(item.mediaType)}
                    </Text>
                    <View style={styles.folderInfo}>
                      <Text
                        variant="caption"
                        color={isVaultMode ? '#FFFFFF' : '#1E1B4B'}
                        numberOfLines={1}
                        style={styles.folderName}
                      >
                        {item.isFavorite ? '⭐ ' : ''}
                        {item.title}
                      </Text>
                      <Text variant="caption" color="#64748B" numberOfLines={1} style={styles.folderMeta}>
                        {formatBytes(item.sizeBytes)} • {String(item.memoryDate).slice(0, 10)}
                        {item.tags ? ` • ${item.tags}` : ''}
                      </Text>
                    </View>
                    {selected && <Text variant="caption" color="#7C3AED">✓</Text>}
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Floating + Action Button */}
        {!isTrashMode && (
          <Pressable
            onPress={() => setAddSheetVisible(true)}
            style={[styles.fab, isVaultMode && styles.fabVault]}
          >
            <Text style={styles.fabPlus}>+</Text>
          </Pressable>
        )}

        {/* + Add Menu Modal */}
        <Modal
          visible={addSheetVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAddSheetVisible(false)}
        >
          <Pressable style={styles.sheetBackdrop} onPress={() => setAddSheetVisible(false)}>
            <View style={styles.addSheet}>
              <Text variant="h3" color="#0F172A" style={styles.sheetTitle}>
                {isVaultMode ? 'Add to Encrypted Safe Vault 🔒' : 'Add to My Memories'}
              </Text>
              {[
                { label: '📁 Create New Folder', onPress: () => { setAddSheetVisible(false); setCreateFolderVisible(true); } },
                { label: '🖼️ Import Photos from Gallery', onPress: () => handleImportFiles('photo') },
                { label: '🎥 Import Videos', onPress: () => handleImportFiles('video') },
                { label: '📄 Import Documents (PDF, Docs, ZIP)', onPress: () => handleImportFiles('document') },
                { label: '📷 Take Photo (Camera)', onPress: () => handleCameraCapture('photo') },
                { label: '🎬 Record Video (Camera)', onPress: () => handleCameraCapture('video') },
                { label: isRecordingAudio ? '⏹ Stop Voice Recording' : '🎙️ Record Voice Memory', onPress: handleToggleVoiceRecord },
              ].map((opt) => (
                <Pressable key={opt.label} onPress={opt.onPress} style={styles.sheetOption}>
                  <Text variant="caption" color="#0F172A" style={styles.sheetOptionText}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Supporting Modals */}
        <CreateFolderModal
          visible={createFolderVisible}
          isVault={isVaultMode}
          onClose={() => setCreateFolderVisible(false)}
          onCreate={handleCreateFolder}
        />

        <FolderDestinationModal
          visible={destModalAction !== null}
          title={destModalAction === 'copy' ? 'Copy Selected Files to...' : 'Move Selected Files to...'}
          folders={folders}
          onClose={() => setDestModalAction(null)}
          onSelect={(targetId) => {
            if (destModalAction) {
              handleRunBulkAction(destModalAction, targetId);
            }
          }}
        />

        <SafeVaultModal
          visible={vaultModalVisible}
          isConfigured={stats.vaultConfigured}
          biometricEnabled={stats.biometricEnabled}
          onClose={() => setVaultModalVisible(false)}
          onUnlocked={handleVaultUnlocked}
        />

        <MemoryViewerModal
          visible={Boolean(viewerItem)}
          item={viewerItem}
          onClose={() => {
            setViewerItem(null);
            if (isVaultMode) {
              memoriesNative.clearVaultPreviewCache();
            }
          }}
          onSaveDetails={async (item, updates) => {
            await memoriesService.updateItem(item.id, updates);
            loadMemories(true);
          }}
          onToggleFavorite={async (item) => {
            const updated = await memoriesService.updateItem(item.id, {
              isFavorite: !item.isFavorite,
            });
            setViewerItem(updated);
            loadMemories(true);
          }}
          onMoveVault={handleMoveSingleVaultToggle}
          onMoveFolder={(item) => {
            setViewerItem(null);
            setSelectedIds(new Set([item.id]));
            setDestModalAction('move');
          }}
          onDelete={async (item) => {
            await memoriesService.updateItem(item.id, { isTrashed: true });
            setViewerItem(null);
            loadMemories(true);
          }}
          onExternalAction={runWithoutAutoLock}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  vaultContainer: { backgroundColor: '#0F172A' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  vaultHeader: {
    backgroundColor: '#1E293B',
    borderBottomColor: '#334155',
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnText: { fontSize: 13, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  vaultTopPill: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  vaultTopPillActive: {
    backgroundColor: '#DC2626',
  },
  vaultPillText: { fontSize: 11.5, fontWeight: '800' },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC2626',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  recordingText: { fontSize: 12, fontWeight: '700' },
  recordingStopBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recordingStopText: { fontSize: 11.5, fontWeight: '800' },
  importingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#6D28D9',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  importingText: { fontSize: 12, fontWeight: '700' },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  searchInputDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  toolBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: borderRadius.md,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  toolBtnText: { fontSize: 11.5, fontWeight: '700' },
  selectionBar: {
    backgroundColor: '#1E1B4B',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  selectionCount: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  selectionActions: { gap: 8 },
  selPill: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  selPillDanger: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
  },
  selPillText: { fontSize: 11.5, fontWeight: '700' },
  scrollContent: { padding: spacing.md, paddingBottom: 96 },
  breadcrumbBar: { marginBottom: spacing.sm },
  crumbItem: { marginRight: 4 },
  crumbText: { fontSize: 12, fontWeight: '700' },
  storageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    marginBottom: spacing.md,
  },
  storageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  storageTitle: { fontSize: 13, fontWeight: '800' },
  storageValue: { fontSize: 12.5, fontWeight: '800' },
  storageSub: { fontSize: 11.5 },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  catCard: {
    width: '31.8%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  catIcon: { fontSize: 20, marginBottom: 4 },
  catLabel: { fontSize: 12, fontWeight: '700' },
  catCount: { fontSize: 11 },
  cleanupRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  cleanupChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cleanupText: { fontSize: 11.5, fontWeight: '700' },
  onThisDayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  onThisDayIcon: { fontSize: 22, marginRight: spacing.sm },
  onThisDayCopy: { flex: 1 },
  onThisDayTitle: { fontSize: 12, fontWeight: '800' },
  onThisDaySub: { fontSize: 12.5, fontWeight: '600' },
  safeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  safeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  safeIcon: { fontSize: 19 },
  safeTextBox: { flex: 1 },
  safeTitle: { fontSize: 14, fontWeight: '800' },
  safeSub: { fontSize: 11 },
  safeArrow: { fontSize: 12.5, fontWeight: '700' },
  sectionBlock: { marginBottom: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: spacing.xs,
  },
  newFolderText: { fontSize: 12, fontWeight: '700' },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  folderRowDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  folderBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  folderEmoji: { fontSize: 18 },
  folderInfo: { flex: 1 },
  folderName: { fontSize: 13.5, fontWeight: '700' },
  folderMeta: { fontSize: 11 },
  loader: { marginVertical: spacing.lg },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  emptyIcon: { fontSize: 34, marginBottom: spacing.xs },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, lineHeight: 17 },
  filesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  gridCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  gridThumb: { width: '100%', height: 115, backgroundColor: '#E2E8F0' },
  gridIconArea: {
    width: '100%',
    height: 115,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTypeEmoji: { fontSize: 36 },
  gridMeta: { padding: 8 },
  gridTitle: { fontSize: 12.5, fontWeight: '700' },
  gridSub: { fontSize: 10.5 },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 12, fontWeight: '800' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  listIcon: { fontSize: 22, marginRight: spacing.sm },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabVault: { backgroundColor: '#A855F7' },
  fabPlus: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', lineHeight: 30 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  addSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: spacing.sm },
  sheetOption: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetOptionText: { fontSize: 14, fontWeight: '600' },
});
