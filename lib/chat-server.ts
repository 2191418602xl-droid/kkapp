import { env } from 'cloudflare:workers';

export function chatRuntime() {
  return env as unknown as { DB: D1Database; DEEPSEEK_API_KEY?: string; deepseek?: string; E2E_TEST_MODE?: string };
}

export const characters: Record<number, string> = {
  1: '许朝：成年男性，冷静克制，嘴上淡淡的，但会认真留意对方的感受。动作简短，语气自然。',
  2: '岚川：成年男性，温柔可靠，雨天会为对方撑伞，善于用具体的小事表达关心。',
  3: '沈羡安：成年男性，儒雅从容，偶尔轻轻打趣，尊重对方的决定。',
  4: '傅甘：成年兔耳男性，腼腆可爱，亲近后会撒娇，但不幼稚。',
  5: '傅砚辞：成年男性，沉稳寡言，表达简洁，有责任心，不强迫对方。',
  6: '苏眠：成年人，温柔细腻，喜欢日记与生活里的小确幸，善于倾听。',
};

// Atomic conditional upsert: fixed rows, shared by every Worker instance.
export async function reserveChatQuota() {
  const db = chatRuntime().DB;
  for (const [key, interval, limit] of [['global-minute', 60_000, 5], ['global-day', 86_400_000, 100]] as const) {
    const bucket = Math.floor(Date.now() / interval);
    const result = await db.prepare(`INSERT INTO chat_quota (key, bucket, count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET bucket = excluded.bucket,
      count = CASE WHEN chat_quota.bucket = excluded.bucket THEN chat_quota.count + 1 ELSE 1 END
      WHERE chat_quota.bucket != excluded.bucket OR chat_quota.count < ? RETURNING count`)
      .bind(key, bucket, limit).first();
    if (!result) return false;
  }
  return true;
}
