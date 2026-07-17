import { z } from 'zod';

export const revokeSessionParamsSchema = z.object({
  sessionId: z.uuid(),
});

export type RevokeSessionParams = z.infer<typeof revokeSessionParamsSchema>;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: true,
} as const;

export const listSessionsRouteSchema = {
  description: 'List authentication sessions owned by the current user',

  tags: ['Authentication'],

  security: [
    {
      bearerAuth: [],
    },
  ],

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
          required: ['sessions'],

          properties: {
            sessions: {
              type: 'array',

              items: {
                type: 'object',
                additionalProperties: false,

                required: [
                  'sessionId',
                  'applicationId',
                  'deviceId',
                  'status',
                  'ipAddress',
                  'userAgent',
                  'lastActivityAt',
                  'expiresAt',
                  'revokedAt',
                  'revokeReason',
                  'createdAt',
                  'current',
                ],

                properties: {
                  sessionId: {
                    type: 'string',
                    format: 'uuid',
                  },

                  applicationId: {
                    type: 'string',
                    format: 'uuid',
                  },

                  deviceId: {
                    anyOf: [
                      {
                        type: 'string',
                        format: 'uuid',
                      },
                      {
                        type: 'null',
                      },
                    ],
                  },

                  status: {
                    type: 'string',
                    enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
                  },

                  ipAddress: {
                    anyOf: [
                      {
                        type: 'string',
                      },
                      {
                        type: 'null',
                      },
                    ],
                  },

                  userAgent: {
                    anyOf: [
                      {
                        type: 'string',
                      },
                      {
                        type: 'null',
                      },
                    ],
                  },

                  lastActivityAt: {
                    type: 'string',
                    format: 'date-time',
                  },

                  expiresAt: {
                    type: 'string',
                    format: 'date-time',
                  },

                  revokedAt: {
                    anyOf: [
                      {
                        type: 'string',
                        format: 'date-time',
                      },
                      {
                        type: 'null',
                      },
                    ],
                  },

                  revokeReason: {
                    anyOf: [
                      {
                        type: 'string',
                      },
                      {
                        type: 'null',
                      },
                    ],
                  },

                  createdAt: {
                    type: 'string',
                    format: 'date-time',
                  },

                  current: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        },
      },
    },

    401: errorResponseSchema,
  },
} as const;

export const revokeSessionRouteSchema = {
  description: 'Revoke an authentication session owned by the current user',

  tags: ['Authentication'],

  security: [
    {
      bearerAuth: [],
    },
  ],

  params: {
    type: 'object',
    additionalProperties: false,
    required: ['sessionId'],

    properties: {
      sessionId: {
        type: 'string',
        format: 'uuid',
      },
    },
  },

  response: {
    204: {
      type: 'null',
    },

    400: errorResponseSchema,
    401: errorResponseSchema,
  },
} as const;
