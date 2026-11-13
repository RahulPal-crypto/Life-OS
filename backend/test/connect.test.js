import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSetupPin,
  validateVerifyPin,
  validateSyncContacts,
  validateCreateConversation,
  validateSendMessage,
  validateUploadMedia,
} from '../src/modules/connect/connect.validator.js';

describe('Connect Validators', () => {
  it('validates setup PIN successfully', () => {
    const res = validateSetupPin({
      pin: '1234',
      biometricEnabled: true,
      autoLockDelay: 'immediate',
    });
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.pin, '1234');
    assert.equal(res.sanitized.biometricEnabled, true);
    assert.equal(res.sanitized.autoLockDelay, 'immediate');
  });

  it('rejects invalid PIN formats', () => {
    const res1 = validateSetupPin({ pin: 'abc' });
    assert.equal(res1.isValid, false);

    const res2 = validateSetupPin({ pin: '12' });
    assert.equal(res2.isValid, false);

    const res3 = validateVerifyPin({ pin: '' });
    assert.equal(res3.isValid, false);
  });

  it('normalizes contacts in sync request', () => {
    const res = validateSyncContacts({
      contacts: [
        { name: 'Aman Sharma', phone: '+91 98765-43210' },
        { name: 'Priya', phone: '098765 43210' },
        { name: 'Empty', phone: '' },
      ],
    });
    assert.equal(res.isValid, true);
    assert.equal(res.sanitized.contacts.length, 2);
    assert.equal(res.sanitized.contacts[0].phone, '+919876543210');
    assert.equal(res.sanitized.contacts[1].phone, '09876543210');
  });

  it('validates conversation and message payloads', () => {
    const conv1 = validateCreateConversation({ type: 'direct', targetUserId: 'user-123' });
    assert.equal(conv1.isValid, true);
    assert.equal(conv1.sanitized.targetUserId, 'user-123');

    const conv2 = validateCreateConversation({ type: 'group', name: 'Trip Friends', memberIds: ['u1', 'u2'] });
    assert.equal(conv2.isValid, true);
    assert.equal(conv2.sanitized.name, 'Trip Friends');

    const msg = validateSendMessage({ content: 'Hello from Life OS!' });
    assert.equal(msg.isValid, true);
    assert.equal(msg.sanitized.content, 'Hello from Life OS!');
    assert.equal(msg.sanitized.messageType, 'text');

    const emptyMsg = validateSendMessage({ content: '' });
    assert.equal(emptyMsg.isValid, false);

    // Phase 2: Media messages with captions or attachments
    const imgMsg = validateSendMessage({
      messageType: 'image',
      mediaUrl: '/uploads/connect/2026/11/sample.jpg',
      fileName: 'sample.jpg',
      fileSize: 102400,
      content: 'Look at this photo',
    });
    assert.equal(imgMsg.isValid, true);
    assert.equal(imgMsg.sanitized.messageType, 'image');
    assert.equal(imgMsg.sanitized.mediaUrl, '/uploads/connect/2026/11/sample.jpg');
    assert.equal(imgMsg.sanitized.fileName, 'sample.jpg');
    assert.equal(imgMsg.sanitized.fileSize, 102400);

    const voiceMsg = validateSendMessage({
      messageType: 'audio',
      mediaUrl: '/uploads/connect/2026/11/voice.m4a',
      fileName: 'voice.m4a',
      mediaDuration: 12,
    });
    assert.equal(voiceMsg.isValid, true);
    assert.equal(voiceMsg.sanitized.messageType, 'audio');
    assert.equal(voiceMsg.sanitized.mediaDuration, 12);
  });

  it('validates media upload payloads for Phase 2', () => {
    const validUpload = validateUploadMedia({
      fileName: 'invoice.pdf',
      base64Data: 'JVBERi0xLjQKJ...',
      mediaType: 'document',
      mimeType: 'application/pdf',
    });
    assert.equal(validUpload.isValid, true);
    assert.equal(validUpload.sanitized.fileName, 'invoice.pdf');
    assert.equal(validUpload.sanitized.mediaType, 'document');

    const invalidUpload = validateUploadMedia({
      fileName: '',
      base64Data: '',
    });
    assert.equal(invalidUpload.isValid, false);
    assert.equal(invalidUpload.errors.length >= 2, true);
  });
});
