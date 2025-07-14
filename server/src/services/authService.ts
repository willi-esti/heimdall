import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/auth';
import { log } from '../lib/logger';

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: Date;
  };
  token: string;
}

export class AuthService {
  // Register a new user
  async register(data: RegisterData): Promise<AuthResult> {
    const { email, username, password, firstName, lastName } = data;

    log.db('Checking for existing user', { email, username });

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
      const errorMessage = existingUser.email === email 
        ? 'Email already exists' 
        : 'Username already taken';
      
      log.warn('User registration blocked: duplicate found', { 
        email, 
        username, 
        conflict: errorMessage 
      });
      
      throw new Error(errorMessage);
    }

    log.debug('Hashing password for new user');

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    log.db('Creating new user in database', { email, username });

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

    log.auth('User created successfully', { userId: user.id, email });

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    return { user, token };
  }

  // Login user
  async login(emailOrUsername: string, password: string): Promise<AuthResult> {
    log.db('Looking up user for login', { emailOrUsername });

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
      log.security('Login attempt with non-existent user', { emailOrUsername });
      throw new Error('Invalid credentials');
    }

    log.debug('User found, verifying password', { userId: user.id });

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      log.security('Login attempt with invalid password', { 
        userId: user.id, 
        email: user.email 
      });
      throw new Error('Invalid credentials');
    }

    log.auth('Password verified, generating token', { userId: user.id });

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  // Get current user by ID
  async getCurrentUser(userId: string) {
    log.db('Getting current user info', { userId });

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      log.warn('User not found during getCurrentUser', { userId });
      throw new Error('User not found');
    }

    log.debug('User info retrieved', { userId, membershipCount: user.memberships.length });
    return user;
  }

  // Refresh token for user
  async refreshToken(userId: string): Promise<string> {
    log.db('Verifying user exists for token refresh', { userId });

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });

    if (!user) {
      log.warn('Token refresh failed: user not found', { userId });
      throw new Error('User not found');
    }

    log.auth('Generating new token for user', { userId });

    // Generate new token
    return generateToken(user.id, user.email);
  }
}
