import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../services/auth';
import { PermissionService } from '../services/permissions';
import { prisma } from '../services/database';
import { MembershipRole } from '@prisma/client';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get audit logs for organization
router.get('/:organizationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.organizationId;
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Check admin permissions to view audit logs
    const hasPermission = await PermissionService.checkOrganizationPermission(
      userId,
      organizationId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required to view audit logs' });
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          folder: {
            select: { id: true, name: true }
          },
          secret: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({
        where: { organizationId }
      })
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for specific folder
router.get('/:organizationId/folder/:folderId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.organizationId;
    const folderId = req.params.folderId;
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Check admin permissions for the folder
    const hasPermission = await PermissionService.checkFolderPermission(
      userId,
      folderId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required to view audit logs' });
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { 
          organizationId,
          folderId
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          folder: {
            select: { id: true, name: true }
          },
          secret: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({
        where: { 
          organizationId,
          folderId
        }
      })
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get folder audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for specific secret
router.get('/:organizationId/secret/:secretId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.organizationId;
    const secretId = req.params.secretId;
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Check admin permissions for the secret
    const hasPermission = await PermissionService.checkSecretPermission(
      userId,
      secretId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required to view audit logs' });
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { 
          organizationId,
          secretId
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          folder: {
            select: { id: true, name: true }
          },
          secret: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({
        where: { 
          organizationId,
          secretId
        }
      })
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get secret audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
