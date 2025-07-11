import { MembershipRole } from '@prisma/client';
import { prisma } from './database';

export class PermissionService {
  /**
   * Check if user has the required role in the organization
   */
  static async checkOrganizationPermission(
    userId: string,
    organizationId: string,
    requiredRole: MembershipRole
  ): Promise<boolean> {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId
        }
      }
    });

    if (!membership) return false;

    return this.hasRequiredRole(membership.role, requiredRole);
  }

  /**
   * Check if user has permission for a folder (considering inheritance)
   */
  static async checkFolderPermission(
    userId: string,
    folderId: string,
    requiredRole: MembershipRole
  ): Promise<boolean> {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { organization: true }
    });

    if (!folder) return false;

    // Check organization membership first
    const hasOrgPermission = await this.checkOrganizationPermission(
      userId,
      folder.organizationId,
      requiredRole
    );

    if (!hasOrgPermission) return false;

    // Check for folder-specific overrides
    const overrideField = this.getRoleOverrideField(requiredRole);
    if (folder[overrideField] !== null) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: folder.organizationId
          }
        }
      });

      if (!membership) return false;
      return this.hasRequiredRole(membership.role, folder[overrideField]!);
    }

    return true;
  }

  /**
   * Check if user has permission for a secret (inherits from folder)
   */
  static async checkSecretPermission(
    userId: string,
    secretId: string,
    requiredRole: MembershipRole
  ): Promise<boolean> {
    const secret = await prisma.secret.findUnique({
      where: { id: secretId },
      include: { folder: true }
    });

    if (!secret) return false;

    return this.checkFolderPermission(userId, secret.folderId, requiredRole);
  }

  /**
   * Get user's effective role in an organization
   */
  static async getUserOrganizationRole(
    userId: string,
    organizationId: string
  ): Promise<MembershipRole | null> {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId
        }
      }
    });

    return membership?.role || null;
  }

  /**
   * Check if a role meets the required level
   */
  private static hasRequiredRole(userRole: MembershipRole, requiredRole: MembershipRole): boolean {
    const roleHierarchy = {
      [MembershipRole.VIEW]: 1,
      [MembershipRole.WRITE]: 2,
      [MembershipRole.ADMIN]: 3
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Get the appropriate override field for a role
   */
  private static getRoleOverrideField(role: MembershipRole): 'viewOverride' | 'writeOverride' | 'adminOverride' {
    switch (role) {
      case MembershipRole.VIEW:
        return 'viewOverride';
      case MembershipRole.WRITE:
        return 'writeOverride';
      case MembershipRole.ADMIN:
        return 'adminOverride';
      default:
        return 'viewOverride';
    }
  }
}
