import { prisma } from '../lib/prisma';
import { Role, SecretType } from '@prisma/client';
import { logger } from '../lib/logger';
import { EncryptionService } from '../lib/encryption';

export interface CreateSecretRequest {
  name: string;
  description?: string;
  value: string; // Plain text value to be encrypted
  type: SecretType;
  folderId: string;
  createdBy: string;
}

export interface UpdateSecretRequest {
  name?: string;
  description?: string;
  value?: string; // Plain text value to be encrypted
  type?: SecretType;
}

export interface SecretResponse {
  id: string;
  name: string;
  description?: string;
  type: SecretType;
  folderId: string;
  createdAt: Date;
  updatedAt: Date;
  folder?: {
    id: string;
    name: string;
    organization: {
      id: string;
      name: string;
    };
  };
}

export interface SecretWithValueResponse extends SecretResponse {
  value: string; // Decrypted value
}

export class SecretService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = EncryptionService.getInstance();
  }

  /**
   * Check if user has access to organization via folder
   */
  private async checkFolderAccess(userId: string, folderId: string, requiredRole: Role = Role.VIEW): Promise<boolean> {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        organization: true
      }
    });

    if (!folder || folder.organization.isDeleted) {
      return false;
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId: folder.organizationId,
      }
    });

    if (!membership) {
      return false;
    }

    // Check role hierarchy: ADMIN > WRITE > VIEW
    const roleHierarchy = { VIEW: 1, WRITE: 2, ADMIN: 3 };
    return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
  }

  /**
   * Check if user has access to a specific secret
   */
  private async checkSecretAccess(userId: string, secretId: string, requiredRole: Role = Role.VIEW): Promise<boolean> {
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: {
        folder: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!secret || secret.folder.organization.isDeleted) {
      return false;
    }

    return this.checkFolderAccess(userId, secret.folderId, requiredRole);
  }

  /**
   * Create a new secret
   */
  async createSecret(request: CreateSecretRequest): Promise<SecretResponse> {
    // Check folder access (WRITE permission required)
    const hasAccess = await this.checkFolderAccess(request.createdBy, request.folderId, Role.WRITE);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to create secrets in this folder');
    }

    // Validate folder exists
    const folder = await prisma.folder.findUnique({
      where: { id: request.folderId },
      include: {
        organization: {
          select: { id: true, name: true, isDeleted: true }
        }
      }
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    if (folder.organization.isDeleted) {
      throw new Error('Cannot create secrets in deleted organization');
    }

    // Check for duplicate names in the same folder
    const existingSecret = await prisma.secret.findFirst({
      where: {
        name: request.name,
        folderId: request.folderId
      }
    });

    if (existingSecret) {
      throw new Error('A secret with this name already exists in this folder');
    }

    // Encrypt the secret value
    const encryptionResult = this.encryptionService.encrypt(request.value);
    if (!encryptionResult.success) {
      throw new Error('Failed to encrypt secret value');
    }

    // Create the secret in a transaction
    const secret = await prisma.$transaction(async (tx) => {
      const newSecret = await tx.secret.create({
        data: {
          name: request.name,
          description: request.description,
          encryptedValue: encryptionResult.encryptedData,
          type: request.type,
          folderId: request.folderId
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
              organization: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      // Create initial version
      await tx.secretVersion.create({
        data: {
          encryptedValue: encryptionResult.encryptedData,
          version: 1,
          changeNote: 'Initial version',
          secretId: newSecret.id,
          createdBy: request.createdBy
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'SECRET_CREATED',
          details: JSON.stringify({
            secretId: newSecret.id,
            secretName: newSecret.name,
            secretType: newSecret.type,
            folderId: request.folderId,
            folderName: newSecret.folder.name,
            organizationId: newSecret.folder.organization.id,
            organizationName: newSecret.folder.organization.name
          }),
          userId: request.createdBy,
          secretId: newSecret.id
        }
      });

      return newSecret;
    });

    logger.info('Secret created successfully', {
      secretId: secret.id,
      secretName: secret.name,
      folderId: request.folderId,
      createdBy: request.createdBy
    });

    return {
      id: secret.id,
      name: secret.name,
      description: secret.description || undefined,
      type: secret.type,
      folderId: secret.folderId,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      folder: secret.folder
    };
  }

  /**
   * Get secret by ID (without decrypted value)
   */
  async getSecretById(secretId: string, userId: string): Promise<SecretResponse> {
    // First check if secret exists
    const secretExists = await prisma.secret.findUnique({
      where: { id: secretId },
      select: { id: true }
    });

    if (!secretExists) {
      throw new Error('Secret not found');
    }

    // Then check secret access
    const hasAccess = await this.checkSecretAccess(userId, secretId, Role.VIEW);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to view this secret');
    }

    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            organization: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!secret) {
      throw new Error('Secret not found');
    }

    // Create audit log for viewing
    await prisma.auditLog.create({
      data: {
        action: 'SECRET_VIEWED',
        details: JSON.stringify({
          secretId: secret.id,
          secretName: secret.name,
          folderId: secret.folderId,
          organizationId: secret.folder.organization.id
        }),
        userId,
        secretId: secret.id
      }
    });

    return {
      id: secret.id,
      name: secret.name,
      description: secret.description || undefined,
      type: secret.type,
      folderId: secret.folderId,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      folder: secret.folder
    };
  }

  /**
   * Get secret by ID with decrypted value
   */
  async getSecretWithValue(secretId: string, userId: string): Promise<SecretWithValueResponse> {
    const secret = await this.getSecretById(secretId, userId);
    
    // Get the encrypted value
    const secretData = await prisma.secret.findUnique({
      where: { id: secretId },
      select: { encryptedValue: true }
    });

    if (!secretData) {
      throw new Error('Secret not found');
    }

    // Decrypt the value
    const decryptionResult = this.encryptionService.decrypt(secretData.encryptedValue);
    if (!decryptionResult.success) {
      throw new Error('Failed to decrypt secret value');
    }

    return {
      ...secret,
      value: decryptionResult.decryptedData
    };
  }

  /**
   * Get all secrets in a folder
   */
  async getFolderSecrets(folderId: string, userId: string): Promise<SecretResponse[]> {
    // Check folder access
    const hasAccess = await this.checkFolderAccess(userId, folderId, Role.VIEW);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to view secrets in this folder');
    }

    const secrets = await prisma.secret.findMany({
      where: { folderId },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            organization: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return secrets.map(secret => ({
      id: secret.id,
      name: secret.name,
      description: secret.description || undefined,
      type: secret.type,
      folderId: secret.folderId,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      folder: secret.folder
    }));
  }

  /**
   * Update secret
   */
  async updateSecret(secretId: string, updates: UpdateSecretRequest, userId: string): Promise<SecretResponse> {
    // First check if secret exists
    const existingSecret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: {
        folder: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!existingSecret) {
      throw new Error('Secret not found');
    }

    // Then check secret access (WRITE permission required)
    const hasAccess = await this.checkSecretAccess(userId, secretId, Role.WRITE);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to update this secret');
    }

    // Check for duplicate names if name is being changed
    if (updates.name && updates.name !== existingSecret.name) {
      const duplicateSecret = await prisma.secret.findFirst({
        where: {
          name: updates.name,
          folderId: existingSecret.folderId,
          id: { not: secretId }
        }
      });

      if (duplicateSecret) {
        throw new Error('A secret with this name already exists in this folder');
      }
    }

    let encryptedValue = existingSecret.encryptedValue;
    let newVersion = false;

    // Encrypt new value if provided
    if (updates.value !== undefined) {
      const encryptionResult = this.encryptionService.encrypt(updates.value);
      if (!encryptionResult.success) {
        throw new Error('Failed to encrypt secret value');
      }
      encryptedValue = encryptionResult.encryptedData;
      newVersion = true;
    }

    // Update the secret in a transaction
    const updatedSecret = await prisma.$transaction(async (tx) => {
      const secret = await tx.secret.update({
        where: { id: secretId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.type && { type: updates.type }),
          ...(newVersion && { encryptedValue })
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
              organization: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      // Create new version if value changed
      if (newVersion) {
        const latestVersion = await tx.secretVersion.findFirst({
          where: { secretId },
          orderBy: { version: 'desc' }
        });

        await tx.secretVersion.create({
          data: {
            encryptedValue,
            version: (latestVersion?.version || 0) + 1,
            changeNote: 'Updated via API',
            secretId,
            createdBy: userId
          }
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'SECRET_UPDATED',
          details: JSON.stringify({
            secretId: secret.id,
            secretName: secret.name,
            updates: { ...updates, value: updates.value ? '[ENCRYPTED]' : undefined },
            organizationId: secret.folder.organization.id
          }),
          userId,
          secretId: secret.id
        }
      });

      return secret;
    });

    logger.info('Secret updated successfully', {
      secretId,
      updates: { ...updates, value: updates.value ? '[ENCRYPTED]' : undefined },
      updatedBy: userId
    });

    return {
      id: updatedSecret.id,
      name: updatedSecret.name,
      description: updatedSecret.description || undefined,
      type: updatedSecret.type,
      folderId: updatedSecret.folderId,
      createdAt: updatedSecret.createdAt,
      updatedAt: updatedSecret.updatedAt,
      folder: updatedSecret.folder
    };
  }

  /**
   * Delete secret
   */
  async deleteSecret(secretId: string, userId: string): Promise<void> {
    // First check if secret exists
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: {
        folder: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!secret) {
      throw new Error('Secret not found');
    }

    // Then check secret access (WRITE permission required)
    const hasAccess = await this.checkSecretAccess(userId, secretId, Role.WRITE);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to delete this secret');
    }

    // Delete the secret (CASCADE will handle versions and audit logs)
    await prisma.$transaction(async (tx) => {
      await tx.secret.delete({
        where: { id: secretId }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'SECRET_DELETED',
          details: JSON.stringify({
            secretId: secret.id,
            secretName: secret.name,
            secretType: secret.type,
            folderId: secret.folderId,
            folderName: secret.folder.name,
            organizationId: secret.folder.organization.id,
            organizationName: secret.folder.organization.name
          }),
          userId
        }
      });
    });

    logger.info('Secret deleted successfully', {
      secretId,
      secretName: secret.name,
      deletedBy: userId
    });
  }

  /**
   * Get secret versions
   */
  async getSecretVersions(secretId: string, userId: string): Promise<any[]> {
    // Check secret access
    const hasAccess = await this.checkSecretAccess(userId, secretId, Role.VIEW);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to view secret versions');
    }

    const versions = await prisma.secretVersion.findMany({
      where: { secretId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        changeNote: true,
        createdAt: true,
        createdBy: true
      }
    });

    return versions;
  }
}
