import { Role, AuditAction } from '@prisma/client';
import type { OrganizationInvite } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { randomBytes } from 'crypto';

export interface CreateInviteData {
  email: string;
  role: Role;
  organizationId: string;
  invitedBy: string;
}

export interface InviteWithDetails extends OrganizationInvite {
  organization: {
    id: string;
    name: string;
    description: string | null;
  };
}

export class InviteService {
  
  // Create a new organization invite
  async createInvite(data: CreateInviteData): Promise<OrganizationInvite> {
    try {
      log.db('Creating organization invite', { 
        organizationId: data.organizationId,
        invitedBy: data.invitedBy,
        email: data.email,
        role: data.role
      });

      // Check if inviter has admin permissions
      const inviterMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: data.invitedBy,
            organizationId: data.organizationId
          }
        }
      });

      if (!inviterMembership || inviterMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can invite users to organizations');
      }

      // Check if organization exists and is not deleted
      const organization = await prisma.organization.findUnique({
        where: { id: data.organizationId }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.isDeleted) {
        throw new Error('Cannot invite users to a deleted organization');
      }

      // Check if user is already a member
      const existingMembership = await prisma.membership.findFirst({
        where: {
          organizationId: data.organizationId,
          user: {
            email: data.email
          }
        }
      });

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }

      // Check if there's already a pending invite for this email
      const existingInvite = await prisma.organizationInvite.findFirst({
        where: {
          organizationId: data.organizationId,
          email: data.email,
          status: 'PENDING' as const,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (existingInvite) {
        throw new Error('A pending invite already exists for this email address');
      }

      // Generate unique invite token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      // Create invite and audit log in transaction
      const result = await prisma.$transaction(async (tx) => {
        const invite = await tx.organizationInvite.create({
          data: {
            email: data.email,
            role: data.role,
            token: token,
            organizationId: data.organizationId,
            invitedBy: data.invitedBy,
            expiresAt: expiresAt,
            status: 'PENDING' as const
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.USER_INVITED,
            userId: data.invitedBy,
            details: JSON.stringify({
              organizationId: data.organizationId,
              invitedEmail: data.email,
              role: data.role,
              inviteId: invite.id
            })
          }
        });

        return invite;
      });

      log.auth('Organization invite created successfully', {
        inviteId: result.id,
        organizationId: data.organizationId,
        invitedBy: data.invitedBy,
        email: data.email,
        role: data.role
      });

      return result;
    } catch (error) {
      log.error('Failed to create organization invite', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: data.organizationId,
        invitedBy: data.invitedBy,
        email: data.email
      });

      if (error instanceof Error) {
        const dbErrorPatterns = [
          "Can't reach database server",
          "Authentication failed against database server",
          "connection",
          "ECONNREFUSED",
          "ENOTFOUND",
          "timeout",
          "database credentials",
          "Invalid `prisma",
          "database server at",
          "P1001", "P1002", "P1008", "P1017"
        ];
        
        const isDbError = dbErrorPatterns.some(pattern => 
          error.message.includes(pattern)
        );
        
        if (isDbError) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        
        // Re-throw business logic errors
        throw error;
      }
      
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  // Accept an organization invite
  async acceptInvite(token: string, userId: string): Promise<void> {
    try {
      log.db('Accepting organization invite', { token, userId });

      // Find the invite
      const invite = await prisma.organizationInvite.findUnique({
        where: { token },
        include: {
          organization: true
        }
      });

      if (!invite) {
        throw new Error('Invalid invite token');
      }

      if (invite.status !== 'PENDING') {
        throw new Error('This invite has already been processed');
      }

      if (invite.expiresAt < new Date()) {
        // Mark as expired
        await prisma.organizationInvite.update({
          where: { id: invite.id },
          data: { status: 'EXPIRED' as const }
        });
        throw new Error('This invite has expired');
      }

      // Check if organization still exists and is not deleted
      if (!invite.organization || invite.organization.isDeleted) {
        throw new Error('Organization no longer exists or has been deleted');
      }

      // Get user by ID and verify email matches
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.email !== invite.email) {
        throw new Error('This invite was sent to a different email address');
      }

      // Check if user is already a member
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: userId,
            organizationId: invite.organizationId
          }
        }
      });

      if (existingMembership) {
        throw new Error('You are already a member of this organization');
      }

      // Accept invite, create membership, and update invite status in transaction
      await prisma.$transaction(async (tx) => {
        // Create membership
        await tx.membership.create({
          data: {
            userId: userId,
            organizationId: invite.organizationId,
            role: invite.role
          }
        });

        // Update invite status
        await tx.organizationInvite.update({
          where: { id: invite.id },
          data: {
            status: 'ACCEPTED' as const,
            acceptedBy: userId,
            acceptedAt: new Date()
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.USER_INVITED,
            userId: userId,
            details: JSON.stringify({
              organizationId: invite.organizationId,
              inviteId: invite.id,
              role: invite.role,
              invitedBy: invite.invitedBy
            })
          }
        });
      });

      log.auth('Organization invite accepted successfully', {
        inviteId: invite.id,
        userId,
        organizationId: invite.organizationId,
        role: invite.role
      });
    } catch (error) {
      log.error('Failed to accept organization invite', {
        error: error instanceof Error ? error.message : 'Unknown error',
        token,
        userId
      });

      if (error instanceof Error) {
        const dbErrorPatterns = [
          "Can't reach database server",
          "Authentication failed against database server",
          "connection",
          "ECONNREFUSED",
          "ENOTFOUND",
          "timeout",
          "database credentials",
          "Invalid `prisma",
          "database server at",
          "P1001", "P1002", "P1008", "P1017"
        ];
        
        const isDbError = dbErrorPatterns.some(pattern => 
          error.message.includes(pattern)
        );
        
        if (isDbError) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        
        // Re-throw business logic errors
        throw error;
      }
      
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  // Reject an organization invite
  async rejectInvite(token: string, userId: string): Promise<void> {
    try {
      log.db('Rejecting organization invite', { token, userId });

      // Find the invite
      const invite = await prisma.organizationInvite.findUnique({
        where: { token }
      });

      if (!invite) {
        throw new Error('Invalid invite token');
      }

      if (invite.status !== 'PENDING') {
        throw new Error('This invite has already been processed');
      }

      // Get user by ID and verify email matches
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.email !== invite.email) {
        throw new Error('This invite was sent to a different email address');
      }

      // Update invite status and create audit log in transaction
      await prisma.$transaction(async (tx) => {
        // Update invite status
        await tx.organizationInvite.update({
          where: { id: invite.id },
          data: {
            status: 'REJECTED' as const,
            acceptedBy: userId // Track who rejected it
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.USER_INVITED,
            userId: userId,
            details: JSON.stringify({
              organizationId: invite.organizationId,
              inviteId: invite.id,
              role: invite.role,
              invitedBy: invite.invitedBy
            })
          }
        });
      });

      log.auth('Organization invite rejected successfully', {
        inviteId: invite.id,
        userId,
        organizationId: invite.organizationId
      });
    } catch (error) {
      log.error('Failed to reject organization invite', {
        error: error instanceof Error ? error.message : 'Unknown error',
        token,
        userId
      });

      if (error instanceof Error) {
        const dbErrorPatterns = [
          "Can't reach database server",
          "Authentication failed against database server",
          "connection",
          "ECONNREFUSED",
          "ENOTFOUND",
          "timeout",
          "database credentials",
          "Invalid `prisma",
          "database server at",
          "P1001", "P1002", "P1008", "P1017"
        ];
        
        const isDbError = dbErrorPatterns.some(pattern => 
          error.message.includes(pattern)
        );
        
        if (isDbError) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        
        // Re-throw business logic errors
        throw error;
      }
      
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  // Get invite details by token (for displaying invite info)
  async getInviteByToken(token: string): Promise<InviteWithDetails | null> {
    try {
      log.db('Fetching invite details', { token });

      const invite = await prisma.organizationInvite.findUnique({
        where: { token },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });

      if (!invite) {
        return null;
      }

      log.db('Invite details fetched', { inviteId: invite.id });
      return invite;
    } catch (error) {
      log.error('Failed to fetch invite details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        token
      });

      if (error instanceof Error) {
        const dbErrorPatterns = [
          "Can't reach database server",
          "Authentication failed against database server",
          "connection",
          "ECONNREFUSED",
          "ENOTFOUND",
          "timeout",
          "database credentials",
          "Invalid `prisma",
          "database server at",
          "P1001", "P1002", "P1008", "P1017"
        ];
        
        const isDbError = dbErrorPatterns.some(pattern => 
          error.message.includes(pattern)
        );
        
        if (isDbError) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
      }
      
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  // Get organization invites (admin only)
  async getOrganizationInvites(organizationId: string, userId: string): Promise<OrganizationInvite[]> {
    try {
      log.db('Fetching organization invites', { organizationId, userId });

      // Check if user is admin of the organization
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: userId,
            organizationId: organizationId
          }
        }
      });

      if (!membership || membership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can view organization invites');
      }

      const invites = await prisma.organizationInvite.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' }
      });

      log.db('Organization invites fetched', { organizationId, count: invites.length });
      return invites;
    } catch (error) {
      log.error('Failed to fetch organization invites', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        userId
      });

      if (error instanceof Error) {
        const dbErrorPatterns = [
          "Can't reach database server",
          "Authentication failed against database server",
          "connection",
          "ECONNREFUSED",
          "ENOTFOUND",
          "timeout",
          "database credentials",
          "Invalid `prisma",
          "database server at",
          "P1001", "P1002", "P1008", "P1017"
        ];
        
        const isDbError = dbErrorPatterns.some(pattern => 
          error.message.includes(pattern)
        );
        
        if (isDbError) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        
        // Re-throw business logic errors
        throw error;
      }
      
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  // Cancel/revoke an invite (admin only)
  async cancelInvite(inviteId: string, userId: string): Promise<void> {
    try {
      log.db('Cancelling organization invite', { inviteId, userId });

      // Find the invite
      const invite = await prisma.organizationInvite.findUnique({
        where: { id: inviteId }
      });

      if (!invite) {
        throw new Error('Invite not found');
      }

      if (invite.status !== 'PENDING') {
        throw new Error('Only pending invites can be cancelled');
      }

      // Check if user is admin of the organization
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: userId,
            organizationId: invite.organizationId
          }
        }
      });

      if (!membership || membership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can cancel invites');
      }

      // Update invite status to rejected (cancelled)
      await prisma.organizationInvite.update({
        where: { id: inviteId },
        data: {
          status: 'REJECTED' as const,
          acceptedBy: userId // Track who cancelled it
        }
      });

      log.auth('Organization invite cancelled successfully', {
        inviteId,
        userId,
        organizationId: invite.organizationId
      });
    } catch (error) {
      log.error('Failed to cancel organization invite', {
        error: error instanceof Error ? error.message : 'Unknown error',
        inviteId,
        userId
      });

      if (error instanceof Error) {
        const dbErrorPatterns = [
          "Can't reach database server",
          "Authentication failed against database server",
          "connection",
          "ECONNREFUSED",
          "ENOTFOUND",
          "timeout",
          "database credentials",
          "Invalid `prisma",
          "database server at",
          "P1001", "P1002", "P1008", "P1017"
        ];
        
        const isDbError = dbErrorPatterns.some(pattern => 
          error.message.includes(pattern)
        );
        
        if (isDbError) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        
        // Re-throw business logic errors
        throw error;
      }
      
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  /**
   * Get all pending invites for a specific user
   */
  async getInvitesByUser(userId: string): Promise<any[]> {
    try {
      // Get user to find their email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get all pending invites for this user's email
      const invites = await prisma.organizationInvite.findMany({
        where: {
          email: user.email,
          status: 'PENDING',
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return invites;
    } catch (error: any) {
      log.error('Failed to get user invites', {
        error: error.message,
        userId
      });

      // Handle known database error patterns
      const dbErrorPatterns = [
        'connection',
        'timeout',
        'network',
        'unavailable'
      ];
      
      const isDbError = dbErrorPatterns.some(pattern => 
        error.message.includes(pattern)
      );
      
      if (isDbError) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      }
      
      // Re-throw business logic errors
      throw error;
    }
  }

  /**
   * Accept an invite by token with improved email matching
   */
  async acceptInviteFlexible(token: string, userId: string): Promise<void> {
    try {
      // Get invite by token
      const invite = await prisma.organizationInvite.findUnique({
        where: { token },
        include: {
          organization: true
        }
      });

      if (!invite) {
        throw new Error('Invalid invite token');
      }

      if (invite.status !== 'PENDING') {
        throw new Error('This invite has already been processed');
      }

      if (invite.expiresAt < new Date()) {
        // Mark as expired
        await prisma.organizationInvite.update({
          where: { id: invite.id },
          data: { status: 'EXPIRED' as const }
        });
        throw new Error('This invite has expired');
      }

      // Check if organization still exists and is not deleted
      if (!invite.organization || invite.organization.isDeleted) {
        throw new Error('Organization no longer exists or has been deleted');
      }

      // Get user by ID
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // More flexible email validation - normalize emails by converting to lowercase and trimming
      const userEmail = user.email.toLowerCase().trim();
      const inviteEmail = invite.email.toLowerCase().trim();

      if (userEmail !== inviteEmail) {
        // Check if user has any email that matches
        const userWithMatchingEmail = await prisma.user.findFirst({
          where: {
            email: {
              mode: 'insensitive',
              equals: invite.email
            }
          }
        });

        if (!userWithMatchingEmail || userWithMatchingEmail.id !== userId) {
          throw new Error('This invite was sent to a different email address');
        }
      }

      // Check if user is already a member of this organization
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: userId,
            organizationId: invite.organizationId
          }
        }
      });

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }

      // Create membership and update invite status in transaction
      await prisma.$transaction(async (tx) => {
        // Create membership
        await tx.membership.create({
          data: {
            userId: userId,
            organizationId: invite.organizationId,
            role: invite.role
          }
        });

        // Update invite status
        await tx.organizationInvite.update({
          where: { id: invite.id },
          data: {
            status: 'ACCEPTED' as const,
            acceptedBy: userId,
            acceptedAt: new Date()
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'USER_INVITE_ACCEPTED',
            details: JSON.stringify({
              inviteId: invite.id,
              userId: userId,
              organizationId: invite.organizationId,
              role: invite.role
            }),
            userId: userId
          }
        });
      });

      log.info('🔐 AUTH: Organization invite accepted successfully', {
        inviteId: invite.id,
        userId: userId,
        organizationId: invite.organizationId,
        role: invite.role
      });
    } catch (error: any) {
      log.error('Failed to accept organization invite', {
        error: error.message,
        token: token,
        userId: userId
      });

      // Handle known database error patterns
      const dbErrorPatterns = [
        'connection',
        'timeout',
        'network',
        'unavailable'
      ];
      
      const isDbError = dbErrorPatterns.some(pattern => 
        error.message.includes(pattern)
      );
      
      if (isDbError) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      }
      
      // Re-throw business logic errors
      throw error;
    }
  }
}
