import { MediaError, checkMediaRequest, mediaFailure, mediaIdentity, mediaImageUrl, mediaJson, mediaRuntime, readMediaBody } from '@/lib/multimodal-server';

export async function POST(request: Request) {
  const visitor = mediaIdentity(request);
  try {
    checkMediaRequest(request, 'image/png');
    const bytes = await readMediaBody(request.body, 8_000_000);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value) || new TextDecoder().decode(bytes.slice(12, 16)) !== 'IHDR') throw new MediaError('角色头像不是有效的 PNG 图片。');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (width < 64 || height < 64 || width > 4096 || height > 4096 || width * height > 12_000_000) throw new MediaError('角色头像尺寸需在 64 至 4096 像素之间。');
    const runtime = mediaRuntime();
    if (!runtime.MEDIA) throw new MediaError('头像存储尚未启用，请联系管理员。', 503);
    const count = await runtime.DB.prepare('SELECT COUNT(*) AS count FROM generated_images WHERE visitor = ?').bind(visitor).first<{count:number}>();
    if ((count?.count ?? 0) >= 30) throw new MediaError('当前图片库已达到 30 张上限，请先使用默认头像。', 409);
    const id = crypto.randomUUID(), createdAt = new Date().toISOString(), key = `images/${visitor}/${id}`;
    await runtime.MEDIA.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });
    try {
      const saved = await runtime.DB.prepare('INSERT INTO generated_images (id, visitor, prompt, size, mime, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM generated_images WHERE visitor = ?) < 30 RETURNING id').bind(id, visitor, '导入角色卡头像', `${width}x${height}`, 'image/png', createdAt, visitor).first();
      if (!saved) throw new MediaError('当前图片库已达到 30 张上限，请先使用默认头像。', 409);
    } catch (error) { await runtime.MEDIA.delete(key); throw error; }
    return mediaJson(request, visitor, { image: { id, url: mediaImageUrl(id), width, height } }, 201);
  } catch (error) { return mediaFailure(request, visitor, error); }
}
