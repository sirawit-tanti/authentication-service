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

    400: {
      type: 'object',
      additionalProperties: true,
    },

    409: {
      type: 'object',
      additionalProperties: true,
    },

    410: {
      type: 'object',
      additionalProperties: true,
    },

    422: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const;
