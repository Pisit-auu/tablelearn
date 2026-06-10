type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(request: Request, key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const bucketKey = `${key}:${client}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    cleanupBuckets(now);
    return null;
  }

  bucket.count += 1;

  if (bucket.count > limit) {
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
