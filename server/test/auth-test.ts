import dotenv from 'dotenv';
import path from 'path';
import request from 'supertest';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import authRoutes from '../src/routes/auth';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

interface TestUser {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

const testUser: TestUser = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'testpassword123',
  firstName: 'Test',
  lastName: 'User'
};

let authToken: string;
let userId: string;

console.log('Testing Auth API Endpoints...\n');

async function runTests() {
  try {
    console.log('🧹 Cleaning up existing test data...');
    // Clean up any existing test user
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: testUser.email },
          { username: testUser.username }
        ]
      }
    });
    console.log('✅ Cleanup complete\n');

    // Test 1: Register new user
    console.log('1. Testing user registration...');
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    console.log('✅ Registration successful');
    console.log('Response:', {
      message: registerResponse.body.message,
      user: {
        id: registerResponse.body.user.id,
        email: registerResponse.body.user.email,
        username: registerResponse.body.user.username
      },
      tokenPresent: !!registerResponse.body.token
    });

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
    console.log('');

    // Test 2: Register duplicate user (should fail)
    console.log('2. Testing duplicate registration (should fail)...');
    const duplicateResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(409);

    console.log('✅ Duplicate registration properly rejected');
    console.log('Error:', duplicateResponse.body.error);
    console.log('');

    // Test 3: Login with valid credentials
    console.log('3. Testing login with valid credentials...');
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        emailOrUsername: testUser.email,
        password: testUser.password
      })
      .expect(200);

    console.log('✅ Login successful');
    console.log('Response:', {
      message: loginResponse.body.message,
      user: {
        id: loginResponse.body.user.id,
        email: loginResponse.body.user.email,
        username: loginResponse.body.user.username
      },
      tokenPresent: !!loginResponse.body.token
    });
    console.log('');

    // Test 4: Login with invalid credentials
    console.log('4. Testing login with invalid credentials (should fail)...');
    const invalidLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        emailOrUsername: testUser.email,
        password: 'wrongpassword'
      })
      .expect(401);

    console.log('✅ Invalid login properly rejected');
    console.log('Error:', invalidLoginResponse.body.error);
    console.log('');

    // Test 5: Get current user info (protected route)
    console.log('5. Testing get current user (protected route)...');
    const currentUserResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    console.log('✅ Current user retrieved successfully');
    console.log('User data:', {
      id: currentUserResponse.body.user.id,
      email: currentUserResponse.body.user.email,
      username: currentUserResponse.body.user.username,
      firstName: currentUserResponse.body.user.firstName,
      lastName: currentUserResponse.body.user.lastName,
      memberships: currentUserResponse.body.user.memberships
    });
    console.log('');

    // Test 6: Access protected route without token (should fail)
    console.log('6. Testing protected route without token (should fail)...');
    const noTokenResponse = await request(app)
      .get('/api/auth/me')
      .expect(401);

    console.log('✅ Protected route properly secured');
    console.log('Error:', noTokenResponse.body.error);
    console.log('');

    // Test 7: Refresh token
    console.log('7. Testing token refresh...');
    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    console.log('✅ Token refresh successful');
    console.log('Response:', {
      message: refreshResponse.body.message,
      newTokenPresent: !!refreshResponse.body.token
    });
    console.log('');

    // Test 8: Test validation errors
    console.log('8. Testing validation errors...');
    const validationResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: '',
        username: '',
        password: ''
      })
      .expect(400);

    console.log('✅ Validation errors properly handled');
    console.log('Error:', validationResponse.body.error);
    console.log('');

    console.log('🎉 All auth endpoint tests passed!');

  } catch (error) {
    console.error('❌ Auth endpoint tests failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Final cleanup...');
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: testUser.email },
          { username: testUser.username }
        ]
      }
    });
    await prisma.$disconnect();
    console.log('✅ Cleanup complete');
  }
}

// Install supertest if not already installed
runTests();
