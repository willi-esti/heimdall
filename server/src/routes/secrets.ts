import { Router } from 'express';
import { 
  SecretController,
  createSecretValidation,
  updateSecretValidation,
  secretIdValidation,
  folderIdValidation
} from '../controllers/secretController';
import { authenticateToken } from '../lib/auth';

/**
 * @swagger
 * components:
 *   parameters:
 *     secretId:
 *       in: path
 *       name: secretId
 *       required: true
 *       schema:
 *         type: string
 *       description: Unique identifier of the secret
 *     folderId:
 *       in: path
 *       name: folderId
 *       required: true
 *       schema:
 *         type: string
 *       description: Unique identifier of the folder
 *     version:
 *       in: path
 *       name: version
 *       required: true
 *       schema:
 *         type: integer
 *       description: Version number of the secret
 */

const router = Router();
const secretController = new SecretController();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/secrets:
 *   post:
 *     summary: Create a new secret
 *     description: Creates a new encrypted secret in the specified folder. The secret value will be encrypted using AES-256-GCM before storage.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSecretRequest'
 *           examples:
 *             database_secret:
 *               summary: Database connection string
 *               value:
 *                 name: "DATABASE_URL"
 *                 description: "Production database connection string"
 *                 value: "postgresql://user:password@db.example.com:5432/myapp"
 *                 type: "DATABASE_URL"
 *                 folderId: "folder123"
 *             api_key:
 *               summary: API key
 *               value:
 *                 name: "STRIPE_API_KEY"
 *                 description: "Stripe payment processing API key"
 *                 value: "sk_live_fake_key_for_testing_only_not_real"
 *                 type: "API_KEY"
 *                 folderId: "folder123"
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
 *                   example: "Secret created successfully"
 *                 secret:
 *                   $ref: '#/components/schemas/Secret'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder not found
 *       409:
 *         description: Secret with this name already exists in folder
 */
router.post('/', createSecretValidation, secretController.createSecret);

/**
 * @swagger
 * /api/secrets/{secretId}:
 *   get:
 *     summary: Get secret metadata
 *     description: Retrieves secret information without the decrypted value. Use this for listing secrets securely.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/secretId'
 *     responses:
 *       200:
 *         description: Secret metadata retrieved successfully
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
 */
router.get('/:secretId', secretIdValidation, secretController.getSecret);

/**
 * @swagger
 * /api/secrets/{secretId}/value:
 *   get:
 *     summary: Get secret with decrypted value
 *     description: Retrieves the secret with its decrypted value. This is a sensitive operation that will be logged for audit purposes.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/secretId'
 *     responses:
 *       200:
 *         description: Secret with decrypted value retrieved successfully
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
 */
router.get('/:secretId/value', secretIdValidation, secretController.getSecretValue);

/**
 * @swagger
 * /api/secrets/{secretId}:
 *   put:
 *     summary: Update a secret
 *     description: Updates a secret's properties. If the value is changed, a new version will be created automatically.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/secretId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSecretRequest'
 *           examples:
 *             update_value:
 *               summary: Update secret value
 *               value:
 *                 value: "postgresql://user:newpassword@db.example.com:5432/myapp"
 *                 description: "Updated production database connection string"
 *             update_metadata:
 *               summary: Update only metadata
 *               value:
 *                 name: "PROD_DATABASE_URL"
 *                 description: "Updated description for production database"
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
 *                   example: "Secret updated successfully"
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
 *         description: Secret with this name already exists in folder
 */
router.put('/:secretId', updateSecretValidation, secretController.updateSecret);

/**
 * @swagger
 * /api/secrets/{secretId}:
 *   delete:
 *     summary: Delete a secret
 *     description: Permanently deletes a secret and all its versions. This action cannot be undone.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/secretId'
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
 *                   example: "Secret deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Secret not found
 */
router.delete('/:secretId', secretIdValidation, secretController.deleteSecret);

/**
 * @swagger
 * /api/secrets/{secretId}/versions:
 *   get:
 *     summary: Get secret version history (metadata only)
 *     description: Retrieves the version history of a secret without decrypted values. Use this for audit trails and version management.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/secretId'
 *     responses:
 *       200:
 *         description: Version history retrieved successfully
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
 */
router.get('/:secretId/versions', secretIdValidation, secretController.getSecretVersions);

/**
 * @swagger
 * /api/secrets/{secretId}/versions/all-values:
 *   get:
 *     summary: Get secret version history with decrypted values
 *     description: |
 *       ⚠️ **SENSITIVE OPERATION**: Retrieves all historical versions of a secret with their decrypted values. 
 *       This provides access to all historical secret data and should be used with extreme caution.
 *       This operation is logged for security auditing.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/secretId'
 *     responses:
 *       200:
 *         description: Version history with values retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 versions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SecretVersionWithValue'
 *                 warning:
 *                   type: string
 *                   example: "This endpoint provides access to all historical secret values. Use with caution."
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Secret not found
 */
router.get('/:secretId/versions/all-values', secretIdValidation, secretController.getSecretVersionsWithValues);

/**
 * @swagger
 * /api/secrets/{secretId}/versions/{version}/value:
 *   get:
 *     summary: Get specific version's decrypted value
 *     description: |
 *       Retrieves the decrypted value of a specific version of a secret. 
 *       This is useful for rollbacks or comparing different versions.
 *       This operation is logged for security auditing.
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/secretId'
 *       - $ref: '#/components/parameters/version'
 *     responses:
 *       200:
 *         description: Version value retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   $ref: '#/components/schemas/SecretVersionWithValue'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Secret or version not found
 */
router.get('/:secretId/versions/:version/value', secretIdValidation, secretController.getSecretVersionValue);

/**
 * @swagger
 * /api/secrets/folders/{folderId}/secrets:
 *   get:
 *     summary: Get all secrets in a folder
 *     description: Retrieves all secrets within a specific folder. Returns metadata only (no decrypted values).
 *     tags: [Secrets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/folderId'
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
 *         description: Insufficient permissions to access this folder
 *       404:
 *         description: Folder not found
 */
router.get('/folders/:folderId/secrets', folderIdValidation, secretController.getFolderSecrets);

export default router;
