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
const createOrgSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['VIEW', 'WRITE', 'ADMIN'])
});

const updateMembershipSchema = z.object({
  role: z.enum(['VIEW', 'WRITE', 'ADMIN'])
});

// Create organization
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = createOrgSchema.parse(req.body);
    const userId = req.user!.id;

    const organization = await prisma.organization.create({
      data: {
        name,
        description,
        ownerId: userId,
        memberships: {
          create: {
            userId,
            role: MembershipRole.ADMIN
          }
        }
      },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    res.status(201).json({
      message: 'Organization created successfully',
      organization
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Get user's organizations
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                memberships: true,
                folders: true
              }
            }
          }
        }
      }
    });

    const organizations = memberships.map(membership => ({
      ...membership.organization,
      userRole: membership.role,
      memberCount: membership.organization._count.memberships,
      folderCount: membership.organization._count.folders
    }));

    res.json({ organizations });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get organization details
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.id;
    const userId = req.user!.id;

    // Check permissions
    const hasPermission = await PermissionService.checkOrganizationPermission(
      userId,
      organizationId,
      MembershipRole.VIEW
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        folders: {
          where: { parentId: null }, // Only root folders
          include: {
            _count: {
              select: { secrets: true, children: true }
            }
          }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get user's role in this organization
    const userRole = await PermissionService.getUserOrganizationRole(userId, organizationId);

    res.json({ 
      organization: {
        ...organization,
        userRole
      }
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Invite user to organization
router.post('/:id/invite', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.id;
    const userId = req.user!.id;
    const { email, role } = inviteUserSchema.parse(req.body);

    // Check if user has admin permissions
    const hasPermission = await PermissionService.checkOrganizationPermission(
      userId,
      organizationId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find the user to invite
    const userToInvite = await prisma.user.findUnique({
      where: { email }
    });

    if (!userToInvite) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    // Check if user is already a member
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: userToInvite.id,
          organizationId
        }
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of this organization' });
    }

    // Create membership
    const membership = await prisma.membership.create({
      data: {
        userId: userToInvite.id,
        organizationId,
        role: role as MembershipRole
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'INVITE',
        details: `Invited ${email} with role ${role}`,
        userId,
        organizationId
      }
    });

    res.status(201).json({
      message: 'User invited successfully',
      membership
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Update user role in organization
router.put('/:id/members/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.id;
    const targetUserId = req.params.userId;
    const currentUserId = req.user!.id;
    const { role } = updateMembershipSchema.parse(req.body);

    // Check if current user has admin permissions
    const hasPermission = await PermissionService.checkOrganizationPermission(
      currentUserId,
      organizationId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update membership
    const membership = await prisma.membership.update({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      },
      data: { role: role as MembershipRole },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'CHANGE_ROLE',
        details: `Changed role to ${role}`,
        userId: currentUserId,
        organizationId
      }
    });

    res.json({
      message: 'User role updated successfully',
      membership
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Remove user from organization
router.delete('/:id/members/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.params.id;
    const targetUserId = req.params.userId;
    const currentUserId = req.user!.id;

    // Check if current user has admin permissions
    const hasPermission = await PermissionService.checkOrganizationPermission(
      currentUserId,
      organizationId,
      MembershipRole.ADMIN
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Don't allow removing the organization owner
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (organization?.ownerId === targetUserId) {
      return res.status(400).json({ error: 'Cannot remove organization owner' });
    }

    // Remove membership
    await prisma.membership.delete({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'REMOVE_USER',
        details: `Removed user from organization`,
        userId: currentUserId,
        organizationId
      }
    });

    res.json({ message: 'User removed from organization successfully' });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

export default router;
