import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { generateToken, AuthenticatedRequest, authenticateToken } from '../lib/auth';

const router = express.Router();

// Registration endpoint
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !username || !password) {
      res.status(400).json({ 
        error: 'Email, username, and password are required' 
      });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({ 
        error: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken' 
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      }
    });

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Internal server error during registration' 
    });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { emailOrUsername, password } = req.body;

    // Validate required fields
    if (!emailOrUsername || !password) {
      res.status(400).json({ 
        error: 'Email/username and password are required' 
      });
      return;
    }

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      }
    });

    if (!user) {
      res.status(401).json({ 
        error: 'Invalid credentials' 
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ 
        error: 'Invalid credentials' 
      });
      return;
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during login' 
    });
  }
});

// Get current user info (protected route)
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                description: true,
              }
            }
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Refresh token endpoint
router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate new token
    const newToken = generateToken(user.id, user.email);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      error: 'Internal server error during token refresh' 
    });
  }
});

export default router;
