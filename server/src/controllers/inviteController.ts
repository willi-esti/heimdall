import { Response } from 'express';
import { InviteService } from '../services/inviteService';
import { logger } from '../lib/logger';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../lib/auth';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Validation middleware
export const createInviteValidation = [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['VIEW', 'WRITE', 'ADMIN']).withMessage('Role must be VIEW, WRITE, or ADMIN')
];

export const acceptInviteValidation = [
  body('token').notEmpty().withMessage('Token is required')
];

export const rejectInviteValidation = [
  body('token').notEmpty().withMessage('Token is required')
];

// Helper function to handle validation errors
const handleValidationErrors = (req: any, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
    return true;
  }
  return false;
};

export class InviteController {
  private inviteService: InviteService;

  constructor() {
    this.inviteService = new InviteService();
  }

  /**
   * Create a new organization invitation
   * POST /api/invites
   */
  createInvite = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check validation errors
      if (handleValidationErrors(req, res)) {
        return;
      }

      const { organizationId, email, role = 'VIEW' } = req.body;
      
      const result = await this.inviteService.createInvite({
        organizationId,
        email,
        role: role as Role,
        invitedBy: userId
      });

      logger.info('Invite created', {
        inviteId: result.id,
        organizationId,
        email,
        invitedBy: userId
      });

      res.status(201).json({
        message: 'Invitation created successfully',
        invite: {
          id: result.id,
          email: result.email,
          role: result.role,
          status: result.status,
          expiresAt: result.expiresAt,
          createdAt: result.createdAt
        }
      });
    } catch (error) {
      logger.error('Error creating invite:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('already exists') || error.message.includes('already invited') || error.message.includes('already a member')) {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Accept an organization invitation
   * POST /api/invites/accept
   */
  acceptInvite = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check validation errors
      if (handleValidationErrors(req, res)) {
        return;
      }

      const { token } = req.body;
      
      // Try the flexible accept method first, fall back to strict method
      try {
        await this.inviteService.acceptInviteFlexible(token, userId);
      } catch (flexError: any) {
        // If flexible method fails, try the original strict method
        if (flexError.message.includes('different email address')) {
          await this.inviteService.acceptInvite(token, userId);
        } else {
          throw flexError;
        }
      }

      logger.info('Invite accepted', {
        token,
        userId
      });

      res.status(200).json({
        message: 'Invitation accepted successfully'
      });
    } catch (error) {
      logger.error('Error accepting invite:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid invite token') || error.message.includes('not found') || error.message.includes('expired')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('already')) {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error.message.includes('different email')) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Reject an organization invitation
   * POST /api/invites/reject
   */
  rejectInvite = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check validation errors
      if (handleValidationErrors(req, res)) {
        return;
      }

      const { token } = req.body;
      
      await this.inviteService.rejectInvite(token, userId);

      logger.info('Invite rejected', {
        token,
        userId
      });

      res.status(200).json({
        message: 'Invitation rejected successfully'
      });
    } catch (error) {
      logger.error('Error rejecting invite:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid invite token') || error.message.includes('not found') || error.message.includes('expired')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('already')) {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error.message.includes('different email')) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get invitation details by token (for invite preview)
   * GET /api/invites/:token
   */
  getInviteDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const token = req.params.token;
      if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      const invite = await this.inviteService.getInviteByToken(token);

      if (!invite) {
        res.status(404).json({ error: 'Invite not found or expired' });
        return;
      }

      res.status(200).json({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          organizationName: invite.organization.name,
          organizationDescription: invite.organization.description,
          invitedBy: invite.invitedBy,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt
        }
      });
    } catch (error) {
      logger.error('Error getting invite details:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('expired')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get all invitations for an organization
   * GET /api/organizations/:organizationId/invites
   */
  getOrganizationInvites = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const organizationId = req.params.organizationId;
      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const invites = await this.inviteService.getOrganizationInvites(organizationId, userId);

      const formattedInvites = invites.map(invite => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        invitedBy: invite.invitedBy,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        acceptedAt: invite.acceptedAt
      }));

      res.status(200).json({
        invites: formattedInvites
      });
    } catch (error) {
      logger.error('Error getting organization invites:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Cancel (reject) an organization invitation
   * DELETE /api/invites/:inviteId
   */
  cancelInvite = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const inviteId = req.params.inviteId;
      if (!inviteId) {
        res.status(400).json({ error: 'Invite ID is required' });
        return;
      }

      await this.inviteService.cancelInvite(inviteId, userId);

      logger.info('Invite cancelled', {
        inviteId,
        userId
      });

      res.status(200).json({
        message: 'Invitation cancelled successfully'
      });
    } catch (error) {
      logger.error('Error cancelling invite:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get all invitations sent to the current user
   * GET /api/invites
   */
  getUserInvites = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const invites = await this.inviteService.getInvitesByUser(userId);

      // Get the users who sent the invites
      const invitedByUserIds = [...new Set(invites.map(inv => inv.invitedBy))];
      const invitedByUsers = await prisma.user.findMany({
        where: {
          id: { in: invitedByUserIds }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      const userMap = new Map(invitedByUsers.map(u => [u.id, u]));

      res.status(200).json({
        invites: invites.map(invite => ({
          id: invite.id,
          token: invite.token,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          organization: invite.organization,
          invitedBy: userMap.get(invite.invitedBy) || null,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt
        }))
      });
    } catch (error) {
      logger.error('Error getting user invites:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
