import { z } from 'zod';

const userStatuses = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const;

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().min(1).max(320).optional(),

    status: z.enum(userStatuses).optional(),
  })
  .strict();

export const userParamsSchema = z
  .object({
    userId: z.uuid(),
  })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export type UserParams = z.infer<typeof userParamsSchema>;

const nullableDateTimeSchema = {
  anyOf: [
    {
      type: 'null',
    },
    {
      type: 'string',
      format: 'date-time',
    },
  ],
} as const;

const roleSchema = {
  type: 'object',

  additionalProperties: false,

  required: ['id', 'code', 'name', 'isSystem', 'isActive', 'assignedAt', 'expiresAt'],

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

    expiresAt: nullableDateTimeSchema,
  },
} as const;

const userSchema = {
  type: 'object',

  additionalProperties: false,

  required: [
    'id',
    'email',
    'status',
    'emailVerified',
    'failedLoginAttempts',
    'lockedUntil',
    'passwordChangedAt',
    'lastLoginAt',
    'version',
    'createdAt',
    'updatedAt',
    'roles',
  ],

  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },

    email: {
      type: 'string',
      format: 'email',
    },

    status: {
      type: 'string',

      enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'],
    },

    emailVerified: {
      type: 'boolean',
    },

    failedLoginAttempts: {
      type: 'integer',
      minimum: 0,
    },

    lockedUntil: nullableDateTimeSchema,

    passwordChangedAt: nullableDateTimeSchema,

    lastLoginAt: nullableDateTimeSchema,

    version: {
      type: 'integer',
      minimum: 1,
    },

    createdAt: {
      type: 'string',
      format: 'date-time',
    },

    updatedAt: {
      type: 'string',
      format: 'date-time',
    },

    roles: {
      type: 'array',
      items: roleSchema,
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

export const listUsersRouteSchema = {
  tags: ['Users'],

  summary: 'List users assigned to the current application',

  security: [
    {
      bearerAuth: [],
    },
  ],

  querystring: {
    type: 'object',

    additionalProperties: false,

    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },

      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },

      search: {
        type: 'string',
        minLength: 1,
        maxLength: 320,
      },

      status: {
        type: 'string',

        enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'],
      },
    },
  },

  response: {
    200: {
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

          required: ['users', 'pagination'],

          properties: {
            users: {
              type: 'array',
              items: userSchema,
            },

            pagination: {
              type: 'object',

              additionalProperties: false,

              required: ['page', 'limit', 'total', 'totalPages'],

              properties: {
                page: {
                  type: 'integer',
                },

                limit: {
                  type: 'integer',
                },

                total: {
                  type: 'integer',
                },

                totalPages: {
                  type: 'integer',
                },
              },
            },
          },
        },
      },
    },

    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
  },
} as const;

export const getUserRouteSchema = {
  tags: ['Users'],

  summary: 'Get a user assigned to the current application',

  security: [
    {
      bearerAuth: [],
    },
  ],

  params: {
    type: 'object',

    additionalProperties: false,

    required: ['userId'],

    properties: {
      userId: {
        type: 'string',
        format: 'uuid',
      },
    },
  },

  response: {
    200: {
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

          required: ['user'],

          properties: {
            user: userSchema,
          },
        },
      },
    },

    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
} as const;
