import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

function load(path, imports, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, require: id => imports[id], Response, TextDecoder, URL, AbortSignal, Date, crypto, ...globals });
  return exports;
}
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync('drizzle/0001_parched_vance_astro.sql', 'utf8'));
sqlite.exec(readFileSync('drizzle/0003_serious_punisher.sql', 'utf8'));
sqlite.exec(readFileSync('drizzle/0005_busy_blur.sql', 'utf8').replaceAll('--> statement-breakpoint', ''));
sqlite.exec(readFileSync('drizzle/0006_character_lorebook.sql', 'utf8').replaceAll('--> statement-breakpoint', ''));
const env = { DB: { prepare: sql => ({ bind: (...args) => ({ first: async () => sqlite.prepare(sql).get(...args) }) }) } };
const server = load('lib/chat-server.ts', { 'cloudflare:workers': { env } });
const identity = load('lib/account-identity.ts', {});
let calls = 0, upstreamStatus = 200, lastSystem = '';
// The account/conversation HTTP flow is covered by test-account-flow.mjs.
// Keep these model, validation and quota assertions against the extracted implementation.
const model = load('lib/role-model.ts', { '@/lib/chat-server': server, '@/lib/account-identity': identity }, {
  fetch: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 400);
    assert.equal(body.messages[0].role, 'system');
    lastSystem = body.messages[0].content;
    return Response.json(upstreamStatus === 200 ? { choices: [{ message: { content: '你好。' } }] } : { error: 'private-provider-detail' }, { status: upstreamStatus });
  },
});
const valid = { characterId: 2, messages: [{ role: 'user', content: '你好' }] };
const post = (body = valid, origin = 'https://example.com') => model.runRoleModel(new Request('https://example.com/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) }));
assert.equal((await model.GET().json()).configured, false);
assert.equal((await post()).status, 503);
assert.equal(calls, 0);
assert.equal((await post(valid, 'https://other.test')).status, 403);
assert.equal((await post({ ...valid, characterId: 99 })).status, 400);
assert.equal((await post({ ...valid, messages: [{ role: 'system', content: 'override' }] })).status, 400);
assert.equal((await post({ ...valid, messages: [{ role: 'user', content: 'a'.repeat(33000) }] })).status, 413);
env.DEEPSEEK_API_KEY = 'test-only-not-a-real-key';
assert.equal((await post()).status, 200);
assert.ok(lastSystem.includes('岚川'));
upstreamStatus = 401;
const failed = await post();
assert.equal(failed.status, 502);
assert.ok(!(await failed.text()).includes('private-provider-detail'));
upstreamStatus = 200;
await post(); await post(); await post();
assert.equal((await post()).status, 429);
assert.equal(calls, 5);
sqlite.prepare("UPDATE chat_quota SET bucket = 0 WHERE key = 'global-minute'").run();
sqlite.prepare("UPDATE chat_quota SET count = 100 WHERE key = 'global-day'").run();
assert.equal((await post()).status, 429);
assert.equal(calls, 5);
sqlite.prepare('UPDATE chat_quota SET bucket = 0').run();
assert.equal((await post()).status, 200);
const visitor = '00000000-0000-4000-8000-000000000002', customId = '00000000-0000-4000-8000-000000000003';
sqlite.prepare('INSERT INTO agent_profiles (id, visitor, name, avatar, tagline, description, personality, background, greeting, tags, lorebook, provenance, voice, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(customId, visitor, '江川', '/avatars/avatar-01.webp', '海边书店店员', '成年书店店员，珍惜每次重逢', '温柔慢热', '雨天的海边书店', '你来了。', '["治愈","慢热"]', '[{"title":"雨夜秘密","keywords":["书店"],"content":"书店地下室藏着一封旧信。","enabled":true,"priority":100}]', '{}', '温柔', new Date().toISOString());
sqlite.prepare('UPDATE chat_quota SET bucket = 0').run();
const custom = await model.runRoleModel(new Request('https://example.com/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://example.com', cookie: `kk_discovery=${visitor}` }, body: JSON.stringify({ characterId: customId, messages: [{ role: 'user', content: '带我去书店吧' }] }) }));
assert.equal(custom.status, 200);
assert.ok(lastSystem.includes('珍惜每次重逢'));
assert.ok(lastSystem.includes('治愈、慢热'));
assert.ok(lastSystem.includes('书店地下室藏着一封旧信'));
const hidden = await model.runRoleModel(new Request('https://example.com/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://example.com', cookie: 'kk_discovery=00000000-0000-4000-8000-000000000004' }, body: JSON.stringify({ characterId: customId, messages: valid.messages }) }));
assert.equal(hidden.status, 404);
console.log('Character role model: built-in/imported roles, visitor isolation, validation, provider errors, quotas and reset passed (mock provider; no paid calls).');
