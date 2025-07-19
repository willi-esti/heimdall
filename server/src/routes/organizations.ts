import { Router } from 'express';
import { OrganizationController } from '../controllers/organizationController';
import { authenticateToken } from '../lib/auth';

const router = Router();
const organizationController = new OrganizationController();

/**
 * @swagger
 * components:
 *   schemas:
 *     Organization:
 *       type: object
 *       properties:
 *         id:
 *           typ       503:
         description: Service temporarily unavailable
 */

/**
 * @swagger
 * /api/organizations/{organizationId}/deletion/request:
 *   post:
 *     summary: Request organization deletion
 *     description: Requests deletion of an organization (requires ADMIN role)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Optional reason for deletion
 *     responses:
 *       201:
 *         description: Deletion request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization deletion request submitted successfully"
 *                 deletionRequest:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     organizationId:
 *                       type: string
 *                     requestedBy:
 *                       type: string
 *                     reason:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       enum: [PENDING, APPROVED, REJECTED, COMPLETED]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - Organization ID is required
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Organization already deleted or deletion already pending
 *       503:
 *         description: Service temporarily unavailable
 * 
 * /api/organizations/{organizationId}/deletion/approve:
 *   post:
 *     summary: Approve organization deletion
 *     description: Approves and executes organization deletion (requires ADMIN role, cannot approve own request)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization deletion approved and executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization deletion approved and executed successfully"
 *       400:
 *         description: Bad request - Organization ID is required
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions or self-approval
 *       404:
 *         description: Organization not found or no pending deletion request
 *       503:
 *         description: Service temporarily unavailable
 * 
 * /api/organizations/{organizationId}/deletion/reject:
 *   post:
 *     summary: Reject organization deletion
 *     description: Rejects organization deletion request (requires ADMIN role)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization deletion request rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization deletion request rejected successfully"
 *       400:
 *         description: Bad request - Organization ID is required
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Organization not found or no pending deletion request
 *       503:
 *         description: Service temporarily unavailable
 * 
 * /api/organizations/{organizationId}/deletion/requests:
 *   get:
 *     summary: Get deletion requests for organization
 *     description: Retrieves all deletion requests for an organization (requires ADMIN role)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Deletion requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletionRequests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       organizationId:
 *                         type: string
 *                       requestedBy:
 *                         type: string
 *                       approvedBy:
 *                         type: string
 *                         nullable: true
 *                       reason:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [PENDING, APPROVED, REJECTED, COMPLETED]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       organization:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                             nullable: true
 *                 count:
 *                   type: integer
 *                   description: Total number of deletion requests
 *       400:
 *         description: Bad request - Organization ID is required
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       503:
 *         description: Service temporarily unavailable
 */

// Create organization
router.post('/', authenticateToken, organizationController.createOrganization);

// Get user's organizations
router.get('/', authenticateToken, organizationController.getUserOrganizations);

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create a new organization
 *     description: Creates a new organization with the authenticated user as the admin
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrganizationRequest'
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization created successfully"
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Organization name is required"
 *       401:
 *         description: Unauthorized - authentication required
 *       409:
 *         description: Conflict - organization name already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Organization name already exists"
 *       503:
 *         description: Service temporarily unavailable
 *   
 *   get:
 *     summary: Get user's organizations
 *     description: Retrieves all organizations that the authenticated user is a member of
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *                 count:
 *                   type: integer
 *                   description: Number of organizations
 *                   example: 2
 *       401:
 *         description: Unauthorized - authentication required
 *       503:
 *         description: Service temporarily unavailable
 */

/**
 * @swagger
 * /api/organizations/{organizationId}:
 *   get:
 *     summary: Get organization by ID
 *     description: Retrieves a specific organization that the user is a member of
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - user is not a member of this organization
 *       404:
 *         description: Organization not found
 *       503:
 *         description: Service temporarily unavailable
 */

/**
 * @swagger
 * /api/organizations/{organizationId}/members:
 *   post:
 *     summary: Add member to organization
 *     description: Adds a user as a member to the organization (requires ADMIN role)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddMemberRequest'
 *     responses:
 *       201:
 *         description: Member added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Member added successfully"
 *                 membership:
 *                   $ref: '#/components/schemas/Membership'
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: User not found
 *       409:
 *         description: User is already a member
 *       503:
 *         description: Service temporarily unavailable
 */

/**
 * @swagger
 * /api/organizations/{organizationId}/members/{userId}:
 *   put:
 *     summary: Update member role
 *     description: Updates a member's role in the organization (requires ADMIN role)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the member to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleRequest'
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Member role updated successfully"
 *                 membership:
 *                   $ref: '#/components/schemas/Membership'
 *       400:
 *         description: Bad request - validation error or cannot remove last admin
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Member not found
 *       503:
 *         description: Service temporarily unavailable
 *   
 *   delete:
 *     summary: Remove member from organization
 *     description: Removes a member from the organization (requires ADMIN role)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the member to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Member removed successfully"
 *       400:
 *         description: Bad request - cannot remove last admin
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Member not found
 *       503:
 *         description: Service temporarily unavailable
 */

// Create organization
router.post('/', authenticateToken, organizationController.createOrganization);

// Get user's organizations
router.get('/', authenticateToken, organizationController.getUserOrganizations);

// Get organization by ID
router.get('/:organizationId', authenticateToken, organizationController.getOrganization);

// Add member to organization
router.post('/:organizationId/members', authenticateToken, organizationController.addMember);

// Update member role
router.put('/:organizationId/members/:userId', authenticateToken, organizationController.updateMemberRole);

// Remove member from organization
router.delete('/:organizationId/members/:userId', authenticateToken, organizationController.removeMember);

// Organization deletion routes
router.post('/:organizationId/deletion/request', authenticateToken, organizationController.requestDeletion);
router.post('/:organizationId/deletion/approve', authenticateToken, organizationController.approveDeletion);
router.post('/:organizationId/deletion/reject', authenticateToken, organizationController.rejectDeletion);
router.get('/:organizationId/deletion/requests', authenticateToken, organizationController.getDeletionRequests);

export default router;
