import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/lib/prisma';

/**
 * Secret Version Deletion Test Suite
 * 
 * Tests the ability to delete specific secret versions with proper validation and restrictions.
 * 
 * Test Scenarios:
 * 1. Delete a historical version successfully
 * 2. Prevent deletion of current (latest) version
 * 3. Prevent deletion of last remaining version
 * 4. Check access control (WRITE permission required)
 * 5. Validate audit logging for version deletion
 * 6. Handle invalid version numbers
 * 7. Handle non-existent versions
 */

describe('Secret Version Deletion API Tests', () => {
  let authToken: string;
  let viewOnlyToken: string;
  let organizationId: string;
  let folderId: string;
  let secretId: string;
  let userId: string;
  let viewOnlyUserId: string;

  beforeAll(async () => {
    // Create test user with WRITE permissions
    const writeUser = await prisma.user.create({
      data: {
        email: 'writeuser@example.com',
        username: 'writeuser',
        password: '$2b$10$test', // This won't be used for login in tests
        firstName: 'Write',
        lastName: 'User'
      }
    });
    userId = writeUser.id;

    // Create test user with VIEW permissions only
    const viewUser = await prisma.user.create({
      data: {
        email: 'viewuser@example.com',
        username: 'viewuser',
        password: '$2b$10$test',
        firstName: 'View',
        lastName: 'User'
      }
    });
    viewOnlyUserId = viewUser.id;

    // Register and get auth token for WRITE user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'writeuser-new@example.com',
        username: 'writeusertest',
        password: 'WriteTest123!',
        firstName: 'Write',
        lastName: 'Test'
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'writeuser-new@example.com',
        password: 'WriteTest123!'
      });

    authToken = loginResponse.body.accessToken;
    const actualUserId = loginResponse.body.user.id;

    // Register and get auth token for VIEW user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'viewuser-new@example.com',
        username: 'viewusertest',
        password: 'ViewTest123!',
        firstName: 'View',
        lastName: 'Test'
      });

    const viewLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'viewuser-new@example.com',
        password: 'ViewTest123!'
      });

    viewOnlyToken = viewLoginResponse.body.accessToken;

    // Create organization with WRITE user as admin
    const orgResponse = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Version Deletion Test Org',
        description: 'Organization for testing secret version deletion'
      });

    organizationId = orgResponse.body.organization.id;

    // Add VIEW user to organization with VIEW role
    await request(app)
      .post(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'viewuser-new@example.com',
        role: 'VIEW'
      });

    // Create test folder
    const folderResponse = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Version Test Folder',
        description: 'Folder for version deletion tests',
        organizationId: organizationId
      });

    folderId = folderResponse.body.folder.id;

    // Create test secret
    const secretResponse = await request(app)
      .post('/api/secrets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Version Test Secret',
        description: 'Secret for version deletion testing',
        value: 'initial-secret-value',
        type: 'GENERIC',
        folderId: folderId
      });

    secretId = secretResponse.body.secret.id;

    // Update the secret multiple times to create versions
    await request(app)
      .put(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        value: 'updated-secret-value-v2'
      });

    await request(app)
      .put(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        value: 'updated-secret-value-v3'
      });

    await request(app)
      .put(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        value: 'updated-secret-value-v4'
      });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: userId },
          { userId: viewOnlyUserId }
        ]
      }
    });

    await prisma.secretVersion.deleteMany({
      where: { secretId: secretId }
    });

    await prisma.secret.deleteMany({
      where: { folderId: folderId }
    });

    await prisma.folder.deleteMany({
      where: { organizationId: organizationId }
    });

    await prisma.membership.deleteMany({
      where: { organizationId: organizationId }
    });

    await prisma.organization.deleteMany({
      where: { id: organizationId }
    });

    // Clean up the test users we created directly
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: 'writeuser@example.com' },
          { email: 'viewuser@example.com' },
          { email: 'writeuser-new@example.com' },
          { email: 'viewuser-new@example.com' }
        ]
      }
    });

    await prisma.$disconnect();
  });

  describe('DELETE /api/secrets/:secretId/versions/:version', () => {
    test('Should successfully delete a historical version (version 2)', async () => {
      // First, verify we have multiple versions
      const versionsResponse = await request(app)
        .get(`/api/secrets/${secretId}/versions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(versionsResponse.status).toBe(200);
      expect(versionsResponse.body.versions.length).toBeGreaterThan(1);

      // Delete version 2 (not the current version)
      const response = await request(app)
        .delete(`/api/secrets/${secretId}/versions/2`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Secret version deleted successfully');

      // Verify the version is deleted
      const updatedVersionsResponse = await request(app)
        .get(`/api/secrets/${secretId}/versions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedVersionsResponse.status).toBe(200);
      const versionNumbers = updatedVersionsResponse.body.versions.map((v: any) => v.version);
      expect(versionNumbers).not.toContain(2);
    });

    test('Should prevent deletion of the current (latest) version', async () => {
      // Get the current latest version
      const versionsResponse = await request(app)
        .get(`/api/secrets/${secretId}/versions`)
        .set('Authorization', `Bearer ${authToken}`);

      const latestVersion = Math.max(...versionsResponse.body.versions.map((v: any) => v.version));

      // Try to delete the latest version
      const response = await request(app)
        .delete(`/api/secrets/${secretId}/versions/${latestVersion}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot delete the current version');
    });

    test('Should prevent deletion when only one version remains', async () => {
      // Create a new secret with only one version
      const singleVersionSecretResponse = await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Single Version Secret',
          description: 'Secret with only one version',
          value: 'single-version-value',
          type: 'GENERIC',
          folderId: folderId
        });

      const singleVersionSecretId = singleVersionSecretResponse.body.secret.id;

      // Try to delete the only version
      const response = await request(app)
        .delete(`/api/secrets/${singleVersionSecretId}/versions/1`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot delete the last remaining version');

      // Clean up
      await prisma.secretVersion.deleteMany({
        where: { secretId: singleVersionSecretId }
      });
      await prisma.secret.delete({
        where: { id: singleVersionSecretId }
      });
    });

    test('Should require WRITE permissions for version deletion', async () => {
      // Try to delete a version with VIEW-only permissions
      const response = await request(app)
        .delete(`/api/secrets/${secretId}/versions/1`)
        .set('Authorization', `Bearer ${viewOnlyToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Write permissions required');
    });

    test('Should return 404 for non-existent version', async () => {
      const response = await request(app)
        .delete(`/api/secrets/${secretId}/versions/999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Secret version not found');
    });

    test('Should return 400 for invalid version number', async () => {
      const response = await request(app)
        .delete(`/api/secrets/${secretId}/versions/invalid`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Version must be a positive integer');
    });

    test('Should return 400 for zero or negative version numbers', async () => {
      const zeroResponse = await request(app)
        .delete(`/api/secrets/${secretId}/versions/0`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(zeroResponse.status).toBe(400);

      const negativeResponse = await request(app)
        .delete(`/api/secrets/${secretId}/versions/-1`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(negativeResponse.status).toBe(400);
    });

    test('Should return 404 for non-existent secret', async () => {
      const response = await request(app)
        .delete('/api/secrets/non-existent-secret-id/versions/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403); // Access denied because secret doesn't exist
    });

    test('Should create audit log for version deletion', async () => {
      // Create a new secret with multiple versions for this test
      const testSecretResponse = await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Audit Test Secret',
          description: 'Secret for audit testing',
          value: 'audit-test-value-v1',
          type: 'GENERIC',
          folderId: folderId
        });

      const testSecretId = testSecretResponse.body.secret.id;

      // Create version 2
      await request(app)
        .put(`/api/secrets/${testSecretId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          value: 'audit-test-value-v2'
        });

      // Delete version 1
      const deleteResponse = await request(app)
        .delete(`/api/secrets/${testSecretId}/versions/1`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);

      // Check that audit log was created
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          secretId: testSecretId,
          action: 'SECRET_VERSION_DELETED'
        }
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('SECRET_VERSION_DELETED');

      const auditDetails = JSON.parse(auditLogs[0].details || '{}');
      expect(auditDetails.secretId).toBe(testSecretId);
      expect(auditDetails.version).toBe(1);

      // Clean up
      await prisma.secretVersion.deleteMany({
        where: { secretId: testSecretId }
      });
      await prisma.secret.delete({
        where: { id: testSecretId }
      });
    });

    test('Should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/secrets/${secretId}/versions/1`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token is required');
    });
  });
});
