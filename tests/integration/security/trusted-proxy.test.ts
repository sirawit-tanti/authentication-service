import type { FastifyInstance, FastifyRequest } from 'fastify';

import { buildApplication } from '@/app.js';
import { createRequestAuditContext } from '@/interfaces/http/auditing/request-audit-context.js';

interface AuditContextResponse {
  requestId?: string;

  ipAddress?: string;

  userAgent?: string;
}

async function createApplication(trustProxy: boolean | number): Promise<FastifyInstance> {
  const application = await buildApplication({
    logger: false,

    registerInfrastructure: false,

    trustProxy,
  });

  application.get('/test/audit-context', (request: FastifyRequest): AuditContextResponse =>
    createRequestAuditContext(request),
  );

  await application.ready();

  return application;
}

describe('Trusted proxy configuration', () => {
  let application: FastifyInstance | null = null;

  afterEach(async (): Promise<void> => {
    if (application !== null) {
      await application.close();

      application = null;
    }
  });

  it('ignores a spoofed forwarded IP when proxy trust is disabled', async () => {
    application = await createApplication(false);

    const response = await application.inject({
      method: 'GET',

      url: '/test/audit-context',

      headers: {
        'x-forwarded-for': '203.0.113.50',

        'x-request-id': 'untrusted-proxy-request',

        'user-agent': 'Vitest Proxy Client',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      requestId: 'untrusted-proxy-request',

      ipAddress: '127.0.0.1',

      userAgent: 'Vitest Proxy Client',
    });
  });

  it('uses the forwarded client IP when one proxy hop is trusted', async () => {
    application = await createApplication(1);

    const response = await application.inject({
      method: 'GET',

      url: '/test/audit-context',

      headers: {
        'x-forwarded-for': '203.0.113.50',

        'x-request-id': 'trusted-proxy-request',

        'user-agent': 'Vitest Proxy Client',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      requestId: 'trusted-proxy-request',

      ipAddress: '203.0.113.50',

      userAgent: 'Vitest Proxy Client',
    });
  });

  it('selects the client address according to the trusted hop count', async () => {
    application = await createApplication(1);

    const response = await application.inject({
      method: 'GET',

      url: '/test/audit-context',

      headers: {
        'x-forwarded-for': '198.51.100.10, 203.0.113.20',

        'x-request-id': 'proxy-chain-request',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<AuditContextResponse>();

    expect(body.requestId).toBe('proxy-chain-request');

    expect(body.ipAddress).toBe('203.0.113.20');
  });
});
