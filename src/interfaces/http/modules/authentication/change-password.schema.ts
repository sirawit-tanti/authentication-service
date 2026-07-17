import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(12, {
    error: 'Password must contain at least 12 characters',
  })
  .max(128, {
    error: 'Password must not exceed 128 characters',
  });

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, {
        error: 'Current password is required',
      })
      .max(128, {
        error: 'Current password must not exceed 128 characters',
      }),

    newPassword: passwordSchema,
  })
  .strict();

export type ChangePasswordRequestBody = z.infer<typeof changePasswordRequestSchema>;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

export const changePasswordRouteSchema = {
  description: 'Change the authenticated user password and revoke other sessions',

  tags: ['Authentication'],

  security: [
    {
      bearerAuth: [],
    },
  ],

  body: {
    type: 'object',
    additionalProperties: false,

    required: ['currentPassword', 'newPassword'],

    properties: {
      currentPassword: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
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
    401: errorResponseSchema,
    409: errorResponseSchema,
  },
} as const;
