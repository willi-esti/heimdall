import request from 'supertest';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import { generateToken } from '../src/lib/auth';
import { InviteService } from '../src/services/inviteService';
import inviteRoutes from '../src/routes/invites';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';

// Mock app setup for testing
const app = express();
app.use(express.json());
app.use('/api/invites', inviteRoutes);

interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
}

interface TestOrganization {
  id: string;
  name: string;
  description: string | null;
}

// Test state
let adminUser: TestUser;
let normalUser: TestUser;
let targetUser: TestUser;
let organization: TestOrganization;
let adminToken: string;
let normalUserToken: string;
let targetUserToken: string;
let inviteService: InviteService;

// Simple assertion helpers
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed${message ? ': ' + message : ''}: expected ${expected}, got ${actual}`);
  }
}

function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`Assertion failed${message ? ': ' + message : ''}: "${haystack}" does not contain "${needle}"`);
  }
}

function assertObjectMatches(actual: any, expected: any, message?: string): void {
  for (const key in expected) {
    if (actual[key] !== expected[key]) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: property ${key} expected ${expected[key]}, got ${actual[key]}`);
    }
  }
}

async function setupTestData(): Promise<void> {
  console.log('🧹 Cleaning up existing test data...');
  
  // Clean up any existing test data
  await prisma.organizationInvite.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  console.log('👥 Creating test users...');
  
  // Create test users
  adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      username: 'admin',
      password: 'hashedpassword',
      firstName: 'Admin',
      lastName: 'User'
    }
  });

  normalUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      username: 'normaluser',
      password: 'hashedpassword',
      firstName: 'Normal',
      lastName: 'User'
    }
  });

  targetUser = await prisma.user.create({
    data: {
      email: 'target@example.com',
      username: 'targetuser',
      password: 'hashedpassword',
      firstName: 'Target',
      lastName: 'User'
    }
  });

  console.log('🏢 Creating test organization...');
  
  // Create test organization
  organization = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      description: 'A test organization for invite testing'
    }
  });

  console.log('👑 Setting up memberships...');
  
  // Add admin as organization admin
  await prisma.membership.create({
    data: {
      userId: adminUser.id,
      organizationId: organization.id,
      role: Role.ADMIN
    }
  });

  // Add normal user as VIEW member
  await prisma.membership.create({
    data: {
      userId: normalUser.id,
      organizationId: organization.id,
      role: Role.VIEW
    }
  });

  console.log('🔑 Generating tokens...');
  
  // Generate tokens
  adminToken = generateToken(adminUser.id, adminUser.email);
  normalUserToken = generateToken(normalUser.id, normalUser.email);
  targetUserToken = generateToken(targetUser.id, targetUser.email);

  inviteService = new InviteService();

  console.log('✅ Test setup complete!');
}

async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');
  
  // Clean up test data
  await prisma.organizationInvite.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();

  console.log('✅ Cleanup complete!');
}

async function testCreateInvite(): Promise<void> {
  console.log('🧪 Testing create invite - admin should be able to create an invite...');
  
  const response = await request(app)
    .post('/api/invites')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      organizationId: organization.id,
      email: 'newuser@example.com',
      role: 'WRITE'
    });

  assertEquals(response.status, 201, 'Status should be 201');
  assertEquals(response.body.message, 'Invitation created successfully', 'Message should be correct');
  assertObjectMatches(response.body.invite, {
    email: 'newuser@example.com',
    role: 'WRITE',
    status: 'PENDING'
  }, 'Invite object should match expected values');
  
  assert(response.body.invite.id, 'Invite should have an ID');
  assert(response.body.invite.expiresAt, 'Invite should have expiration date');

  console.log('✅ Create invite test passed!');
}

async function testCreateInviteNonAdmin(): Promise<void> {
  console.log('🧪 Testing create invite rejection - non-admin should be rejected...');
  
  const response = await request(app)
    .post('/api/invites')
    .set('Authorization', `Bearer ${normalUserToken}`)
    .send({
      organizationId: organization.id,
      email: 'another@example.com',
      role: 'VIEW'
    });

  assertEquals(response.status, 403, 'Status should be 403');
  assertContains(response.body.error, 'Only admins can invite users', 'Error message should be correct');

  console.log('✅ Non-admin rejection test passed!');
}

