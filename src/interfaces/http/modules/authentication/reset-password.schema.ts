import { z } from 'zod';

export const resetPasswordRequestSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(1, {
        error: 'Password reset token is required',
      })
      .max(512, {
        error: 'Password reset token must not exceed 512 characters',
      }),

    newPassword: z
      .string()
      .min(12, {
        error: 'Password must contain at least 12 characters',
      })
      .max(128, {
        error: 'Password must not exceed 128 characters',
      }),
  })
  .strict();

export type ResetPasswordRequestBody = z.infer<typeof resetPasswordRequestSchema>;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

export const resetPasswordRouteSchema = {
  description: 'Reset a user password using a password reset token',

  tags: ['Authentication'],

  body: {
    type: 'object',
    additionalProperties: false,

    required: ['token', 'newPassword'],

    properties: {
      token: {
        type: 'string',
        minLength: 1,
        maxLength: 512,
      },

      newPassword: {
        type: 'string',
        minLength: 12,
        maxLength: 128,
      },
    },
  },

  response: {
    204: {
      type: 'null',
    },

    400: errorResponseSchema,
    409: errorResponseSchema,
  },
} as const;
