import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

interface PermissionSeed {
  code: string;
  name: string;
  resource: string;
  action: string;
  description: string;
}

interface ApplicationSeed {
  code: string;
  name: string;
  description: string;
}

const applications: ApplicationSeed[] = [
  {
    code: 'ERP',
    name: 'Enterprise Resource Planning',
    description: 'Enterprise resource planning system',
  },
  {
    code: 'POS',
    name: 'Point of Sale',
    description: 'Point-of-sale system',
  },
  {
    code: 'HR',
    name: 'Human Resources',
    description: 'Human resources management system',
  },
  {
    code: 'INVENTORY',
    name: 'Inventory',
    description: 'Inventory management system',
  },
  {
    code: 'FINANCE',
    name: 'Finance',
    description: 'Finance and accounting system',
  },
  {
    code: 'CRM',
    name: 'Customer Relationship Management',
    description: 'Customer relationship management system',
  },
];

const commonPermissions: PermissionSeed[] = [
  {
    code: 'users.read',
    name: 'Read users',
    resource: 'users',
    action: 'read',
    description: 'View users and their profiles',
  },
  {
    code: 'users.create',
    name: 'Create users',
    resource: 'users',
    action: 'create',
    description: 'Create new users',
  },
  {
    code: 'users.update',
    name: 'Update users',
    resource: 'users',
    action: 'update',
    description: 'Update users and their profiles',
  },
  {
    code: 'users.disable',
    name: 'Disable users',
    resource: 'users',
    action: 'disable',
    description: 'Disable or suspend user accounts',
  },
  {
    code: 'roles.read',
    name: 'Read roles',
    resource: 'roles',
    action: 'read',
    description: 'View roles and permission mappings',
  },
  {
    code: 'roles.manage',
    name: 'Manage roles',
    resource: 'roles',
    action: 'manage',
    description: 'Create and update roles',
  },
  {
    code: 'roles.assign',
    name: 'Assign roles',
    resource: 'roles',
    action: 'assign',
    description: 'Assign and remove roles from users',
  },
  {
    code: 'sessions.read',
    name: 'Read sessions',
    resource: 'sessions',
    action: 'read',
    description: 'View active user sessions',
  },
  {
    code: 'sessions.revoke',
    name: 'Revoke sessions',
    resource: 'sessions',
    action: 'revoke',
    description: 'Revoke active user sessions',
  },
  {
    code: 'audit_logs.read',
    name: 'Read audit logs',
    resource: 'audit_logs',
    action: 'read',
    description: 'View authentication and authorization audit logs',
  },
  {
    code: 'api_keys.read',
    name: 'Read API keys',
    resource: 'api_keys',
    action: 'read',
    description: 'View API key metadata',
  },
  {
    code: 'api_keys.manage',
    name: 'Manage API keys',
    resource: 'api_keys',
    action: 'manage',
    description: 'Create and revoke API keys',
  },
];

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function seedApplication(applicationSeed: ApplicationSeed): Promise<void> {
  const application = await prisma.application.upsert({
    where: {
      code: applicationSeed.code,
    },

    update: {
      name: applicationSeed.name,
      description: applicationSeed.description,
      isActive: true,
    },

    create: {
      code: applicationSeed.code,
      name: applicationSeed.name,
      description: applicationSeed.description,
      isActive: true,
    },
  });

  const permissions = await Promise.all(
    commonPermissions.map(async (permissionSeed) =>
      prisma.permission.upsert({
        where: {
          applicationId_code: {
            applicationId: application.id,
            code: permissionSeed.code,
          },
        },

        update: {
          name: permissionSeed.name,
          description: permissionSeed.description,
          resource: permissionSeed.resource,
          action: permissionSeed.action,
          isActive: true,
        },

        create: {
          applicationId: application.id,
          code: permissionSeed.code,
          name: permissionSeed.name,
          description: permissionSeed.description,
          resource: permissionSeed.resource,
          action: permissionSeed.action,
          isActive: true,
        },
      }),
    ),
  );

  const administratorRole = await prisma.role.upsert({
    where: {
      applicationId_code: {
        applicationId: application.id,
        code: 'ADMINISTRATOR',
      },
    },

    update: {
      name: 'Administrator',
      description: `Full administrative access to ${application.name}`,
      isSystem: true,
      isActive: true,
    },

    create: {
      applicationId: application.id,
      code: 'ADMINISTRATOR',
      name: 'Administrator',
      description: `Full administrative access to ${application.name}`,
      isSystem: true,
      isActive: true,
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: {
      applicationId_code: {
        applicationId: application.id,
        code: 'VIEWER',
      },
    },

    update: {
      name: 'Viewer',
      description: `Read-only access to ${application.name}`,
      isSystem: true,
      isActive: true,
    },

    create: {
      applicationId: application.id,
      code: 'VIEWER',
      name: 'Viewer',
      description: `Read-only access to ${application.name}`,
      isSystem: true,
      isActive: true,
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: administratorRole.id,
      permissionId: permission.id,
    })),

    skipDuplicates: true,
  });

  const viewerPermissions = permissions.filter((permission) => permission.action === 'read');

  await prisma.rolePermission.createMany({
    data: viewerPermissions.map((permission) => ({
      roleId: viewerRole.id,
      permissionId: permission.id,
    })),

    skipDuplicates: true,
  });
}

async function main(): Promise<void> {
  for (const applicationSeed of applications) {
    await seedApplication(applicationSeed);
  }

  console.info(`Seeded ${String(applications.length)} applications successfully`);
}

try {
  await main();
} catch (error: unknown) {
  console.error('Database seeding failed', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
