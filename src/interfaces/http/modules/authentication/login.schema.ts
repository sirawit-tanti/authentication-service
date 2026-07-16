import { z } from 'zod';

export const loginRequestSchema = z
  .object({
    applicationId: z.uuid(),

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
  description: 'Authenticate a user and create a session',

  tags: ['Authentication'],

  body: {
    type: 'object',
    additionalProperties: false,

    required: ['applicationId', 'email', 'password'],

    properties: {
      applicationId: {
        type: 'string',
        format: 'uuid',
      },

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

          required: ['user', 'sessionId', 'tokens'],

          properties: {
            user: {
              type: 'object',
              additionalProperties: false,

              required: ['userId', 'email', 'status'],

              properties: {
                userId: {
                  type: 'string',
                  format: 'uuid',
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

    409: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const;
