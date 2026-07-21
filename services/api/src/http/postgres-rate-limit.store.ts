import type {
  ClientRateLimitInfo,
  Options,
  Store,
} from "express-rate-limit";
import { prismaAdmin } from "../db/prisma";

type RateLimitRow = {
  total_hits: number;
  reset_at: Date;
};

/** A Cloud Run-safe rate-limit store shared by every API instance. */
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60_000;

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const rows = await prismaAdmin.$queryRaw<RateLimitRow[]>`
      SELECT hits AS total_hits, reset_at
      FROM receipt_parse_rate_limits
      WHERE key = ${key} AND reset_at > NOW()
    `;
    const row = rows[0];
    return row
      ? { totalHits: Number(row.total_hits), resetTime: row.reset_at }
      : undefined;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const rows = await prismaAdmin.$queryRaw<RateLimitRow[]>`
      INSERT INTO receipt_parse_rate_limits (key, hits, reset_at)
      VALUES (
        ${key},
        1,
        NOW() + (${this.windowMs} * INTERVAL '1 millisecond')
      )
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE
          WHEN receipt_parse_rate_limits.reset_at <= NOW() THEN 1
          ELSE receipt_parse_rate_limits.hits + 1
        END,
        reset_at = CASE
          WHEN receipt_parse_rate_limits.reset_at <= NOW()
            THEN NOW() + (${this.windowMs} * INTERVAL '1 millisecond')
          ELSE receipt_parse_rate_limits.reset_at
        END
      RETURNING hits AS total_hits, reset_at
    `;
    const row = rows[0];
    if (!row) {
      throw new Error("Receipt rate-limit counter could not be updated");
    }
    return { totalHits: Number(row.total_hits), resetTime: row.reset_at };
  }

  async decrement(key: string): Promise<void> {
    await prismaAdmin.$executeRaw`
      UPDATE receipt_parse_rate_limits
      SET hits = GREATEST(hits - 1, 0)
      WHERE key = ${key} AND reset_at > NOW()
    `;
  }

  async resetKey(key: string): Promise<void> {
    await prismaAdmin.$executeRaw`
      DELETE FROM receipt_parse_rate_limits WHERE key = ${key}
    `;
  }
}
