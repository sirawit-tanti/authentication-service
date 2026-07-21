import { z } from 'zod';

const roleCodePattern = /^[A-Z][A-Z0-9_]{1,99}$/;

export const roleParamsSchema = z
  .object({
    roleId: z.uuid(),
  })
  .strict();

export const createRoleBodySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .transform((value): string => value.toUpperCase())
      .refine((value): boolean => roleCodePattern.test(value), {
        message: 'Role code must contain only uppercase letters, numbers, and underscores',
      }),

    name: z.string().trim().min(1).max(150),

    description: z.string().trim().max(500).nullable().default(null),
  })
  .strict();

export const updateRoleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),

    description: z.string().trim().max(500).nullable().optional(),

    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value): boolean =>
      value.name !== undefined || value.description !== undefined || value.isActive !== undefined,
    {
      message: 'At least one role property must be provided',
    },
  );

export const replaceRolePermissionsBodySchema = z
  .object({
    permissionIds: z.array(z.uuid()).max(200),
  })
  .strict();

export type RoleParams = z.infer<typeof roleParamsSchema>;

export type CreateRoleBody = z.infer<typeof createRoleBodySchema>;

export type UpdateRoleBody = z.infer<typeof updateRoleBodySchema>;

export type ReplaceRolePermissionsBody = z.infer<typeof replaceRolePermissionsBodySchema>;

const permissionResponseSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['id', 'code', 'name', 'description', 'resource', 'action', 'isActive'],

  properties: {
    id: {
      type: 'string',

      format: 'uuid',
    },

    code: {
      type: 'string',
    },

    name: {
      type: 'string',
    },

    description: {
      anyOf: [
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },

    resource: {
      type: 'string',
    },

    action: {
      type: 'string',
    },

    isActive: {
      type: 'boolean',
    },
  },
} as const;

const roleResponseSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['id', 'code', 'name', 'description', 'isSystem', 'isActive', 'permissions'],

  properties: {
    id: {
      type: 'string',

      format: 'uuid',
    },

    code: {
      type: 'string',
    },

    name: {
      type: 'string',
    },

    description: {
      anyOf: [
        {
          type: 'null',
        },
        {
          type: 'string',
        },
      ],
    },

    isSystem: {
      type: 'boolean',
    },

    isActive: {
      type: 'boolean',
    },

    permissions: {
      type: 'array',

      items: permissionResponseSchema,
    },
  },
} as const;

const roleSuccessResponseSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['success', 'data'],

  properties: {
    success: {
      type: 'boolean',

      const: true,
    },

    data: {
      type: 'object',

      additionalProperties: false,

      required: ['role'],

      properties: {
        role: roleResponseSchema,
      },
    },
  },
} as const;

const errorResponseSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['success', 'error'],

  properties: {
    success: {
      type: 'boolean',

      const: false,
    },

    error: {
      type: 'object',

      additionalProperties: false,

      required: ['code', 'message'],

      properties: {
        code: {
          type: 'string',
        },

        message: {
          type: 'string',
        },

        details: {
          type: 'array',

          items: {
            type: 'object',

            additionalProperties: true,
          },
        },
      },
    },
  },
} as const;

const roleParamsJsonSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['roleId'],

  properties: {
    roleId: {
      type: 'string',

      format: 'uuid',
    },
  },
} as const;

export const createRoleRouteSchema = {
  tags: ['Authorization'],

  summary: 'Create a custom role',

  security: [
    {
      bearerAuth: [],
    },
  ],

  body: {
    type: 'object',

    additionalProperties: false,

    required: ['code', 'name'],

    properties: {
      code: {
        type: 'string',

        minLength: 2,

        maxLength: 100,
      },

      name: {
        type: 'string',

        minLength: 1,

        maxLength: 150,
      },

      description: {
        anyOf: [
          {
            type: 'null',
          },
          {
            type: 'string',

            maxLength: 500,
          },
        ],
      },
    },
  },

  response: {
    201: roleSuccessResponseSchema,

    400: errorResponseSchema,

    401: errorResponseSchema,

    403: errorResponseSchema,

    409: errorResponseSchema,
  },
} as const;

export const updateRoleRouteSchema = {
  tags: ['Authorization'],

  summary: 'Update a custom role',

  security: [
    {
      bearerAuth: [],
    },
  ],

  params: roleParamsJsonSchema,

  body: {
    type: 'object',

    additionalProperties: false,

    minProperties: 1,

    properties: {
      name: {
        type: 'string',

        minLength: 1,

        maxLength: 150,
      },

      description: {
        anyOf: [
          {
            type: 'null',
          },
          {
            type: 'string',

            maxLength: 500,
          },
        ],
      },

      isActive: {
        type: 'boolean',
      },
    },
  },

  response: {
    200: roleSuccessResponseSchema,

    400: errorResponseSchema,

    401: errorResponseSchema,

    403: errorResponseSchema,

    404: errorResponseSchema,
  },
} as const;

export const replaceRolePermissionsRouteSchema = {
  tags: ['Authorization'],

  summary: 'Replace permissions assigned to a custom role',

  security: [
    {
      bearerAuth: [],
    },
  ],

  params: roleParamsJsonSchema,

  body: {
    type: 'object',

    additionalProperties: false,

    required: ['permissionIds'],

    properties: {
      permissionIds: {
        type: 'array',

        maxItems: 200,

        items: {
          type: 'string',

          format: 'uuid',
        },
      },
    },
  },

  response: {
    200: roleSuccessResponseSchema,

    400: errorResponseSchema,

    401: errorResponseSchema,

    403: errorResponseSchema,

    404: errorResponseSchema,
  },
} as const;
