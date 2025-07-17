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
 *           type: string
 *           description: Unique identifier for the organization
 *         name:
 *           type: string
 *           description: Organization name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Organization description
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         memberships:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MembershipWithUser'
 *         _count:
 *           type: object
 *           properties:
 *             memberships:
 *               type: integer
 *               description: Total number of members
 *     
 *     Membership:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the membership
 *         userId:
 *           type: string
 *           description: User ID
 *         organizationId:
 *           type: string
 *           description: Organization ID
 *         role:
 *           type: string
 *           enum: [VIEW, WRITE, ADMIN]
 *           description: User role in the organization
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Membership creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     MembershipWithUser:
 *       type: object
 *       allOf:
 *         - $ref: '#/components/schemas/Membership'
 *         - type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 username:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                   nullable: true
 *                 lastName:
 *                   type: string
 *                   nullable: true
 *     
 *     CreateOrganizationRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Organization name
 *           example: "My Company"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: Organization description
 *           example: "A software development company"
 *     
 *     AddMemberRequest:
 *       type: object
 *       required:
 *         - userId
 *         - role
 *       properties:
 *         userId:
 *           type: string
 *           description: ID of the user to add as a member
 *           example: "cmd5r7bxj0000o707645mds3w"
 *         role:
 *           type: string
 *           enum: [VIEW, WRITE, ADMIN]
 *           description: Role to assign to the user
 *           example: "WRITE"
 *     
 *     UpdateRoleRequest:
 *       type: object
 *       required:
 *         - role
 *       properties:
 *         role:
 *           type: string
 *           enum: [VIEW, WRITE, ADMIN]
 *           description: New role for the user
 *           example: "ADMIN"
 */

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

export default router;
