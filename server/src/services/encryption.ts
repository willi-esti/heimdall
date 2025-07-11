import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 12, but we use 16 for compatibility
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class EncryptionService {
  private static key: Buffer;

  static initialize() {
    const keyString = process.env.ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    if (keyString.length !== KEY_LENGTH) {
      throw new Error(`ENCRYPTION_KEY must be exactly ${KEY_LENGTH} characters long`);
    }
    
    this.key = Buffer.from(keyString, 'utf8');
  }

  static encrypt(text: string): string {
    if (!this.key) {
      this.initialize();
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, this.key);
    cipher.setAutoPadding(false);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + Auth Tag + Encrypted Data
    const combined = iv.toString('hex') + authTag.toString('hex') + encrypted;
    
    return combined;
  }

  static decrypt(encryptedData: string): string {
    if (!this.key) {
      this.initialize();
    }

    // Extract components
    const ivHex = encryptedData.slice(0, IV_LENGTH * 2);
    const authTagHex = encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2);
    const encryptedHex = encryptedData.slice((IV_LENGTH + TAG_LENGTH) * 2);
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(ALGORITHM, this.key);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate a secure random encryption key
   */
  static generateKey(): string {
    return crypto.randomBytes(KEY_LENGTH).toString('base64').slice(0, KEY_LENGTH);
  }
}
