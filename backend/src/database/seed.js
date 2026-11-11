import crypto from 'crypto';
import { query, pool } from '../config/db.js';
import { hashPassword } from '../utils/hashHelper.js';

export const runSeed = async () => {
  console.log('[Seeder] Checking for default test user...');

  const email = 'rahul@lifeos.app';
  const phone = '+91 9876543210';
  const rawPassword = 'password123';

  try {
    const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);

    if (existing.length > 0) {
      console.log(`[Seeder] User '${email}' already exists. Skipping seed.`);
      return;
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(rawPassword);

    await query(
      `INSERT INTO users (id, name, email, phone, password_hash, is_email_verified, is_phone_verified, account_status, terms_accepted)
       VALUES (?, ?, ?, ?, ?, 1, 1, 'active', 1)`,
      [userId, 'Rahul Pal', email, phone, passwordHash]
    );

    console.log(`[Seeder] Successfully created default test user:`);
    console.log(`         Name: Rahul Pal`);
    console.log(`         Email: ${email}`);
    console.log(`         Phone: ${phone}`);
    console.log(`         Password: ${rawPassword}`);
  } catch (error) {
    console.error('[Seeder Error]:', error.message);
  } finally {
    await pool.end();
  }
};

if (process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
