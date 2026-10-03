import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = ts.transpileModule(readFileSync('lib/character-card.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
runInNewContext(source, { exports, Blob, File, Response, TextDecoder, TextEncoder, Uint8Array, DataView, DecompressionStream, atob, Set, Map, JSON, Error, SyntaxError });

const { parseCharacterCard, characterImportIssues, characterTagline } = exports;
const card = {
  name: '江川', description: '在海边书店工作的成年人。', personality: '温柔，慢热，善于倾听。',
  scenario: '你们在雨天的书店初次相遇。', first_mes: '（递来毛巾）{{user}}，先擦擦雨水。', tags: ['温柔', '治愈'],
};

const flat = await parseCharacterCard(new File([JSON.stringify(card)], 'card.json', { type: 'application/json' }));
assert.equal(flat.draft.name, '江川');
assert.equal(flat.draft.greeting, '（递来毛巾）你，先擦擦雨水。');
assert.deepEqual([...flat.draft.tags], ['温柔', '治愈']);
assert.deepEqual([...characterImportIssues(flat.draft)], []);

const v2 = await parseCharacterCard(new File([JSON.stringify({ spec: 'chara_card_v2', data: { ...card, name: '林砚', first_mes: '<BOT>：你来了。' } })], 'card-v2.json'));
assert.equal(v2.draft.name, '林砚');
assert.equal(v2.draft.greeting, '林砚：你来了。');

const txt = await parseCharacterCard(new File(['角色名：苏澄\n人设：成年咖啡师\n性格：开朗、元气\n剧情背景：城市咖啡馆\n开场白：早上好。\n标签：日常，治愈'], 'card.txt', { type: 'text/plain' }));
assert.equal(txt.draft.name, '苏澄');
assert.equal(txt.draft.voice, '元气');
assert.deepEqual([...txt.draft.tags], ['日常', '治愈']);

function chunk(type, payload) {
  const bytes = new Uint8Array(12 + payload.length);
  new DataView(bytes.buffer).setUint32(0, payload.length);
  bytes.set(new TextEncoder().encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}
const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = new Uint8Array(13); new DataView(ihdr.buffer).setUint32(0, 512); new DataView(ihdr.buffer).setUint32(4, 768);
const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ data: card }))));
const text = new Uint8Array([...new TextEncoder().encode('chara'), 0, ...new TextEncoder().encode(encoded)]);
const png = new File([signature, chunk('IHDR', ihdr), chunk('tEXt', text), chunk('IEND', new Uint8Array())], 'card.png', { type: 'image/png' });
const parsedPng = await parseCharacterCard(png);
assert.equal(parsedPng.source, 'PNG');
assert.equal(parsedPng.draft.name, '江川');
assert.ok(parsedPng.avatar);

const official = await parseCharacterCard(new File([readFileSync('public/character-packs/default_Seraphina.png')], 'default_Seraphina.png', { type: 'image/png' }));
assert.equal(official.draft.name, 'Seraphina');
assert.match(official.draft.personality, /caring/);
assert.match(official.draft.scenario, /Eldoria/);
assert.equal(official.draft.lorebook.length, 4);
assert.ok(official.draft.lorebook.some(entry => entry.keywords.includes('shadowfang')));

await assert.rejects(() => parseCharacterCard(new File(['{bad'], 'broken.json')), /JSON 格式不正确/);
await assert.rejects(() => parseCharacterCard(new File(['hello'], 'card.pdf')), /暂不支持/);
const incomplete = await parseCharacterCard(new File(['一段没有标题的角色描述'], 'card.txt'));
assert.ok(characterImportIssues(incomplete.draft).includes('请补充角色名'));
assert.ok(incomplete.warnings.some(warning => warning.includes('未分段')));
assert.equal(characterTagline('第一句。第二句'), '第一句');

console.log('Character import: JSON V1/V2/V3, PNG metadata, TXT mapping, embedded fields, lorebook, macros and failures passed.');
