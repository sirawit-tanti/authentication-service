import type { FastifyInstance } from 'fastify';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM';

export interface GracefulShutdownOptions {
  application: Pick<FastifyInstance, 'close' | 'log'>;

  timeoutMilliseconds: number;

  setExitCode?: (exitCode: number) => void;
}

export type GracefulShutdownHandler = (signal: ShutdownSignal) => Promise<void>;

function createShutdownTimeout(timeoutMilliseconds: number): {
  promise: Promise<never>;
  cancel(): void;
} {
  let timeout: NodeJS.Timeout | undefined;

  const promise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Graceful shutdown exceeded ${String(timeoutMilliseconds)} milliseconds`));
    }, timeoutMilliseconds);

    timeout.unref();
  });

  return {
    promise,

    cancel(): void {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    },
  };
}

export function createGracefulShutdownHandler(
  options: GracefulShutdownOptions,
): GracefulShutdownHandler {
  if (!Number.isInteger(options.timeoutMilliseconds) || options.timeoutMilliseconds <= 0) {
    throw new RangeError('Graceful shutdown timeout must be a positive integer');
  }

  const setExitCode =
    options.setExitCode ??
    ((exitCode: number): void => {
      process.exitCode = exitCode;
    });

  let shutdownPromise: Promise<void> | undefined;

  return function shutdown(signal: ShutdownSignal): Promise<void> {
    shutdownPromise ??= performShutdown(signal);

    return shutdownPromise;
  };

  async function performShutdown(signal: ShutdownSignal): Promise<void> {
    options.application.log.info(
      {
        signal,

        timeoutMilliseconds: options.timeoutMilliseconds,
      },
      'Authentication service shutdown started',
    );

    const timeout = createShutdownTimeout(options.timeoutMilliseconds);

    try {
      await Promise.race([options.application.close(), timeout.promise]);

      options.application.log.info(
        {
          signal,
        },
        'Authentication service stopped gracefully',
      );

      setExitCode(0);
    } catch (error: unknown) {
      options.application.log.error(
        {
          err: error,
          signal,
        },
        'Authentication service graceful shutdown failed',
      );

      setExitCode(1);
    } finally {
      timeout.cancel();
    }
  }
}
