import { SECURITY_AUDIT_ACTIONS } from '@/application/auditing/security-audit-action.js';
import type {
  AssignedRoleRecord,
  FindUserRolesInput,
  ReplaceUserRolesInput,
  ReplaceUserRolesResult,
  UserRoleAssignmentRepository,
} from '@/application/ports/repositories/user-role-assignment.repository.js';
import type { ApplicationPrismaClient } from '../prisma-client.js';

const USER_RESOURCE_TYPE = 'USER';

export class PrismaUserRoleAssignmentRepository implements UserRoleAssignmentRepository {
  private readonly prisma: ApplicationPrismaClient;

  public constructor(prisma: ApplicationPrismaClient) {
    this.prisma = prisma;
  }

  public async findForUser(input: FindUserRolesInput): Promise<AssignedRoleRecord[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId: input.userId,

        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: input.checkedAt,
            },
          },
        ],

        role: {
          applicationId: input.applicationId,
        },
      },

      orderBy: {
        role: {
          code: 'asc',
        },
      },

      select: {
        assignedAt: true,

        expiresAt: true,

        role: {
          select: {
            id: true,

            code: true,

            name: true,

            description: true,

            isSystem: true,

            isActive: true,
          },
        },
      },
    });

    return assignments.map((assignment): AssignedRoleRecord => ({
      id: assignment.role.id,

      code: assignment.role.code,

      name: assignment.role.name,

      description: assignment.role.description,

      isSystem: assignment.role.isSystem,

      isActive: assignment.role.isActive,

      assignedAt: assignment.assignedAt,

      expiresAt: assignment.expiresAt,
    }));
  }

  public async replace(input: ReplaceUserRolesInput): Promise<ReplaceUserRolesResult> {
    return this.prisma.$transaction(
      async (transaction): Promise<ReplaceUserRolesResult> => {
        const user = await transaction.user.findFirst({
          where: {
            id: input.targetUserId,

            deletedAt: null,
          },

          select: {
            id: true,
          },
        });

        if (user === null) {
          return {
            status: 'USER_NOT_FOUND',
          };
        }

        const requestedRoles =
          input.roleIds.length === 0
            ? []
            : await transaction.role.findMany({
                where: {
                  id: {
                    in: input.roleIds,
                  },

                  applicationId: input.applicationId,

                  isActive: true,
                },

                select: {
                  id: true,

                  code: true,

                  name: true,

                  description: true,

                  isSystem: true,

                  isActive: true,
                },
              });

        const foundRoleIds = new Set(requestedRoles.map((role): string => role.id));

        const invalidRoleIds = input.roleIds.filter((roleId): boolean => !foundRoleIds.has(roleId));

        if (invalidRoleIds.length > 0) {
          return {
            status: 'INVALID_ROLES',

            invalidRoleIds,
          };
        }

        const previousAssignments = await transaction.userRole.findMany({
          where: {
            userId: input.targetUserId,

            role: {
              applicationId: input.applicationId,
            },
          },

          select: {
            roleId: true,

            role: {
              select: {
                code: true,
              },
            },
          },
        });

        await transaction.userRole.deleteMany({
          where: {
            userId: input.targetUserId,

            role: {
              applicationId: input.applicationId,
            },
          },
        });

        if (requestedRoles.length > 0) {
          await transaction.userRole.createMany({
            data: requestedRoles.map((role) => ({
              userId: input.targetUserId,

              roleId: role.id,

              assignedAt: input.assignedAt,

              assignedById: input.assignedByUserId,
            })),
          });
        }

        await transaction.auditLog.create({
          data: {
            applicationId: input.applicationId,

            actorUserId: input.assignedByUserId,

            action: SECURITY_AUDIT_ACTIONS.ROLE_ASSIGNMENTS_REPLACED,

            resourceType: USER_RESOURCE_TYPE,

            resourceId: input.targetUserId,

            outcome: 'SUCCESS',

            createdAt: input.assignedAt,

            metadata: {
              previousRoleIds: previousAssignments.map((assignment) => assignment.roleId),

              previousRoleCodes: previousAssignments.map((assignment) => assignment.role.code),

              newRoleIds: requestedRoles.map((role) => role.id),

              newRoleCodes: requestedRoles.map((role) => role.code),
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

          roles: requestedRoles
            .sort((left, right): number => left.code.localeCompare(right.code))
            .map((role): AssignedRoleRecord => ({
              id: role.id,

              code: role.code,

              name: role.name,

              description: role.description,

              isSystem: role.isSystem,

              isActive: role.isActive,

              assignedAt: input.assignedAt,

              expiresAt: null,
            })),
        };
      },
      {
        maxWait: 2_000,

        timeout: 5_000,
      },
    );
  }
}
