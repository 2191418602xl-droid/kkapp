import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

function load(path, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, require: id => imports[id], Response, TextDecoder, URL, Date, structuredClone, crypto });
  return exports;
}
const lib = load('lib/discovery.ts');
const identity = load('lib/account-identity.ts');
const now = Date.parse('2026-09-04T10:00:00Z');
let state = lib.updateDiscovery(lib.emptyDiscovery(), { action: 'water', companion: 'lanchuan' }, now);
assert.equal(state.garden.lanchuan.water, 1);
assert.throws(() => lib.updateDiscovery(state, { action: 'water' }, now));
state = lib.updateDiscovery(state, { action: 'water' }, now + 86400000);
assert.equal(state.garden.lanchuan.water, 2);
state = lib.updateDiscovery(state, { action: 'diary', title: '今天', text: '下雨了', mood: '开心' }, now);
state = lib.updateDiscovery(state, { action: 'diary', id: state.diaries[0].id, title: '雨停了', text: '晴天' }, now);
assert.equal(state.diaries.length, 1);
assert.equal(state.diaries[0].text, '晴天');
assert.throws(() => lib.updateDiscovery(state, { action: 'letter', title: 'x', text: 'y', hours: -1 }, now));
state = lib.updateDiscovery(state, { action: 'job', index: 0, choice: 1 }, now);
assert.equal(state.job.coins, 20);
assert.throws(() => lib.updateDiscovery(state, { action: 'job', index: 0, choice: 1 }, now));
for (const [start, step] of [[0, 1], [0, 9], [0, 10], [36, -8]]) {
  const board = Array(81).fill(0); for (let k = 0; k < 5; k++) board[start + k * step] = 1;
  assert.equal(lib.boardWinner(board), 1);
}
const board = Array(81).fill(0); board.fill(1, 0, 4);
assert.equal(lib.boardReply(board), 4);
assert.equal(lib.boardWinner(Array(81).fill(0)), 0);
assert.equal(lib.boardReply(Array(81).fill(1)), -1);
const db = new DatabaseSync(':memory:');
db.exec(readFileSync('drizzle/0002_panoramic_blur.sql', 'utf8'));
const api = load('app/api/discovery/route.ts', { '@/lib/discovery': lib, '@/lib/account-identity': identity, '@/lib/discovery-server': {
  discoveryDatabase: () => ({ prepare: sql => ({ bind: (...args) => ({ first: async () => db.prepare(sql).get(...args) }) }) }),
} });
const url = 'https://example.com/api/discovery';
const initial = await api.GET(new Request(url));
assert.equal(initial.status, 200);
const cookie = initial.headers.get('set-cookie').split(';')[0];
const post = (body, origin = 'https://example.com') => api.POST(new Request(url, { method: 'POST', headers: { cookie, origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const input = { action: 'letter', title: '给明天', text: '秘密文字', hours: 24, revision: 0 };
const saved = await post(input);
assert.equal(saved.status, 200);
assert.equal((await saved.json()).letters[0].text, '');
assert.equal((await post(input)).status, 409);
assert.equal((await post(input, 'https://other.test')).status, 403);
const own = await api.GET(new Request(url, { headers: { cookie } }));
assert.equal((await own.json()).letters.length, 1);
const other = await api.GET(new Request(url));
assert.equal((await other.json()).letters.length, 0);
const stored = JSON.parse(db.prepare('SELECT data FROM discovery_progress').get().data);
assert.equal(stored.letters[0].text, '秘密文字');
stored.letters[0].openAt = '2020-01-01T00:00:00Z';
db.prepare('UPDATE discovery_progress SET data = ?').run(JSON.stringify(stored));
const delivered = await api.GET(new Request(url, { headers: { cookie } }));
assert.equal((await delivered.json()).letters[0].text, '秘密文字');
// Simulate the trusted platform dispatch headers while exercising the real identity module.
const platformRequest = (request, account = 'discovery-account-a') => {
  const headers = new Headers(request.headers);
  headers.set('oai-authenticated-user-id', account);
  headers.set('oai-authenticated-user-email', `${account}@example.test`);
  return new Request(request, { headers });
};
const accountSaved = await api.POST(platformRequest(new Request(url, {
  method: 'POST', headers: { cookie, origin: 'https://example.com', 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'diary', title: '账户日记', text: '跨浏览器保留', mood: '开心', revision: 0 }),
})));
assert.equal(accountSaved.status, 200);
assert.equal(accountSaved.headers.get('set-cookie'), null);
assert.equal(accountSaved.headers.get('cache-control'), 'private, no-store');
assert.ok(accountSaved.headers.get('vary').includes('oai-authenticated-user-id'));
const anotherBrowser = `kk_discovery=${crypto.randomUUID()}`;
const accountRead = await api.GET(platformRequest(new Request(url, { headers: { cookie: anotherBrowser } })));
assert.equal((await accountRead.json()).diaries[0].text, '跨浏览器保留');
const otherAccount = await api.GET(platformRequest(new Request(url, { headers: { cookie } }), 'discovery-account-b'));
assert.equal((await otherAccount.json()).diaries.length, 0);
const guestRead = await api.GET(new Request(url, { headers: { cookie } }));
const guestState = await guestRead.json();
assert.equal(guestState.diaries.length, 0);
assert.equal(guestState.letters[0].text, '秘密文字');
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM discovery_progress WHERE visitor = ?').get('account:discovery-account-a').count, 1);
console.log('Discovery tests passed: daily limits, editing, games, letter timing, visitor/account isolation, persistence and version conflicts.');
