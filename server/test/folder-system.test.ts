import request from 'supertest';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import { generateToken } from '../src/lib/auth';
import { FolderService } from '../src/services/folderService';
import folderRoutes from '../src/routes/folders';
import organizationRoutes from '../src/routes/organizations';
import { Role } from '@prisma/client';

// Mock app setup for testing
const app = express();
app.use(express.json());
app.use('/api/folders', folderRoutes);
app.use('/api/organizations', organizationRoutes);

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

interface TestFolder {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  organizationId: string;
}

// Test state
let adminUser: TestUser;
let writeUser: TestUser;
let viewUser: TestUser;
let outsideUser: TestUser;
let organization: TestOrganization;
let adminToken: string;
let writeUserToken: string;
let viewUserToken: string;
let outsideUserToken: string;
let folderService: FolderService;

let rootFolder: TestFolder;
let childFolder: TestFolder;
let grandchildFolder: TestFolder;

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
  
  // Clean up any existing test data in correct order
  await prisma.folder.deleteMany();
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

  writeUser = await prisma.user.create({
    data: {
      email: 'writer@example.com',
      username: 'writer',
      password: 'hashedpassword',
      firstName: 'Write',
      lastName: 'User'
    }
  });

  viewUser = await prisma.user.create({
    data: {
      email: 'viewer@example.com',
      username: 'viewer',
      password: 'hashedpassword',
      firstName: 'View',
      lastName: 'User'
    }
  });

  outsideUser = await prisma.user.create({
    data: {
      email: 'outside@example.com',
      username: 'outside',
      password: 'hashedpassword',
      firstName: 'Outside',
      lastName: 'User'
    }
  });

  console.log('🏢 Creating test organization...');
  
  // Create test organization
  organization = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      description: 'A test organization for folder testing'
    }
  });

  console.log('👑 Setting up memberships...');
  
  // Add users with different roles
  await prisma.membership.create({
    data: {
      userId: adminUser.id,
      organizationId: organization.id,
      role: Role.ADMIN
    }
  });

  await prisma.membership.create({
    data: {
      userId: writeUser.id,
      organizationId: organization.id,
      role: Role.WRITE
    }
  });

  await prisma.membership.create({
    data: {
      userId: viewUser.id,
      organizationId: organization.id,
      role: Role.VIEW
    }
  });

  console.log('🔑 Generating tokens...');
  
  // Generate tokens
  adminToken = generateToken(adminUser.id, adminUser.email);
  writeUserToken = generateToken(writeUser.id, writeUser.email);
  viewUserToken = generateToken(viewUser.id, viewUser.email);
  outsideUserToken = generateToken(outsideUser.id, outsideUser.email);

  folderService = new FolderService();

  console.log('📁 Creating test folder hierarchy...');
  
  // Create test folder hierarchy
  rootFolder = await prisma.folder.create({
    data: {
      name: 'Root Folder',
      description: 'Root level folder',
      organizationId: organization.id,
      parentId: null
    }
  });

  childFolder = await prisma.folder.create({
    data: {
      name: 'Child Folder',
      description: 'Child of root folder',
      organizationId: organization.id,
      parentId: rootFolder.id
    }
  });

  grandchildFolder = await prisma.folder.create({
    data: {
      name: 'Grandchild Folder',
      description: 'Child of child folder',
      organizationId: organization.id,
      parentId: childFolder.id
    }
  });

  console.log('✅ Test setup complete!');
}

async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');
  
  // Clean up test data in correct order
  await prisma.folder.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();

  console.log('✅ Cleanup complete!');
}

