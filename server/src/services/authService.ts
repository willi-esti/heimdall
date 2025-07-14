import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/auth';

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
      throw new Error(
        existingUser.email === email 
          ? 'Email already exists' 
          : 'Username already taken'
      );
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

    return { user, token };
  }

  // Login user
  async login(emailOrUsername: string, password: string): Promise<AuthResult> {
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
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email);

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  // Get current user by ID
  async getCurrentUser(userId: string) {
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
      throw new Error('User not found');
    }

    return user;
  }

  // Refresh token for user
  async refreshToken(userId: string): Promise<string> {
    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new token
    return generateToken(user.id, user.email);
  }
}
