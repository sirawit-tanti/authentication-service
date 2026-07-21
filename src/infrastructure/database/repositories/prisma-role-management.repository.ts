import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type {
  CreateRoleInput,
  CreateRoleResult,
  ManagedRolePermissionRecord,
  ManagedRoleRecord,
  ReplaceRolePermissionsInput,
  ReplaceRolePermissionsResult,
  RoleManagementRepository,
  UpdateRoleInput,
  UpdateRoleResult,
} from '@/application/ports/repositories/role-management.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const ROLE_RESOURCE_TYPE = 'ROLE';

interface PrismaRolePermissionRecord {
  permission: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    resource: string;
    action: string;
    isActive: boolean;
  };
}

interface PrismaManagedRoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  rolePermissions: PrismaRolePermissionRecord[];
}

function mapPermission(record: PrismaRolePermissionRecord): ManagedRolePermissionRecord {
  return {
    id: record.permission.id,

    code: record.permission.code,

    name: record.permission.name,

    description: record.permission.description,

    resource: record.permission.resource,

    action: record.permission.action,

    isActive: record.permission.isActive,
  };
}

function mapRole(role: PrismaManagedRoleRecord): ManagedRoleRecord {
  return {
    id: role.id,

    code: role.code,

    name: role.name,

    description: role.description,

    isSystem: role.isSystem,

    isActive: role.isActive,

    permissions: role.rolePermissions.map(mapPermission),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return error.code === 'P2002';
}

const roleSelect = {
  id: true,

  code: true,

  name: true,

  description: true,

  isSystem: true,

  isActive: true,

  rolePermissions: {
    orderBy: {
      permission: {
        code: 'asc' as const,
      },
    },

    select: {
      permission: {
        select: {
          id: true,

          code: true,

          name: true,

          description: true,

          resource: true,

          action: true,

          isActive: true,
        },
      },
    },
  },
} as const;

export class PrismaRoleManagementRepository implements RoleManagementRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async create(input: CreateRoleInput): Promise<CreateRoleResult> {
    try {
      return await this.prisma.$transaction(async (transaction): Promise<CreateRoleResult> => {
        const existingRole = await transaction.role.findFirst({
          where: {
            applicationId: input.applicationId,

            code: input.code,
          },

          select: {
            id: true,
          },
        });

        if (existingRole !== null) {
          return {
            status: 'DUPLICATE_CODE',
          };
        }

        const role = await transaction.role.create({
          data: {
            applicationId: input.applicationId,

            code: input.code,

            name: input.name,

            description: input.description,

            isSystem: false,

            isActive: true,
          },

          select: roleSelect,
        });

        await transaction.auditLog.create({
          data: {
            applicationId: input.applicationId,

            actorUserId: input.actorUserId,

            action: SECURITY_AUDIT_ACTIONS.ROLE_CREATED,

            resourceType: ROLE_RESOURCE_TYPE,

            resourceId: role.id,

            outcome: 'SUCCESS',

            createdAt: input.createdAt,

            metadata: {
              code: role.code,

              name: role.name,

              description: role.description,

              isSystem: role.isSystem,

              isActive: role.isActive,
            },

            ...(input.requestId === undefined
              ? {}
              : {
                  requestId: input.requestId,
                }),

            ...(input.ipAddress === undefined
              ? {}
              : {
                  ipAddress: input.ipAddress,
                }),

            ...(input.userAgent === undefined
              ? {}
              : {
                  userAgent: input.userAgent,
                }),
          },
        });

        return {
          status: 'CREATED',

          role: mapRole(role),
        };
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return {
          status: 'DUPLICATE_CODE',
        };
      }

      throw error;
    }
  }

  public async update(input: UpdateRoleInput): Promise<UpdateRoleResult> {
    return this.prisma.$transaction(async (transaction): Promise<UpdateRoleResult> => {
      const currentRole = await transaction.role.findFirst({
        where: {
          id: input.roleId,

          applicationId: input.applicationId,
        },

        select: roleSelect,
      });

      if (currentRole === null) {
        return {
          status: 'NOT_FOUND',
        };
      }

      if (currentRole.isSystem) {
        return {
          status: 'SYSTEM_ROLE_PROTECTED',
        };
      }

      const role = await transaction.role.update({
        where: {
          id: currentRole.id,
        },

        data: {
          ...(input.name === undefined
            ? {}
            : {
                name: input.name,
              }),

          ...(input.description === undefined
            ? {}
            : {
                description: input.description,
              }),

          ...(input.isActive === undefined
            ? {}
            : {
                isActive: input.isActive,
              }),
        },

        select: roleSelect,
      });

      await transaction.auditLog.create({
        data: {
          applicationId: input.applicationId,

          actorUserId: input.actorUserId,

          action: SECURITY_AUDIT_ACTIONS.ROLE_UPDATED,

          resourceType: ROLE_RESOURCE_TYPE,

          resourceId: role.id,

          outcome: 'SUCCESS',

          createdAt: input.updatedAt,

          metadata: {
            previous: {
              name: currentRole.name,

              description: currentRole.description,

              isActive: currentRole.isActive,
            },

            current: {
              name: role.name,

              description: role.description,

              isActive: role.isActive,
            },
          },

          ...(input.requestId === undefined
            ? {}
            : {
                requestId: input.requestId,
              }),

          ...(input.ipAddress === undefined
            ? {}
            : {
                ipAddress: input.ipAddress,
              }),

          ...(input.userAgent === undefined
            ? {}
            : {
                userAgent: input.userAgent,
              }),
        },
      });

      return {
        status: 'UPDATED',

        role: mapRole(role),
      };
    });
  }

  public async replacePermissions(
    input: ReplaceRolePermissionsInput,
  ): Promise<ReplaceRolePermissionsResult> {
    return this.prisma.$transaction(async (transaction): Promise<ReplaceRolePermissionsResult> => {
      const currentRole = await transaction.role.findFirst({
        where: {
          id: input.roleId,

          applicationId: input.applicationId,
        },

        select: roleSelect,
      });

      if (currentRole === null) {
        return {
          status: 'NOT_FOUND',
        };
      }

      if (currentRole.isSystem) {
        return {
          status: 'SYSTEM_ROLE_PROTECTED',
        };
      }

      const permissions =
        input.permissionIds.length === 0
          ? []
          : await transaction.permission.findMany({
              where: {
                id: {
                  in: input.permissionIds,
                },

                applicationId: input.applicationId,

                isActive: true,
              },

              orderBy: {
                code: 'asc',
              },

              select: {
                id: true,

                code: true,
              },
            });

      const foundPermissionIds = new Set(permissions.map((permission): string => permission.id));

      const invalidPermissionIds = input.permissionIds.filter(
        (permissionId): boolean => !foundPermissionIds.has(permissionId),
      );

      if (invalidPermissionIds.length > 0) {
        return {
          status: 'INVALID_PERMISSIONS',

          invalidPermissionIds,
        };
      }

      const previousPermissions = currentRole.rolePermissions.map(({ permission }) => ({
        id: permission.id,

        code: permission.code,
      }));

      await transaction.rolePermission.deleteMany({
        where: {
          roleId: currentRole.id,
        },
      });

      if (permissions.length > 0) {
        await transaction.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: currentRole.id,

            permissionId: permission.id,
          })),
        });
      }

      const role = await transaction.role.findUniqueOrThrow({
        where: {
          id: currentRole.id,
        },

        select: roleSelect,
      });

      await transaction.auditLog.create({
        data: {
          applicationId: input.applicationId,

          actorUserId: input.actorUserId,

          action: SECURITY_AUDIT_ACTIONS.ROLE_PERMISSIONS_REPLACED,

          resourceType: ROLE_RESOURCE_TYPE,

          resourceId: role.id,

          outcome: 'SUCCESS',

          createdAt: input.updatedAt,

          metadata: {
            previousPermissions,

            currentPermissions: permissions,
          },

          ...(input.requestId === undefined
            ? {}
            : {
                requestId: input.requestId,
              }),

          ...(input.ipAddress === undefined
            ? {}
            : {
                ipAddress: input.ipAddress,
              }),

          ...(input.userAgent === undefined
            ? {}
            : {
                userAgent: input.userAgent,
              }),
        },
      });

      return {
        status: 'UPDATED',

        role: mapRole(role),
      };
    });
  }
}