async function testCreateFolder(): Promise<void> {
  console.log('🧪 Testing create folder - admin should be able to create folder...');
  
  const response = await request(app)
    .post('/api/folders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'New Folder',
      description: 'A new test folder',
      organizationId: organization.id
    });

  assertEquals(response.status, 201, 'Status should be 201');
  assertEquals(response.body.message, 'Folder created successfully', 'Message should be correct');
  assertObjectMatches(response.body.folder, {
    name: 'New Folder',
    description: 'A new test folder',
    organizationId: organization.id,
    parentId: null
  }, 'Folder object should match expected values');
  
  assert(response.body.folder.id, 'Folder should have an ID');
  assert(response.body.folder.createdAt, 'Folder should have creation date');

  console.log('✅ Create folder test passed!');
}

async function testCreateSubfolder(): Promise<void> {
  console.log('🧪 Testing create subfolder - should work with valid parent...');
  
  const response = await request(app)
    .post('/api/folders')
    .set('Authorization', `Bearer ${writeUserToken}`)
    .send({
      name: 'New Subfolder',
      description: 'A new test subfolder',
      organizationId: organization.id,
      parentId: rootFolder.id
    });

  assertEquals(response.status, 201, 'Status should be 201');
  assertObjectMatches(response.body.folder, {
    name: 'New Subfolder',
    parentId: rootFolder.id
  }, 'Subfolder should have correct parent');

  console.log('✅ Create subfolder test passed!');
}

async function testCreateFolderPermissions(): Promise<void> {
  console.log('🧪 Testing create folder permissions - VIEW user should be rejected...');
  
  const response = await request(app)
    .post('/api/folders')
    .set('Authorization', `Bearer ${viewUserToken}`)
    .send({
      name: 'Unauthorized Folder',
      organizationId: organization.id
    });

  assertEquals(response.status, 403, 'Status should be 403');
  assertContains(response.body.error, 'Insufficient permissions', 'Error message should mention permissions');

  console.log('✅ Create folder permissions test passed!');
}

async function testCreateFolderValidation(): Promise<void> {
  console.log('🧪 Testing create folder validation - invalid data should be rejected...');
  
  // Test missing name
  const response1 = await request(app)
    .post('/api/folders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      organizationId: organization.id
    });

  assertEquals(response1.status, 400, 'Missing name should return 400');
  assertEquals(response1.body.error, 'Validation failed', 'Error should be validation failed');

  // Test missing organization ID
  const response2 = await request(app)
    .post('/api/folders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Test Folder'
    });

  assertEquals(response2.status, 400, 'Missing organization ID should return 400');

  console.log('✅ Create folder validation test passed!');
}

async function testCreateFolderDuplicateName(): Promise<void> {
  console.log('🧪 Testing create folder duplicate name - should be rejected...');
  
  const response = await request(app)
    .post('/api/folders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: rootFolder.name, // Same name as existing root folder
      organizationId: organization.id
    });

  assertEquals(response.status, 409, 'Status should be 409');
  assertContains(response.body.error, 'already exists', 'Error should mention folder already exists');

  console.log('✅ Create folder duplicate name test passed!');
}

async function testGetFolderById(): Promise<void> {
  console.log('🧪 Testing get folder by ID...');
  
  const response = await request(app)
    .get(`/api/folders/${rootFolder.id}`)
    .set('Authorization', `Bearer ${viewUserToken}`);

  assertEquals(response.status, 200, 'Status should be 200');
  assertObjectMatches(response.body.folder, {
    id: rootFolder.id,
    name: rootFolder.name,
    description: rootFolder.description,
    organizationId: organization.id
  }, 'Folder should match expected values');

  // Should include children and organization info
  assert(Array.isArray(response.body.folder.children), 'Should include children array');
  assert(response.body.folder.organization, 'Should include organization info');

  console.log('✅ Get folder by ID test passed!');
}

async function testGetFolderPermissions(): Promise<void> {
  console.log('🧪 Testing get folder permissions - outside user should be rejected...');
  
  const response = await request(app)
    .get(`/api/folders/${rootFolder.id}`)
    .set('Authorization', `Bearer ${outsideUserToken}`);

  assertEquals(response.status, 403, 'Status should be 403');
  assertContains(response.body.error, 'Insufficient permissions', 'Error should mention permissions');

  console.log('✅ Get folder permissions test passed!');
}

