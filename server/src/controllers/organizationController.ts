import { Response } from 'express';
import { AuthenticatedRequest } from '../lib/auth';
import { OrganizationService, CreateOrganizationData, AddMemberData, RequestDeletionData } from '../services/organizationService';
import { Role } from '@prisma/client';
import { log } from '../lib/logger';

export class OrganizationController {
  private organizationService: OrganizationService;

  constructor() {
    this.organizationService = new OrganizationService();
  }

  // Create new organization
  createOrganization = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name, description } = req.body;
      const userId = req.user?.userId;

      log.auth('Organization creation attempt', { userId, organizationName: name });

      // Validate required fields
      if (!name || !userId) {
        log.warn('Organization creation failed: missing required fields', { userId, name });
        res.status(400).json({ 
          error: 'Organization name is required' 
        });
        return;
      }

      // Validate name length
      if (name.length < 2 || name.length > 100) {
        res.status(400).json({ 
          error: 'Organization name must be between 2 and 100 characters' 
        });
        return;
      }

      const data: CreateOrganizationData = {
        name: name.trim(),
        description: description?.trim(),
      };

      const organization = await this.organizationService.createOrganization(userId, data);

      log.auth('Organization created successfully', { 
        organizationId: organization.id,
        userId,
        name: organization.name 
      });

      res.status(201).json({
        message: 'Organization created successfully',
        organization,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const knownErrors = [
          'Organization name already exists',
          'Service temporarily unavailable'
        ];
        
        if (knownErrors.some(knownError => error.message.includes(knownError))) {
          const statusCode = error.message.includes('already exists') ? 409 : 503;
          res.status(statusCode).json({ error: error.message });
          return;
        }
      }
      
      // Log unexpected errors for debugging
      log.error('Unexpected error in organization creation', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Get user's organizations
  getUserOrganizations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organizations = await this.organizationService.getUserOrganizations(userId);

      res.status(200).json({
        organizations,
        count: organizations.length,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Service temporarily unavailable')) {
        res.status(503).json({ error: error.message });
        return;
      }
      
      log.error('Unexpected error fetching user organizations', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Get organization by ID
  getOrganization = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const organization = await this.organizationService.getOrganization(organizationId, userId);

      res.status(200).json({ organization });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error fetching organization', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Add member to organization
  addMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const { userId: targetUserId, role } = req.body;
      const requesterId = req.user?.userId;

      log.auth('Add member attempt', { organizationId, requesterId, targetUserId, role });

      if (!requesterId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate required fields
      if (!targetUserId || !role) {
        res.status(400).json({ 
          error: 'User ID and role are required' 
        });
        return;
      }

      // Validate role
      if (!Object.values(Role).includes(role)) {
        res.status(400).json({ 
          error: 'Invalid role. Must be VIEW, WRITE, or ADMIN' 
        });
        return;
      }

      const data: AddMemberData = {
        userId: targetUserId,
        role: role as Role,
      };

      const membership = await this.organizationService.addMember(organizationId, requesterId, data);

      log.auth('Member added successfully', { 
        organizationId,
        requesterId,
        newMemberId: targetUserId,
        role 
      });

      res.status(201).json({
        message: 'Member added successfully',
        membership,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only admins'];
        const conflictErrors = ['already a member', 'not found'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (conflictErrors.some(err => error.message.includes(err))) {
          const statusCode = error.message.includes('not found') ? 404 : 409;
          res.status(statusCode).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error adding member', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        requesterId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Update member role
  updateMemberRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId, userId: targetUserId } = req.params;
      const { role } = req.body;
      const requesterId = req.user?.userId;

      log.auth('Update member role attempt', { organizationId, requesterId, targetUserId, role });

      if (!requesterId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate required fields
      if (!role) {
        res.status(400).json({ 
          error: 'Role is required' 
        });
        return;
      }

      // Validate role
      if (!Object.values(Role).includes(role)) {
        res.status(400).json({ 
          error: 'Invalid role. Must be VIEW, WRITE, or ADMIN' 
        });
        return;
      }

      const updatedMembership = await this.organizationService.updateMemberRole(
        organizationId, 
        requesterId, 
        targetUserId, 
        role as Role
      );

      log.auth('Member role updated successfully', { 
        organizationId,
        requesterId,
        targetUserId,
        newRole: role 
      });

      res.status(200).json({
        message: 'Member role updated successfully',
        membership: updatedMembership,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only admins'];
        const businessErrors = ['Cannot remove the last admin', 'not found'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (businessErrors.some(err => error.message.includes(err))) {
          const statusCode = error.message.includes('not found') ? 404 : 400;
          res.status(statusCode).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error updating member role', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        targetUserId: req.params.userId,
        requesterId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Remove member from organization
  removeMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId, userId: targetUserId } = req.params;
      const requesterId = req.user?.userId;

      log.auth('Remove member attempt', { organizationId, requesterId, targetUserId });

      if (!requesterId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await this.organizationService.removeMember(organizationId, requesterId, targetUserId);

      log.auth('Member removed successfully', { 
        organizationId,
        requesterId,
        removedUserId: targetUserId 
      });

      res.status(200).json({
        message: 'Member removed successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only admins'];
        const businessErrors = ['Cannot remove the last admin', 'not a member'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (businessErrors.some(err => error.message.includes(err))) {
          const statusCode = error.message.includes('not a member') ? 404 : 400;
          res.status(statusCode).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error removing member', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        targetUserId: req.params.userId,
        requesterId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Request organization deletion
  requestDeletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.userId;

      log.auth('Organization deletion request attempt', { organizationId, userId, reason });

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const data: RequestDeletionData = {
        reason: reason?.trim(),
      };

      const deletionRequest = await this.organizationService.requestDeletion(organizationId, userId, data);

      log.auth('Organization deletion requested successfully', { 
        organizationId,
        userId,
        deletionRequestId: deletionRequest.id
      });

      res.status(201).json({
        message: 'Organization deletion request submitted successfully',
        deletionRequest,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const knownErrors = [
          'Access denied',
          'Organization not found',
          'Organization is already deleted',
          'Organization deletion is already pending',
          'Service temporarily unavailable'
        ];
        
        if (knownErrors.some(knownError => error.message.includes(knownError))) {
          let statusCode = 500;
          if (error.message.includes('Access denied')) statusCode = 403;
          else if (error.message.includes('not found')) statusCode = 404;
          else if (error.message.includes('already deleted') || error.message.includes('already pending')) statusCode = 409;
          else if (error.message.includes('Service temporarily unavailable')) statusCode = 503;
          
          res.status(statusCode).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error requesting organization deletion', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Approve organization deletion
  approveDeletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.userId;

      log.auth('Organization deletion approval attempt', { organizationId, userId });

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      await this.organizationService.approveDeletion(organizationId, userId);

      log.auth('Organization deletion approved successfully', { 
        organizationId,
        userId
      });

      res.status(200).json({
        message: 'Organization deletion approved and executed successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const knownErrors = [
          'Access denied',
          'No pending deletion request found',
          'Cannot approve your own deletion request',
          'Organization not found',
          'Service temporarily unavailable'
        ];
        
        if (knownErrors.some(knownError => error.message.includes(knownError))) {
          let statusCode = 500;
          if (error.message.includes('Access denied') || error.message.includes('Cannot approve your own')) statusCode = 403;
          else if (error.message.includes('not found')) statusCode = 404;
          else if (error.message.includes('Service temporarily unavailable')) statusCode = 503;
          
          res.status(statusCode).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error approving organization deletion', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Reject organization deletion
  rejectDeletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.userId;

      log.auth('Organization deletion rejection attempt', { organizationId, userId });

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      await this.organizationService.rejectDeletion(organizationId, userId);

      log.auth('Organization deletion rejected successfully', { 
        organizationId,
        userId
      });

      res.status(200).json({
        message: 'Organization deletion request rejected successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const knownErrors = [
          'Access denied',
          'No pending deletion request found',
          'Organization not found',
          'Service temporarily unavailable'
        ];
        
        if (knownErrors.some(knownError => error.message.includes(knownError))) {
          let statusCode = 500;
          if (error.message.includes('Access denied')) statusCode = 403;
          else if (error.message.includes('not found')) statusCode = 404;
          else if (error.message.includes('Service temporarily unavailable')) statusCode = 503;
          
          res.status(statusCode).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error rejecting organization deletion', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };

  // Get deletion requests for an organization
  getDeletionRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const deletionRequests = await this.organizationService.getDeletionRequests(organizationId, userId);

      res.status(200).json({
        deletionRequests,
        count: deletionRequests.length,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const knownErrors = [
          'Access denied',
          'Service temporarily unavailable'
        ];
        
        if (knownErrors.some(knownError => error.message.includes(knownError))) {
          let statusCode = 500;
          if (error.message.includes('Access denied')) statusCode = 403;
          else if (error.message.includes('Service temporarily unavailable')) statusCode = 503;
          
          res.status(statusCode).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error fetching deletion requests', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: req.params.organizationId,
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'An unexpected error occurred. Please try again later.' 
      });
    }
  };
}
