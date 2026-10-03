import { chatRuntime } from '@/lib/chat-server';
import { signedInUser, FlowError } from '@/lib/account-identity';
export function testEnabled(request: Request) {
 return ['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname) && (chatRuntime() as unknown as { E2E_TEST_MODE?: string }).E2E_TEST_MODE === '1';
}
export function requireTest(request: Request) { if (!testEnabled(request)) throw new FlowError('测试模式未启用。',403); }
export function sessionId(request: Request) { const id=request.headers.get('x-kk-session-id'); return id && /^[a-f0-9-]{36}$/.test(id)?id:null; }
export async function record(request: Request, event: string, detail: unknown={}, ids: {message_id?:string;trace_id?:string;order_id?:string; id?:string}={}, source='backend') {
 const session=sessionId(request); if (!testEnabled(request)||!session) return;
 try { await chatRuntime().DB.prepare('INSERT INTO e2e_events (id, source, event, user_id, session_id, message_id, trace_id, order_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(ids.id??crypto.randomUUID(),source,event,signedInUser(request)?.id??null,session,ids.message_id??null,ids.trace_id??null,ids.order_id??null,JSON.stringify(detail).slice(0,6000),new Date().toISOString()).run(); } catch { console.error('E2E_EVENT_SAVE_FAILED',event); }
}