async function testGetOrganizationFolders(): Promise<void> {
  console.log('🧪 Testing get organization folders...');
  
  const response = await request(app)
    .get(`/api/organizations/${organization.id}/folders`)
    .set('Authorization', `Bearer ${viewUserToken}`);

  assertEquals(response.status, 200, 'Status should be 200');
  assert(Array.isArray(response.body.folders), 'Should return folders array');
  assert(response.body.folders.length >= 3, 'Should include at least our test folders');

  // Check that folders include hierarchy info
  const folders = response.body.folders;
  const root = folders.find((f: any) => f.id === rootFolder.id);
  assert(root, 'Should include root folder');
  assert(root._count, 'Should include count information');

  console.log('✅ Get organization folders test passed!');
}

async function testGetFolderTree(): Promise<void> {
  console.log('🧪 Testing get folder tree...');
  
  const response = await request(app)
    .get(`/api/organizations/${organization.id}/folders/tree`)
    .set('Authorization', `Bearer ${viewUserToken}`);

  assertEquals(response.status, 200, 'Status should be 200');
  assert(Array.isArray(response.body.folderTree), 'Should return folder tree array');

  // Find root folder in tree
  const rootInTree = response.body.folderTree.find((f: any) => f.id === rootFolder.id);
  assert(rootInTree, 'Root folder should be in tree');
  assert(Array.isArray(rootInTree.children), 'Root should have children array');
  assert(rootInTree.children.length > 0, 'Root should have children');

  // Check child folder is in root's children
  const childInTree = rootInTree.children.find((f: any) => f.id === childFolder.id);
  assert(childInTree, 'Child folder should be in root children');

  console.log('✅ Get folder tree test passed!');
}

async function testUpdateFolder(): Promise<void> {
  console.log('🧪 Testing update folder...');
  
  const response = await request(app)
    .put(`/api/folders/${rootFolder.id}`)
    .set('Authorization', `Bearer ${writeUserToken}`)
    .send({
      name: 'Updated Root Folder',
      description: 'Updated description'
    });

  assertEquals(response.status, 200, 'Status should be 200');
  assertEquals(response.body.message, 'Folder updated successfully', 'Message should be correct');
  assertObjectMatches(response.body.folder, {
    name: 'Updated Root Folder',
    description: 'Updated description'
  }, 'Folder should be updated');

  console.log('✅ Update folder test passed!');
}

async function testUpdateFolderPermissions(): Promise<void> {
  console.log('🧪 Testing update folder permissions - VIEW user should be rejected...');
  
  const response = await request(app)
    .put(`/api/folders/${rootFolder.id}`)
    .set('Authorization', `Bearer ${viewUserToken}`)
    .send({
      name: 'Unauthorized Update'
    });

  assertEquals(response.status, 403, 'Status should be 403');
  assertContains(response.body.error, 'Insufficient permissions', 'Error should mention permissions');

  console.log('✅ Update folder permissions test passed!');
}

async function testMoveFolder(): Promise<void> {
  console.log('🧪 Testing move folder...');
  
  // Create a new folder to move
  const newFolder = await prisma.folder.create({
    data: {
      name: 'Movable Folder',
      organizationId: organization.id,
      parentId: null
    }
  });

  const response = await request(app)
    .post(`/api/folders/${newFolder.id}/move`)
    .set('Authorization', `Bearer ${writeUserToken}`)
    .send({
      parentId: rootFolder.id
    });

  assertEquals(response.status, 200, 'Status should be 200');
  assertEquals(response.body.message, 'Folder moved successfully', 'Message should be correct');
  assertEquals(response.body.folder.parentId, rootFolder.id, 'Folder should be moved to new parent');

  console.log('✅ Move folder test passed!');
}

