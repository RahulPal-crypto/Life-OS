import { apiConfig } from '../../../config/apiConfig';
import { authService } from '../../auth/services/authService';
import { NativeMediaType } from './memoriesNative';

export type MemorySort = 'newest' | 'oldest' | 'name_asc' | 'size_desc' | 'type';

export type MemoryBulkActionType =
  | 'move'
  | 'copy'
  | 'trash'
  | 'restore'
  | 'delete-forever'
  | 'move-to-vault'
  | 'remove-from-vault'
  | 'favorite'
  | 'unfavorite';

export interface MemoryFolder {
  id: string;
  parentId: string | null;
  name: string;
  color: string;
  icon: string;
  isPinned: boolean;
  isVault: boolean;
  isTrashed: boolean;
  trashedAt: number | null;
  itemCount: number;
  totalBytes: number;
}

export interface MemoryItem {
  id: string;
  folderId: string | null;
  title: string;
  fileName: string;
  mediaType: NativeMediaType;
  mimeType: string | null;
  sizeBytes: number;
  localUri: string | null;
  vaultUri: string | null;
  driveFileId: string | null;
  driveSynced: boolean;
  story: string | null;
  memoryDate: string;
  location: string | null;
  people: string | null;
  tags: string | null;
  mood: string | null;
  isFavorite: boolean;
  isVault: boolean;
  isTrashed: boolean;
  trashedAt: number | null;
  linkedActivityId: string | null;
}

export interface MemoryStats {
  totalItems: number;
  totalBytes: number;
  photoCount: number;
  videoCount: number;
  documentCount: number;
  audioCount: number;
  favoriteCount: number;
  trashedCount: number;
  largeCount: number;
  unsortedCount: number;
  vaultCount: number;
  vaultBytes: number;
  vaultConfigured: boolean;
  biometricEnabled: boolean;
}

export interface MemoryOverviewResponse {
  stats: MemoryStats;
  onThisDay: MemoryItem[];
  folders: MemoryFolder[];
  items: MemoryItem[];
}

export interface OverviewFilterParams {
  folderId?: string | null;
  category?: NativeMediaType | null;
  search?: string;
  sort?: MemorySort;
  vault?: boolean;
  trashed?: boolean;
  favoritesOnly?: boolean;
  largeOnly?: boolean;
  unsortedOnly?: boolean;
}

class MemoriesService {
  private vaultToken: string | null = null;

  getVaultToken(): string | null {
    return this.vaultToken;
  }

  isVaultUnlocked(): boolean {
    return Boolean(this.vaultToken);
  }

  clearVaultSession(): void {
    this.vaultToken = null;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const extraHeaders: Record<string, string> = {};
    if (this.vaultToken) {
      extraHeaders['x-vault-token'] = this.vaultToken;
    }

    return authService.authorizedRequest(endpoint, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...extraHeaders,
      },
    });
  }

  async fetchOverview(filters: OverviewFilterParams = {}): Promise<MemoryOverviewResponse> {
    const params: string[] = [];
    if (filters.folderId) params.push(`folderId=${encodeURIComponent(filters.folderId)}`);
    if (filters.category) params.push(`category=${encodeURIComponent(filters.category)}`);
    if (filters.search?.trim()) params.push(`search=${encodeURIComponent(filters.search.trim())}`);
    if (filters.sort) params.push(`sort=${encodeURIComponent(filters.sort)}`);
    if (filters.vault) params.push('vault=1');
    if (filters.trashed) params.push('trashed=1');
    if (filters.favoritesOnly) params.push('favorites=1');
    if (filters.largeOnly) params.push('largeOnly=1');
    if (filters.unsortedOnly) params.push('unsortedOnly=1');

    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    const json = await this.request(`${apiConfig.endpoints.memories.overview}${qs}`);
    return json.data;
  }

  async createFolder(payload: {
    name: string;
    parentId?: string | null;
    icon?: string;
    color?: string;
    isPinned?: boolean;
    isVault?: boolean;
  }): Promise<MemoryFolder> {
    const json = await this.request(apiConfig.endpoints.memories.folders, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return json.data;
  }

  async updateFolder(
    folderId: string,
    payload: Partial<{
      name: string;
      parentId: string | null;
      icon: string;
      color: string;
      isPinned: boolean;
      isVault: boolean;
      isTrashed: boolean;
    }>
  ): Promise<MemoryFolder> {
    const json = await this.request(
      `${apiConfig.endpoints.memories.folders}/${encodeURIComponent(folderId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return json.data;
  }

  async deleteFolder(folderId: string, permanent = false): Promise<void> {
    await this.request(
      `${apiConfig.endpoints.memories.folders}/${encodeURIComponent(folderId)}${
        permanent ? '?permanent=1' : ''
      }`,
      { method: 'DELETE' }
    );
  }

  async createItem(payload: {
    folderId?: string | null;
    title: string;
    fileName: string;
    mediaType: NativeMediaType;
    mimeType?: string | null;
    sizeBytes?: number;
    localUri?: string | null;
    vaultUri?: string | null;
    story?: string;
    memoryDate?: string;
    location?: string;
    people?: string;
    tags?: string;
    mood?: string;
    isFavorite?: boolean;
    isVault?: boolean;
  }): Promise<MemoryItem> {
    const json = await this.request(apiConfig.endpoints.memories.items, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return json.data;
  }

  async updateItem(
    itemId: string,
    payload: Partial<{
      title: string;
      fileName: string;
      folderId: string | null;
      localUri: string | null;
      vaultUri: string | null;
      story: string | null;
      memoryDate: string;
      location: string | null;
      people: string | null;
      tags: string | null;
      mood: string | null;
      isFavorite: boolean;
      isVault: boolean;
      isTrashed: boolean;
    }>
  ): Promise<MemoryItem> {
    const json = await this.request(
      `${apiConfig.endpoints.memories.items}/${encodeURIComponent(itemId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return json.data;
  }

  async bulkAction(
    action: MemoryBulkActionType,
    itemIds: string[],
    targetFolderId: string | null = null
  ): Promise<{ affected: number; urisToDelete: string[] }> {
    const json = await this.request(apiConfig.endpoints.memories.bulk, {
      method: 'POST',
      body: JSON.stringify({ action, itemIds, targetFolderId }),
    });
    return json.data;
  }

  async setupVaultPin(payload: {
    pin: string;
    currentPin?: string;
    biometricEnabled?: boolean;
  }): Promise<{ biometricKey?: string; biometricEnabled: boolean }> {
    const json = await this.request(apiConfig.endpoints.memories.vaultSetup, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (json.data?.vaultToken) {
      this.vaultToken = json.data.vaultToken;
    }
    return {
      biometricKey: json.data?.biometricKey,
      biometricEnabled: Boolean(json.data?.biometricEnabled),
    };
  }

  async unlockVaultPin(pin: string): Promise<boolean> {
    const json = await this.request(apiConfig.endpoints.memories.vaultUnlock, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    this.vaultToken = json.data?.vaultToken || null;
    return Boolean(this.vaultToken);
  }

  async unlockVaultBiometric(biometricKey: string): Promise<boolean> {
    const json = await this.request(apiConfig.endpoints.memories.vaultUnlockBiometric, {
      method: 'POST',
      body: JSON.stringify({ biometricKey }),
    });
    this.vaultToken = json.data?.vaultToken || null;
    return Boolean(this.vaultToken);
  }
}

export const memoriesService = new MemoriesService();
