import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('drizzle/0001_parched_vance_astro.sql', 'utf8'));
db.exec(readFileSync('drizzle/0004_multimodal_images.sql', 'utf8'));
const blobs = new Map();
const runtime = { DB: { prepare: sql => ({ bind: (...args) => ({
  first: async () => db.prepare(sql).get(...args),
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => db.prepare(sql).run(...args),
}) }) }, MEDIA: {
  put: async (key, bytes) => blobs.set(key, bytes),
  get: async key => blobs.has(key) ? { body: blobs.get(key) } : null,
  delete: async key => blobs.delete(key),
} };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const calls = [];
let fail = false, imageUrl = 'https://media.siliconflow.cn/example.png', volcMode = 'success';
const mockFetch = async (url, init) => {
  calls.push(String(url));
  if (String(url).startsWith('https://media.')) { assert.equal(init.headers, undefined); return new Response(png); }
  if (String(url).startsWith('https://ark.cn-beijing.volces.com/')) {
    assert.equal(init.headers.Authorization, 'Bearer mock-ark-key'); assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'mock-seedream-model'); assert.equal(body.size, '2048x2048');
    assert.equal(body.watermark, true); assert.equal(body.sequential_image_generation, 'disabled');
    return Response.json({ data: [{ url: 'https://media.volcengine.example/image.png' }] });
  }
  if (String(url).startsWith('https://openspeech.bytedance.com/')) {
    assert.equal(init.headers['X-Api-Key'], 'mock-speech-key'); assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.headers['X-Api-Resource-Id'], 'seed-tts-2.0'); assert.ok(init.headers['X-Api-Request-Id']);
    assert.ok(init.signal instanceof AbortSignal);
    const params = JSON.parse(init.body).req_params;
    assert.equal(params.speaker, 'zh_female_vv_uranus_bigtts'); assert.equal(params.audio_params.format, 'mp3');
    if (volcMode === 'error') return Response.json({ message: 'private-provider-secret mock-speech-key' }, { status: 403 });
    const stream = volcMode === 'partial' ? '{"code":0,"data":"SUQzAAA="}\n{"co' :
      volcMode === 'eof' ? '{"code":0,"data":"SUQzAAA="}\n' :
      volcMode === 'rejected' ? '{"code":45000000,"message":"private-provider-secret mock-speech-key"}\n' :
      '{"code":0,"data":"SUQ="}\r\n{"code":0,"data":null}\n{"code":0,"data":"MwAA"}\n{"code":20000000}';
    const bytes = new TextEncoder().encode(stream);
    return new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    } }));
  }
  assert.equal(init.headers.Authorization, 'Bearer mock-key-not-real');
  if (fail) return Response.json({ error: 'private-provider-secret' }, { status: 401 });
  if (String(url).endsWith('/images/generations')) { const body = JSON.parse(init.body); assert.equal(body.batch_size, undefined); assert.equal(body.model, 'Kwai-Kolors/Kolors'); return Response.json({ images: [{ url: imageUrl }] }); }
  if (String(url).endsWith('/audio/speech')) { assert.equal(JSON.parse(init.body).voice, 'FunAudioLLM/CosyVoice2-0.5B:claire'); return new Response(new Uint8Array([73, 68, 51, 0, 0])); }
  assert.ok(init.body instanceof FormData); assert.equal(init.body.get('model'), 'TeleAI/TeleSpeechASR');
  assert.equal(init.body.get('file').type, 'audio/wav'); return Response.json({ text: '我想你了' });
};
function load(path, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, require: id => imports[id], fetch: mockFetch, Response, Request, TextDecoder, URL, AbortSignal, Date, crypto, Uint8Array, DataView, Blob, FormData, atob });
  return exports;
}
const shared = load('lib/multimodal-shared.ts');
const identity = load('lib/account-identity.ts');
const server = load('lib/multimodal-server.ts', { 'cloudflare:workers': { env: runtime }, '@/lib/account-identity': identity });
const imports = { '@/lib/multimodal-server': server, '@/lib/multimodal-shared': shared, '@/lib/account-identity': identity };
imports['@/lib/volcengine-media'] = load('lib/volcengine-media.ts', imports);
const images = load('app/api/media/images/route.ts', imports), asset = load('app/api/media/images/[id]/route.ts', imports);
const speech = load('app/api/media/speech/route.ts', imports), asr = load('app/api/media/transcribe/route.ts', imports), status = load('app/api/media/route.ts', imports), importedAvatar = load('app/api/media/imports/route.ts', imports);
const visitor = crypto.randomUUID(), other = crypto.randomUUID(), importVisitor = crypto.randomUUID();
const request = (path, data, who = visitor, origin = 'https://example.com', type = 'application/json') => new Request(`https://example.com/api/media/${path}`, { method: 'POST', headers: { origin, 'Content-Type': type, cookie: `kk_discovery=${who}` }, body: type === 'application/json' ? JSON.stringify(data) : data });
const get = (path = '', who = visitor) => new Request(`https://example.com/api/media/${path}`, { headers: { cookie: `kk_discovery=${who}` } });
const valid = { prompt: '成年角色，雨夜撑伞，插画', size: '1024x1024' };
function avatarPng(width = 512, height = 768) {
  const bytes = new Uint8Array(33); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(8, 13); bytes.set(new TextEncoder().encode('IHDR'), 12);
  new DataView(bytes.buffer).setUint32(16, width); new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}
