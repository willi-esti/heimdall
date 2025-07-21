import { Response } from 'express';
import { FolderService } from '../services/folderService';
import { logger } from '../lib/logger';
import { body, param, query, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../lib/auth';

// Validation middleware
export const createFolderValidation = [
  body('name').notEmpty().withMessage('Folder name is required').isLength({ max: 255 }).withMessage('Folder name must not exceed 255 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('parentId').optional().custom((value) => {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value !== 'string') {
        throw new Error('Parent ID must be a string');
      }
      // Allow both UUID and CUID formats
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const cuidRegex = /^c[0-9a-z]{24}$/i;
      if (!uuidRegex.test(value) && !cuidRegex.test(value)) {
        throw new Error('Parent ID must be a valid UUID or CUID');
      }
    }
    return true;
  }),
  body('organizationId').notEmpty().withMessage('Organization ID is required')
];

export const updateFolderValidation = [
  param('folderId').notEmpty().withMessage('Folder ID is required'),
  body('name').optional().notEmpty().withMessage('Folder name cannot be empty').isLength({ max: 255 }).withMessage('Folder name must not exceed 255 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('parentId').optional().custom((value) => {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value !== 'string') {
        throw new Error('Parent ID must be a string');
      }
      // Allow both UUID and CUID formats
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const cuidRegex = /^c[0-9a-z]{24}$/i;
      if (!uuidRegex.test(value) && !cuidRegex.test(value)) {
        throw new Error('Parent ID must be a valid UUID or CUID');
      }
    }
    return true;
  })
];

export const folderIdValidation = [
  param('folderId').notEmpty().withMessage('Folder ID is required')
];

export const organizationIdValidation = [
  param('organizationId').notEmpty().withMessage('Organization ID is required')
];

export const deleteFolderValidation = [
  param('folderId').notEmpty().withMessage('Folder ID is required'),
  query('force').optional().isBoolean().withMessage('Force parameter must be a boolean')
];

export const moveFolderValidation = [
  param('folderId').notEmpty().withMessage('Folder ID is required'),
  body('parentId').optional().custom((value) => {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value !== 'string') {
        throw new Error('Parent ID must be a string');
      }
      // Allow both UUID and CUID formats
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const cuidRegex = /^c[0-9a-z]{24}$/i;
      if (!uuidRegex.test(value) && !cuidRegex.test(value)) {
        throw new Error('Parent ID must be a valid UUID or CUID');
      }
    }
    return true;
  })
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

export class FolderController {
  private folderService: FolderService;

  constructor() {
    this.folderService = new FolderService();
  }

  /**
   * Create a new folder
   * POST /api/folders
   */
  createFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { name, description, parentId, organizationId } = req.body;

      // Normalize parentId: convert empty string to null
      const normalizedParentId = parentId === '' || parentId === undefined ? null : parentId;

      const folder = await this.folderService.createFolder({
        name,
        description,
        parentId: normalizedParentId,
        organizationId,
        createdBy: userId
      });

      logger.info('Folder created', {
        folderId: folder.id,
        folderName: name,
        organizationId,
        createdBy: userId
      });

      res.status(201).json({
        message: 'Folder created successfully',
        folder: {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          parentId: folder.parentId,
          organizationId: folder.organizationId,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt
        }
      });
    } catch (error) {
      logger.error('Error creating folder:', error);

      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('already exists')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get folder by ID
   * GET /api/folders/:folderId
   */
  getFolderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { folderId } = req.params;

      const folder = await this.folderService.getFolderById(folderId, userId);

      res.status(200).json({
        folder
      });
    } catch (error) {
      logger.error('Error getting folder:', error);

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
   * Get all folders in an organization
   * GET /api/organizations/:organizationId/folders
   */
  getOrganizationFolders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { organizationId } = req.params;

      const folders = await this.folderService.getOrganizationFolders(organizationId, userId);

      res.status(200).json({
        folders
      });
    } catch (error) {
      logger.error('Error getting organization folders:', error);

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
   * Get folder tree for an organization
   * GET /api/organizations/:organizationId/folders/tree
   */
  getFolderTree = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { organizationId } = req.params;

      const folderTree = await this.folderService.getFolderTree(organizationId, userId);

      res.status(200).json({
        folderTree
      });
    } catch (error) {
      logger.error('Error getting folder tree:', error);

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
   * Update folder
   * PUT /api/folders/:folderId
   */
  updateFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { folderId } = req.params;
      const { name, description, parentId } = req.body;

      // Normalize parentId: convert empty string to null
      const normalizedParentId = parentId === '' || parentId === undefined ? null : parentId;

      const folder = await this.folderService.updateFolder(folderId, {
        name,
        description,
        parentId: normalizedParentId
      }, userId);

      logger.info('Folder updated', {
        folderId,
        updatedBy: userId
      });

      res.status(200).json({
        message: 'Folder updated successfully',
        folder: {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          parentId: folder.parentId,
          organizationId: folder.organizationId,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt
        }
      });
    } catch (error) {
      logger.error('Error updating folder:', error);

      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('already exists') || error.message.includes('cycle')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Delete folder
   * DELETE /api/folders/:folderId
   */
  deleteFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { folderId } = req.params;
      const force = req.query.force === 'true';

      await this.folderService.deleteFolder(folderId, userId, force);

      logger.info('Folder deleted', {
        folderId,
        force,
        deletedBy: userId
      });

      res.status(200).json({
        message: 'Folder deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting folder:', error);

      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('Cannot delete folder with contents')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Move folder to a different parent
   * POST /api/folders/:folderId/move
   */
  moveFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { folderId } = req.params;
      const { parentId } = req.body;

      // Normalize parentId: convert empty string to null
      const normalizedParentId = parentId === '' || parentId === undefined ? null : parentId;

      const folder = await this.folderService.moveFolder(folderId, normalizedParentId, userId);

      logger.info('Folder moved', {
        folderId,
        newParentId: parentId,
        movedBy: userId
      });

      res.status(200).json({
        message: 'Folder moved successfully',
        folder: {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          parentId: folder.parentId,
          organizationId: folder.organizationId,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt
        }
      });
    } catch (error) {
      logger.error('Error moving folder:', error);

      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('cycle')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get folder path (breadcrumb)
   * GET /api/folders/:folderId/path
   */
  getFolderPath = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { folderId } = req.params;

      const path = await this.folderService.getFolderPath(folderId, userId);

      res.status(200).json({
        path
      });
    } catch (error) {
      logger.error('Error getting folder path:', error);

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
}
