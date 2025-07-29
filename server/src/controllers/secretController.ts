import { Response } from 'express';
import { SecretService } from '../services/secretService';
import { logger } from '../lib/logger';
import { body, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../lib/auth';

// Validation middleware
export const createSecretValidation = [
  body('name').notEmpty().withMessage('Secret name is required').isLength({ max: 255 }).withMessage('Secret name must not exceed 255 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('value').notEmpty().withMessage('Secret value is required'),
  body('type').isIn(['GENERIC', 'PASSWORD', 'API_KEY', 'TOKEN', 'CERTIFICATE', 'DATABASE_URL']).withMessage('Invalid secret type'),
  body('folderId').notEmpty().withMessage('Folder ID is required')
];

export const updateSecretValidation = [
  param('secretId').notEmpty().withMessage('Secret ID is required'),
  body('name').optional().notEmpty().withMessage('Secret name cannot be empty').isLength({ max: 255 }).withMessage('Secret name must not exceed 255 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('value').optional().notEmpty().withMessage('Secret value cannot be empty'),
  body('type').optional().isIn(['GENERIC', 'PASSWORD', 'API_KEY', 'TOKEN', 'CERTIFICATE', 'DATABASE_URL']).withMessage('Invalid secret type')
];

export const secretIdValidation = [
  param('secretId').notEmpty().withMessage('Secret ID is required')
];

export const folderIdValidation = [
  param('folderId').notEmpty().withMessage('Folder ID is required')
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

export class SecretController {
  private secretService: SecretService;

  constructor() {
    this.secretService = new SecretService();
  }

  /**
   * @swagger
   * /api/secrets:
   *   post:
   *     summary: Create a new secret
   *     description: Creates a new encrypted secret in the specified folder
   *     tags: [Secrets]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - value
   *               - type
   *               - folderId
   *             properties:
   *               name:
   *                 type: string
   *                 description: Name of the secret
   *                 maxLength: 255
   *               description:
   *                 type: string
   *                 description: Optional description of the secret
   *                 maxLength: 1000
   *               value:
   *                 type: string
   *                 description: The secret value (will be encrypted)
   *               type:
   *                 type: string
   *                 enum: [GENERIC, PASSWORD, API_KEY, TOKEN, CERTIFICATE, DATABASE_URL]
   *                 description: Type of the secret
   *               folderId:
   *                 type: string
   *                 description: ID of the folder to store the secret in
   *     responses:
   *       201:
   *         description: Secret created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 secret:
   *                   $ref: '#/components/schemas/Secret'
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Folder not found
   *       409:
   *         description: Secret name already exists in folder
   *       500:
   *         description: Internal server error
   */
  createSecret = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { name, description, value, type, folderId } = req.body;

      const secret = await this.secretService.createSecret({
        name,
        description,
        value,
        type,
        folderId,
        createdBy: userId
      });

      logger.info('Secret created', {
        secretId: secret.id,
        secretName: name,
        folderId,
        createdBy: userId
      });

      res.status(201).json({
        message: 'Secret created successfully',
        secret: {
          id: secret.id,
          name: secret.name,
          description: secret.description,
          type: secret.type,
          folderId: secret.folderId,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
          folder: secret.folder
        }
      });
    } catch (error) {
      logger.error('Error creating secret:', error);

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
   * @swagger
   * /api/secrets/{secretId}:
   *   get:
   *     summary: Get secret metadata
   *     description: Retrieves secret information without the encrypted value
   *     tags: [Secrets]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: secretId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the secret to retrieve
   *     responses:
   *       200:
   *         description: Secret retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 secret:
   *                   $ref: '#/components/schemas/Secret'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Secret not found
   *       500:
   *         description: Internal server error
   */
  getSecret = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { secretId } = req.params;

      const secret = await this.secretService.getSecretById(secretId, userId);

      res.status(200).json({
        secret: {
          id: secret.id,
          name: secret.name,
          description: secret.description,
          type: secret.type,
          folderId: secret.folderId,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
          folder: secret.folder
        }
      });
    } catch (error) {
      logger.error('Error getting secret:', error);

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
   * @swagger
   * /api/secrets/{secretId}/value:
   *   get:
   *     summary: Get secret with decrypted value
   *     description: Retrieves secret information including the decrypted value
   *     tags: [Secrets]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: secretId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the secret to retrieve
   *     responses:
   *       200:
   *         description: Secret with value retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 secret:
   *                   $ref: '#/components/schemas/SecretWithValue'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Secret not found
   *       500:
   *         description: Internal server error
   */
  getSecretValue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { secretId } = req.params;

      const secret = await this.secretService.getSecretWithValue(secretId, userId);

      res.status(200).json({
        secret: {
          id: secret.id,
          name: secret.name,
          description: secret.description,
          type: secret.type,
          value: secret.value,
          folderId: secret.folderId,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
          folder: secret.folder
        }
      });
    } catch (error) {
      logger.error('Error getting secret value:', error);

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
   * @swagger
   * /api/secrets/folders/{folderId}/secrets:
   *   get:
   *     summary: Get all secrets in a folder
   *     description: Retrieves all secrets within the specified folder
   *     tags: [Secrets]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: folderId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the folder to get secrets from
   *     responses:
   *       200:
   *         description: Folder secrets retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 secrets:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Secret'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Folder not found
   *       500:
   *         description: Internal server error
   */
  getFolderSecrets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const secrets = await this.secretService.getFolderSecrets(folderId, userId);

      res.status(200).json({
        secrets: secrets.map(secret => ({
          id: secret.id,
          name: secret.name,
          description: secret.description,
          type: secret.type,
          folderId: secret.folderId,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt
        }))
      });
    } catch (error) {
      logger.error('Error getting folder secrets:', error);

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
   * @swagger
   * /api/secrets/{secretId}:
   *   put:
   *     summary: Update secret
   *     description: Updates an existing secret's properties
   *     tags: [Secrets]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: secretId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the secret to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: New name for the secret
   *                 maxLength: 255
   *               description:
   *                 type: string
   *                 description: New description for the secret
   *                 maxLength: 1000
   *               value:
   *                 type: string
   *                 description: New secret value (will be encrypted)
   *               type:
   *                 type: string
   *                 enum: [GENERIC, PASSWORD, API_KEY, TOKEN, CERTIFICATE, DATABASE_URL]
   *                 description: New type of the secret
   *     responses:
   *       200:
   *         description: Secret updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 secret:
   *                   $ref: '#/components/schemas/Secret'
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Secret not found
   *       409:
   *         description: Secret name already exists in folder
   *       500:
   *         description: Internal server error
   */
  updateSecret = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { secretId } = req.params;
      const { name, description, value, type } = req.body;

      const secret = await this.secretService.updateSecret(secretId, {
        name,
        description,
        value,
        type
      }, userId);

      logger.info('Secret updated', {
        secretId,
        updatedBy: userId
      });

      res.status(200).json({
        message: 'Secret updated successfully',
        secret: {
          id: secret.id,
          name: secret.name,
          description: secret.description,
          type: secret.type,
          folderId: secret.folderId,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
          folder: secret.folder
        }
      });
    } catch (error) {
      logger.error('Error updating secret:', error);

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
   * @swagger
   * /api/secrets/{secretId}:
   *   delete:
   *     summary: Delete secret
   *     description: Permanently deletes a secret and all its versions
   *     tags: [Secrets]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: secretId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the secret to delete
   *     responses:
   *       200:
   *         description: Secret deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Secret not found
   *       500:
   *         description: Internal server error
   */
  deleteSecret = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { secretId } = req.params;

      await this.secretService.deleteSecret(secretId, userId);

      logger.info('Secret deleted', {
        secretId,
        deletedBy: userId
      });

      res.status(200).json({
        message: 'Secret deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting secret:', error);

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
   * @swagger
   * /api/secrets/{secretId}/versions:
   *   get:
   *     summary: Get secret version history
   *     description: Retrieves the version history of a secret
   *     tags: [Secrets]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: secretId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the secret to get versions for
   *     responses:
   *       200:
   *         description: Secret versions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 versions:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SecretVersion'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Secret not found
   *       500:
   *         description: Internal server error
   */
  getSecretVersions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { secretId } = req.params;

      const versions = await this.secretService.getSecretVersions(secretId, userId);

      res.status(200).json({
        versions
      });
    } catch (error) {
      logger.error('Error getting secret versions:', error);

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
   * Get specific secret version with decrypted value
   * GET /api/secrets/:secretId/versions/:version/value
   */
  getSecretVersionValue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { secretId, version } = req.params;
      const versionNumber = parseInt(version);

      if (isNaN(versionNumber) || versionNumber < 1) {
        res.status(400).json({ error: 'Invalid version number' });
        return;
      }

      const versionData = await this.secretService.getSecretVersionValue(secretId, versionNumber, userId);

      res.status(200).json({
        version: versionData
      });
    } catch (error) {
      logger.error('Error getting secret version value:', error);

      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('Failed to decrypt')) {
          res.status(500).json({ error: 'Failed to decrypt secret version' });
          return;
        }
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get secret versions with all decrypted values (admin-only)
   * GET /api/secrets/:secretId/versions/all-values
   */
  getSecretVersionsWithValues = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const { secretId } = req.params;

      const versions = await this.secretService.getSecretVersionsWithValues(secretId, userId);

      res.status(200).json({
        versions,
        warning: 'This endpoint provides access to all historical secret values. Use with caution.'
      });
    } catch (error) {
      logger.error('Error getting secret versions with values:', error);

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
