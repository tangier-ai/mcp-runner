import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

interface RateLimitRecord {
  failedAttempts: number;
  lastFailure: number;
  blockedUntil?: number;
  blockCount: number;
}

@Injectable()
export class RateLimiterService {
  private readonly attempts = new Map<string, RateLimitRecord>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly baseBlockDurationMs = 60 * 1000; // 1 minute base block
  private readonly maxBlockDurationMs = 60 * 60 * 1000; // 1 hour max block

  isBlocked(ip: string): boolean {
    const record = this.attempts.get(ip);
    if (!record) return false;

    const now = Date.now();

    // Check if still blocked
    if (record.blockedUntil && now < record.blockedUntil) {
      return true;
    }

    // If block period expired, reset to unblocked state but keep block count
    if (record.blockedUntil && now >= record.blockedUntil) {
      record.blockedUntil = undefined;
      record.failedAttempts = 0;
      this.attempts.set(ip, record);
      return false;
    }

    return false;
  }

  recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const record = this.attempts.get(ip);

    if (!record) {
      this.attempts.set(ip, {
        failedAttempts: 1,
        lastFailure: now,
        blockCount: 0,
      });
      return;
    }

    // Reset counter if outside window (but keep block count for exponential backoff)
    if (now - record.lastFailure > this.windowMs && !record.blockedUntil) {
      record.failedAttempts = 1;
      record.lastFailure = now;
      this.attempts.set(ip, record);
      return;
    }

    // Increment failed attempts
    record.failedAttempts++;
    record.lastFailure = now;

    // Block if exceeded max attempts with exponential backoff
    if (record.failedAttempts >= this.maxAttempts) {
      record.blockCount++;
      const blockDuration = Math.min(
        this.baseBlockDurationMs * Math.pow(2, record.blockCount - 1),
        this.maxBlockDurationMs,
      );
      record.blockedUntil = now + blockDuration;
    }

    this.attempts.set(ip, record);
  }

  clearSuccessfulAttempt(ip: string): void {
    this.attempts.delete(ip);
  }

  // Cleanup expired records every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.attempts.entries()) {
      if (record.blockedUntil && now >= record.blockedUntil) {
        this.attempts.delete(ip);
      } else if (
        !record.blockedUntil &&
        now - record.lastFailure > this.windowMs
      ) {
        this.attempts.delete(ip);
      }
    }
  }
}
