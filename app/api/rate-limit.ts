type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function clientKeyFromHeaders(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headers.get("x-real-ip") || "unknown";
}

/** Counts one hit for `key:client` and reports whether it is over `limit` in the window. */
export function isRateLimited(bucketKey: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    cleanupBuckets(now);
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

export function rateLimit(request: Request, key: string, limit = 60, windowMs = 60_000) {
  if (isRateLimited(`${key}:${clientKeyFromHeaders(request.headers)}`, limit, windowMs)) {
    return Response.json({ error: "เรียกใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง" }, { status: 429 });
  }

  return null;
}

function cleanupBuckets(now: number) {
  if (buckets.size < 500) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