async function testCreateInviteValidation(): Promise<void> {
  console.log('🧪 Testing create invite validation - invalid email should be rejected...');
  
  const response = await request(app)
    .post('/api/invites')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      organizationId: organization.id,
      email: 'invalid-email',
      role: 'VIEW'
    });

  assertEquals(response.status, 400, 'Status should be 400');
  assertEquals(response.body.error, 'Validation failed', 'Error should be validation failed');

  console.log('✅ Validation test passed!');
}

async function testCreateInviteExistingMember(): Promise<void> {
  console.log('🧪 Testing create invite for existing member - should be rejected...');
  
  const response = await request(app)
    .post('/api/invites')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      organizationId: organization.id,
      email: normalUser.email, // Already a member
      role: 'WRITE'
    });

  assertEquals(response.status, 409, 'Status should be 409');
  assertContains(response.body.error, 'already a member', 'Error should mention already a member');

  console.log('✅ Existing member test passed!');
}

async function testInviteServiceMethods(): Promise<void> {
  console.log('🧪 Testing invite service methods...');
  
  // Clean up existing invites for clean tests
  await prisma.organizationInvite.deleteMany({
    where: { email: 'service-test@example.com' }
  });

  console.log('  📝 Testing createInvite service method...');
  
  const invite = await inviteService.createInvite({
    organizationId: organization.id,
    email: 'service-test@example.com',
    role: Role.WRITE,
    invitedBy: adminUser.id
  });

  assertObjectMatches(invite, {
    email: 'service-test@example.com',
    role: Role.WRITE,
    organizationId: organization.id,
    invitedBy: adminUser.id,
    status: 'PENDING'
  }, 'Created invite should match expected values');

  // Check expiration is properly set (should be 7 days from now)
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const timeDifference = Math.abs(invite.expiresAt.getTime() - sevenDaysFromNow.getTime());
  assert(timeDifference < 60000, 'Expiration should be approximately 7 days from now'); // Within 1 minute

  console.log('  🔍 Testing getInviteByToken service method...');
  
  const retrievedInvite = await inviteService.getInviteByToken(invite.token);
  assert(retrievedInvite !== null, 'Retrieved invite should not be null');
  assertObjectMatches(retrievedInvite!.organization, {
    name: organization.name,
    description: organization.description
  }, 'Organization details should be included');

  console.log('  ✅ Testing acceptInvite service method...');
  
  // Create a fresh invite for acceptance test
  const newInvite = await inviteService.createInvite({
    organizationId: organization.id,
    email: targetUser.email,
    role: Role.WRITE,
    invitedBy: adminUser.id
  });

  await inviteService.acceptInvite(newInvite.token, targetUser.id);

  // Check membership was created
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: targetUser.id,
        organizationId: organization.id
      }
    }
  });

  assert(membership !== null, 'Membership should be created');
  assertEquals(membership!.role, Role.WRITE, 'Membership role should be WRITE');

  // Check invite status was updated
  const updatedInvite = await prisma.organizationInvite.findUnique({
    where: { id: newInvite.id }
  });

  assertEquals(updatedInvite!.status, 'ACCEPTED', 'Invite status should be ACCEPTED');
  assertEquals(updatedInvite!.acceptedBy, targetUser.id, 'AcceptedBy should be set');
  assert(updatedInvite!.acceptedAt !== null, 'AcceptedAt should be set');

  console.log('  ❌ Testing rejectInvite service method...');
  
  // Create a fresh invite for rejection test - use different email since targetUser is now a member
  const rejectInvite = await inviteService.createInvite({
    organizationId: organization.id,
    email: 'reject-test@example.com',
    role: Role.VIEW,
    invitedBy: adminUser.id
  });

  // Create a test user with the matching email for rejection test
  const rejectTestUser = await prisma.user.create({
    data: {
      email: 'reject-test@example.com',
      username: 'rejecttest',
      password: 'hashedpassword',
      firstName: 'Reject',
      lastName: 'Test'
    }
  });

  await inviteService.rejectInvite(rejectInvite.token, rejectTestUser.id);

  // Check invite status was updated
  const rejectedInvite = await prisma.organizationInvite.findUnique({
    where: { id: rejectInvite.id }
  });

  assertEquals(rejectedInvite!.status, 'REJECTED', 'Invite status should be REJECTED');

  console.log('✅ Service methods tests passed!');
}

