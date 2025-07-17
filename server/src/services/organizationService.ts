import { Organization, Membership, Role, PrismaClient } from '@prisma/client';
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
}