assert.equal((await importedAvatar.POST(request('imports', avatarPng(), importVisitor, 'https://other.test', 'image/png'))).status, 403);
assert.equal((await importedAvatar.POST(request('imports', new Uint8Array(40), importVisitor, 'https://example.com', 'image/png'))).status, 400);
const imported = await importedAvatar.POST(request('imports', avatarPng(), importVisitor, 'https://example.com', 'image/png'));
assert.equal(imported.status, 201);
const importedImage = (await imported.json()).image;
assert.equal(await server.ownsGeneratedImage(importVisitor, importedImage.url), true);
assert.equal(await server.ownsGeneratedImage(visitor, importedImage.url), false);
assert.equal((await status.GET(get()).json()).image, false);
assert.equal((await images.POST(request('images', valid))).status, 503);
assert.equal(calls.length, 0);
runtime.SILICONFLOW_API_KEY = 'mock-key-not-real';
assert.equal((await status.GET(get()).json()).speech, true);
assert.equal((await images.POST(request('images', valid, visitor, 'https://other.test'))).status, 403);
assert.equal((await images.POST(request('images', { ...valid, size: '999x999' }))).status, 400);
assert.equal((await images.POST(request('images', { prompt: 'x'.repeat(9000), size: valid.size }))).status, 413);
assert.equal(calls.length, 0);
let result = await images.POST(request('images', valid)); assert.equal(result.status, 201);
const image = (await result.json()).image;
assert.equal(image.url, `/api/media/images/${image.id}`);
assert.equal((await (await images.GET(get('images'))).json()).images.length, 1);
assert.equal((await (await images.GET(get('images', other))).json()).images.length, 0);
assert.equal(await server.ownsGeneratedImage(visitor, image.url), true);
assert.equal(await server.ownsGeneratedImage(other, image.url), false);
assert.equal((await asset.GET(get('images/' + image.id), { params: Promise.resolve({ id: image.id }) })).status, 200);
assert.equal((await asset.GET(get('images/' + image.id, other), { params: Promise.resolve({ id: image.id }) })).status, 404);
assert.equal((await speech.POST(request('speech', { text: '你好', voice: 'private:clone' }))).status, 400);
assert.equal((await speech.POST(request('speech', { text: 'x'.repeat(501), voice: 'claire' }))).status, 400);
assert.equal((await speech.POST(request('speech', { text: '你好', voice: 'claire' }))).headers.get('content-type'), 'audio/mpeg');
function wav(frames = 1600) {
  const buffer = Buffer.alloc(44 + frames * 2); buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(16000, 24); buffer.writeUInt32LE(32000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40); return buffer;
}
assert.equal((await asr.POST(request('transcribe', wav(), visitor, 'https://example.com', 'audio/wav'))).status, 200);
assert.equal((await asr.POST(request('transcribe', new Uint8Array(60), visitor, 'https://example.com', 'audio/wav'))).status, 400);
assert.equal((await asr.POST(request('transcribe', wav(480001), visitor, 'https://example.com', 'audio/wav'))).status, 413);
fail = true;
result = await speech.POST(request('speech', { text: '你好', voice: 'claire' })); assert.equal(result.status, 502); assert.ok(!(await result.text()).includes('private-provider-secret'));
fail = false;
imageUrl = 'http://127.0.0.1/secret';
assert.equal((await images.POST(request('images', valid))).status, 502);
const before = calls.length;
assert.equal((await images.POST(request('images', valid))).status, 429); assert.equal(calls.length, before);
assert.equal(blobs.size, 2);
db.exec('DELETE FROM chat_quota');
runtime.ARK_API_KEY = 'mock-ark-key';
assert.equal((await status.GET(get()).json()).image, false, 'An incomplete Ark setup must not fall back to SiliconFlow');
runtime.ARK_IMAGE_MODEL = 'mock-seedream-model';
assert.equal((await images.POST(request('images', valid))).status, 201);
runtime.DOUBAO_SPEECH_API_KEY = 'mock-speech-key';
assert.equal((await status.GET(get()).json()).speech, false, 'A speaker is required');
runtime.DOUBAO_TTS_SPEAKER = 'zh_female_vv_uranus_bigtts';
delete runtime.SILICONFLOW_API_KEY;
const volcStatus = await status.GET(get()).json();
assert.equal(volcStatus.image, true); assert.equal(volcStatus.speech, true); assert.equal(volcStatus.transcription, false);
assert.equal(volcStatus.voices[0].id, 'doubao'); assert.ok(!JSON.stringify(volcStatus).includes('mock-speech-key'));
assert.equal((await speech.POST(request('speech', { text: '你好', voice: 'claire' }))).status, 400);
for (const mode of ['success', 'eof']) {
  volcMode = mode;
  result = await speech.POST(request('speech', { text: '你好', voice: 'doubao' }));
  assert.equal(result.status, 200); assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([73, 68, 51, 0, 0]));
}
for (const mode of ['error', 'rejected', 'partial']) {
  volcMode = mode;
  result = await speech.POST(request('speech', { text: '你好', voice: 'doubao' }));
  assert.equal(result.status, 502); const message = await result.text();
  assert.ok(!message.includes('private-provider-secret')); assert.ok(!message.includes('mock-speech-key'));
}
// Simulate platform authentication, retaining the real owner resolution and response headers.
const platformRequest = (request, account = 'media-account-a') => {
  const headers = new Headers(request.headers);
  headers.set('oai-authenticated-user-id', account);
  headers.set('oai-authenticated-user-email', `${account}@example.test`);
  return new Request(request, { headers });
};
const accountImported = await importedAvatar.POST(platformRequest(request('imports', avatarPng(), visitor, 'https://example.com', 'image/png')));
assert.equal(accountImported.status, 201);
assert.equal(accountImported.headers.get('set-cookie'), null);
assert.equal(accountImported.headers.get('cache-control'), 'private, no-store');
assert.ok(accountImported.headers.get('vary').includes('oai-authenticated-user-id'));
const accountImage = (await accountImported.json()).image;
assert.equal(await server.ownsGeneratedImage('account:media-account-a', accountImage.url), true);
assert.equal(await server.ownsGeneratedImage(visitor, accountImage.url), false);
const accountList = await images.GET(platformRequest(get('images', other)));
assert.equal((await accountList.json()).images[0].id, accountImage.id);
const otherAccountList = await images.GET(platformRequest(get('images'), 'media-account-b'));
assert.equal((await otherAccountList.json()).images.length, 0);
const accountAssetContext = () => ({ params: Promise.resolve({ id: accountImage.id }) });
assert.equal((await asset.GET(platformRequest(get('images/' + accountImage.id, other)), accountAssetContext())).status, 200);
assert.equal((await asset.GET(platformRequest(get('images/' + accountImage.id), 'media-account-b'), accountAssetContext())).status, 404);
assert.equal((await asset.GET(get('images/' + accountImage.id), accountAssetContext())).status, 404);
console.log('Multimodal: imported avatars, validation, quotas, visitor/account private storage, SiliconFlow + Ark contracts, Doubao chunk parsing and secret-safe failures passed. Mock providers only.');
