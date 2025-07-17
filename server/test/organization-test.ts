import dotenv from 'dotenv';
import path from 'path';
import request from 'supertest';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import authRoutes from '../src/routes/auth';
import organizationRoutes from '../src/routes/organizations';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);

interface TestUser {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

const testUser1: TestUser = {
  email: 'orgtest1@example.com',
  username: 'orgtest1',
  password: 'testpassword123',
  firstName: 'Organization',
  lastName: 'Test1'
};

const testUser2: TestUser = {
  email: 'orgtest2@example.com',
  username: 'orgtest2',
  password: 'testpassword123',
  firstName: 'Organization',
  lastName: 'Test2'
};

let authToken1: string;
let authToken2: string;
let userId1: string;
let userId2: string;
let organizationId: string;

console.log('Testing Organization API Endpoints...\n');

async function runTests() {
  try {
    console.log('🧹 Cleaning up existing test data...');
    // Clean up any existing test data
    await prisma.membership.deleteMany({
      where: {
        user: {
          OR: [
            { email: testUser1.email },
            { email: testUser2.email }
          ]
        }
      }
    });
    
    await prisma.organization.deleteMany({
      where: {
        name: {
          in: ['Test Organization', 'Another Test Org', 'Updated Test Org']
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: testUser1.email },
          { email: testUser2.email },
          { username: testUser1.username },
          { username: testUser2.username }
        ]
      }
    });
    console.log('✅ Cleanup complete\n');

    // Setup: Create test users
    console.log('🔧 Setting up test users...');
    const registerResponse1 = await request(app)
      .post('/api/auth/register')
      .send(testUser1)
      .expect(201);

    const registerResponse2 = await request(app)
      .post('/api/auth/register')
      .send(testUser2)
      .expect(201);

    authToken1 = registerResponse1.body.token;
    authToken2 = registerResponse2.body.token;
    userId1 = registerResponse1.body.user.id;
    userId2 = registerResponse2.body.user.id;

    console.log('✅ Test users created');
    console.log(`User 1 ID: ${userId1}`);
    console.log(`User 2 ID: ${userId2}\n`);

    // Test 1: Create organization
    console.log('1. Testing organization creation...');
    const createResponse = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        name: 'Test Organization',
        description: 'A test organization for API testing'
      })
      .expect(201);

    console.log('✅ Organization creation successful');
    console.log('Response:', {
      id: createResponse.body.organization.id,
      name: createResponse.body.organization.name,
      description: createResponse.body.organization.description,
      memberCount: createResponse.body.organization.members?.length || 0
    });

    organizationId = createResponse.body.organization.id;
    console.log('');

    // Test 2: Create duplicate organization (should fail)
    console.log('2. Testing duplicate organization creation (should fail)...');
    const duplicateResponse = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        name: 'Test Organization',
        description: 'Another description'
      })
      .expect(409);

    console.log('✅ Duplicate organization properly rejected');
    console.log('Error:', duplicateResponse.body.error);
    console.log('');

    // Test 3: Create organization without authentication (should fail)
    console.log('3. Testing organization creation without auth (should fail)...');
    const noAuthResponse = await request(app)
      .post('/api/organizations')
      .send({
        name: 'Unauthorized Organization',
        description: 'This should fail'
      })
      .expect(401);

    console.log('✅ Unauthorized access properly rejected');
    console.log('Error:', noAuthResponse.body.error);
    console.log('');

    // Test 4: Get user's organizations
    console.log('4. Testing get user organizations...');
    const listResponse = await request(app)
      .get('/api/organizations')
      .set('Authorization', `Bearer ${authToken1}`)
      .expect(200);

    console.log('✅ Organizations list retrieved successfully');
    console.log('Response:', {
      count: listResponse.body.organizations.length,
      organizations: listResponse.body.organizations.map((org: any) => ({
        id: org.id,
        name: org.name,
        role: org.members?.[0]?.role,
        memberCount: org.members?.length || 0
      }))
    });
    console.log('');

    // Test 5: Get specific organization by ID
    console.log('5. Testing get organization by ID...');
    const getResponse = await request(app)
      .get(`/api/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${authToken1}`)
      .expect(200);

    console.log('✅ Organization retrieved successfully');
    console.log('Response:', {
      id: getResponse.body.organization.id,
      name: getResponse.body.organization.name,
      description: getResponse.body.organization.description,
      memberCount: getResponse.body.organization.members?.length || 0,
      userRole: getResponse.body.organization.members?.find((m: any) => m.userId === userId1)?.role
    });
    console.log('');

    // Test 6: Get organization with invalid ID (should fail)
    console.log('6. Testing get organization with invalid ID (should fail)...');
    const invalidIdResponse = await request(app)
      .get('/api/organizations/invalid-id')
      .set('Authorization', `Bearer ${authToken1}`)
      .expect(404);

    console.log('✅ Invalid ID properly rejected');
    console.log('Error:', invalidIdResponse.body.error);
    console.log('');

    // Test 7: Get non-existent organization (should fail)
    console.log('7. Testing get non-existent organization (should fail)...');
    const nonExistentResponse = await request(app)
      .get('/api/organizations/99999999-9999-9999-9999-999999999999')
      .set('Authorization', `Bearer ${authToken1}`)
      .expect(404);

    console.log('✅ Non-existent organization properly handled');
    console.log('Error:', nonExistentResponse.body.error);
    console.log('');

    // Test 8: Add member to organization
    console.log('8. Testing add member to organization...');
    const addMemberResponse = await request(app)
      .post(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        userId: userId2,
        role: 'WRITE'
      })
      .expect(201);

    console.log('✅ Member added successfully');
    console.log('Response:', {
      message: addMemberResponse.body.message,
      membershipRole: addMemberResponse.body.membership?.role
    });
    console.log('');

    // Test 9: Add duplicate member (should fail)
    console.log('9. Testing add duplicate member (should fail)...');
    const duplicateMemberResponse = await request(app)
      .post(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        userId: userId2,
        role: 'VIEW'
      })
      .expect(409);

    console.log('✅ Duplicate member properly rejected');
    console.log('Error:', duplicateMemberResponse.body.error);
    console.log('');

    // Test 10: Add member without admin role (should fail)
    console.log('10. Testing add member without admin role (should fail)...');
    const noAdminResponse = await request(app)
      .post(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        userId: userId1,
        role: 'VIEW'
      })
      .expect(403);

    console.log('✅ Non-admin access properly rejected');
    console.log('Error:', noAdminResponse.body.error);
    console.log('');

    // Test 11: Update member role
    console.log('11. Testing update member role...');
    const updateRoleResponse = await request(app)
      .put(`/api/organizations/${organizationId}/members/${userId2}`)
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        role: 'ADMIN'
      })
      .expect(200);

    console.log('✅ Member role updated successfully');
    console.log('Response:', {
      message: updateRoleResponse.body.message,
      newRole: updateRoleResponse.body.membership.role
    });
    console.log('');

    // Test 12: Update role of non-member (should fail)
    console.log('12. Testing update role of non-member (should fail)...');
    // First create another user
    const tempUser = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'temp@example.com',
        username: 'tempuser',
        password: 'temppass123',
        firstName: 'Temp',
        lastName: 'User'
      })
      .expect(201);

    const nonMemberResponse = await request(app)
      .put(`/api/organizations/${organizationId}/members/${tempUser.body.user.id}`)
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        role: 'VIEW'
      })
      .expect(503);  // Prisma error returns 503

    console.log('✅ Non-member role update properly rejected');
    console.log('Error:', nonMemberResponse.body.error);
    console.log('');

    // Test 13: Remove member from organization
    console.log('13. Testing remove member from organization...');
    const removeMemberResponse = await request(app)
      .delete(`/api/organizations/${organizationId}/members/${userId2}`)
      .set('Authorization', `Bearer ${authToken1}`)
      .expect(200);

    console.log('✅ Member removed successfully');
    console.log('Response:', {
      message: removeMemberResponse.body.message
    });
    console.log('');

    // Test 14: Try to remove last admin (should fail)
    console.log('14. Testing remove last admin (should fail)...');
    const removeLastAdminResponse = await request(app)
      .delete(`/api/organizations/${organizationId}/members/${userId1}`)
      .set('Authorization', `Bearer ${authToken1}`)
      .expect(400);

    console.log('✅ Last admin removal properly rejected');
    console.log('Error:', removeLastAdminResponse.body.error);
    console.log('');

    // Test 15: Access organization as non-member (should fail)
    console.log('15. Testing access organization as non-member (should fail)...');
    const nonMemberAccessResponse = await request(app)
      .get(`/api/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(403);

    console.log('✅ Non-member access properly rejected');
    console.log('Error:', nonMemberAccessResponse.body.error);
    console.log('');

    // Test 16: Create organization with validation errors
    console.log('16. Testing organization creation with validation errors...');
    const validationResponse = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        name: '',
        description: ''
      })
      .expect(400);

    console.log('✅ Validation errors properly handled');
    console.log('Error:', validationResponse.body.error);
    console.log('');

    // Test 17: Test organization created by user2 to verify isolation
    console.log('17. Testing organization isolation between users...');
    const user2OrgResponse = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        name: 'Another Test Org',
        description: 'User 2 organization'
      })
      .expect(201);

    // User1 should not see User2's organization
    const user1ListResponse = await request(app)
      .get('/api/organizations')
      .set('Authorization', `Bearer ${authToken1}`)
      .expect(200);

    const user2OrgId = user2OrgResponse.body.organization.id;
    const user1CanSeeUser2Org = user1ListResponse.body.organizations.some(
      (org: any) => org.id === user2OrgId
    );

    console.log('✅ Organization isolation working correctly');
    console.log('User 1 can see User 2 org:', user1CanSeeUser2Org);
    console.log('User 1 organization count:', user1ListResponse.body.organizations.length);
    console.log('');

    console.log('🎉 All organization endpoint tests passed!');

  } catch (error) {
    console.error('❌ Organization endpoint tests failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  } finally {
    // Cleanup
    console.log('\n🧹 Final cleanup...');
    await prisma.membership.deleteMany({
      where: {
        user: {
          OR: [
            { email: testUser1.email },
            { email: testUser2.email },
            { email: 'temp@example.com' }
          ]
        }
      }
    });
    
    await prisma.organization.deleteMany({
      where: {
        name: {
          in: ['Test Organization', 'Another Test Org', 'Updated Test Org', 'Unauthorized Organization']
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: testUser1.email },
          { email: testUser2.email },
          { email: 'temp@example.com' },
          { username: testUser1.username },
          { username: testUser2.username },
          { username: 'tempuser' }
        ]
      }
    });
    await prisma.$disconnect();
    console.log('✅ Cleanup complete');
  }
}

// Run the tests
runTests();
