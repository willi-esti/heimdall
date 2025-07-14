import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../lib/auth';
import { log } from '../lib/logger';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // Register a new user
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, username, password, firstName, lastName } = req.body;

      log.auth('Registration attempt', { email, username });

      // Validate required fields
      if (!email || !username || !password) {
        log.warn('Registration failed: missing required fields', { email, username });
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

      log.auth('User registered successfully', { 
        userId: result.user.id, 
        email: result.user.email 
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists') || error.message.includes('already taken')) {
          log.warn('Registration failed: duplicate user', { 
            error: error.message,
            email: req.body.email,
            username: req.body.username 
          });
          res.status(409).json({ error: error.message });
          return;
        }
      }
      
      log.errorWithContext(
        error instanceof Error ? error : new Error(String(error)), 
        'Registration',
        { email: req.body.email, username: req.body.username }
      );
      res.status(500).json({ 
        error: 'Internal server error during registration' 
      });
    }
  };

  // Login user
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emailOrUsername, password } = req.body;

      log.auth('Login attempt', { emailOrUsername });

      // Validate required fields
      if (!emailOrUsername || !password) {
        log.warn('Login failed: missing credentials', { emailOrUsername });
        res.status(400).json({ 
          error: 'Email/username and password are required' 
        });
        return;
      }

      const result = await this.authService.login(emailOrUsername, password);

      log.auth('Login successful', { 
        userId: result.user.id, 
        email: result.user.email 
      });

      res.json({
        message: 'Login successful',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        log.security('Failed login attempt', { 
          emailOrUsername: req.body.emailOrUsername,
          ip: req.ip 
        });
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      log.errorWithContext(
        error instanceof Error ? error : new Error(String(error)), 
        'Login',
        { emailOrUsername: req.body.emailOrUsername }
      );
      res.status(500).json({ 
        error: 'Internal server error during login' 
      });
    }
  };

  // Get current user info
  getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        log.warn('Get current user failed: no authenticated user');
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      log.debug('Getting current user info', { userId: req.user.userId });

      const user = await this.authService.getCurrentUser(req.user.userId);

      log.debug('Current user info retrieved', { userId: user.id });
      res.json({ user });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        log.warn('Get current user failed: user not found', { userId: req.user?.userId });
        res.status(404).json({ error: 'User not found' });
        return;
      }

      log.errorWithContext(
        error instanceof Error ? error : new Error(String(error)), 
        'Get Current User',
        { userId: req.user?.userId }
      );
      res.status(500).json({ 
        error: 'Internal server error' 
      });
    }
  };

  // Refresh JWT token
  refreshToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        log.warn('Token refresh failed: no authenticated user');
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      log.auth('Token refresh requested', { userId: req.user.userId });

      const newToken = await this.authService.refreshToken(req.user.userId);

      log.auth('Token refreshed successfully', { userId: req.user.userId });

      res.json({
        message: 'Token refreshed successfully',
        token: newToken,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        log.warn('Token refresh failed: user not found', { userId: req.user?.userId });
        res.status(404).json({ error: 'User not found' });
        return;
      }

      log.errorWithContext(
        error instanceof Error ? error : new Error(String(error)), 
        'Token Refresh',
        { userId: req.user?.userId }
      );
      res.status(500).json({ 
        error: 'Internal server error during token refresh' 
      });
    }
  };
}
