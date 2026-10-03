import { env } from 'cloudflare:workers';
import { resourceOwner, ownerHeaders } from '@/lib/account-identity';

export function mediaRuntime() {
  return env as unknown as { DB: D1Database; MEDIA?: R2Bucket; SILICONFLOW_API_KEY?: string;
    SILICONFLOW_IMAGE_MODEL?: string; SILICONFLOW_TTS_MODEL?: string; SILICONFLOW_ASR_MODEL?: string;
    ARK_API_KEY?: string; ARK_IMAGE_MODEL?: string; DOUBAO_SPEECH_API_KEY?: string;
    DOUBAO_TTS_SPEAKER?: string; DOUBAO_TTS_VOICE_LABEL?: string };
}
export class MediaError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function mediaIdentity(request: Request) {
  return resourceOwner(request);
}
export function mediaJson(request: Request, visitor: string, data: unknown, status = 200) {
  return Response.json(data, { status, headers: ownerHeaders(request, visitor) });
}
export function mediaFailure(request: Request, visitor: string, error: unknown) {
  return mediaJson(request, visitor, { error: error instanceof MediaError ? error.message : '模型服务或存储暂时不可用，请稍后重试。' }, error instanceof MediaError ? error.status : 503);
}
export function checkMediaRequest(request: Request, contentType: string) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new MediaError('请求来源无效。', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== contentType) throw new MediaError('内容格式不正确。', 415);
}
// Limit actual bytes, including chunked requests with no Content-Length.
export async function readMediaBody(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) throw new MediaError('内容为空。');
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new MediaError('内容过大，请缩短后重试。', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function mediaInput(request: Request) {
  checkMediaRequest(request, 'application/json');
  const bytes = await readMediaBody(request.body, 8_000);
  try {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch { throw new MediaError('内容格式不正确。'); }
}
export function mediaKey() {
  const key = mediaRuntime().SILICONFLOW_API_KEY?.trim();
  if (!key) throw new MediaError('图片与声音模型尚未启用，等待管理员配置硅基流动服务。', 503);
  return key;
}
// Reuse the fixed quota table. Shared global limits cannot be bypassed by clearing cookies.
// Attempts count even on provider failure, keeping repeated retries bounded.
export async function reserveMediaQuota(kind: 'image' | 'audio') {
  const limits = kind === 'image' ? [2, 20] : [10, 100];
  for (const [index, interval] of [60_000, 86_400_000].entries()) {
    const result = await mediaRuntime().DB.prepare(`INSERT INTO chat_quota (key, bucket, count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET bucket = excluded.bucket,
      count = CASE WHEN chat_quota.bucket = excluded.bucket THEN chat_quota.count + 1 ELSE 1 END
      WHERE chat_quota.bucket != excluded.bucket OR chat_quota.count < ? RETURNING count`)
      .bind(`media-${kind}-${index}`, Math.floor(Date.now() / interval), limits[index]).first();
    if (!result) throw new MediaError('当前模型体验额度已用完，请稍后再试。', 429);
  }
}
export async function callMediaProvider(path: 'images/generations' | 'audio/speech' | 'audio/transcriptions', body: string | FormData, timeout: number, signal?: AbortSignal) {
  const response = await fetch(`https://api.siliconflow.cn/v1/${path}`, { method: 'POST',
    headers: { Authorization: `Bearer ${mediaKey()}`, ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}) },
    body, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new MediaError(response.status === 429 ? '模型服务繁忙，请稍后重试。' : '模型暂时无法完成请求，请联系管理员检查服务配置与可用额度。', 502);
  }
  return response;
}
export const mediaImageUrl = (id: string) => `/api/media/images/${id}`;
export async function ownsGeneratedImage(visitor: string, url: string) {
  const id = url.match(/^\/api\/media\/images\/([a-f0-9-]{36})$/)?.[1];
  return Boolean(id && await mediaRuntime().DB.prepare('SELECT id FROM generated_images WHERE id = ? AND visitor = ?').bind(id, visitor).first());
}
export function validateRecording(bytes: Uint8Array) {
  // Client exports canonical mono PCM WAV: 16 kHz / 16 bit, max 30 seconds.
  const text = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  if (bytes.length < 44) throw new MediaError('录音文件不完整，请重新录制。');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (text(0, 4) !== 'RIFF' || text(8, 12) !== 'WAVE' || text(12, 16) !== 'fmt ' || text(36, 40) !== 'data' ||
    v.getUint32(4, true) !== bytes.length - 8 || v.getUint32(16, true) !== 16 || v.getUint16(20, true) !== 1 ||
    v.getUint16(22, true) !== 1 || v.getUint32(24, true) !== 16000 || v.getUint32(28, true) !== 32000 ||
    v.getUint16(32, true) !== 2 || v.getUint16(34, true) !== 16 || v.getUint32(40, true) !== bytes.length - 44 ||
    (bytes.length - 44) % 2 || bytes.length < 3244 || bytes.length > 960044) throw new MediaError('请录制 0.1 至 30 秒的语音。');
}
