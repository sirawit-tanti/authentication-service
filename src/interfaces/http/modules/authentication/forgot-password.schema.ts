import { z } from 'zod';

export const forgotPasswordRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .pipe(z.email())
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export type ForgotPasswordRequestBody = z.infer<typeof forgotPasswordRequestSchema>;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

export const forgotPasswordRouteSchema = {
  description: 'Request a password reset email',

  tags: ['Authentication'],

  body: {
    type: 'object',
    additionalProperties: false,
    required: ['email'],

    properties: {
      email: {
        type: 'string',
        format: 'email',
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
          required: ['message'],

          properties: {
            message: {
              type: 'string',
            },
          },
        },
      },
    },

    400: errorResponseSchema,
  },
} as const;
