import { z } from 'zod';

export const loginRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, {
        error: 'Email is required',
      })
      .max(320, {
        error: 'Email must not exceed 320 characters',
      })
      .pipe(z.email()),

    password: z
      .string()
      .min(1, {
        error: 'Password is required',
      })
      .max(128, {
        error: 'Password must not exceed 128 characters',
      }),
  })
  .strict();

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;

export const loginRouteSchema = {
  description: 'Authenticate a user with email and password',
  tags: ['Authentication'],
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        minLength: 1,
        maxLength: 320,
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
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
    401: {
      type: 'object',
      additionalProperties: true,
    },
    409: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const;
