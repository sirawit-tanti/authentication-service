import { z } from 'zod';

export const resendVerificationRequestSchema = z
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
  })
  .strict();

export type ResendVerificationRequestBody = z.infer<typeof resendVerificationRequestSchema>;

export const resendVerificationRouteSchema = {
  description: 'Request another email verification message',

  tags: ['Authentication'],

  body: {
    type: 'object',
    additionalProperties: false,
    required: ['email'],

    properties: {
      email: {
        type: 'string',
        minLength: 1,
        maxLength: 320,
      },
    },
  },

  response: {
    202: {
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
          required: ['accepted'],

          properties: {
            accepted: {
              type: 'boolean',
              enum: [true],
            },
          },
        },
      },
    },

    400: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const;
