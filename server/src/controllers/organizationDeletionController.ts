import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../lib/auth';
import { organizationDeletionService } from '../services/organizationDeletionService';
import { log } from '../lib/logger';

export class OrganizationDeletionController {
  
  /**
   * Request organization deletion
   * POST /api/organizations/:id/request-deletion
   */
  async requestDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: organizationId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const result = await organizationDeletionService.requestDeletion(
        organizationId,
        userId,
        reason
      );

      res.status(201).json({
        message: 'Organization deletion requested successfully',
        deletionRequest: {
          id: result.deletionRequest.id,
          status: result.deletionRequest.status,
          reason: result.deletionRequest.reason,
          requestedAt: result.deletionRequest.createdAt
        }
      });

    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only organization admins'];
        const conflictErrors = ['already has a pending deletion request', 'already marked for deletion'];
        const notFoundErrors = ['not found'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (conflictErrors.some(err => error.message.includes(err))) {
          res.status(409).json({ error: error.message });
          return;
        }
        
        if (notFoundErrors.some(err => error.message.includes(err))) {
          res.status(404).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error requesting deletion', { 
        organizationId: req.params.id,
        userId: req.user?.userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Approve organization deletion
   * POST /api/organizations/:id/approve-deletion
   */
  async approveDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: organizationId } = req.params;
      const { approvalNotes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const result = await organizationDeletionService.approveDeletion(
        organizationId,
        userId,
        approvalNotes
      );

      res.status(200).json({
        message: 'Organization deletion approved successfully',
        deletionRequest: {
          id: result.deletionRequest.id,
          status: result.deletionRequest.status,
          approvedBy: result.deletionRequest.approvedBy,
          approvalNotes: result.deletionRequest.approvalNotes,
          approvedAt: result.deletionRequest.updatedAt
        }
      });

    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only system admins'];
        const notFoundErrors = ['not found', 'No pending deletion request'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (notFoundErrors.some(err => error.message.includes(err))) {
          res.status(404).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error approving deletion', { 
        organizationId: req.params.id,
        userId: req.user?.userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Complete organization deletion
   * POST /api/organizations/:id/complete-deletion
   */
  async completeDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: organizationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const result = await organizationDeletionService.completeDeletion(
        organizationId,
        userId
      );

      res.status(200).json({
        message: 'Organization deletion completed successfully',
        deletionRequest: {
          id: result.deletionRequest.id,
          status: result.deletionRequest.status,
          completedAt: result.deletionRequest.updatedAt
        },
        secretsProcessed: result.secretsCount
      });

    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only system admins'];
        const notFoundErrors = ['not found', 'No approved deletion request'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (notFoundErrors.some(err => error.message.includes(err))) {
          res.status(404).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error completing deletion', { 
        organizationId: req.params.id,
        userId: req.user?.userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Reject organization deletion
   * POST /api/organizations/:id/reject-deletion
   */
  async rejectDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: organizationId } = req.params;
      const { rejectionReason } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const result = await organizationDeletionService.rejectDeletion(
        organizationId,
        userId,
        rejectionReason
      );

      res.status(200).json({
        message: 'Organization deletion rejected successfully',
        deletionRequest: {
          id: result.deletionRequest.id,
          status: result.deletionRequest.status,
          rejectionReason: result.deletionRequest.approvalNotes,
          rejectedAt: result.deletionRequest.updatedAt
        }
      });

    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only system admins'];
        const notFoundErrors = ['not found', 'No pending deletion request'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (notFoundErrors.some(err => error.message.includes(err))) {
          res.status(404).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error rejecting deletion', { 
        organizationId: req.params.id,
        userId: req.user?.userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get deletion requests for an organization
   * GET /api/organizations/:id/deletion-requests
   */
  async getDeletionRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: organizationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const requests = await organizationDeletionService.getDeletionRequests(
        organizationId,
        userId
      );

      res.status(200).json({
        deletionRequests: requests.map((request: any) => ({
          id: request.id,
          status: request.status,
          reason: request.reason,
          requestedBy: request.requestedBy,
          approvedBy: request.approvedBy,
          approvalNotes: request.approvalNotes,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt
        }))
      });

    } catch (error) {
      if (error instanceof Error) {
        // Handle known business logic errors
        const accessErrors = ['Access denied', 'Only organization admins'];
        const notFoundErrors = ['not found'];
        
        if (accessErrors.some(err => error.message.includes(err))) {
          res.status(403).json({ error: error.message });
          return;
        }
        
        if (notFoundErrors.some(err => error.message.includes(err))) {
          res.status(404).json({ error: error.message });
          return;
        }
        
        if (error.message.includes('Service temporarily unavailable')) {
          res.status(503).json({ error: error.message });
          return;
        }
      }
      
      log.error('Unexpected error getting deletion requests', { 
        organizationId: req.params.id,
        userId: req.user?.userId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const organizationDeletionController = new OrganizationDeletionController();
