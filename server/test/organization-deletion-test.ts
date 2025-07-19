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
  email: 'admin@example.com',
  username: 'admin',
  password: 'adminpassword123',
  firstName: 'Admin',
  lastName: 'User'
};

const testUser2: TestUser = {
  email: 'approver@example.com',
  username: 'approver',
  password: 'approverpassword123',
  firstName: 'Approver',
  lastName: 'User'
};

let adminToken: string;
let approverToken: string;
let adminUserId: string;
let approverUserId: string;
let organizationId: string;

console.log('Testing Organization Deletion Workflow...\n');

async function runTests() {
  try {
    console.log('🧹 Cleaning up existing test data...');
    // Clean up existing test data
    await prisma.organizationDeletionRequest.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.organization.deleteMany({
      where: {
        name: 'Test Organization for Deletion'
      }
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: testUser1.email },
          { username: testUser1.username },
          { email: testUser2.email },
          { username: testUser2.username }
        ]
      }
    });
    console.log('✅ Cleanup complete\n');

    // Test 1: Setup - Create test users
    console.log('📝 Test 1: Setting up test users...');
    
    // Register admin user
    const adminRegResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser1);
    
    if (adminRegResponse.status !== 201) {
      throw new Error(`Admin registration failed: ${adminRegResponse.body.error}`);
    }
    
    // Register approver user
    const approverRegResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser2);
    
    if (approverRegResponse.status !== 201) {
      throw new Error(`Approver registration failed: ${approverRegResponse.body.error}`);
    }
    
    // Login admin user
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser1.email,
        password: testUser1.password
      });
    
    if (adminLoginResponse.status !== 200) {
      throw new Error(`Admin login failed: ${adminLoginResponse.body.error}`);
    }
    
    adminToken = adminLoginResponse.body.token;
    adminUserId = adminLoginResponse.body.user.id;
    
    // Login approver user
    const approverLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser2.email,
        password: testUser2.password
      });
    
    if (approverLoginResponse.status !== 200) {
      throw new Error(`Approver login failed: ${approverLoginResponse.body.error}`);
    }
    
    approverToken = approverLoginResponse.body.token;
    approverUserId = approverLoginResponse.body.user.id;
    
    console.log('✅ Test users created and authenticated\n');

    // Test 2: Create organization
    console.log('📝 Test 2: Creating organization...');
    
    const createOrgResponse = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Organization for Deletion',
        description: 'A test organization for deletion workflow testing'
      });
    
    if (createOrgResponse.status !== 201) {
      throw new Error(`Organization creation failed: ${createOrgResponse.body.error}`);
    }
    
    organizationId = createOrgResponse.body.organization.id;
    console.log('✅ Organization created successfully\n');

    // Test 3: Add approver as admin to organization
    console.log('📝 Test 3: Adding approver as admin...');
    
    const addMemberResponse = await request(app)
      .post(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: approverUserId,
        role: 'ADMIN'
      });
    
    if (addMemberResponse.status !== 201) {
      throw new Error(`Adding member failed: ${addMemberResponse.body.error}`);
    }
    
    console.log('✅ Approver added as admin\n');

    // Test 4: Request organization deletion
    console.log('📝 Test 4: Requesting organization deletion...');
    
    const requestDeletionResponse = await request(app)
      .post(`/api/organizations/${organizationId}/deletion/request`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Testing deletion workflow'
      });
    
    if (requestDeletionResponse.status !== 201) {
      throw new Error(`Deletion request failed: ${requestDeletionResponse.body.error}`);
    }
    
    console.log('✅ Deletion request submitted successfully\n');

    // Test 5: Try to request deletion again (should fail)
    console.log('📝 Test 5: Testing duplicate deletion request...');
    
    const duplicateRequestResponse = await request(app)
      .post(`/api/organizations/${organizationId}/deletion/request`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Duplicate request'
      });
    
    if (duplicateRequestResponse.status !== 409) {
      throw new Error(`Expected 409 for duplicate request, got ${duplicateRequestResponse.status}`);
    }
    
    console.log('✅ Duplicate deletion request properly rejected\n');

    // Test 6: Get deletion requests
    console.log('📝 Test 6: Getting deletion requests...');
    
    const getDeletionRequestsResponse = await request(app)
      .get(`/api/organizations/${organizationId}/deletion/requests`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    if (getDeletionRequestsResponse.status !== 200) {
      throw new Error(`Getting deletion requests failed: ${getDeletionRequestsResponse.body.error}`);
    }
    
    if (getDeletionRequestsResponse.body.count !== 1) {
      throw new Error(`Expected 1 deletion request, got ${getDeletionRequestsResponse.body.count}`);
    }
    
    console.log('✅ Deletion requests retrieved successfully\n');

    // Test 7: Try self-approval (should fail)
    console.log('📝 Test 7: Testing self-approval (should fail)...');
    
    const selfApprovalResponse = await request(app)
      .post(`/api/organizations/${organizationId}/deletion/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    if (selfApprovalResponse.status !== 403) {
      throw new Error(`Expected 403 for self-approval, got ${selfApprovalResponse.status}`);
    }
    
    console.log('✅ Self-approval properly rejected\n');

    // Test 8: Test rejection workflow
    console.log('📝 Test 8: Testing rejection workflow...');
    
    const rejectDeletionResponse = await request(app)
      .post(`/api/organizations/${organizationId}/deletion/reject`)
      .set('Authorization', `Bearer ${approverToken}`);
    
    if (rejectDeletionResponse.status !== 200) {
      throw new Error(`Deletion rejection failed: ${rejectDeletionResponse.body.error}`);
    }
    
    console.log('✅ Deletion request rejected successfully\n');

    // Test 9: Request deletion again after rejection
    console.log('📝 Test 9: Requesting deletion again after rejection...');
    
    const secondRequestResponse = await request(app)
      .post(`/api/organizations/${organizationId}/deletion/request`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Second deletion request after rejection'
      });
    
    if (secondRequestResponse.status !== 201) {
      throw new Error(`Second deletion request failed: ${secondRequestResponse.body.error}`);
    }
    
    console.log('✅ Second deletion request submitted successfully\n');

    // Test 10: Approve deletion
    console.log('📝 Test 10: Approving deletion...');
    
    const approveDeletionResponse = await request(app)
      .post(`/api/organizations/${organizationId}/deletion/approve`)
      .set('Authorization', `Bearer ${approverToken}`);
    
    if (approveDeletionResponse.status !== 200) {
      throw new Error(`Deletion approval failed: ${approveDeletionResponse.body.error}`);
    }
    
    console.log('✅ Deletion approved and executed successfully\n');

    // Test 11: Verify organization is marked as deleted
    console.log('📝 Test 11: Verifying organization is marked as deleted...');
    
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    });
    
    if (!organization?.isDeleted) {
      throw new Error('Organization should be marked as deleted');
    }
    
    console.log('✅ Organization correctly marked as deleted\n');

    // Test 12: Try to access deleted organization
    console.log('📝 Test 12: Testing access to deleted organization...');
    
    const getDeletedOrgResponse = await request(app)
      .get(`/api/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    // This should fail because memberships are deleted
    if (getDeletedOrgResponse.status !== 403) {
      throw new Error(`Expected 403 for deleted organization access, got ${getDeletedOrgResponse.status}`);
    }
    
    console.log('✅ Access to deleted organization properly denied\n');

    // Test 13: Verify audit logs
    console.log('📝 Test 13: Verifying audit logs...');
    
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: 'ORGANIZATION_DELETION_REQUESTED' },
          { action: 'ORGANIZATION_DELETION_APPROVED' },
          { action: 'ORGANIZATION_DELETION_REJECTED' }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (auditLogs.length < 3) {
      throw new Error(`Expected at least 3 audit log entries, got ${auditLogs.length}`);
    }
    
    console.log('✅ Audit logs properly created\n');

    console.log('🎉 ALL TESTS PASSED! Organization deletion workflow is working correctly.\n');
    
    console.log('📊 Test Summary:');
    console.log('- ✅ User creation and authentication');
    console.log('- ✅ Organization creation and member management');
    console.log('- ✅ Deletion request workflow');
    console.log('- ✅ Duplicate request prevention');
    console.log('- ✅ Self-approval prevention');
    console.log('- ✅ Rejection workflow');
    console.log('- ✅ Approval workflow');
    console.log('- ✅ Soft deletion implementation');
    console.log('- ✅ Access control for deleted organizations');
    console.log('- ✅ Audit logging');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    console.log('\n🧹 Final cleanup...');
    // Clean up test data
    await prisma.organizationDeletionRequest.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.organization.deleteMany({
      where: {
        name: 'Test Organization for Deletion'
      }
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: testUser1.email },
          { username: testUser1.username },
          { email: testUser2.email },
          { username: testUser2.username }
        ]
      }
    });
    
    await prisma.$disconnect();
    console.log('✅ Cleanup complete');
  }
}

// Run the tests
runTests().catch(console.error);
