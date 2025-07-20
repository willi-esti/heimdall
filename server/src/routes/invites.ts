import { Router } from 'express';
import { InviteController, createInviteValidation, acceptInviteValidation, rejectInviteValidation } from '../controllers/inviteController';
import { authenticateToken, optionalAuth } from '../lib/auth';

const router = Router();
const inviteController = new InviteController();

/**
 * @swagger
 * /api/invites:
 *   get:
 *     summary: Get all invitations sent to the current user
 *     tags: [Invites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of invitations for the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invites:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       token:
 *                         type: string
 *                       email:
 *                         type: string
 *                         format: email
 *                       role:
 *                         type: string
 *                         enum: [VIEW, WRITE, ADMIN]
 *                       status:
 *                         type: string
 *                         enum: [PENDING, ACCEPTED, REJECTED, EXPIRED]
 *                       organization:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                       invitedBy:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                           email:
 *                             type: string
 *                             format: email
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Create a new organization invitation
 *     tags: [Invites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizationId:
 *                 type: string
 *                 description: ID of the organization to invite to
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the user to invite
 *               role:
 *                 type: string
 *                 enum: [VIEW, WRITE, ADMIN]
 *                 default: VIEW
 *                 description: Role to assign to the invited user
 *             required:
 *               - organizationId
 *               - email
 *     responses:
 *       201:
 *         description: Invitation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 invite:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - only admins can invite users
 *       404:
 *         description: Organization not found
 *       409:
 *         description: User already invited or already a member
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, inviteController.getUserInvites);
router.post('/', authenticateToken, createInviteValidation, inviteController.createInvite);

/**
 * @swagger
 * /api/invites/accept:
 *   post:
 *     summary: Accept an organization invitation
 *     tags: [Invites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Unique invitation token
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invite not found or expired
 *       409:
 *         description: Invite already processed or user already a member
 *       500:
 *         description: Internal server error
 */
router.post('/accept', authenticateToken, acceptInviteValidation, inviteController.acceptInvite);

/**
 * @swagger
 * /api/invites/reject:
 *   post:
 *     summary: Reject an organization invitation
 *     tags: [Invites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Unique invitation token
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: Invitation rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invite not found or expired
 *       409:
 *         description: Invite already processed
 *       500:
 *         description: Internal server error
 */
router.post('/reject', authenticateToken, rejectInviteValidation, inviteController.rejectInvite);

/**
 * @swagger
 * /api/invites/{token}:
 *   get:
 *     summary: Get invitation details by token (for preview)
 *     tags: [Invites]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invite:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                     organizationName:
 *                       type: string
 *                     organizationDescription:
 *                       type: string
 *                       nullable: true
 *                     invitedBy:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Token is required
 *       404:
 *         description: Invite not found or expired
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/invites/{token}:
 *   get:
 *     summary: Get invitation details by token (for invite preview)
 *     tags: [Invites]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *                 role:
 *                   type: string
 *                   enum: [VIEW, WRITE, ADMIN]
 *                 organization:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Token is required
 *       404:
 *         description: Invite not found or expired
 *       500:
 *         description: Internal server error
 */
router.get('/:token', optionalAuth, inviteController.getInviteDetails);

/**
 * @swagger
 * /api/invites/{inviteId}:
 *   delete:
 *     summary: Cancel an organization invitation
 *     tags: [Invites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the invitation to cancel
 *     responses:
 *       200:
 *         description: Invitation cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invite ID is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - only admins can cancel invites
 *       404:
 *         description: Invite not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:inviteId', authenticateToken, inviteController.cancelInvite);

export default router;
