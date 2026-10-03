export type CharacterImportDraft = {
  name: string;
  description: string;
  personality: string;
  greeting: string;
  scenario: string;
  tags: string[];
  lorebook: CharacterLoreEntry[];
  provenance?: CharacterProvenance;
  voice: '温柔' | '清冷' | '元气' | '沉稳';
};

export type CharacterLoreEntry = {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  constant: boolean;
  enabled: boolean;
  priority: number;
};

export type CharacterProvenance = {
  author: string;
  version: string;
  notes: string;
  source: string;
  license: string;
};

export type CharacterCardParseResult = {
  draft: CharacterImportDraft;
  avatar?: Blob;
  warnings: string[];
  source: 'PNG' | 'JSON' | 'TXT';
};

const limits = { name: 20, description: 1000, personality: 500, greeting: 300, scenario: 1000 } as const;
type TextDraftKey = 'name' | 'description' | 'personality' | 'greeting' | 'scenario' | 'tags';
const labels: Record<string, TextDraftKey> = {
  name: 'name', '角色名': 'name', '角色名称': 'name', '名称': 'name',
  description: 'description', persona: 'description', '人设': 'description', '角色设定': 'description', '角色简介': 'description', '简介': 'description',
  personality: 'personality', '性格': 'personality', '性格设定': 'personality',
  first_mes: 'greeting', first_message: 'greeting', greeting: 'greeting', '开场白': 'greeting', '初始消息': 'greeting',
  scenario: 'scenario', background: 'scenario', '剧情背景': 'scenario', '故事背景': 'scenario', '世界观': 'scenario', '背景': 'scenario',
  tags: 'tags', '标签': 'tags',
};

