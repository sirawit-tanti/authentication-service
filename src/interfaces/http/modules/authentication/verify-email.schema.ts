import { z } from 'zod';

export const verifyEmailRequestSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(1, {
        error: 'Verification token is required',
      })
      .max(512, {
        error: 'Verification token must not exceed 512 characters',
      }),
  })
  .strict();

export type VerifyEmailRequestBody = z.infer<typeof verifyEmailRequestSchema>;

const apiErrorDetailSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message'],

  properties: {
    code: {
      type: 'string',
    },

    field: {
      type: 'string',
    },

    message: {
      type: 'string',
    },
  },
} as const;

const apiErrorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'error'],

  properties: {
    success: {
      type: 'boolean',
      enum: [false],
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
          items: apiErrorDetailSchema,
        },
      },
    },
  },
} as const;

export const verifyEmailRouteSchema = {
  description: 'Verify a registered user email address',

  tags: ['Authentication'],

  body: {
    type: 'object',
    additionalProperties: false,
    required: ['token'],

    properties: {
      token: {
        type: 'string',
        minLength: 1,
        maxLength: 512,
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
          required: ['userId', 'email', 'status'],

          properties: {
            userId: {
              type: 'string',
            },

            email: {
              type: 'string',
            },

            status: {
              type: 'string',
              enum: ['ACTIVE'],
            },
          },
        },
      },
    },

    400: apiErrorResponseSchema,

    409: apiErrorResponseSchema,

    410: apiErrorResponseSchema,

    422: apiErrorResponseSchema,

    429: apiErrorResponseSchema,

    500: apiErrorResponseSchema,
  },
} as const;
