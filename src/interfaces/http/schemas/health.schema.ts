const successResponseProperties = {
  success: {
    type: 'boolean',
    enum: [true],
  },

  message: {
    type: 'string',
  },
} as const;

export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'message', 'data'],

  properties: {
    ...successResponseProperties,

    data: {
      type: 'object',
      additionalProperties: false,
      required: ['service', 'status', 'timestamp', 'uptime'],

      properties: {
        service: {
          type: 'string',
        },

        status: {
          type: 'string',
          enum: ['healthy'],
        },

        timestamp: {
          type: 'string',
          format: 'date-time',
        },

        uptime: {
          type: 'number',
          minimum: 0,
        },
      },
    },
  },
} as const;

export const livenessResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'message', 'data'],

  properties: {
    ...successResponseProperties,

    data: {
      type: 'object',
      additionalProperties: false,
      required: ['service', 'status', 'timestamp', 'uptime'],

      properties: {
        service: {
          type: 'string',
        },

        status: {
          type: 'string',
          enum: ['healthy'],
        },

        timestamp: {
          type: 'string',
          format: 'date-time',
        },

        uptime: {
          type: 'number',
          minimum: 0,
        },
      },
    },
  },
} as const;

export const readinessResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'message', 'data'],

  properties: {
    ...successResponseProperties,

    data: {
      type: 'object',
      additionalProperties: false,
      required: ['service', 'status', 'dependencies', 'timestamp'],

      properties: {
        service: {
          type: 'string',
        },

        status: {
          type: 'string',
          enum: ['ready'],
        },

        dependencies: {
          type: 'object',
          additionalProperties: false,
          required: ['database'],

          properties: {
            database: {
              type: 'string',
              enum: ['connected'],
            },
          },
        },

        timestamp: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
  },
} as const;