const blankDraft = (): CharacterImportDraft => ({ name: '', description: '', personality: '', greeting: '', scenario: '', tags: [], lorebook: [], voice: '温柔' });
const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const firstText = (...values: unknown[]) => values.map(asText).find(Boolean) ?? '';
const clip = (value: string, max: number, warnings: string[], label: string) => {
  if (value.length <= max) return value;
  warnings.push(`${label}超过 ${max} 字，已按 Kirakira 字段上限截取。`);
  return value.slice(0, max).trim();
};
function normalizeTags(value: unknown) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，、|/\n]/) : [];
  return [...new Set(items.map(item => asText(item).replace(/^#/, '')).filter(Boolean))].slice(0, 8).map(tag => tag.slice(0, 20));
}
function voiceFor(text: string): CharacterImportDraft['voice'] {
  if (/元气|活泼|开朗|阳光|热烈/.test(text)) return '元气';
  if (/沉稳|可靠|寡言|成熟|稳重/.test(text)) return '沉稳';
  if (/清冷|克制|疏离|冷静|理性/.test(text)) return '清冷';
  return '温柔';
}
function replaceMacros(value: string, name: string) {
  return value.replace(/{{\s*char\s*}}|<BOT>/gi, name || '角色').replace(/{{\s*user\s*}}|<USER>/gi, '你');
}
function quotedValues(value: string) {
  return [...value.matchAll(/["']([^"']+)["']/g)].map(match => match[1].trim()).filter(Boolean);
}
function embeddedCharacterFields(description: string, name: string) {
  const personality = description.match(/\[\s*[^\]]*personality\s*=([^\]]+)\]/i)?.[1] ?? '';
  const scenario = description.match(/scenario\s*:\s*([^\]\r\n]+)/i)?.[1]?.trim() ?? '';
  const body = description.match(/\[\s*[^\]]*(?:body|appearance|features)\s*=([^\]]+)\]/i)?.[1] ?? '';
  const traits = quotedValues(personality);
  const features = quotedValues(body);
  return {
    personality: traits.join('，'),
    scenario,
    description: [
      traits.length ? `${name || '该角色'}是${traits.slice(0, 8).join('、')}的角色。` : '',
      features.length ? `外貌特征：${features.slice(0, 8).join('、')}。` : '',
    ].filter(Boolean).join('\n'),
  };
}
function normalizeLorebook(value: unknown): CharacterLoreEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const book = value as Record<string, unknown>;
  const rawEntries = Array.isArray(book.entries) ? book.entries : book.entries && typeof book.entries === 'object' ? Object.values(book.entries as Record<string, unknown>) : [];
  const seen = new Set<string>();
  const entries: CharacterLoreEntry[] = [];
  for (const [index, value] of rawEntries.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    const content = asText(entry.content).slice(0, 2000);
    if (!content) continue;
    const keywords = normalizeTags(entry.keys ?? entry.key).slice(0, 12);
    const signature = `${keywords.join('|')}\n${content}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    entries.push({
      id: asText(entry.id ?? entry.uid) || String(index),
      title: firstText(entry.comment, entry.name, `世界设定 ${index + 1}`).slice(0, 60),
      keywords,
      content,
      constant: entry.constant === true,
      enabled: entry.enabled !== false && entry.disable !== true,
      priority: Number.isFinite(Number(entry.insertion_order ?? entry.order)) ? Number(entry.insertion_order ?? entry.order) : 100,
    });
    if (entries.length >= 20 || entries.reduce((sum, item) => sum + item.content.length, 0) >= 12_000) break;
  }
  return entries;
}
function finalize(draft: CharacterImportDraft, source: CharacterCardParseResult['source'], avatar?: Blob, extraWarnings: string[] = []): CharacterCardParseResult {
  const warnings = [...extraWarnings];
  draft.description = replaceMacros(draft.description, draft.name);
  draft.personality = replaceMacros(draft.personality, draft.name);
  draft.greeting = replaceMacros(draft.greeting, draft.name);
  draft.scenario = replaceMacros(draft.scenario, draft.name);
  draft.lorebook = draft.lorebook.map(entry => ({ ...entry, content: replaceMacros(entry.content, draft.name) }));
  draft.name = clip(draft.name, limits.name, warnings, '角色名');
  draft.description = clip(draft.description, limits.description, warnings, '人设');
  draft.personality = clip(draft.personality, limits.personality, warnings, '性格');
  draft.greeting = clip(draft.greeting, limits.greeting, warnings, '开场白');
  draft.scenario = clip(draft.scenario, limits.scenario, warnings, '剧情背景');
  draft.tags = normalizeTags(draft.tags);
  draft.voice = voiceFor(`${draft.personality} ${draft.description} ${draft.tags.join(' ')}`);
  const fields: [TextDraftKey, string][] = [['name', '角色名'], ['description', '人设'], ['personality', '性格'], ['greeting', '开场白'], ['scenario', '剧情背景']];
  for (const [key, label] of fields) if (!draft[key]) warnings.push(`${label}未识别，请在创建前补充。`);
  if (!draft.tags.length) warnings.push('标签未识别，可在预览中补充。');
  if (!avatar) warnings.push('角色卡未包含可用头像，将使用默认头像。');
  return { draft, avatar, warnings: [...new Set(warnings)], source };
}

function decodeBase64Text(value: string) {
  const normalized = value.replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function dataImage(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^data:image\/png;base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return undefined;
  try {
    const binary = atob(match[1].replace(/\s/g, ''));
    return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: 'image/png' });
  } catch { return undefined; }
}
function fromObject(raw: unknown, source: 'PNG' | 'JSON', avatar?: Blob) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('角色卡 JSON 结构不正确。');
  const root = raw as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data as Record<string, unknown> : root;
  const draft = blankDraft();
  draft.name = firstText(data.name, root.name, data.char_name, root.char_name);
  draft.description = firstText(data.description, data.char_persona, data.persona, root.description, root.char_persona, root.persona);
  draft.personality = firstText(data.personality, root.personality);
  draft.greeting = firstText(data.first_mes, data.first_message, data.greeting, root.first_mes, root.first_message, root.greeting);
  draft.scenario = firstText(data.scenario, data.background, data.world, root.scenario, root.background, root.world);
  draft.tags = normalizeTags(data.tags ?? root.tags);
  const embedded = embeddedCharacterFields(draft.description, draft.name);
  if (!draft.personality) draft.personality = embedded.personality;
  if (!draft.scenario) draft.scenario = embedded.scenario;
  if (embedded.description) draft.description = embedded.description;
  draft.lorebook = normalizeLorebook(data.character_book ?? root.character_book);
  const creator = firstText(data.creator, root.creator);
  draft.provenance = creator || data.character_version || data.creator_notes ? {
    author: creator,
    version: firstText(data.character_version, root.character_version),
    notes: firstText(data.creator_notes, root.creator_notes, root.creatorcomment),
    source: source === 'PNG' ? '角色卡 PNG' : '角色卡 JSON',
    license: '',
  } : undefined;
  const embeddedAvatar = avatar ?? dataImage(data.avatar) ?? dataImage(root.avatar) ?? dataImage(data.image) ?? dataImage(root.image);
  return finalize(draft, source, embeddedAvatar);
}

async function inflate(bytes: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持压缩 PNG 角色卡，请改用 JSON 角色卡。');
  const stream = new Blob([Uint8Array.from(bytes).buffer]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function zero(bytes: Uint8Array, start: number) {
  const found = bytes.indexOf(0, start);
  if (found < 0) throw new Error('PNG 角色卡元数据损坏。');
  return found;
}
async function pngMetadata(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value)) throw new Error('文件不是有效的 PNG 图片。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    if (length > 8_000_000 || offset + 12 + length > bytes.length) throw new Error('PNG 角色卡文件损坏。');
    const type = new TextDecoder('latin1').decode(bytes.slice(offset + 4, offset + 8));
    const chunk = bytes.slice(offset + 8, offset + 8 + length);
    let keyword = '', payload = '';
    if (type === 'tEXt') {
      const split = zero(chunk, 0); keyword = new TextDecoder('latin1').decode(chunk.slice(0, split)); payload = new TextDecoder('latin1').decode(chunk.slice(split + 1));
    } else if (type === 'zTXt') {
      const split = zero(chunk, 0); keyword = new TextDecoder('latin1').decode(chunk.slice(0, split)); payload = new TextDecoder().decode(await inflate(chunk.slice(split + 2)));
    } else if (type === 'iTXt') {
      const split = zero(chunk, 0); keyword = new TextDecoder('latin1').decode(chunk.slice(0, split));
      const compressed = chunk[split + 1] === 1; let cursor = split + 3;
      cursor = zero(chunk, cursor) + 1; cursor = zero(chunk, cursor) + 1;
      payload = new TextDecoder().decode(compressed ? await inflate(chunk.slice(cursor)) : chunk.slice(cursor));
    }
    if (/^(chara|ccv3)$/i.test(keyword)) {
      try { return JSON.parse(payload.trim().startsWith('{') ? payload : decodeBase64Text(payload)) as unknown; }
      catch { throw new Error('PNG 中的角色卡信息无法解析，请尝试导出为 JSON 后再导入。'); }
    }
    offset += length + 12;
    if (type === 'IEND') break;
  }
  throw new Error('这张 PNG 没有检测到角色卡信息。请上传带有 chara 元数据的 PNG，或改用 JSON / TXT。');
}

function fromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('TXT 角色卡内容为空。');
  if (trimmed.startsWith('{')) {
    try { return fromObject(JSON.parse(trimmed), 'JSON'); }
    catch (error) { if (error instanceof SyntaxError) throw new Error('JSON 格式不正确，请检查逗号、引号和括号。'); throw error; }
  }
  const draft = blankDraft();
  const sections = new Map<TextDraftKey, string[]>();
  let active: TextDraftKey | null = null;
  const loose: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const heading = line.match(/^\s*(?:#{1,4}\s*)?([\w\u4e00-\u9fff _-]{1,20})\s*[:：]\s*(.*)$/);
    const key = heading ? labels[heading[1].trim().toLowerCase()] : undefined;
    if (key) {
      active = key;
      const value = heading?.[2]?.trim();
      if (value) sections.set(key, [...(sections.get(key) ?? []), value]);
    } else if (active && line.trim()) sections.set(active, [...(sections.get(active) ?? []), line.trim()]);
    else if (line.trim()) loose.push(line.trim());
  }
  draft.name = (sections.get('name') ?? []).join(' ').trim();
  draft.description = (sections.get('description') ?? []).join('\n').trim();
  draft.personality = (sections.get('personality') ?? []).join('\n').trim();
  draft.greeting = (sections.get('greeting') ?? []).join('\n').trim();
  draft.scenario = (sections.get('scenario') ?? []).join('\n').trim();
  draft.tags = normalizeTags((sections.get('tags') ?? []).join(','));
  const extra: string[] = [];
  if (!draft.description && loose.length) {
    draft.description = loose.join('\n');
    extra.push('未识别到明确字段，已把未分段文字放入人设，请检查后再创建。');
  }
  return finalize(draft, 'TXT', undefined, extra);
}

export async function parseCharacterCard(file: File): Promise<CharacterCardParseResult> {
  if (file.size > 8_000_000) throw new Error('角色卡不能超过 8 MB。');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (file.type === 'image/png' || extension === 'png') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return fromObject(await pngMetadata(bytes), 'PNG', file);
  }
  if (file.type === 'application/json' || extension === 'json') {
    try { return fromObject(JSON.parse(await file.text()), 'JSON'); }
    catch (error) { if (error instanceof SyntaxError) throw new Error('JSON 格式不正确，请检查逗号、引号和括号。'); throw error; }
  }
  if (file.type.startsWith('text/') || extension === 'txt') return fromText(await file.text());
  throw new Error('暂不支持这个文件格式，请上传 PNG、JSON 或 TXT 角色卡。');
}

export function characterImportIssues(draft: CharacterImportDraft) {
  const issues: string[] = [];
  if (!draft.name.trim()) issues.push('请补充角色名');
  if (!draft.description.trim()) issues.push('请补充人设');
  if (!draft.personality.trim()) issues.push('请补充性格');
  if (!draft.greeting.trim()) issues.push('请补充开场白');
  if (!draft.scenario.trim()) issues.push('请补充剧情背景');
  return issues;
}

export function characterTagline(description: string) {
  const first = description.trim().split(/[。！？!?\n]/)[0] || description.trim();
  return first.slice(0, 60);
}
