import { z } from 'zod';

export const logoutRequestSchema = z
  .object({
    refreshToken: z
      .string()
      .trim()
      .min(1, {
        error: 'Refresh token is required',
      })
      .max(512, {
        error: 'Refresh token must not exceed 512 characters',
      }),
  })
  .strict();

export type LogoutRequestBody = z.infer<typeof logoutRequestSchema>;

export const logoutRouteSchema = {
  description: 'Revoke the session associated with a refresh token',

  tags: ['Authentication'],

  body: {
    type: 'object',
    additionalProperties: false,
    required: ['refreshToken'],

    properties: {
      refreshToken: {
        type: 'string',
        minLength: 1,
        maxLength: 512,
      },
    },
  },

  response: {
    204: {
      type: 'null',
    },

    400: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const;
