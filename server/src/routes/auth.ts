import express from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../lib/auth';

const router = express.Router();
const authController = new AuthController();

// Registration endpoint
router.post('/register', authController.register);

// Login endpoint
router.post('/login', authController.login);

// Get current user info (protected route)
router.get('/me', authenticateToken, authController.getCurrentUser);

// Refresh token endpoint (protected route)
router.post('/refresh', authenticateToken, authController.refreshToken);

export default router;
