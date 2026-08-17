---
name: redis-caching-patterns
description: >-
  Use this skill when implementing Redis caching strategies, rate limiters (sliding window),
  session stores, distributed locks (Redlock), pub/sub messaging, and cache invalidation.
---

# Redis Caching & Distributed Patterns Skill

Best practices for leveraging Redis in modern high-throughput backend applications.

---

## 1. Core Caching Patterns

### Cache-Aside (Lazy Loading)

```ts
async function getCachedExam(examId: string, ttlSeconds = 3600): Promise<Exam> {
  const cacheKey = `exam:${examId}`;

  // 1. Try Cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Fetch from DB
  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) {
    // Cache null with short TTL (e.g. 60s) to prevent Cache Penetration
    await redis.set(cacheKey, JSON.stringify(null), "EX", 60);
    throw new NotFoundError("Exam not found");
  }

  // 3. Populate Cache with Jitter to prevent Cache Stampede
  const jitter = Math.floor(Math.random() * 300); // 0-300s variance
  await redis.set(cacheKey, JSON.stringify(exam), "EX", ttlSeconds + jitter);

  return exam;
}
```

---

## 2. Sliding Window Rate Limiter (Lua Script)

Execute rate limiting atomically in Redis using sorted sets (`ZSET`):

```lua
-- KEYS[1]: rate limit key (e.g. "ratelimit:user_123:submit")
-- ARGV[1]: current timestamp in milliseconds
-- ARGV[2]: window size in milliseconds (e.g. 60000)
-- ARGV[3]: max allowed requests (e.g. 10)

local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

-- Remove timestamps older than window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

-- Count current requests in window
local currentRequests = redis.call('ZCARD', key)

if currentRequests < limit then
  -- Add current request
  redis.call('ZADD', key, now, now)
  redis.call('PEXPIRE', key, window)
  return 1 -- Allowed
else
  return 0 -- Rejected / Rate Limited
end
```

---

## 3. Key Naming & Memory Management

- **Key Format**: `namespace:resource_type:id:sub_resource` (e.g., `onthilab:attempt:att_123:answers`).
- **Always Set TTL**: Every cache key should have an explicit Time-To-Live (TTL) to avoid memory exhaustion.
- **Eviction Policy**: Use `allkeys-lru` or `volatile-lru` in `redis.conf` for cache workloads.