async function testGetInviteDetails(): Promise<void> {
  console.log('🧪 Testing get invite details endpoint...');
  
  const testInvite = await inviteService.createInvite({
    organizationId: organization.id,
    email: 'details-test@example.com',
    role: Role.WRITE,
    invitedBy: adminUser.id
  });

  const response = await request(app)
    .get(`/api/invites/${testInvite.token}`);

  assertEquals(response.status, 200, 'Status should be 200');
  assertObjectMatches(response.body.invite, {
    email: 'details-test@example.com',
    role: 'WRITE',
    status: 'PENDING',
    organizationName: organization.name,
    organizationDescription: organization.description
  }, 'Invite details should match expected values');

  console.log('  🔍 Testing invalid token...');
  
  const invalidResponse = await request(app)
    .get('/api/invites/invalid-token');

  assertEquals(invalidResponse.status, 404, 'Invalid token should return 404');

  console.log('✅ Get invite details tests passed!');
}

async function testAcceptInviteEndpoint(): Promise<void> {
  console.log('🧪 Testing accept invite endpoint...');
  
  // Clean up target user memberships
  await prisma.membership.deleteMany({
    where: { userId: targetUser.id }
  });

  const testInvite = await inviteService.createInvite({
    organizationId: organization.id,
    email: targetUser.email,
    role: Role.WRITE,
    invitedBy: adminUser.id
  });

  const response = await request(app)
    .post('/api/invites/accept')
    .set('Authorization', `Bearer ${targetUserToken}`)
    .send({
      token: testInvite.token
    });

  assertEquals(response.status, 200, 'Status should be 200');
  assertEquals(response.body.message, 'Invitation accepted successfully', 'Message should be correct');

  console.log('  ❌ Testing invalid token...');
  
  const invalidResponse = await request(app)
    .post('/api/invites/accept')
    .set('Authorization', `Bearer ${targetUserToken}`)
    .send({
      token: 'invalid-token'
    });

  assertEquals(invalidResponse.status, 404, 'Invalid token should return 404');

  console.log('✅ Accept invite endpoint tests passed!');
}

async function testRejectInviteEndpoint(): Promise<void> {
  console.log('🧪 Testing reject invite endpoint...');
  
  const testInvite = await inviteService.createInvite({
    organizationId: organization.id,
    email: targetUser.email,
    role: Role.VIEW,
    invitedBy: adminUser.id
  });

  const response = await request(app)
    .post('/api/invites/reject')
    .set('Authorization', `Bearer ${targetUserToken}`)
    .send({
      token: testInvite.token
    });

  assertEquals(response.status, 200, 'Status should be 200');
  assertEquals(response.body.message, 'Invitation rejected successfully', 'Message should be correct');

  console.log('✅ Reject invite endpoint tests passed!');
}

async function testErrorHandling(): Promise<void> {
  console.log('🧪 Testing error handling...');
  
  console.log('  🔒 Testing missing authentication...');
  
  const noAuthResponse = await request(app)
    .post('/api/invites')
    .send({
      organizationId: organization.id,
      email: 'test@example.com'
    });

  assertEquals(noAuthResponse.status, 401, 'Missing auth should return 401');

  console.log('  📝 Testing malformed request...');
  
  const malformedResponse = await request(app)
    .post('/api/invites')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      // Missing required fields
      email: 'test@example.com'
    });

  assertEquals(malformedResponse.status, 400, 'Malformed request should return 400');
  assertEquals(malformedResponse.body.error, 'Validation failed', 'Error should be validation failed');

  console.log('  🏢 Testing non-existent organization...');
  
  const nonExistentOrgResponse = await request(app)
    .post('/api/invites')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      organizationId: 'non-existent-id',
      email: 'test@example.com',
      role: 'VIEW'
    });

  assertEquals(nonExistentOrgResponse.status, 404, 'Non-existent org should return 404');

  console.log('✅ Error handling tests passed!');
}

async function runAllTests(): Promise<void> {
  try {
    console.log('🚀 Starting Organization Invite System Tests\n');
    
    await setupTestData();
    
    // Run all test functions
    await testCreateInvite();
    await testCreateInviteNonAdmin();
    await testCreateInviteValidation();
    await testCreateInviteExistingMember();
    await testInviteServiceMethods();
    await testGetInviteDetails();
    await testAcceptInviteEndpoint();
    await testRejectInviteEndpoint();
    await testErrorHandling();
    
    await cleanupTestData();
    
    console.log('\n🎉 All Organization Invite System Tests Passed!');
    console.log('✅ Invite system is working correctly');
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    await cleanupTestData();
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}
