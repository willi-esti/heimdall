import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { Role, DeletionStatus, AuditAction } from '@prisma/client';

export class OrganizationDeletionService {
  
  /**
   * Request deletion of an organization (admin only)
   */
  async requestDeletion(organizationId: string, requesterId: string, reason?: string) {
    try {
      log.db('Requesting organization deletion', { 
        organizationId, 
        requesterId, 
        reason: reason || 'No reason provided' 
      });

      // Check if requester is an admin of the organization
      const membership = await prisma.membership.findFirst({
        where: {
          userId: requesterId,
          organizationId: organizationId
        }
      });

      if (!membership || membership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only organization admins can request deletion');
      }

      // Check if organization exists and is not already deleted
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      if (organization.isDeleted) {
        throw new Error('Organization is already marked for deletion');
      }

      // Check if there's already a pending deletion request
      const existingRequest = await prisma.organizationDeletionRequest.findFirst({
        where: {
          organizationId: organizationId,
          status: DeletionStatus.PENDING
        }
      });

      if (existingRequest) {
        throw new Error('Organization already has a pending deletion request');
      }

      // Create deletion request and update organization
      const result = await prisma.$transaction(async (tx) => {
        // Create deletion request
        const deletionRequest = await tx.organizationDeletionRequest.create({
          data: {
            organizationId: organizationId,
            requestedBy: requesterId,
            reason: reason || 'No reason provided',
            status: DeletionStatus.PENDING
          }
        });

        // Update organization with deletion request info
        const updatedOrg = await tx.organization.update({
          where: { id: organizationId },
          data: {
            deletionRequestedAt: new Date(),
            deletionRequestedBy: requesterId,
            deletionReason: reason || 'No reason provided'
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_REQUESTED,
            userId: requesterId,
            details: `Organization deletion requested: ${reason || 'No reason provided'}`
          }
        });

        return { deletionRequest, organization: updatedOrg };
      });

      log.auth('Organization deletion requested', {
        organizationId,
        requesterId,
        requestId: result.deletionRequest.id
      });

      return result;

    } catch (error) {
      log.error('Failed to request organization deletion', { 
        organizationId, 
        requesterId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Approve deletion of an organization (system admin only)
   */
  async approveDeletion(organizationId: string, approverId: string, approvalNotes?: string) {
    try {
      log.db('Approving organization deletion', { 
        organizationId, 
        approverId, 
        approvalNotes: approvalNotes || 'No notes provided' 
      });

      // TODO: Add system admin check here
      // For now, any user can approve (you might want to add a system admin role)
      
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

      // Check if organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          memberships: true,
          folders: {
            include: {
              secrets: true
            }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Start deletion process
      const result = await prisma.$transaction(async (tx) => {
        // Update deletion request status
        const updatedRequest = await tx.organizationDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: DeletionStatus.APPROVED,
            approvedBy: approverId,
            approvalNotes: approvalNotes || 'No notes provided'
          }
        });

        // Update organization with approval info
        const updatedOrg = await tx.organization.update({
          where: { id: organizationId },
          data: {
            deletionApprovedAt: new Date(),
            deletionApprovedBy: approverId
          }
        });

        // Create audit log for approval
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_APPROVED,
            userId: approverId,
            details: `Organization deletion approved: ${approvalNotes || 'No notes provided'}`
          }
        });

        return { deletionRequest: updatedRequest, organization: updatedOrg };
      });

      log.auth('Organization deletion approved', {
        organizationId,
        approverId,
        requestId: result.deletionRequest.id
      });

      return result;

    } catch (error) {
      log.error('Failed to approve organization deletion', { 
        organizationId, 
        approverId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Complete the deletion process - reassign secrets and soft delete organization
   */
  async completeDeletion(organizationId: string, completedBy: string) {
    try {
      log.db('Completing organization deletion', { organizationId, completedBy });

      // Find approved deletion request
      const deletionRequest = await prisma.organizationDeletionRequest.findFirst({
        where: {
          organizationId: organizationId,
          status: DeletionStatus.APPROVED
        }
      });

      if (!deletionRequest) {
        throw new Error('No approved deletion request found for this organization');
      }

      // Get organization with all related data
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          memberships: true,
          folders: {
            include: {
              secrets: {
                include: {
                  versions: true
                }
              }
            }
          }
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Process deletion
      const result = await prisma.$transaction(async (tx) => {
        // 1. Reassign secrets to their original creators
        for (const folder of organization.folders) {
          for (const secret of folder.secrets) {
            // Find the creator from the first version (if exists)
            const firstVersion = await tx.secretVersion.findFirst({
              where: { secretId: secret.id },
              orderBy: { createdAt: 'asc' }
            });

            if (firstVersion) {
              // TODO: Implement personal vault logic
              // For now, we'll just log that secrets need to be reassigned
              log.db('Secret needs reassignment', {
                secretId: secret.id,
                originalCreator: firstVersion.createdBy,
                secretName: secret.name
              });
            }
          }
        }

        // 2. Remove all memberships
        await tx.membership.deleteMany({
          where: { organizationId: organizationId }
        });

        // 3. Mark organization as deleted
        const deletedOrg = await tx.organization.update({
          where: { id: organizationId },
          data: {
            isDeleted: true,
            deletionCompletedAt: new Date()
          }
        });

        // 4. Update deletion request status
        const completedRequest = await tx.organizationDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: DeletionStatus.COMPLETED
          }
        });

        // 5. Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_COMPLETED,
            userId: completedBy,
            details: `Organization deletion completed - ${organization.folders.length} folders and ${organization.folders.reduce((acc, folder) => acc + folder.secrets.length, 0)} secrets processed`
          }
        });

        return { 
          organization: deletedOrg, 
          deletionRequest: completedRequest,
          secretsCount: organization.folders.reduce((acc, folder) => acc + folder.secrets.length, 0)
        };
      });

      log.auth('Organization deletion completed', {
        organizationId,
        completedBy,
        secretsProcessed: result.secretsCount
      });

      return result;

    } catch (error) {
      log.error('Failed to complete organization deletion', { 
        organizationId, 
        completedBy, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Reject deletion request
   */
  async rejectDeletion(organizationId: string, rejectedBy: string, rejectionReason?: string) {
    try {
      log.db('Rejecting organization deletion', { 
        organizationId, 
        rejectedBy, 
        rejectionReason: rejectionReason || 'No reason provided' 
      });

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

      const result = await prisma.$transaction(async (tx) => {
        // Update deletion request status
        const rejectedRequest = await tx.organizationDeletionRequest.update({
          where: { id: deletionRequest.id },
          data: {
            status: DeletionStatus.REJECTED,
            approvalNotes: rejectionReason || 'No reason provided'
          }
        });

        // Reset organization deletion fields
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            deletionRequestedAt: null,
            deletionRequestedBy: null,
            deletionReason: null
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: AuditAction.ORGANIZATION_DELETION_REJECTED,
            userId: rejectedBy,
            details: `Organization deletion rejected: ${rejectionReason || 'No reason provided'}`
          }
        });

        return { deletionRequest: rejectedRequest };
      });

      log.auth('Organization deletion rejected', {
        organizationId,
        rejectedBy,
        requestId: result.deletionRequest.id
      });

      return result;

    } catch (error) {
      log.error('Failed to reject organization deletion', { 
        organizationId, 
        rejectedBy, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get deletion requests for an organization
   */
  async getDeletionRequests(organizationId: string, requesterId: string) {
    try {
      // Check if requester has access to the organization
      const membership = await prisma.membership.findFirst({
        where: {
          userId: requesterId,
          organizationId: organizationId
        }
      });

      if (!membership || membership.role !== Role.ADMIN) {
        throw new Error('Access denied: Only organization admins can view deletion requests');
      }

      const requests = await prisma.organizationDeletionRequest.findMany({
        where: { organizationId: organizationId },
        orderBy: { createdAt: 'desc' }
      });

      return requests;

    } catch (error) {
      log.error('Failed to get deletion requests', { 
        organizationId, 
        requesterId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Check if organization is accessible (not deleted)
   */
  async isOrganizationAccessible(organizationId: string): Promise<boolean> {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { isDeleted: true }
      });

      return organization ? !organization.isDeleted : false;

    } catch (error) {
      log.error('Failed to check organization accessibility', { 
        organizationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
}

export const organizationDeletionService = new OrganizationDeletionService();
