import { Organization, Membership, Role, OrganizationDeletionRequest, DeletionStatus, AuditAction } from '@prisma/client';
import { log } from '../lib/logger';
import { prisma } from '../lib/prisma';

export interface CreateOrganizationData {
  name: string;
  description?: string;
}

export interface AddMemberData {
  userId: string;
  role: Role;
}

export interface RequestDeletionData {
  reason?: string;
}

export interface DeletionRequestWithDetails extends OrganizationDeletionRequest {
  organization: {
    id: string;
    name: string;
    description: string | null;
  };
}

export interface OrganizationWithMembers extends Organization {
  memberships: (Membership & {
    user: {
      id: string;
      email: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
    };
  })[];
  _count: {
    memberships: number;
  };
}

export class OrganizationService {
  // Create a new organization with the creator as ADMIN
  async createOrganization(creatorId: string, data: CreateOrganizationData): Promise<OrganizationWithMembers> {
    try {
      log.db('Creating new organization', { creatorId, organizationName: data.name });

      // Check if organization name already exists
      const existingOrg = await prisma.organization.findFirst({
        where: { name: data.name }
      });

      if (existingOrg) {
        throw new Error('Organization name already exists');
      }

      // Create organization and add creator as admin in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create the organization
        const organization = await tx.organization.create({
          data: {
            name: data.name,
            description: data.description,
          }
        });

        // Add creator as admin
        await tx.membership.create({
          data: {
            userId: creatorId,
            organizationId: organization.id,
            role: Role.ADMIN,
          }
        });

        // Return organization with memberships
        return await tx.organization.findUnique({
          where: { id: organization.id },
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                  }
                }
              }
            },
            _count: {
              select: { memberships: true }
            }
          }
        });
      });

      if (!result) {
        throw new Error('Failed to create organization');
      }

      log.auth('Organization created successfully', { 
        organizationId: result.id, 
        creatorId,
        name: result.name 
      });

      return result;
    } catch (error) {
      log.error('Organization creation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        organizationName: data.name 
      });

      // Handle database connection errors gracefully
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

  // Get user's organizations
  async getUserOrganizations(userId: string): Promise<OrganizationWithMembers[]> {
    try {
      log.db('Fetching user organizations', { userId });

      const organizations = await prisma.organization.findMany({
        where: {
          memberships: {
            some: {
              userId: userId
            }
          }
        },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                }
              }
            }
          },
          _count: {
            select: { memberships: true }
          }
        }
      });

      log.db('User organizations fetched', { userId, count: organizations.length });
      return organizations;
    } catch (error) {
      log.error('Failed to fetch user organizations', { 
        error: error instanceof Error ? error.message : 'Unknown error',
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
      }
      
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
  }

  // Get organization by ID with permission check
  async getOrganization(organizationId: string, userId: string): Promise<OrganizationWithMembers> {
    try {
      log.db('Fetching organization', { organizationId, userId });

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                }
              }
            }
          },
          _count: {
            select: { memberships: true }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if user is a member
      const userMembership = organization.memberships.find((m: any) => m.userId === userId);
      if (!userMembership) {
        throw new Error('Access denied: You are not a member of this organization');
      }

      log.db('Organization fetched successfully', { organizationId, userId });
      return organization;
    } catch (error) {
      log.error('Failed to fetch organization', { 
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

  // Add member to organization (requires ADMIN role)
  async addMember(organizationId: string, requesterId: string, data: AddMemberData): Promise<Membership> {
    try {
      log.db('Adding member to organization', { organizationId, requesterId, targetUserId: data.userId });

      // Check requester permissions
      const requesterMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: requesterId,
            organizationId: organizationId
          }
        }
      });

      if (!requesterMembership || requesterMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can add members');
      }

      // Check if user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: data.userId }
      });

      if (!targetUser) {
        throw new Error('User not found');
      }

      // Check if user is already a member
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: data.userId,
            organizationId: organizationId
          }
        }
      });

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }

      // Create membership
      const membership = await prisma.membership.create({
        data: {
          userId: data.userId,
          organizationId: organizationId,
          role: data.role,
        }
      });

      log.auth('Member added successfully', { 
        organizationId, 
        requesterId,
        newMemberId: data.userId,
        role: data.role 
      });

      return membership;
    } catch (error) {
      log.error('Failed to add member', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        requesterId,
        targetUserId: data.userId 
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

  // Update member role (requires ADMIN role)
  async updateMemberRole(organizationId: string, requesterId: string, targetUserId: string, newRole: Role): Promise<Membership> {
    try {
      log.db('Updating member role', { organizationId, requesterId, targetUserId, newRole });

      // Check requester permissions
      const requesterMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: requesterId,
            organizationId: organizationId
          }
        }
      });

      if (!requesterMembership || requesterMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can update member roles');
      }

      // Prevent demoting the last admin
      if (newRole !== Role.ADMIN) {
        const adminCount = await prisma.membership.count({
          where: {
            organizationId: organizationId,
            role: Role.ADMIN
          }
        });

        const targetMembership = await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: targetUserId,
              organizationId: organizationId
            }
          }
        });

        if (targetMembership?.role === Role.ADMIN && adminCount <= 1) {
          throw new Error('Cannot remove the last admin from the organization');
        }
      }

      // Update membership
      const updatedMembership = await prisma.membership.update({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId: organizationId
          }
        },
        data: {
          role: newRole
        }
      });

      log.auth('Member role updated successfully', { 
        organizationId, 
        requesterId,
        targetUserId,
        newRole 
      });

      return updatedMembership;
    } catch (error) {
      log.error('Failed to update member role', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        requesterId,
        targetUserId,
        newRole 
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

  // Remove member from organization (requires ADMIN role)
  async removeMember(organizationId: string, requesterId: string, targetUserId: string): Promise<void> {
    try {
      log.db('Removing member from organization', { organizationId, requesterId, targetUserId });

      // Check requester permissions
      const requesterMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: requesterId,
            organizationId: organizationId
          }
        }
      });

      if (!requesterMembership || requesterMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can remove members');
      }

      // Prevent removing the last admin
      const targetMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId: organizationId
          }
        }
      });

      if (!targetMembership) {
        throw new Error('User is not a member of this organization');
      }

      if (targetMembership.role === Role.ADMIN) {
        const adminCount = await prisma.membership.count({
          where: {
            organizationId: organizationId,
            role: Role.ADMIN
          }
        });

        if (adminCount <= 1) {
          throw new Error('Cannot remove the last admin from the organization');
        }
      }

      // Remove membership
      await prisma.membership.delete({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId: organizationId
          }
        }
      });

      log.auth('Member removed successfully', { 
        organizationId, 
        requesterId,
        removedUserId: targetUserId 
      });
    } catch (error) {
      log.error('Failed to remove member', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        requesterId,
        targetUserId 
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

  // Request organization deletion (requires ADMIN role)
  async requestDeletion(organizationId: string, requesterId: string, data: RequestDeletionData): Promise<OrganizationDeletionRequest> {
    try {
      log.db('Requesting organization deletion', { organizationId, requesterId });

      // Check requester permissions
      const requesterMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: requesterId,
            organizationId: organizationId
          }
        }
      });

      if (!requesterMembership || requesterMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can request organization deletion');
      }

      // Check if organization exists and is not already deleted
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.isDeleted) {
        throw new Error('Organization is already deleted');
      }

      // Check if there's already a pending deletion request
      const existingRequest = await prisma.organizationDeletionRequest.findFirst({
        where: {
          organizationId: organizationId,
          status: DeletionStatus.PENDING
        }
      });

      if (existingRequest) {
        throw new Error('Organization deletion is already pending');
      }

      // Create deletion request and update organization in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create deletion request
        const deletionRequest = await tx.organizationDeletionRequest.create({
          data: {
            organizationId: organizationId,
            requestedBy: requesterId,
            reason: data.reason,
            status: DeletionStatus.PENDING
          }
        });

        // Update organization to mark deletion as requested
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            deletionRequestedAt: new Date(),
            deletionRequestedBy: requesterId
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_REQUESTED,
            userId: requesterId,
            details: JSON.stringify({
              organizationId: organizationId,
              reason: data.reason
            })
          }
        });

        return deletionRequest;
      });

      log.auth('Organization deletion requested', { 
        organizationId, 
        requesterId,
        reason: data.reason 
      });

      return result;
    } catch (error) {
      log.error('Failed to request organization deletion', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        requesterId
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

  // Approve organization deletion (requires ADMIN role)
  async approveDeletion(organizationId: string, approverId: string): Promise<void> {
    try {
      log.db('Approving organization deletion', { organizationId, approverId });

      // Check approver permissions
      const approverMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: approverId,
            organizationId: organizationId
          }
        }
      });

      if (!approverMembership || approverMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can approve organization deletion');
      }

      // Find pending deletion request
      const deletionRequest = await prisma.organizationDeletionRequest.findFirst({
        where: {
          organizationId: organizationId,
          status: DeletionStatus.PENDING
        }
      });

      if (!deletionRequest) {
        throw new Error('No pending deletion request found for this organization');
      }

      // Prevent self-approval
      if (deletionRequest.requestedBy === approverId) {
        throw new Error('Cannot approve your own deletion request');
      }

      // Get organization with all related data
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          folders: {
            include: {
              secrets: true
            }
          },
          memberships: {
            include: {
              user: true
            }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Execute deletion process in transaction
      await prisma.$transaction(async (tx) => {
        // 1. Handle secrets - reassign to their creators or move to personal vault
        for (const folder of organization.folders) {
          for (const secret of folder.secrets) {
            // Note: In a real implementation, you'd need to determine the original creator
            // For now, we'll just keep them in the folder but mark the org as deleted
            // You might want to create a "Personal Vault" organization for each user
            log.info('Secret preserved during organization deletion', {
              secretId: secret.id,
              secretName: secret.name,
              organizationId: organizationId
            });
          }
        }

        // 2. Remove all memberships
        await tx.membership.deleteMany({
          where: { organizationId: organizationId }
        });

        // 3. Update deletion request status
        await tx.organizationDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: DeletionStatus.APPROVED,
            approvedBy: approverId
          }
        });

        // 4. Mark organization as deleted (soft delete)
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            isDeleted: true,
            deletionApprovedAt: new Date(),
            deletionApprovedBy: approverId
          }
        });

        // 5. Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_APPROVED,
            userId: approverId,
            details: JSON.stringify({
              organizationId: organizationId,
              requestedBy: deletionRequest.requestedBy,
              reason: deletionRequest.reason
            })
          }
        });

        // 6. Final audit log for deletion
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_APPROVED,
            userId: approverId,
            details: JSON.stringify({
              organizationId: organizationId,
              organizationName: organization.name,
              secretsCount: organization.folders.reduce((count, folder) => count + folder.secrets.length, 0),
              membersCount: organization.memberships.length,
              deletionCompleted: true
            })
          }
        });
      });

      log.auth('Organization deletion approved and executed', { 
        organizationId, 
        approverId,
        requestedBy: deletionRequest.requestedBy
      });
    } catch (error) {
      log.error('Failed to approve organization deletion', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        approverId
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

  // Reject organization deletion (requires ADMIN role)
  async rejectDeletion(organizationId: string, rejectorId: string): Promise<void> {
    try {
      log.db('Rejecting organization deletion', { organizationId, rejectorId });

      // Check rejector permissions
      const rejectorMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: rejectorId,
            organizationId: organizationId
          }
        }
      });

      if (!rejectorMembership || rejectorMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can reject organization deletion');
      }

      // Find pending deletion request
      const deletionRequest = await prisma.organizationDeletionRequest.findFirst({
        where: {
          organizationId: organizationId,
          status: DeletionStatus.PENDING
        }
      });

      if (!deletionRequest) {
        throw new Error('No pending deletion request found for this organization');
      }

      // Update deletion request and organization in transaction
      await prisma.$transaction(async (tx) => {
        // Update deletion request status
        await tx.organizationDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: DeletionStatus.REJECTED,
            approvedBy: rejectorId
          }
        });

        // Clear deletion request fields from organization
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            deletionRequestedAt: null,
            deletionRequestedBy: null
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_REJECTED,
            userId: rejectorId,
            details: JSON.stringify({
              organizationId: organizationId,
              requestedBy: deletionRequest.requestedBy,
              reason: deletionRequest.reason
            })
          }
        });
      });

      log.auth('Organization deletion rejected', { 
        organizationId, 
        rejectorId,
        requestedBy: deletionRequest.requestedBy
      });
    } catch (error) {
      log.error('Failed to reject organization deletion', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        rejectorId
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

  // Get deletion requests for an organization (requires ADMIN role)
  async getDeletionRequests(organizationId: string, userId: string): Promise<DeletionRequestWithDetails[]> {
    try {
      log.db('Fetching deletion requests', { organizationId, userId });

      // Check user permissions
      const userMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: userId,
            organizationId: organizationId
          }
        }
      });

      if (!userMembership || userMembership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only admins can view deletion requests');
      }

      const deletionRequests = await prisma.organizationDeletionRequest.findMany({
        where: { organizationId: organizationId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      log.db('Deletion requests fetched', { organizationId, userId, count: deletionRequests.length });
      return deletionRequests;
    } catch (error) {
      log.error('Failed to fetch deletion requests', { 
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
}
