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
const env = { DB: db, DEEPSEEK_API_KEY: 'mock-provider-key', E2E_TEST_MODE: '1' };
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

const account=load('app/api/account/route.ts'), chat=load('app/api/chat/route.ts'), test=load('app/api/test/route.ts');
const {acceptance,FRONT_EVENTS,AI_EVENTS}=load('lib/e2e-shared.ts');
const session=crypto.randomUUID();
const request=(path,body,user='sim-user',host='localhost')=>new Request(`http://${host}/api/${path}`,{method:body?'POST':'GET',headers:{origin:`http://${host}`,'Content-Type':'application/json','x-kk-session-id':session,...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'sim@example.test'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const get=()=>account.GET(request('account')).then(r=>r.json());
const act=body=>account.POST(request('account',body));
const postEvent=event=>test.POST(request('test',{event,id:crypto.randomUUID()}));
assert.equal((await test.GET(request('test',null,'sim-user','hosted.example'))).status,200);
assert.equal((await test.GET(request('test',null,'sim-user','hosted.example'))).json instanceof Function,true);
assert.equal((await (await test.GET(request('test',null,'sim-user','hosted.example'))).json()).enabled,false);
assert.equal((await account.POST(request('account',{action:'mock-pay',orderId:crypto.randomUUID()},null))).status,401);
assert.equal((await account.POST(request('account',{action:'mock-pay',orderId:crypto.randomUUID()},'sim-user','hosted.example'))).status,403);
assert.equal((await postEvent('generation_result')).status,400,'client cannot forge AI stages');
const first=await get();assert.equal(first.registered,true);assert.equal(first.account.wallet.balance,5);
assert.equal((await get()).registered,false);
const input={characterId:2,prompt:'今天工作好累',requestId:crypto.randomUUID(),action:'message'};
let reply=await (await chat.POST(request('chat',input))).json();assert.ok(reply.reply);assert.equal(reply.freeTokenUsed,true);assert.ok(reply.ids.trace_id);
const replay=await (await chat.POST(request('chat',input))).json();assert.equal(replay.replayed,true);assert.equal(replay.ids.trace_id,reply.ids.trace_id);
let traces=(await (await test.GET(request('test'))).json()).events;
for(const event of AI_EVENTS)assert.ok(traces.some(e=>e.event===event&&e.trace_id===reply.ids.trace_id&&e.message_id===input.requestId),event);
assert.ok(traces.find(e=>e.event==='understanding_result').detail.includes('distressed'));
await act({action:'trial'});const second=await (await chat.POST(request('chat',{...input,requestId:crypto.randomUUID(),prompt:'我喜欢雨天的书店'}))).json();assert.equal(second.premiumFeatureUsed,true);
const key=crypto.randomUUID();let state=await (await act({action:'order',productId:'membership30',idempotencyKey:key})).json();let order=state.orders.find(o=>o.idempotencyKey===key);assert.equal(order.status,'pending');
state=await (await act({action:'mock-pay',orderId:order.id})).json();order=state.orders.find(o=>o.id===order.id);assert.equal(order.status,'paid');assert.equal(order.testMode,true);assert.equal(state.account.membership.kind,'paid');assert.equal(state.gmv.totalFen,0);
const expires=state.account.membership.expiresAt;state=await (await act({action:'mock-pay',orderId:order.id})).json();assert.equal(state.account.membership.expiresAt,expires,'replayed payment cannot grant twice');
assert.equal((await act({action:'cancel-order',orderId:order.id})).status,409);
assert.equal((await account.POST(request('account',{action:'mock-pay',orderId:order.id},'other-user'))).status,404);
assert.equal(acceptance([]).passed,false);
// The acceptance algorithm must reject absent stages and incorrect ordering.
const sequence=['register_start','register_success','login_success','role_exposure','role_click','voice_play','chat_start','chat_send',...AI_EVENTS,'ai_response_show','chat_continue','story_enter','free_token_use','premium_feature_use','pay_click','pay_success'];
let n=0;const fixture=[];
const row=(event,source='frontend',detail={})=>({id:String(n++),event,source,user_id:'u',session_id:'s',message_id:'m',trace_id:'t',order_id:['pay_click','pay_success','order_created','mock_payment_settled'].includes(event)?'o':null,detail:JSON.stringify(detail),created_at:String(n)});
for(const event of sequence){
 if(event==='register_success')fixture.push(row('account_registered','backend'));
 if(event==='voice_play')fixture.push(row('mock_voice_generated','backend',{mode:'mock',characterId:2}));
 if(event==='free_token_use')fixture.push(row('free_token_committed','backend'));
 if(event==='premium_feature_use')fixture.push(row('premium_reply_committed','backend'));
 if(event==='pay_click')fixture.push(row('order_created','backend',{status:'pending',productType:'membership'}));
 if(event==='pay_success')fixture.push(row('mock_payment_settled','backend',{status:'paid',productType:'membership',membership:'paid',testMode:true}));
 fixture.push(row(event,AI_EVENTS.includes(event)?'backend':'frontend',{characterId:2,played:true,approved:true,status:event==='pay_click'?'pending':'paid',membership:'paid'}));
}
assert.equal(acceptance(fixture).passed,true);assert.equal(acceptance([...fixture].reverse()).passed,false);assert.equal(acceptance(fixture.filter(e=>e.event!=='review_result')).passed,false);
assert.equal(acceptance(fixture.map(e=>e.event==='review_result'?{...e,detail:'{"approved":false}'}:e)).passed,false);
assert.equal(acceptance(fixture.filter(e=>e.event!=='mock_payment_settled')).passed,false);
assert.equal(acceptance(fixture.filter(e=>e.event!=='free_token_committed')).passed,false);
assert.equal(acceptance(fixture.map(e=>({...e,message_id:null,trace_id:null}))).passed,false);
console.log('PASS E2E routes: local gate, new-run identity, actual AI spans, replay IDs, free/premium quota, pending→paid, membership, payment replay, ownership, hosted rejection, ordered acceptance. Provider mocked for regression only.');
