export const authorizationRouteSchema = {
  tags: ['Authentication'],

  summary: 'Get current user authorization',

  description:
    'Returns active roles and permissions for the authenticated user in the current application.',

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

          const: true,
        },

        data: {
          type: 'object',

          additionalProperties: false,

          required: ['roles', 'permissions'],

          properties: {
            roles: {
              type: 'array',

              items: {
                type: 'string',
              },
            },

            permissions: {
              type: 'array',

              items: {
                type: 'string',
              },
            },
          },
        },
      },
    },

    401: {
      type: 'object',

      additionalProperties: false,

      required: ['success', 'error'],

      properties: {
        success: {
          type: 'boolean',

          const: false,
        },

        error: {
          type: 'object',

          additionalProperties: false,

          required: ['code', 'message'],

          properties: {
            code: {
              type: 'string',
            },

            message: {
              type: 'string',
            },
          },
        },
      },
    },
  },
} as const;
