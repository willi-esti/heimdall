import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, authenticateToken } from '../services/auth';
import { PermissionService } from '../services/permissions';
import { prisma } from '../services/database';
import { MembershipRole } from '@prisma/client';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createFolderSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional()
});

const updateFolderSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  viewOverride: z.enum(['VIEW', 'WRITE', 'ADMIN']).optional(),
  writeOverride: z.enum(['VIEW', 'WRITE', 'ADMIN']).optional(),
  adminOverride: z.enum(['VIEW', 'WRITE', 'ADMIN']).optional()
});

// Create folder
router.post('/:organizationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.organizationId;
    const userId = req.user!.id;
    const { name, description, parentId } = createFolderSchema.parse(req.body);

    // Check write permissions for the organization (or parent folder if nested)
    let hasPermission = false;
    if (parentId) {
      hasPermission = await PermissionService.checkFolderPermission(
        userId,
        parentId,
        MembershipRole.WRITE
      );
    } else {
      hasPermission = await PermissionService.checkOrganizationPermission(
        userId,
        organizationId,
        MembershipRole.WRITE
      );
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // If parentId is provided, verify it belongs to the same organization
    if (parentId) {
      const parentFolder = await prisma.folder.findUnique({
        where: { id: parentId }
      });

      if (!parentFolder || parentFolder.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Invalid parent folder' });
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        description,
        organizationId,
        parentId
      },
      include: {
        _count: {
          select: {
            children: true,
            secrets: true
          }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        details: `Created folder: ${name}`,
        userId,
        organizationId,
        folderId: folder.id
      }
    });

    res.status(201).json({
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Get folders for organization (with hierarchy)
router.get('/:organizationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.organizationId;
    const userId = req.user!.id;

    // Check view permissions
    const hasPermission = await PermissionService.checkOrganizationPermission(
      userId,
      organizationId,
      MembershipRole.VIEW
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const folders = await prisma.folder.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            children: true,
            secrets: true
          }
        },
        parent: {
          select: { id: true, name: true }
        }
      },
      orderBy: [
        { parentId: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ folders });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Get folder details
router.get('/detail/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = req.params.id;
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

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        organization: {
          select: { id: true, name: true }
        },
        parent: {
          select: { id: true, name: true }
        },
        children: {
          include: {
            _count: {
              select: {
                children: true,
                secrets: true
              }
            }
          }
        },
        secrets: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
          }
        },
        _count: {
          select: {
            children: true,
            secrets: true
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ folder });
  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({ error: 'Failed to fetch folder' });
  }
});

// Update folder
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = req.params.id;
    const userId = req.user!.id;
    const updateData = updateFolderSchema.parse(req.body);

    // Check write permissions
    const hasPermission = await PermissionService.checkFolderPermission(
      userId,
      folderId,
      MembershipRole.WRITE
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Write access required' });
    }

    // Convert enum strings to MembershipRole if provided
    const prismaUpdateData: any = { ...updateData };
    if (updateData.viewOverride) {
      prismaUpdateData.viewOverride = updateData.viewOverride as MembershipRole;
    }
    if (updateData.writeOverride) {
      prismaUpdateData.writeOverride = updateData.writeOverride as MembershipRole;
    }
    if (updateData.adminOverride) {
      prismaUpdateData.adminOverride = updateData.adminOverride as MembershipRole;
    }

    const folder = await prisma.folder.update({
      where: { id: folderId },
      data: prismaUpdateData,
      include: {
        _count: {
          select: {
            children: true,
            secrets: true
          }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        details: `Updated folder: ${folder.name}`,
        userId,
        organizationId: folder.organizationId,
        folderId: folder.id
      }
    });

    res.json({
      message: 'Folder updated successfully',
      folder
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Delete folder
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folderId = req.params.id;
    const userId = req.user!.id;

    // Check admin permissions
    const hasPermission = await PermissionService.checkFolderPermission(
      userId,
      folderId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get folder info before deletion for logging
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        _count: {
          select: {
            children: true,
            secrets: true
          }
        }
      }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if folder has children or secrets
    if (folder._count.children > 0 || folder._count.secrets > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete folder that contains subfolders or secrets',
        details: {
          subfolders: folder._count.children,
          secrets: folder._count.secrets
        }
      });
    }

    // Delete the folder
    await prisma.folder.delete({
      where: { id: folderId }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        details: `Deleted folder: ${folder.name}`,
        userId,
        organizationId: folder.organizationId
      }
    });

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

export default router;
