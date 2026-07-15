export interface CloseableResource {
  close(): Promise<void>;
}

export function isCloseableResource(value: unknown): value is CloseableResource {
  return (
    typeof value === 'object' &&
    value !== null &&
    'close' in value &&
    typeof value.close === 'function'
  );
}
