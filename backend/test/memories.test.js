import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateFolder,
  validateCreateItem,
  validateBulkAction,
  validateVaultPin,
  validateOverviewQuery,
} from '../src/modules/memories/memories.validator.js';

test('Memories validators accept valid folder, item, bulk action, and vault PIN inputs', () => {
  const folder = validateCreateFolder({
    name: 'Goa Trip 2026',
    icon: '🏝️',
    color: '#0EA5E9',
    isPinned: true,
  });
  assert.equal(folder.isValid, true);
  assert.equal(folder.sanitized.name, 'Goa Trip 2026');
  assert.equal(folder.sanitized.isPinned, true);

  const item = validateCreateItem({
    title: 'Sunset Photo',
    fileName: 'IMG_20261112.jpg',
    mediaType: 'photo',
    sizeBytes: 2450120,
    story: 'Evening walk on the beach',
    tags: '#goa,#sunset',
    location: 'Baga Beach',
  });
  assert.equal(item.isValid, true);
  assert.equal(item.sanitized.mediaType, 'photo');
  assert.equal(item.sanitized.sizeBytes, 2450120);

  const bulk = validateBulkAction({
    action: 'move-to-vault',
    itemIds: ['id-1', 'id-2'],
    targetFolderId: 'vault-folder-1',
  });
  assert.equal(bulk.isValid, true);
  assert.equal(bulk.sanitized.itemIds.length, 2);

  const pin = validateVaultPin({ pin: '2580' });
  assert.equal(pin.isValid, true);
});

test('Memories validators reject invalid media types, empty titles, and non-numeric Vault PINs', () => {
  const badItem = validateCreateItem({ title: '', fileName: '', mediaType: 'exe' });
  assert.equal(badItem.isValid, false);
  assert.ok(badItem.errors.title);
  assert.ok(badItem.errors.mediaType);

  const badPin = validateVaultPin({ pin: '12ab' });
  assert.equal(badPin.isValid, false);
  assert.ok(badPin.errors.pin);

  const query = validateOverviewQuery({ vault: '1', sort: 'size_desc', largeOnly: 'true' });
  assert.equal(query.vault, true);
  assert.equal(query.sort, 'size_desc');
  assert.equal(query.largeOnly, true);
});
