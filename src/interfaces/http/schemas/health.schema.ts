const healthDependencySchema = {
  type: 'object',

  additionalProperties: false,

  required: ['status'],

  properties: {
    status: {
      type: 'string',

      enum: ['connected', 'unavailable', 'timeout', 'not_checked'],
    },

    responseTimeMilliseconds: {
      type: 'integer',
      minimum: 0,
    },
  },
} as const;

const readinessResponseSchema = {
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

      required: ['status', 'timestamp', 'dependencies'],

      properties: {
        status: {
          type: 'string',

          enum: ['ready', 'not_ready'],
        },

        timestamp: {
          type: 'string',
        },

        dependencies: {
          type: 'object',

          additionalProperties: false,

          required: ['postgresql', 'redis'],

          properties: {
            postgresql: healthDependencySchema,

            redis: healthDependencySchema,
          },
        },
      },
    },
  },
} as const;

export const livenessRouteSchema = {
  description: 'Confirm that the authentication service process is alive',

  tags: ['Health'],

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

          required: ['status', 'timestamp', 'uptimeSeconds'],

          properties: {
            status: {
              type: 'string',
              enum: ['alive'],
            },

            timestamp: {
              type: 'string',
            },

            uptimeSeconds: {
              type: 'integer',
              minimum: 0,
            },
          },
        },
      },
    },
  },
} as const;

export const readinessRouteSchema = {
  description: 'Confirm that the authentication service and its dependencies are ready',

  tags: ['Health'],

  response: {
    200: readinessResponseSchema,

    503: readinessResponseSchema,
  },
} as const;
