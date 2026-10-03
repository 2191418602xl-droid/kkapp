import { imageSizes } from '@/lib/multimodal-shared';
import { MediaError, mediaRuntime, mediaIdentity, mediaJson, mediaInput, mediaFailure, reserveMediaQuota, readMediaBody, mediaImageUrl } from '@/lib/multimodal-server';
import { generateImageUrl, requireImageModel } from '@/lib/volcengine-media';

export async function GET(request: Request) {
  const visitor = mediaIdentity(request);
  try {
    const rows = await mediaRuntime().DB.prepare('SELECT id, prompt, size, created_at FROM generated_images WHERE visitor = ? ORDER BY created_at DESC LIMIT 30').bind(visitor).all<{id:string}>();
    return mediaJson(request, visitor, { images: rows.results.map(row => ({ ...row, url: mediaImageUrl(row.id) })) });
  } catch (error) { return mediaFailure(request, visitor, error); }
}
export async function POST(request: Request) {
  const visitor = mediaIdentity(request);
  try {
    const input = await mediaInput(request);
    if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 800 || !imageSizes.includes(input.size as typeof imageSizes[number])) throw new MediaError('请填写 1 至 800 字的画面描述并选择比例。');
    requireImageModel(); const runtime = mediaRuntime();
    if (!runtime.MEDIA) throw new MediaError('图片存储尚未启用，请联系管理员。', 503);
    const count = await runtime.DB.prepare('SELECT COUNT(*) AS count FROM generated_images WHERE visitor = ?').bind(visitor).first<{count:number}>();
    if ((count?.count ?? 0) >= 30) throw new MediaError('当前图片库已达到 30 张上限。', 409);
    await reserveMediaQuota('image');
    // Only download the URL returned by the authenticated provider, never a client-supplied URL.
    const url = new URL(await generateImageUrl(input.prompt.trim(), input.size as string));
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !url.hostname.includes('.') || /(^|\.)(localhost|local|internal)$/.test(url.hostname) || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) throw new MediaError('模型返回的图片地址无效。', 502);
    const file = await fetch(url.href, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!file.ok) throw new MediaError('图片下载失败，请稍后重试。', 502);
    const bytes = await readMediaBody(file.body, 10_000_000);
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
    const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : '';
    if (!mime) throw new MediaError('模型未返回有效图片，请重试。', 502);
    const id = crypto.randomUUID(), created_at = new Date().toISOString(), key = `images/${visitor}/${id}`;
    await runtime.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      const saved = await runtime.DB.prepare('INSERT INTO generated_images (id, visitor, prompt, size, mime, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM generated_images WHERE visitor = ?) < 30 RETURNING id').bind(id, visitor, input.prompt.trim(), input.size, mime, created_at, visitor).first();
      if (!saved) throw new MediaError('图片库已达到 30 张上限，本次图片未保存。', 409);
    } catch (error) { await runtime.MEDIA.delete(key); throw error; }
    return mediaJson(request, visitor, { image: { id, prompt: input.prompt.trim(), size: input.size, created_at, url: mediaImageUrl(id) } }, 201);
  } catch (error) { return mediaFailure(request, visitor, error); }
}
