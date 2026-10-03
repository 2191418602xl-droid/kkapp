import { FlowError } from '@/lib/account-identity';

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };
export type ConversationAction = 'message' | 'continue' | 'rewrite';
export type UnfinishedTurn = { requestId: string; prompt: string; action: ConversationAction; status: 'pending' | 'failed' };
type Conversation = { id: string; owner: string; character_id: string; world: string; stage: number; active_request: string | null; lock_until: number; updated_at: string };
type Turn = { id: string; request_id: string; action: string; prompt: string; reply: string; status: string; attempt: number; created_at: string };
export const validCharacterId = (id: unknown): id is string | number => typeof id === 'number' ? Number.isInteger(id) && id >= 1 && id <= 6 : typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
export function worldName(value: unknown) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 100 || Array.from(value).some(char => char.charCodeAt(0) < 32)) throw new FlowError('世界信息不正确。');
  return value.trim();
}
export async function getConversation(db: D1Database, owner: string, characterId: string | number, world: string) {
  return db.prepare('SELECT * FROM conversations WHERE owner = ? AND character_id = ? AND world = ?').bind(owner, String(characterId), world).first<Conversation>();
}
export async function openConversation(db: D1Database, owner: string, characterId: string | number, world: string) {
  await db.prepare('INSERT OR IGNORE INTO conversations (id, owner, character_id, world, updated_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), owner, String(characterId), world, new Date().toISOString()).run();
  return (await getConversation(db, owner, characterId, world))!;
}
export async function conversationHistory(db: D1Database, id: string) {
  const turns = await db.prepare("SELECT * FROM conversation_turns WHERE conversation = ? AND status = 'completed' ORDER BY created_at DESC, rowid DESC LIMIT 50").bind(id).all<Turn>();
  return turns.results.reverse().flatMap(turn => [{ role: 'user' as const, content: turn.prompt }, { role: 'assistant' as const, content: turn.reply }]);
}
export async function latestUnfinishedTurn(db: D1Database, id: string): Promise<UnfinishedTurn | null> {
  // Inspect the latest turn of any status, so a completed newer turn suppresses
  // abandoned pending/failed turns rather than reviving an old retry prompt.
  const turn = await db.prepare('SELECT request_id, prompt, action, status FROM conversation_turns WHERE conversation = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').bind(id).first<Pick<Turn, 'request_id' | 'prompt' | 'action' | 'status'>>();
  if (!turn || (turn.status !== 'pending' && turn.status !== 'failed')) return null;
  return { requestId: turn.request_id, prompt: turn.prompt, action: turn.action as ConversationAction, status: turn.status };
}
export async function beginTurn(db: D1Database, conversation: Conversation, requestId: string, action: string, prompt: string) {
  const existing = await db.prepare('SELECT * FROM conversation_turns WHERE conversation = ? AND request_id = ?').bind(conversation.id, requestId).first<Turn>();
  if (existing && (existing.action !== action || existing.prompt !== prompt)) throw new FlowError('重试内容已变化，请重新发送。', 409);
  if (existing?.status === 'completed') return { replay: existing.reply, id: existing.id, lease: '', abandoned: null };
  // A unique lease, not the client request ID, prevents a timed-out worker from
  // saving over or releasing the lock acquired by its retry.
  const lease = crypto.randomUUID();
  const lock = await db.prepare('UPDATE conversations SET active_request = ?, lock_until = ? WHERE id = ? AND (active_request IS NULL OR lock_until < ?) RETURNING id').bind(lease, Date.now() + 90_000, conversation.id, Date.now()).first();
  if (!lock) throw new FlowError('角色正在回复，请等待完成后再发送。', 409);
  const abandoned = conversation.active_request ? await db.prepare("SELECT id, attempt FROM conversation_turns WHERE conversation = ? AND lease = ? AND status = 'pending'").bind(conversation.id, conversation.active_request).first<{ id: string; attempt: number }>() : null;
  const id = existing?.id ?? crypto.randomUUID();
  try {
    const started = await db.prepare("INSERT INTO conversation_turns (id, conversation, request_id, action, prompt, status, attempt, lease, created_at) VALUES (?, ?, ?, ?, ?, 'pending', 1, ?, ?) ON CONFLICT(conversation, request_id) DO UPDATE SET status = 'pending', attempt = attempt + 1, lease = excluded.lease WHERE status != 'completed' RETURNING attempt").bind(id, conversation.id, requestId, action, prompt, lease, new Date().toISOString()).first<{ attempt: number }>();
    if (!started) { await releaseTurn(db, conversation.id, lease); throw new FlowError('这条回复已完成，请重新加载。', 409); }
    return { replay: null, id: `${id}:${started.attempt}`, lease, abandoned: abandoned ? `${abandoned.id}:${abandoned.attempt}` : existing?.status === 'pending' ? `${id}:${existing.attempt}` : null };
  } catch (error) { await releaseTurn(db, conversation.id, lease); throw error; }
}
export async function releaseTurn(db: D1Database, conversationId: string, lease: string) {
  await db.prepare('UPDATE conversations SET active_request = NULL, lock_until = 0 WHERE id = ? AND active_request = ?').bind(conversationId, lease).run();
}
export async function failTurn(db: D1Database, conversationId: string, requestId: string, lease: string) {
  await db.batch([
    db.prepare("UPDATE conversation_turns SET status = 'failed' WHERE conversation = ? AND request_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM conversations WHERE id = ? AND active_request = ?)").bind(conversationId, requestId, conversationId, lease),
    db.prepare('UPDATE conversations SET active_request = NULL, lock_until = 0 WHERE id = ? AND active_request = ?').bind(conversationId, lease),
  ]);
}
export function completedTurnStatements(db: D1Database, conversation: Conversation, requestId: string, lease: string, reply: string, action: string) {
  return [
    // Throw within the same D1 transaction if this worker lost its lease.
    db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM conversations WHERE id = ? AND active_request = ?) THEN 1 ELSE json('stale_conversation_lease') END").bind(conversation.id, lease),
    db.prepare("UPDATE conversation_turns SET reply = ?, status = 'completed' WHERE conversation = ? AND request_id = ? AND status = 'pending'").bind(reply, conversation.id, requestId),
    db.prepare('UPDATE conversations SET stage = stage + ?, updated_at = ?, active_request = NULL, lock_until = 0 WHERE id = ? AND active_request = ?').bind(action === 'rewrite' ? 0 : 1, new Date().toISOString(), conversation.id, lease),
  ];
}
