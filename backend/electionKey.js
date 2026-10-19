const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Creates a 32-byte encryption key from JWT_SECRET.
 */
function encryptionKey() {
  return crypto
    .createHash('sha256')
    .update(String(process.env.JWT_SECRET || ''))
    .digest();
}

/**
 * Generates a random 8-digit election key.
 */
function generateElectionKey() {
  let key = String(crypto.randomInt(10000000, 100000000));

  // Avoid common/test keys
  while (key === '123456' || key === '12345678') {
    key = String(crypto.randomInt(10000000, 100000000));
  }

  return key;
}

/**
 * Protects the election key:
 * 1. bcrypt hash -> used to verify student's entered key
 * 2. AES-256-GCM encryption -> used when professor needs to see the key later
 */
async function protectElectionKey(plainKey) {
  const key = String(plainKey).trim();

  // Hash for verification
  const hash = await bcrypt.hash(key, 10);

  // Random initialization vector
  const iv = crypto.randomBytes(12);

  // AES-256-GCM encryption
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    encryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(key, 'utf8'),
    cipher.final(),
  ]);

  // Authentication tag
  const tag = cipher.getAuthTag();

  // Store IV + tag + encrypted data together
  const stored = Buffer.concat([
    iv,
    tag,
    encrypted,
  ]).toString('base64');

  return {
    hash,
    stored,
  };
}

/**
 * Decrypts the stored election key.
 * Used only when professor needs to view/share the election key.
 */
function revealElectionKey(stored) {
  try {
    if (!stored) {
      return null;
    }

    const buf = Buffer.from(String(stored), 'base64');

    // 12 bytes IV + 16 bytes auth tag = 28 bytes minimum
    if (buf.length < 29) {
      return null;
    }

    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encryptedData = buf.subarray(28);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      iv
    );

    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Failed to reveal election key:', error.message);
    return null;
  }
}

/**
 * Verifies a student's entered election key
 * against the bcrypt hash stored in the database.
 */
async function verifyElectionKey(provided, hash) {
  if (!provided || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(
      String(provided).trim(),
      String(hash)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Normalizes email before storing/checking.
 * Example:
 * " Student@College.COM " -> "student@college.com"
 */
function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * Normalizes roll number before storing/checking.
 * Example:
 * " se 12 34 " -> "SE1234"
 */
function normalizeRoll(roll) {
  return String(roll || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

module.exports = {
  generateElectionKey,
  protectElectionKey,
  revealElectionKey,
  verifyElectionKey,
  normalizeEmail,
  normalizeRoll,
};