import { env } from 'cloudflare:workers';
// On hosted Sites these headers are supplied by the authenticated dispatch layer.
// Never accept identity from a request body, query parameter or browser storage.
export function signedInUser(request: Request) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!id || !email || id.length > 256 || email.length > 320) return null;
  let name = '';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(request.headers.get('oai-authenticated-user-full-name') || ''); } catch {}
  }
  const session=request.headers.get('x-kk-session-id');
  const localTest=['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname)&&session&&/^[a-f0-9-]{36}$/.test(session)&&(env as unknown as {E2E_TEST_MODE?:string}).E2E_TEST_MODE==='1';
  return { id:localTest?`${id}:e2e:${session}`:id, name: name.trim().slice(0, 40) || '星光旅人' };
}
export const signInPath = '/signin-with-chatgpt?return_to=%2F%3Fwelcome%3D1';
export const signOutPath = '/signout-with-chatgpt?return_to=%2F';

export function resourceOwner(request: Request) {
  const user = signedInUser(request);
  return user ? `account:${user.id}` : request.headers.get('cookie')?.match(/(?:^|;\s*)kk_discovery=([a-f0-9-]{36})(?:;|$)/)?.[1] ?? crypto.randomUUID();
}

export function ownerHeaders(request: Request, owner: string) {
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, oai-authenticated-user-id' };
  if (!owner.startsWith('account:')) headers['Set-Cookie'] = `kk_discovery=${owner}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  return headers;
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, oai-authenticated-user-id' } });
}

export class FlowError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function flowInput(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new FlowError('请求来源无效。', 403);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new FlowError('请使用 JSON 请求。', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new FlowError('请求内容为空。');
  let size = 0, raw = ''; const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 16000) { await reader.cancel(); throw new FlowError('内容过长。', 413); }
      raw += decoder.decode(value, { stream: true });
    }
    const input: unknown = JSON.parse(raw + decoder.decode());
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    return input as Record<string, unknown>;
  } catch (e) { if (e instanceof FlowError) throw e; throw new FlowError('请求格式不正确。'); }
  finally { reader.releaseLock(); }
}
