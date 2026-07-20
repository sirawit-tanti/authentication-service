import { z } from 'zod';

const DEFAULT_LIMIT = 20;

const MAXIMUM_LIMIT = 100;

export const listAuditLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAXIMUM_LIMIT).default(DEFAULT_LIMIT),

    cursor: z.string().trim().min(1).max(1_024).optional(),

    actorUserId: z.uuid().optional(),

    action: z.string().trim().min(1).max(150).optional(),

    outcome: z.enum(['SUCCESS', 'FAILURE']).optional(),

    resourceType: z.string().trim().min(1).max(100).optional(),

    resourceId: z.string().trim().min(1).max(100).optional(),

    requestId: z.string().trim().min(1).max(100).optional(),

    createdFrom: z.coerce.date().optional(),

    createdTo: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((query, context): void => {
    if (
      query.createdFrom !== undefined &&
      query.createdTo !== undefined &&
      query.createdFrom > query.createdTo
    ) {
      context.addIssue({
        code: 'custom',

        path: ['createdTo'],

        message: 'createdTo must be greater than or equal to createdFrom',
      });
    }
  });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

const errorResponseSchema = {
  type: 'object',

  additionalProperties: true,
} as const;

const nullableStringSchema = {
  anyOf: [
    {
      type: 'string',
    },
    {
      type: 'null',
    },
  ],
} as const;

const nullableUuidSchema = {
  anyOf: [
    {
      type: 'string',

      format: 'uuid',
    },
    {
      type: 'null',
    },
  ],
} as const;

const auditLogResponseSchema = {
  type: 'object',

  additionalProperties: false,

  required: [
    'id',
    'applicationId',
    'actorUserId',
    'action',
    'resourceType',
    'resourceId',
    'outcome',
    'ipAddress',
    'userAgent',
    'requestId',
    'metadata',
    'errorMessage',
    'createdAt',
  ],

  properties: {
    id: {
      type: 'string',

      format: 'uuid',
    },

    applicationId: nullableUuidSchema,

    actorUserId: nullableUuidSchema,

    action: {
      type: 'string',
    },

    resourceType: nullableStringSchema,

    resourceId: nullableStringSchema,

    outcome: {
      type: 'string',

      enum: ['SUCCESS', 'FAILURE'],
    },

    ipAddress: nullableStringSchema,

    userAgent: nullableStringSchema,

    requestId: nullableStringSchema,

    metadata: {
      anyOf: [
        {
          type: 'object',

          additionalProperties: true,
        },
        {
          type: 'array',
        },
        {
          type: 'string',
        },
        {
          type: 'number',
        },
        {
          type: 'boolean',
        },
        {
          type: 'null',
        },
      ],
    },

    errorMessage: nullableStringSchema,

    createdAt: {
      type: 'string',

      format: 'date-time',
    },
  },
} as const;

export const listAuditLogsRouteSchema = {
  description: 'List application-scoped security audit logs',

  tags: ['Auditing'],

  security: [
    {
      bearerAuth: [],
    },
  ],

  querystring: {
    type: 'object',

    additionalProperties: false,

    properties: {
      limit: {
        type: 'integer',

        minimum: 1,

        maximum: MAXIMUM_LIMIT,

        default: DEFAULT_LIMIT,
      },

      cursor: {
        type: 'string',

        minLength: 1,

        maxLength: 1_024,
      },

      actorUserId: {
        type: 'string',

        format: 'uuid',
      },

      action: {
        type: 'string',

        minLength: 1,

        maxLength: 150,
      },

      outcome: {
        type: 'string',

        enum: ['SUCCESS', 'FAILURE'],
      },

      resourceType: {
        type: 'string',

        minLength: 1,

        maxLength: 100,
      },

      resourceId: {
        type: 'string',

        minLength: 1,

        maxLength: 100,
      },

      requestId: {
        type: 'string',

        minLength: 1,

        maxLength: 100,
      },

      createdFrom: {
        type: 'string',

        format: 'date-time',
      },

      createdTo: {
        type: 'string',

        format: 'date-time',
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

          enum: [true],
        },

        data: {
          type: 'object',

          additionalProperties: false,

          required: ['auditLogs', 'nextCursor'],

          properties: {
            auditLogs: {
              type: 'array',

              items: auditLogResponseSchema,
            },

            nextCursor: {
              anyOf: [
                {
                  type: 'string',
                },
                {
                  type: 'null',
                },
              ],
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
