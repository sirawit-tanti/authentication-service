import { z } from 'zod';

export const userRoleParamsSchema = z
  .object({
    userId: z.uuid(),
  })
  .strict();

export const replaceUserRolesBodySchema = z
  .object({
    roleIds: z.array(z.uuid()).max(100),
  })
  .strict();

export type UserRoleParams = z.infer<typeof userRoleParamsSchema>;

export type ReplaceUserRolesBody = z.infer<typeof replaceUserRolesBodySchema>;

const assignedRoleSchema = {
  type: 'object',

  additionalProperties: false,

  required: [
    'id',
    'code',
    'name',
    'description',
    'isSystem',
    'isActive',
    'assignedAt',
    'expiresAt',
  ],

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
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },

    isSystem: {
      type: 'boolean',
    },

    isActive: {
      type: 'boolean',
    },

    assignedAt: {
      type: 'string',

      format: 'date-time',
    },

    expiresAt: {
      anyOf: [
        {
          type: 'string',

          format: 'date-time',
        },
        {
          type: 'null',
        },
      ],
    },
  },
} as const;

const successResponseSchema = {
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

      required: ['roles'],

      properties: {
        roles: {
          type: 'array',

          items: assignedRoleSchema,
        },
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

const paramsJsonSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['userId'],

  properties: {
    userId: {
      type: 'string',

      format: 'uuid',
    },
  },
} as const;

export const getUserRolesRouteSchema = {
  tags: ['Authorization'],

  summary: 'Get roles assigned to a user',

  security: [
    {
      bearerAuth: [],
    },
  ],

  params: paramsJsonSchema,

  response: {
    200: successResponseSchema,

    400: errorResponseSchema,

    401: errorResponseSchema,

    403: errorResponseSchema,
  },
} as const;

export const replaceUserRolesRouteSchema = {
  tags: ['Authorization'],

  summary: 'Replace roles assigned to a user',

  security: [
    {
      bearerAuth: [],
    },
  ],

  params: paramsJsonSchema,

  body: {
    type: 'object',

    additionalProperties: false,

    required: ['roleIds'],

    properties: {
      roleIds: {
        type: 'array',

        maxItems: 100,

        items: {
          type: 'string',

          format: 'uuid',
        },
      },
    },
  },

  response: {
    200: successResponseSchema,

    400: errorResponseSchema,

    401: errorResponseSchema,

    403: errorResponseSchema,

    404: errorResponseSchema,
  },
} as const;
