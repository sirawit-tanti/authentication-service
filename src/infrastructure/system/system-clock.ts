import type { Clock } from '@/application/ports/system/clock.js';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
