/** Tiny TTL cache + token-bucket limiter to respect provider rate limits. */

interface Entry<T> {
  value: T;
  expires: number;
}

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

/** Simple token bucket: `rate` tokens per `intervalMs`, waits when empty. */
export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly rate: number,
    private readonly intervalMs: number,
  ) {
    this.tokens = rate;
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise((r) => setTimeout(r, this.intervalMs / this.rate));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.last;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.rate, this.tokens + (elapsed / this.intervalMs) * this.rate);
    this.last = now;
  }
}