async function testMoveFolderCyclePrevention(): Promise<void> {
  console.log('🧪 Testing move folder cycle prevention...');
  
  // Try to move root folder to be child of its own descendant (would create cycle)
  const response = await request(app)
    .post(`/api/folders/${rootFolder.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      parentId: grandchildFolder.id
    });

  assertEquals(response.status, 409, 'Status should be 409');
  assertContains(response.body.error, 'cycle', 'Error should mention cycle');

  console.log('✅ Move folder cycle prevention test passed!');
}

async function testDeleteFolder(): Promise<void> {
  console.log('🧪 Testing delete empty folder...');
  
  // Create a new empty folder to delete
  const emptyFolder = await prisma.folder.create({
    data: {
      name: 'Empty Folder',
      organizationId: organization.id,
      parentId: null
    }
  });

  const response = await request(app)
    .delete(`/api/folders/${emptyFolder.id}`)
    .set('Authorization', `Bearer ${writeUserToken}`);

  assertEquals(response.status, 200, 'Status should be 200');
  assertEquals(response.body.message, 'Folder deleted successfully', 'Message should be correct');

  // Verify folder is deleted
  const deletedFolder = await prisma.folder.findUnique({
    where: { id: emptyFolder.id }
  });
  assert(deletedFolder === null, 'Folder should be deleted');

  console.log('✅ Delete empty folder test passed!');
}

async function testDeleteFolderWithContents(): Promise<void> {
  console.log('🧪 Testing delete folder with contents - should be rejected without force...');
  
  const response = await request(app)
    .delete(`/api/folders/${rootFolder.id}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assertEquals(response.status, 409, 'Status should be 409');
  assertContains(response.body.error, 'Cannot delete folder with contents', 'Error should mention contents');

  console.log('✅ Delete folder with contents test passed!');
}

async function testDeleteFolderForce(): Promise<void> {
  console.log('🧪 Testing delete folder with force...');
  
  // Create a folder with children to test force delete
  const parentFolder = await prisma.folder.create({
    data: {
      name: 'Parent to Delete',
      organizationId: organization.id,
      parentId: null
    }
  });

  const childToDelete = await prisma.folder.create({
    data: {
      name: 'Child to Delete',
      organizationId: organization.id,
      parentId: parentFolder.id
    }
  });

  const response = await request(app)
    .delete(`/api/folders/${parentFolder.id}?force=true`)
    .set('Authorization', `Bearer ${adminToken}`);

  assertEquals(response.status, 200, 'Status should be 200');

  // Verify both folders are deleted
  const deletedParent = await prisma.folder.findUnique({
    where: { id: parentFolder.id }
  });
  const deletedChild = await prisma.folder.findUnique({
    where: { id: childToDelete.id }
  });
  
  assert(deletedParent === null, 'Parent folder should be deleted');
  assert(deletedChild === null, 'Child folder should be deleted');

  console.log('✅ Delete folder force test passed!');
}

async function testGetFolderPath(): Promise<void> {
  console.log('🧪 Testing get folder path (breadcrumb)...');
  
  const response = await request(app)
    .get(`/api/folders/${grandchildFolder.id}/path`)
    .set('Authorization', `Bearer ${viewUserToken}`);

  assertEquals(response.status, 200, 'Status should be 200');
  assert(Array.isArray(response.body.path), 'Should return path array');
  assertEquals(response.body.path.length, 3, 'Path should have 3 levels');

  // Check path order (root -> child -> grandchild)
  assertEquals(response.body.path[0].id, rootFolder.id, 'First should be root');
  assertEquals(response.body.path[1].id, childFolder.id, 'Second should be child');
  assertEquals(response.body.path[2].id, grandchildFolder.id, 'Third should be grandchild');

  console.log('✅ Get folder path test passed!');
}

async function testFolderServiceMethods(): Promise<void> {
  console.log('🧪 Testing folder service methods...');
  
  console.log('  📝 Testing createFolder service method...');
  
  const folder = await folderService.createFolder({
    name: 'Service Test Folder',
    description: 'Created via service',
    organizationId: organization.id,
    createdBy: adminUser.id
  });

  assertObjectMatches(folder, {
    name: 'Service Test Folder',
    description: 'Created via service',
    organizationId: organization.id
  }, 'Created folder should match expected values');

  console.log('  🔍 Testing getFolderById service method...');
  
  const retrievedFolder = await folderService.getFolderById(folder.id, adminUser.id);
  assert(retrievedFolder !== null, 'Retrieved folder should not be null');
  assertEquals(retrievedFolder.id, folder.id, 'Retrieved folder should match');

  console.log('  🏗️ Testing updateFolder service method...');
  
  const updatedFolder = await folderService.updateFolder(folder.id, {
    name: 'Updated Service Folder'
  }, adminUser.id);

  assertEquals(updatedFolder.name, 'Updated Service Folder', 'Folder name should be updated');

  console.log('  🗑️ Testing deleteFolder service method...');
  
  await folderService.deleteFolder(folder.id, adminUser.id);

  // Verify folder is deleted - may return null or throw error
  let folderFound = false;
  try {
    const result = await folderService.getFolderById(folder.id, adminUser.id);
    // If we get here, the folder still exists (shouldn't happen but could be cached)
    folderFound = (result !== null && result !== undefined);
  } catch (error) {
    // This is expected - folder should not be found
    folderFound = false;
  }
  
  // Also check directly in database to be sure
  const dbFolder = await prisma.folder.findUnique({
    where: { id: folder.id }
  });
  
  assert(dbFolder === null, 'Folder should be deleted from database');
  console.log('  ✅ Folder successfully deleted from database');

  console.log('✅ Service methods tests passed!');
}

async function testErrorHandling(): Promise<void> {
  console.log('🧪 Testing error handling...');
  
  console.log('  🔒 Testing missing authentication...');
  
  const noAuthResponse = await request(app)
    .post('/api/folders')
    .send({
      name: 'Unauthorized Folder',
      organizationId: organization.id
    });

  assertEquals(noAuthResponse.status, 401, 'Missing auth should return 401');

  console.log('  📁 Testing non-existent folder...');
  
  const nonExistentResponse = await request(app)
    .get('/api/folders/non-existent-id')
    .set('Authorization', `Bearer ${viewUserToken}`);

  assertEquals(nonExistentResponse.status, 404, 'Non-existent folder should return 404');

  console.log('  🏢 Testing non-existent organization...');
  
  const nonExistentOrgResponse = await request(app)
    .post('/api/folders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Test Folder',
      organizationId: 'non-existent-id'
    });

  assertEquals(nonExistentOrgResponse.status, 404, 'Non-existent org should return 404');

  console.log('✅ Error handling tests passed!');
}

async function runAllTests(): Promise<void> {
  try {
    console.log('🚀 Starting Folder System Tests\n');
    
    await setupTestData();
    
    // Run all test functions
    await testCreateFolder();
    await testCreateSubfolder();
    await testCreateFolderPermissions();
    await testCreateFolderValidation();
    await testCreateFolderDuplicateName();
    await testGetFolderById();
    await testGetFolderPermissions();
    await testGetOrganizationFolders();
    await testGetFolderTree();
    await testUpdateFolder();
    await testUpdateFolderPermissions();
    await testMoveFolder();
    await testMoveFolderCyclePrevention();
    await testDeleteFolder();
    await testDeleteFolderWithContents();
    await testDeleteFolderForce();
    await testGetFolderPath();
    await testFolderServiceMethods();
    await testErrorHandling();
    
    await cleanupTestData();
    
    console.log('\n🎉 All Folder System Tests Passed!');
    console.log('✅ Folder system is working correctly');
    
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
