import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../lib/auth';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // Register a new user
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, username, password, firstName, lastName } = req.body;

      // Validate required fields
      if (!email || !username || !password) {
        res.status(400).json({ 
          error: 'Email, username, and password are required' 
        });
        return;
      }

      const result = await this.authService.register({
        email,
        username,
        password,
        firstName,
        lastName,
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists') || error.message.includes('already taken')) {
          res.status(409).json({ error: error.message });
          return;
        }
      }
      
      console.error('Registration error:', error);
      res.status(500).json({ 
        error: 'Internal server error during registration' 
      });
    }
  };

  // Login user
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emailOrUsername, password } = req.body;

      // Validate required fields
      if (!emailOrUsername || !password) {
        res.status(400).json({ 
          error: 'Email/username and password are required' 
        });
        return;
      }

      const result = await this.authService.login(emailOrUsername, password);

      res.json({
        message: 'Login successful',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Internal server error during login' 
      });
    }
  };

  // Get current user info
  getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const user = await this.authService.getCurrentUser(req.user.userId);

      res.json({ user });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      console.error('Get current user error:', error);
      res.status(500).json({ 
        error: 'Internal server error' 
      });
    }
  };

  // Refresh JWT token
  refreshToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const newToken = await this.authService.refreshToken(req.user.userId);

      res.json({
        message: 'Token refreshed successfully',
        token: newToken,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      console.error('Token refresh error:', error);
      res.status(500).json({ 
        error: 'Internal server error during token refresh' 
      });
    }
  };
}
