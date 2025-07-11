import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authenticateToken } from '../services/auth';
import { PermissionService } from '../services/permissions';
import { EncryptionService } from '../services/encryption';
import { prisma } from '../services/database';
import { MembershipRole } from '@prisma/client';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createSecretSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  value: z.string().min(1)
});

const updateSecretSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  value: z.string().min(1).optional()
});

// Create secret
router.post('/:folderId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = req.params.folderId;
    const userId = req.user!.id;
    const { name, description, value } = createSecretSchema.parse(req.body);

    // Check write permissions for the folder
    const hasPermission = await PermissionService.checkFolderPermission(
      userId,
      folderId,
      MembershipRole.WRITE
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Get folder to verify it exists and get organization ID
    const folder = await prisma.folder.findUnique({
      where: { id: folderId }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Encrypt the secret value
    const encryptedValue = EncryptionService.encrypt(value);

    // Create the secret
    const secret = await prisma.secret.create({
      data: {
        name,
        description,
        encryptedValue,
        folderId
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        folder: {
          select: { id: true, name: true, organizationId: true }
        }
      }
    });

    // Create initial version
    await prisma.secretVersion.create({
      data: {
        secretId: secret.id,
        version: 1,
        encryptedValue,
        userId
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        details: `Created secret: ${name}`,
        userId,
        organizationId: folder.organizationId,
        folderId,
        secretId: secret.id
      }
    });

    res.status(201).json({
      message: 'Secret created successfully',
      secret
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create secret error:', error);
    res.status(500).json({ error: 'Failed to create secret' });
  }
});

// Get secrets in folder
router.get('/folder/:folderId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = req.params.folderId;
    const userId = req.user!.id;

    // Check view permissions
    const hasPermission = await PermissionService.checkFolderPermission(
      userId,
      folderId,
      MembershipRole.VIEW
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const secrets = await prisma.secret.findMany({
      where: { folderId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { versions: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ secrets });
  } catch (error) {
    console.error('Get secrets error:', error);
    res.status(500).json({ error: 'Failed to fetch secrets' });
  }
});

// Get secret details (with decrypted value)
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const secretId = req.params.id;
    const userId = req.user!.id;

    // Check view permissions
    const hasPermission = await PermissionService.checkSecretPermission(
      userId,
      secretId,
      MembershipRole.VIEW
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            organization: {
              select: { id: true, name: true }
            }
          }
        },
        versions: {
          select: {
            id: true,
            version: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { version: 'desc' },
          take: 10 // Last 10 versions
        },
        _count: {
          select: { versions: true }
        }
      }
    });

    if (!secret) {
      return res.status(404).json({ error: 'Secret not found' });
    }

    // Decrypt the value
    const decryptedValue = EncryptionService.decrypt(secret.encryptedValue);

    // Log the access
    await prisma.auditLog.create({
      data: {
        action: 'READ',
        details: `Accessed secret: ${secret.name}`,
        userId,
        organizationId: secret.folder.organizationId,
        folderId: secret.folderId,
        secretId: secret.id
      }
    });

    res.json({
      secret: {
        ...secret,
        value: decryptedValue,
        encryptedValue: undefined // Remove encrypted value from response
      }
    });
  } catch (error) {
    console.error('Get secret error:', error);
    res.status(500).json({ error: 'Failed to fetch secret' });
  }
});

// Update secret
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const secretId = req.params.id;
    const userId = req.user!.id;
    const updateData = updateSecretSchema.parse(req.body);

    // Check write permissions
    const hasPermission = await PermissionService.checkSecretPermission(
      userId,
      secretId,
      MembershipRole.WRITE
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Get current secret
    const currentSecret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: {
        folder: { select: { organizationId: true } },
        versions: {
          select: { version: true },
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!currentSecret) {
      return res.status(404).json({ error: 'Secret not found' });
    }

    const updateFields: any = {};
    let newVersion = false;

    // Update name and description if provided
    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.description !== undefined) updateFields.description = updateData.description;

    // Handle value update (requires versioning)
    if (updateData.value) {
      updateFields.encryptedValue = EncryptionService.encrypt(updateData.value);
      newVersion = true;
    }

    // Update the secret
    const secret = await prisma.secret.update({
      where: { id: secretId },
      data: updateFields,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        folder: {
          select: { id: true, name: true }
        }
      }
    });

    // Create new version if value was updated
    if (newVersion) {
      const nextVersion = currentSecret.versions[0]?.version + 1 || 1;
      await prisma.secretVersion.create({
        data: {
          secretId,
          version: nextVersion,
          encryptedValue: updateFields.encryptedValue,
          userId
        }
      });
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        details: `Updated secret: ${secret.name}${newVersion ? ' (new version)' : ''}`,
        userId,
        organizationId: currentSecret.folder.organizationId,
        folderId: currentSecret.folderId,
        secretId: secret.id
      }
    });

    res.json({
      message: 'Secret updated successfully',
      secret,
      newVersion
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update secret error:', error);
    res.status(500).json({ error: 'Failed to update secret' });
  }
});

// Get secret version history
router.get('/:id/versions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const secretId = req.params.id;
    const userId = req.user!.id;

    // Check view permissions
    const hasPermission = await PermissionService.checkSecretPermission(
      userId,
      secretId,
      MembershipRole.VIEW
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const versions = await prisma.secretVersion.findMany({
      where: { secretId },
      select: {
        id: true,
        version: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { version: 'desc' }
    });

    res.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// Get specific version of secret
router.get('/:id/versions/:version', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const secretId = req.params.id;
    const version = parseInt(req.params.version);
    const userId = req.user!.id;

    // Check view permissions
    const hasPermission = await PermissionService.checkSecretPermission(
      userId,
      secretId,
      MembershipRole.VIEW
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const secretVersion = await prisma.secretVersion.findUnique({
      where: {
        secretId_version: {
          secretId,
          version
        }
      },
      include: {
        secret: {
          select: {
            id: true,
            name: true,
            folder: {
              select: { organizationId: true }
            }
          }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!secretVersion) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Decrypt the value
    const decryptedValue = EncryptionService.decrypt(secretVersion.encryptedValue);

    // Log the access
    await prisma.auditLog.create({
      data: {
        action: 'READ',
        details: `Accessed secret version ${version}: ${secretVersion.secret.name}`,
        userId,
        organizationId: secretVersion.secret.folder.organizationId,
        secretId
      }
    });

    res.json({
      version: {
        ...secretVersion,
        value: decryptedValue,
        encryptedValue: undefined
      }
    });
  } catch (error) {
    console.error('Get version error:', error);
    res.status(500).json({ error: 'Failed to fetch version' });
  }
});

// Delete secret
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const secretId = req.params.id;
    const userId = req.user!.id;

    // Check admin permissions
    const hasPermission = await PermissionService.checkSecretPermission(
      userId,
      secretId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get secret info before deletion
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: {
        folder: { select: { organizationId: true } }
      }
    });

    if (!secret) {
      return res.status(404).json({ error: 'Secret not found' });
    }

    // Delete the secret (this will cascade delete versions due to Prisma schema)
    await prisma.secret.delete({
      where: { id: secretId }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        details: `Deleted secret: ${secret.name}`,
        userId,
        organizationId: secret.folder.organizationId,
        folderId: secret.folderId
      }
    });

    res.json({ message: 'Secret deleted successfully' });
  } catch (error) {
    console.error('Delete secret error:', error);
    res.status(500).json({ error: 'Failed to delete secret' });
  }
});

export default router;
