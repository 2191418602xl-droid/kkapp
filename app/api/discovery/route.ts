import { emptyDiscovery, updateDiscovery, type DiscoveryState } from '@/lib/discovery';
import { discoveryDatabase } from '@/lib/discovery-server';
import { resourceOwner, ownerHeaders } from '@/lib/account-identity';

function identity(request: Request) {
  return resourceOwner(request);
}
function respond(request: Request, visitor: string, data: unknown, status = 200) {
  return Response.json(data, { status, headers: ownerHeaders(request, visitor) });
}
function visible(state: DiscoveryState) {
  return { ...state, letters: state.letters.map(e => e.openAt && Date.parse(e.openAt) > Date.now() ? { ...e, text: '' } : e) };
}
async function read(visitor: string) {
  const row = await discoveryDatabase().prepare('SELECT data FROM discovery_progress WHERE visitor = ?').bind(visitor).first<{ data: string }>();
  return row ? JSON.parse(row.data) as DiscoveryState : emptyDiscovery();
}
export async function GET(request: Request) {
  const visitor = identity(request);
  try { return respond(request, visitor, visible(await read(visitor))); }
  catch { return respond(request, visitor, { error: '暂时无法加载，请重试。' }, 503); }
}
export async function POST(request: Request) {
  const visitor = identity(request);
  if (request.headers.get('origin') !== new URL(request.url).origin) return respond(request, visitor, { error: '请求来源无效。' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return respond(request, visitor, { error: '消息格式不正确。' }, 415);
  let input: Record<string, unknown>;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    let raw = '', size = 0; const decoder = new TextDecoder();
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 16000) { await reader.cancel(); return respond(request, visitor, { error: '内容太长。' }, 413); }
      raw += decoder.decode(value, { stream: true }); }
    input = JSON.parse(raw + decoder.decode());
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
  } catch { return respond(request, visitor, { error: '内容格式不正确。' }, 400); }
  try {
    const current = await read(visitor);
    if (input.revision !== current.revision) return respond(request, visitor, { error: '内容已在其他页面更新，请重新加载后操作。' }, 409);
    let next: DiscoveryState;
    try { next = updateDiscovery(current, input); }
    catch (e) { return respond(request, visitor, { error: e instanceof Error ? e.message : '内容有误。' }, 400); }
    const result = await discoveryDatabase().prepare(`INSERT INTO discovery_progress (visitor, revision, data) VALUES (?, ?, ?)
      ON CONFLICT(visitor) DO UPDATE SET revision = excluded.revision, data = excluded.data
      WHERE discovery_progress.revision = ? RETURNING revision`).bind(visitor, next.revision, JSON.stringify(next), current.revision).first();
    if (!result) return respond(request, visitor, { error: '保存冲突，请重新加载后重试。' }, 409);
    return respond(request, visitor, visible(next));
  } catch { return respond(request, visitor, { error: '保存失败，内容仍保留在输入框中，请重试。' }, 503); }
}
