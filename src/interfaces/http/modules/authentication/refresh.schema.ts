import { z } from 'zod';

export const refreshRequestSchema = z
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

export type RefreshRequestBody = z.infer<typeof refreshRequestSchema>;

export const refreshRouteSchema = {
  description: 'Rotate a refresh token and issue a new token pair',

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
          required: ['sessionId', 'tokens'],

          properties: {
            sessionId: {
              type: 'string',
              format: 'uuid',
            },

            tokens: {
              type: 'object',
              additionalProperties: false,

              required: [
                'accessToken',
                'refreshToken',
                'tokenType',
                'accessTokenExpiresInSeconds',
                'refreshTokenExpiresAt',
              ],

              properties: {
                accessToken: {
                  type: 'string',
                },

                refreshToken: {
                  type: 'string',
                },

                tokenType: {
                  type: 'string',
                  enum: ['Bearer'],
                },

                accessTokenExpiresInSeconds: {
                  type: 'integer',
                  minimum: 1,
                },

                refreshTokenExpiresAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
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
  },
} as const;
