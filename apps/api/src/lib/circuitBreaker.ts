import { AppError } from './errors.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  openMs: number;
  halfOpenMaxCalls: number;
  now?: () => number;
}

export interface CircuitBreakerSnapshot {
  state: CircuitState;
  consecutiveFail: number;
  successCount: number;
  failureCount: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

export class CircuitBreaker {
  readonly name: string;
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly now: () => number;

  private state: CircuitState = 'closed';
  private consecutiveFail = 0;
  private successCount = 0;
  private failureCount = 0;
  private lastSuccessAt: number | null = null;
  private lastFailureAt: number | null = null;
  private openedAt: number | null = null;
  private halfOpenCalls = 0;

  constructor(name: string, options: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options.failureThreshold;
    this.openMs = options.openMs;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls;
    this.now = options.now ?? Date.now;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    this.transitionIfNeeded();

    if (this.state === 'open') {
      throw AppError.circuitOpen(this.name);
    }

    if (this.state === 'half_open') {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        throw AppError.circuitOpen(this.name);
      }
      this.halfOpenCalls += 1;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  getSnapshot(): CircuitBreakerSnapshot {
    this.transitionIfNeeded();
    return {
      state: this.state,
      consecutiveFail: this.consecutiveFail,
      successCount: this.successCount,
      failureCount: this.failureCount,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
    };
  }

  private transitionIfNeeded(): void {
    if (this.state === 'open' && this.openedAt !== null) {
      if (this.now() - this.openedAt >= this.openMs) {
        this.state = 'half_open';
        this.halfOpenCalls = 0;
      }
    }
  }

  private onSuccess(): void {
    this.successCount += 1;
    this.consecutiveFail = 0;
    this.lastSuccessAt = this.now();
    this.state = 'closed';
    this.openedAt = null;
    this.halfOpenCalls = 0;
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.consecutiveFail += 1;
    this.lastFailureAt = this.now();

    if (this.state === 'half_open') {
      this.state = 'open';
      this.openedAt = this.now();
      this.halfOpenCalls = 0;
      return;
    }

    if (this.consecutiveFail >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = this.now();
    }
  }
}
