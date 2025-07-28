import * as crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

export interface EncryptionResult {
  encryptedData: string; // Base64 encoded: salt + iv + tag + encrypted
  success: boolean;
}

export interface DecryptionResult {
  decryptedData: string;
  success: boolean;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private readonly encryptionKey: string;

  private constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (key.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
    this.encryptionKey = key;
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Derives a key from the master key using PBKDF2 with a salt
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
  }

  /**
   * Encrypts data using AES-256-GCM
   */
  public encrypt(data: string): EncryptionResult {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Derive key from master key and salt
      const key = this.deriveKey(salt);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from('heimdall-secrets'));
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([salt, iv, tag, encrypted]);
      
      // Return base64 encoded result
      return {
        encryptedData: combined.toString('base64'),
        success: true
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      return {
        encryptedData: '',
        success: false
      };
    }
  }

  /**
   * Decrypts data using AES-256-GCM
   */
  public decrypt(encryptedData: string): DecryptionResult {
    try {
      // Decode base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = combined.subarray(0, SALT_LENGTH);
      const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      
      // Derive key from master key and salt
      const key = this.deriveKey(salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      decipher.setAAD(Buffer.from('heimdall-secrets'));
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        decryptedData: decrypted,
        success: true
      };
    } catch (error) {
      logger.error('Decryption failed:', error);
      return {
        decryptedData: '',
        success: false
      };
    }
  }

  /**
   * Generates a random encryption key for testing/setup
   */
  public static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
