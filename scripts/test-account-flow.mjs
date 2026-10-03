import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

// Run the actual route/library source against SQLite, with only transport and D1
// adapted. No copied business SQL, credentials or live provider charges.
const sqlite = new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, 'utf8').replaceAll('--> statement-breakpoint', ''));
let failSql = null;
function statement(sql, args = []) {
  const execute = () => { if (failSql?.(sql)) throw new Error('injected database failure'); return sqlite.prepare(sql); };
  return { sql, args, bind: (...values) => statement(sql, values),
    first: async (column) => { const row = execute().get(...args); return column ? row?.[column] ?? null : row ?? null; },
    all: async () => ({ results: execute().all(...args), success: true, meta: {} }),
    run: async () => { const result = execute().run(...args); return { success: true, meta: { changes: Number(result.changes) } }; } };
}
const db = { prepare: statement, batch: async statements => {
  sqlite.exec('BEGIN');
  try { const results = statements.map(s => { if (failSql?.(s.sql)) throw new Error('injected database failure'); const prepared = sqlite.prepare(s.sql); const rows = prepared.all(...s.args); return { success: true, results: rows, meta: { changes: Number(sqlite.prepare('SELECT changes() AS n').get().n) } }; }); sqlite.exec('COMMIT'); return results; }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
} };
const env = { DB: db, DEEPSEEK_API_KEY: 'mock-provider-key' };
let calls = 0, upstream = 200, upstreamMessages = [];
const modules = new Map();
function load(path) {
  const full = resolve(path); if (modules.has(full)) return modules.get(full);
  const exports = {}; modules.set(full, exports);
  const code = ts.transpileModule(readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, require: id => id === 'cloudflare:workers' ? { env } : load((id.startsWith('@/') ? resolve(id.slice(2)) : resolve(dirname(full), id)).replace(/(?:\.ts)?$/, '.ts')),
    Request, Response, Headers, URL, TextEncoder, TextDecoder, crypto, Date, AbortSignal, console,
    fetch: async (url, init) => { assert.equal(url, 'https://api.deepseek.com/chat/completions'); calls++; upstreamMessages = JSON.parse(init.body).messages; return Response.json(upstream === 200 ? { choices: [{ message: { content: '（收起伞）我们去前面的书店吧，你想坐靠窗的位置吗？' } }] } : { error: 'private-provider-detail' }, { status: upstream }); } }, { filename: full });
  return exports;
}
const account = load('app/api/account/route.ts'), chat = load('app/api/chat/route.ts'), diamonds = load('app/api/diamonds/route.ts');
const commerce = load('lib/account-commerce.ts');
const request = (path, body, user = 'flow-test-user', origin = 'https://example.com') => new Request(`https://example.com/api/${path}`, { method: body ? 'POST' : 'GET', headers: { ...(user ? { 'oai-authenticated-user-id': user, 'oai-authenticated-user-email': `${user}@example.test` } : {}), origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const state = async (user = 'flow-test-user') => (await account.GET(request('account', null, user))).json();
const action = async body => account.POST(request('account', body));
const message = (prompt = '我们下一站去哪里？') => ({ characterId: 2, prompt, action: 'message', requestId: crypto.randomUUID(), world: '雨夜重逢' });
const resetRate = () => sqlite.prepare('UPDATE chat_quota SET bucket = 0').run();

assert.equal((await state(null)).authenticated, false);
assert.equal((await chat.POST(request('chat', message(), null))).status, 401);
assert.equal((await action({ action: 'checkin', accountId: 'attacker' })).status, 200);
let snapshot = await state(); assert.equal(snapshot.account.wallet.balance, 6); assert.equal(snapshot.account.chatQuota.freeRemaining, 3);
await Promise.all(Array.from({ length: 5 }, () => action({ action: 'checkin' })));
assert.equal((await state()).account.wallet.balance, 6);
assert.equal((await state('other-user')).account.wallet.balance, 5);
assert.equal((await account.POST(request('account', { action: 'trial' }, 'flow-test-user', 'https://evil.test'))).status, 403);

const first = message(); let response = await chat.POST(request('chat', first)); assert.equal(response.status, 200, await response.clone().text());
const firstReply = await response.json(); assert.equal(firstReply.stage, 1); assert.equal(calls, 1);
assert.equal((await chat.POST(request('chat', first))).status, 200); assert.equal(calls, 1);
assert.equal((await chat.POST(request('chat', { ...first, prompt: 'changed' }))).status, 409);
const history = await (await chat.GET(request('chat?characterId=2&world=雨夜重逢'))).json();
assert.equal(history.messages.length, 2); assert.equal(history.messages[0].content, first.prompt);
assert.equal((await (await chat.GET(request('chat?characterId=2&world=雨夜重逢', null, 'other-user'))).json()).messages.length, 0);
await chat.POST(request('chat', message('继续下一幕'))); assert.ok(upstreamMessages.some(m => m.content === firstReply.reply));
await chat.POST(request('chat', message('再继续'))); assert.equal((await state()).account.chatQuota.freeRemaining, 0);
resetRate(); const beforePaid = (await state()).account.wallet.balance;
await chat.POST(request('chat', message('我想听你说'))); assert.equal((await state()).account.wallet.balance, beforePaid - 1);
upstream = 500; const failed = message('失败后重试的消息');
assert.equal((await chat.POST(request('chat', failed))).status, 502);
assert.equal((await state()).account.wallet.balance, beforePaid - 1);
const unfinished = await (await chat.GET(request('chat?characterId=2&world=雨夜重逢'))).json();
assert.equal(unfinished.unfinished.requestId, failed.requestId); assert.equal(unfinished.unfinished.prompt, failed.prompt); assert.equal(unfinished.unfinished.status, 'failed');
upstream = 200; resetRate(); response = await chat.POST(request('chat', failed)); assert.equal(response.status, 200, await response.clone().text());
assert.equal((await (await chat.GET(request('chat?characterId=2&world=雨夜重逢'))).json()).unfinished, null);
assert.equal((await state()).account.wallet.balance, beforePaid - 2);
await action({ action: 'trial' }); snapshot = await state(); assert.equal(snapshot.account.membership.kind, 'trial'); assert.ok(snapshot.account.chatQuota.freeRemaining > 0);
assert.equal((await action({ action: 'trial' })).status, 409);

const orderKey = crypto.randomUUID(); const orderBody = { action: 'order', productId: 'd60', idempotencyKey: orderKey };
await Promise.all([action(orderBody), action(orderBody)]); snapshot = await state(); assert.equal(snapshot.orders.length, 1); assert.equal(snapshot.orders[0].status, 'pending');
assert.equal(snapshot.orders[0].priceFen, 100); assert.equal(snapshot.gmv.totalFen, 0);
assert.equal((await diamonds.POST(request('diamonds', { action: 'purchase', pack: 'd6480', requestId: crypto.randomUUID() }))).status, 409);
const orderId = snapshot.orders[0].id;
assert.equal((await account.POST(request('account', { action: 'cancel-order', orderId }, 'other-user'))).status, 404);
assert.equal((await action({ action: 'cancel-order', orderId })).status, 200);
assert.equal((await state()).orders[0].status, 'cancelled');

await commerce.ensureAccount(db, 'concurrency');
const reservations = await Promise.all(Array.from({ length: 8 }, () => commerce.reserveChatReply(db, 'concurrency', crypto.randomUUID())));
assert.equal(reservations.filter(r => !r.paid).length, 3); assert.equal((await commerce.getWalletState(db, 'concurrency')).balance, 0);
await assert.rejects(() => commerce.reserveChatReply(db, 'concurrency', crypto.randomUUID()));
assert.equal((await commerce.reserveChatReply(db, 'concurrency', reservations[0].reservationId)).paid, false);
sqlite.exec('CREATE TABLE test_commit_counter (value INTEGER NOT NULL); INSERT INTO test_commit_counter VALUES (0)');
await Promise.all([1, 2].map(() => commerce.commitChatReply(db, 'concurrency', reservations[0].reservationId, [db.prepare('UPDATE test_commit_counter SET value = value + 1')])));
assert.equal(sqlite.prepare('SELECT value FROM test_commit_counter').get().value, 1);
const paid = reservations.find(r => r.paid);
await Promise.all([commerce.commitChatReply(db, 'concurrency', paid.reservationId), commerce.refundChatReply(db, 'concurrency', paid.reservationId)]).catch(() => {});
const paidState = sqlite.prepare('SELECT status FROM chat_reservations WHERE account=? AND request_key=?').get('concurrency', paid.reservationId);
assert.equal((await commerce.getWalletState(db, 'concurrency')).balance, paidState.status === 'refunded' ? 1 : 0);
await commerce.refundChatReply(db, 'concurrency', 'nonexistent');
const rollback = reservations.filter(r => r.paid)[1];
const balanceBeforeRollback = (await commerce.getWalletState(db, 'concurrency')).balance;
failSql = sql => sql.includes('INSERT INTO wallet_ledger');
await assert.rejects(() => commerce.refundChatReply(db, 'concurrency', rollback.reservationId));
failSql = null;
assert.equal(sqlite.prepare('SELECT status FROM chat_reservations WHERE request_key=?').get(rollback.reservationId).status, 'reserved');
await commerce.refundChatReply(db, 'concurrency', rollback.reservationId); await commerce.refundChatReply(db, 'concurrency', rollback.reservationId);
assert.equal((await commerce.getWalletState(db, 'concurrency')).balance, balanceBeforeRollback + 1);
await commerce.ensureAccount(db, 'starter-race');
const starter = await Promise.allSettled([1, 2].map(() => commerce.createOrder(db, 'starter-race', 'starter', crypto.randomUUID())));
assert.equal(starter.filter(r => r.status === 'fulfilled').length, 1);
const starterOrder = starter.find(r => r.status === 'fulfilled').value;
await commerce.settleTestPayment(db, starterOrder.id, 'starter-test-event', true);
await commerce.settleTestPayment(db, starterOrder.id, 'starter-test-event', true);
assert.equal((await commerce.getWalletState(db, 'starter-race')).balance, 605);
assert.equal((await commerce.getAccountGMV(db, 'starter-race')).totalFen, 0);
await assert.rejects(() => commerce.createOrder(db, 'starter-race', 'starter', crypto.randomUUID()));
await assert.rejects(() => commerce.settleTestPayment(db, starterOrder.id, 'changed-event', true));
await commerce.ensureAccount(db, 'membership-race');
const memberOrders = await Promise.all([1, 2].map(() => commerce.createOrder(db, 'membership-race', 'membership30', crypto.randomUUID())));
await Promise.all(memberOrders.map((order, i) => commerce.settleTestPayment(db, order.id, `member-event-${i}`, true)));
const membership = await commerce.getMembershipState(db, 'membership-race');
assert.equal(membership.kind, 'paid');
assert.ok(new Date(membership.expiresAt).getTime() - Date.now() > 59.9 * 86400000, 'two membership orders extend by 60 days');
assert.equal((await commerce.getAccountGMV(db, 'membership-race')).totalFen, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM memberships WHERE account=?').get('membership-race').n, 2);
const insufficientKey = crypto.randomUUID();
await commerce.reserveChatReply(db, 'concurrency', crypto.randomUUID());
await assert.rejects(() => commerce.reserveChatReply(db, 'concurrency', insufficientKey));
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM chat_reservations WHERE request_key=?').get(insufficientKey).n, 0);
await commerce.refundChatReply(db, 'concurrency', insufficientKey);
assert.equal((await commerce.getWalletState(db, 'concurrency')).balance, 0);
console.log('PASS account flow: auth isolation, signup/checkin idempotency, persisted role conversation/story, free/paid/retry/refund, trial, order/cancel, fake purchase rejection, concurrent quotas/commit/refund rollback/starter limit. Provider mocked; no real payment or voice claim.');
