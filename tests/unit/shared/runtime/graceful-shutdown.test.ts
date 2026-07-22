import type { FastifyInstance } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { createGracefulShutdownHandler } from '../../../../src/shared/runtime/graceful-shutdown.js';

interface TestApplication {
  close: ReturnType<typeof vi.fn>;

  log: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
}

function createApplication(): TestApplication {
  return {
    close: vi.fn().mockResolvedValue(undefined),

    log: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
}

function asFastifyApplication(
  application: TestApplication,
): Pick<FastifyInstance, 'close' | 'log'> {
  return application as unknown as Pick<FastifyInstance, 'close' | 'log'>;
}

describe('createGracefulShutdownHandler', () => {
  it('closes the application and sets a successful exit code', async () => {
    const application = createApplication();

    const setExitCode = vi.fn();

    const shutdown = createGracefulShutdownHandler({
      application: asFastifyApplication(application),

      timeoutMilliseconds: 1_000,

      setExitCode,
    });

    await shutdown('SIGTERM');

    expect(application.close).toHaveBeenCalledOnce();

    expect(setExitCode).toHaveBeenCalledWith(0);

    expect(application.log.info).toHaveBeenCalledWith(
      {
        signal: 'SIGTERM',
      },
      'Authentication service stopped gracefully',
    );

    expect(application.log.error).not.toHaveBeenCalled();
  });

  it('performs shutdown only once when multiple signals arrive', async () => {
    const application = createApplication();

    const shutdown = createGracefulShutdownHandler({
      application: asFastifyApplication(application),

      timeoutMilliseconds: 1_000,

      setExitCode: vi.fn(),
    });

    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT'), shutdown('SIGTERM')]);

    expect(application.close).toHaveBeenCalledOnce();
  });

  it('sets a failure exit code when closing fails', async () => {
    const application = createApplication();

    const closeError = new Error('Close failed');

    application.close.mockRejectedValue(closeError);

    const setExitCode = vi.fn();

    const shutdown = createGracefulShutdownHandler({
      application: asFastifyApplication(application),

      timeoutMilliseconds: 1_000,

      setExitCode,
    });

    await shutdown('SIGINT');

    expect(setExitCode).toHaveBeenCalledWith(1);

    expect(application.log.error).toHaveBeenCalledWith(
      {
        err: closeError,
        signal: 'SIGINT',
      },
      'Authentication service graceful shutdown failed',
    );
  });

  it('rejects an invalid shutdown timeout', () => {
    const application = createApplication();

    expect(() => {
      createGracefulShutdownHandler({
        application: asFastifyApplication(application),

        timeoutMilliseconds: 0,
      });
    }).toThrow('Graceful shutdown timeout must be a positive integer');
  });
});
