import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSetupPin,
  validateVerifyPin,
  validateSyncContacts,
  validateCreateConversation,
  validateSendMessage,
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

    const emptyMsg = validateSendMessage({ content: '' });
    assert.equal(emptyMsg.isValid, false);
  });
});
