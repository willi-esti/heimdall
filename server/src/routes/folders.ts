import { Router } from 'express';
import { 
  FolderController, 
  createFolderValidation, 
  updateFolderValidation, 
  folderIdValidation, 
  organizationIdValidation,
  deleteFolderValidation,
  moveFolderValidation
} from '../controllers/folderController';
import { authenticateToken } from '../lib/auth';

const router = Router();
const folderController = new FolderController();

/**
 * @swagger
 * components:
 *   schemas:
 *     Folder:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the folder
 *         name:
 *           type: string
 *           description: Name of the folder
 *         description:
 *           type: string
 *           description: Optional description of the folder
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: ID of the parent folder (null for root folders)
 *         organizationId:
 *           type: string
 *           description: ID of the organization this folder belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the folder was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the folder was last updated
 *         children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Folder'
 *           description: Child folders (when included)
 *         secrets:
 *           type: array
 *           items:
 *             type: object
 *           description: Secrets in this folder (when included)
 */

/**
 * @swagger
 * /api/folders:
 *   post:
 *     summary: Create a new folder
 *     tags: [Folders]
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
 *               - organizationId
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 description: Name of the folder
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional description of the folder
 *               parentId:
 *                 type: string
 *                 description: ID of the parent folder (optional for root folders)
 *               organizationId:
 *                 type: string
 *                 description: ID of the organization
 *     responses:
 *       201:
 *         description: Folder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Organization or parent folder not found
 *       409:
 *         description: Folder name already exists in this location
 *       500:
 *         description: Internal server error
 */
router.post('/', authenticateToken, createFolderValidation, folderController.createFolder);

/**
 * @swagger
 * /api/folders/{folderId}:
 *   get:
 *     summary: Get folder details by ID
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the folder
 *     responses:
 *       200:
 *         description: Folder details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Internal server error
 */
router.get('/:folderId', authenticateToken, folderIdValidation, folderController.getFolderById);

/**
 * @swagger
 * /api/folders/{folderId}:
 *   put:
 *     summary: Update folder
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the folder
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 description: New name for the folder
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: New description for the folder
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: New parent folder ID (null for root level)
 *     responses:
 *       200:
 *         description: Folder updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder not found
 *       409:
 *         description: Name conflict or would create cycle
 *       500:
 *         description: Internal server error
 */
router.put('/:folderId', authenticateToken, updateFolderValidation, folderController.updateFolder);

/**
 * @swagger
 * /api/folders/{folderId}:
 *   delete:
 *     summary: Delete folder
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the folder
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force delete folder and all its contents
 *     responses:
 *       200:
 *         description: Folder deleted successfully
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
 *         description: Folder not found
 *       409:
 *         description: Folder contains items (use force=true to delete)
 *       500:
 *         description: Internal server error
 */
router.delete('/:folderId', authenticateToken, deleteFolderValidation, folderController.deleteFolder);

/**
 * @swagger
 * /api/folders/{folderId}/move:
 *   post:
 *     summary: Move folder to a different parent
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the folder to move
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: New parent folder ID (null for root level)
 *     responses:
 *       200:
 *         description: Folder moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 folder:
 *                   $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder not found
 *       409:
 *         description: Would create cycle in folder hierarchy
 *       500:
 *         description: Internal server error
 */
router.post('/:folderId/move', authenticateToken, moveFolderValidation, folderController.moveFolder);

/**
 * @swagger
 * /api/folders/{folderId}/path:
 *   get:
 *     summary: Get folder path (breadcrumb)
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the folder
 *     responses:
 *       200:
 *         description: Folder path retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 path:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Internal server error
 */
router.get('/:folderId/path', authenticateToken, folderIdValidation, folderController.getFolderPath);

export default router;
