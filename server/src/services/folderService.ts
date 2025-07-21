import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';
import { logger } from '../lib/logger';

export interface CreateFolderRequest {
  name: string;
  description?: string;
  parentId?: string | null;
  organizationId: string;
  createdBy: string;
}

export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  parentId?: string | null;
}

export class FolderService {
  /**
   * Check if user has access to organization
   */
  private async checkOrganizationAccess(userId: string, organizationId: string, requiredRole: Role = Role.VIEW): Promise<boolean> {
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
      },
      include: {
        organization: true
      }
    });

    if (!membership || membership.organization.isDeleted) {
      return false;
    }

    // Check role hierarchy: ADMIN > WRITE > VIEW
    const roleHierarchy = { VIEW: 1, WRITE: 2, ADMIN: 3 };
    return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
  }

  /**
   * Check if user has access to a specific folder
   */
  private async checkFolderAccess(userId: string, folderId: string, requiredRole: Role = Role.VIEW): Promise<boolean> {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        organization: true
      }
    });

    if (!folder || folder.organization.isDeleted) {
      return false;
    }

    return this.checkOrganizationAccess(userId, folder.organizationId, requiredRole);
  }

  /**
   * Validate folder hierarchy to prevent cycles
   */
  private async validateFolderHierarchy(folderId: string, parentId: string): Promise<boolean> {
    if (folderId === parentId) {
      return false; // Cannot be parent of itself
    }

        // Check if parentId is a descendant of folderId (would create cycle)
    let currentParentId: string | null = parentId;
    const visitedIds = new Set<string>();
    
    while (currentParentId) {
      if (visitedIds.has(currentParentId)) {
        return false; // Detected cycle
      }
      
      visitedIds.add(currentParentId);
      
      if (currentParentId === folderId) {
        return false; // Would create cycle
      }

      const parent: { parentId: string | null } | null = await prisma.folder.findUnique({
        where: { id: currentParentId },
        select: { parentId: true }
      });

      if (!parent) {
        break;
      }

      currentParentId = parent.parentId;
    }

    return true;
  }

  /**
   * Create a new folder
   */
  async createFolder(request: CreateFolderRequest): Promise<any> {
    // Validate organization exists and is not deleted
    const organization = await prisma.organization.findUnique({
      where: { id: request.organizationId }
    });

    if (!organization || organization.isDeleted) {
      throw new Error('Organization not found or has been deleted');
    }

    // Check organization access (WRITE permission required)
    const hasAccess = await this.checkOrganizationAccess(request.createdBy, request.organizationId, Role.WRITE);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to create folders in this organization');
    }

    // If parentId is provided, validate it exists and belongs to same organization
    if (request.parentId) {
      const parentFolder = await prisma.folder.findUnique({
        where: { id: request.parentId }
      });

      if (!parentFolder) {
        throw new Error('Parent folder not found');
      }

      if (parentFolder.organizationId !== request.organizationId) {
        throw new Error('Parent folder must belong to the same organization');
      }
    }

    // Check for duplicate names in the same parent/organization
    const existingFolder = await prisma.folder.findFirst({
      where: {
        name: request.name,
        organizationId: request.organizationId,
        parentId: request.parentId || null
      }
    });

    if (existingFolder) {
      throw new Error('A folder with this name already exists in this location');
    }

    // Create the folder
    const folder = await prisma.$transaction(async (tx) => {
      const newFolder = await tx.folder.create({
        data: {
          name: request.name,
          description: request.description,
          parentId: request.parentId,
          organizationId: request.organizationId
        },
        include: {
          organization: {
            select: { name: true }
          },
          parent: {
            select: { name: true }
          }
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'FOLDER_CREATED',
          details: JSON.stringify({
            folderId: newFolder.id,
            folderName: newFolder.name,
            organizationId: request.organizationId,
            organizationName: newFolder.organization.name,
            parentFolderId: request.parentId,
            parentFolderName: newFolder.parent?.name
          }),
          userId: request.createdBy
        }
      });

      return newFolder;
    });

    logger.info('Folder created successfully', {
      folderId: folder.id,
      folderName: folder.name,
      organizationId: request.organizationId,
      createdBy: request.createdBy,
      parentId: request.parentId
    });

    return folder;
  }

  /**
   * Get folder by ID with full details
   */
  async getFolderById(folderId: string, userId: string): Promise<any> {
    // First check if folder exists
    const folderExists = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true }
    });

    if (!folderExists) {
      throw new Error('Folder not found');
    }

    // Check folder access
    const hasAccess = await this.checkFolderAccess(userId, folderId, Role.VIEW);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to view this folder');
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        organization: {
          select: { id: true, name: true }
        },
        parent: {
          select: { id: true, name: true }
        },
        children: {
          select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
          orderBy: { name: 'asc' }
        },
        secrets: {
          select: { id: true, name: true, description: true, type: true, createdAt: true, updatedAt: true },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    return folder;
  }

  /**
   * Get all folders in an organization with hierarchy
   */
  async getOrganizationFolders(organizationId: string, userId: string): Promise<any[]> {
    // Check organization access
    const hasAccess = await this.checkOrganizationAccess(userId, organizationId, Role.VIEW);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to view folders in this organization');
    }

    const folders = await prisma.folder.findMany({
      where: { organizationId },
      include: {
        parent: {
          select: { id: true, name: true }
        },
        children: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            children: true,
            secrets: true
          }
        }
      },
      orderBy: [
        { parentId: { sort: 'asc', nulls: 'first' } },
        { name: 'asc' }
      ]
    });

    return folders;
  }

  /**
   * Get folder tree structure
   */
  async getFolderTree(organizationId: string, userId: string): Promise<any[]> {
    // Check organization access
    const hasAccess = await this.checkOrganizationAccess(userId, organizationId, Role.VIEW);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to view folders in this organization');
    }

    const folders = await prisma.folder.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            children: true,
            secrets: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Build tree structure
    const folderMap = new Map();
    const rootFolders: any[] = [];

    // First pass: create folder map
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: []
      });
    });

    // Second pass: build hierarchy
    folders.forEach(folder => {
      const folderNode = folderMap.get(folder.id);
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children.push(folderNode);
        } else {
          rootFolders.push(folderNode);
        }
      } else {
        rootFolders.push(folderNode);
      }
    });

    return rootFolders;
  }

  /**
   * Update folder
   */
  async updateFolder(folderId: string, updates: UpdateFolderRequest, userId: string): Promise<any> {
    // First check if folder exists
    const existingFolder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        organization: true
      }
    });

    if (!existingFolder) {
      throw new Error('Folder not found');
    }

    // Then check folder access (WRITE permission required)
    const hasAccess = await this.checkFolderAccess(userId, folderId, Role.WRITE);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to update this folder');
    }

    // Validate parent folder change
    if (updates.parentId !== undefined) {
      if (updates.parentId) {
        // Validate parent exists and belongs to same organization
        const parentFolder = await prisma.folder.findUnique({
          where: { id: updates.parentId }
        });

        if (!parentFolder) {
          throw new Error('Parent folder not found');
        }

        if (parentFolder.organizationId !== existingFolder.organizationId) {
          throw new Error('Parent folder must belong to the same organization');
        }

        // Validate hierarchy to prevent cycles
        const isValidHierarchy = await this.validateFolderHierarchy(folderId, updates.parentId);
        if (!isValidHierarchy) {
          throw new Error('Invalid folder hierarchy: would create a cycle');
        }
      }
    }

    // Check for duplicate names if name is being changed
    if (updates.name && updates.name !== existingFolder.name) {
      const duplicateFolder = await prisma.folder.findFirst({
        where: {
          name: updates.name,
          organizationId: existingFolder.organizationId,
          parentId: updates.parentId !== undefined ? updates.parentId : existingFolder.parentId,
          id: { not: folderId }
        }
      });

      if (duplicateFolder) {
        throw new Error('A folder with this name already exists in this location');
      }
    }

    // Update the folder
    const updatedFolder = await prisma.$transaction(async (tx) => {
      const folder = await tx.folder.update({
        where: { id: folderId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.parentId !== undefined && { parentId: updates.parentId })
        },
        include: {
          organization: {
            select: { name: true }
          },
          parent: {
            select: { name: true }
          }
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'FOLDER_UPDATED',
          details: JSON.stringify({
            folderId: folder.id,
            folderName: folder.name,
            organizationId: folder.organizationId,
            organizationName: folder.organization.name,
            updates: updates
          }),
          userId
        }
      });

      return folder;
    });

    logger.info('Folder updated successfully', {
      folderId,
      updates,
      updatedBy: userId
    });

    return updatedFolder;
  }

  /**
   * Delete folder (and optionally its contents)
   */
  async deleteFolder(folderId: string, userId: string, force: boolean = false): Promise<void> {
    // First check if folder exists
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        children: true,
        secrets: true,
        organization: {
          select: { name: true }
        }
      }
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Then check folder access (WRITE permission required)
    const hasAccess = await this.checkFolderAccess(userId, folderId, Role.WRITE);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to delete this folder');
    }

    // Check if folder has contents
    if (!force && (folder.children.length > 0 || folder.secrets.length > 0)) {
      throw new Error('Cannot delete folder with contents. Use force=true to delete folder and all its contents.');
    }

    // Delete the folder (CASCADE will handle children and secrets if force=true)
    await prisma.$transaction(async (tx) => {
      if (force) {
        // Recursively delete all children and their secrets
        await tx.folder.deleteMany({
          where: {
            OR: [
              { parentId: folderId },
              { id: folderId }
            ]
          }
        });
      } else {
        await tx.folder.delete({
          where: { id: folderId }
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'FOLDER_DELETED',
          details: JSON.stringify({
            folderId: folder.id,
            folderName: folder.name,
            organizationId: folder.organizationId,
            organizationName: folder.organization.name,
            force,
            childrenCount: folder.children.length,
            secretsCount: folder.secrets.length
          }),
          userId
        }
      });
    });

    logger.info('Folder deleted successfully', {
      folderId,
      folderName: folder.name,
      force,
      deletedBy: userId
    });
  }

  /**
   * Move folder to a different parent
   */
  async moveFolder(folderId: string, newParentId: string | null, userId: string): Promise<any> {
    return this.updateFolder(folderId, { parentId: newParentId }, userId);
  }

  /**
   * Get folder path (breadcrumb)
   */
  async getFolderPath(folderId: string, userId: string): Promise<any[]> {
    // First check if folder exists
    const folderExists = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true }
    });

    if (!folderExists) {
      throw new Error('Folder not found');
    }

    // Then check folder access
    const hasAccess = await this.checkFolderAccess(userId, folderId, Role.VIEW);
    if (!hasAccess) {
      throw new Error('Access denied: Insufficient permissions to view this folder');
    }

    const path: any[] = [];
    let currentFolderId: string | null = folderId;

    while (currentFolderId) {
      const folder: { id: string; name: string; parentId: string | null } | null = await prisma.folder.findUnique({
        where: { id: currentFolderId },
        select: {
          id: true,
          name: true,
          parentId: true
        }
      });

      if (!folder) {
        break;
      }

      path.unshift({
        id: folder.id,
        name: folder.name
      });

      currentFolderId = folder.parentId;
    }

    return path;
  }
}
