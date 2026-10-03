import { mediaRuntime } from '@/lib/multimodal-server';
import { resourceOwner } from '@/lib/account-identity';
export async function GET(request: Request, { params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const visitor = resourceOwner(request);
  if (!visitor || !/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  try {
    const runtime = mediaRuntime();
    const row = await runtime.DB.prepare('SELECT mime FROM generated_images WHERE id = ? AND visitor = ?').bind(id, visitor).first<{mime:string}>();
    if (!row) return new Response(null, { status: 404 });
    const object = await runtime.MEDIA?.get(`images/${visitor}/${id}`);
    if (!object) return new Response(null, { status: 404 });
    return new Response(object.body, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `inline; filename="kirakira-${id}.${row.mime.split('/')[1]}"` } });
  } catch { return new Response(null, { status: 503 }); }
}
