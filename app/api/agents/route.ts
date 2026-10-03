import { discoveryDatabase } from '@/lib/discovery-server';
import { ownsGeneratedImage } from '@/lib/multimodal-server';
import { resourceOwner, ownerHeaders } from '@/lib/account-identity';

const avatarChoices = ['/avatars/avatar-01.webp', '/avatars/avatar-02.webp', '/avatars/avatar-03.jpg', '/avatars/avatar-06.webp', '/avatars/avatar-09.webp', '/avatars/avatar-15.jpg'];
function identity(request: Request) {
  return resourceOwner(request);
}
function respond(request: Request, visitor: string, data: unknown, status = 200) {
  return Response.json(data, { status, headers: ownerHeaders(request, visitor) });
}
function hasUnsafeControl(value: string) {
  for (let index = 0; index < value.length; index++) { const code = value.charCodeAt(index); if (code < 32 && code !== 9 && code !== 10 && code !== 13 || code === 127) return true; }
  return false;
}
const clean = (value: unknown, max: number) => typeof value === 'string' && value.trim() && value.trim().length <= max && !hasUnsafeControl(value) ? value.trim() : null;
function cleanTags(value: unknown) {
  if (!Array.isArray(value) || value.length > 8) return [];
  return [...new Set(value.map(tag => clean(tag, 20)).filter((tag): tag is string => Boolean(tag)))];
}
type LoreEntry = { id: string; title: string; keywords: string[]; content: string; constant: boolean; enabled: boolean; priority: number };
function cleanLorebook(value: unknown): LoreEntry[] {
  if (!Array.isArray(value) || value.length > 20) return [];
  const entries: LoreEntry[] = [];
  let total = 0;
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const content = clean(item.content, 2000), title = clean(item.title, 60) ?? `世界设定 ${index + 1}`;
    if (!content || total + content.length > 12_000) continue;
    const keywords = Array.isArray(item.keywords) ? [...new Set(item.keywords.map(keyword => clean(keyword, 30)).filter((keyword): keyword is string => Boolean(keyword)))].slice(0, 12) : [];
    entries.push({ id: clean(item.id, 80) ?? String(index), title, keywords, content, constant: item.constant === true, enabled: item.enabled !== false, priority: Number.isFinite(Number(item.priority)) ? Math.max(-1000, Math.min(1000, Number(item.priority))) : 100 });
    total += content.length;
  }
  return entries;
}
function cleanProvenance(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const item = value as Record<string, unknown>;
  return { author: clean(item.author, 80) ?? '', version: clean(item.version, 40) ?? '', notes: clean(item.notes, 300) ?? '', source: clean(item.source, 160) ?? '', license: clean(item.license, 40) ?? '' };
}
function contentSafety(values: string[]) {
  const content = values.join('\n');
  if (/(忽略|覆盖|绕过).{0,12}(系统|规则|指令|安全)|system\s*prompt|developer\s*message|jailbreak|越狱提示/i.test(content)) return '角色卡包含试图覆盖系统规则的内容，请删除后再创建。';
  const mentionsMinor = /未成年|幼女|正太|小学生|初中生|高中生|(?:^|\D)(?:[0-9]|1[0-7])\s*岁/.test(content);
  const sexual = /色情|性爱|性交|性奴|调教|强奸|裸照|露骨|未成年人性内容/.test(content);
  if (mentionsMinor && sexual) return '角色卡包含未成年人性内容，无法创建。';
  if (/鼓励.{0,8}(自杀|自残)|自杀教程|伤害现实中的人|现实伤害计划/.test(content)) return '角色卡包含鼓励自伤或现实伤害的内容，无法创建。';
  return '';
}
export async function GET(request: Request) {
  const visitor = identity(request);
  try {
    const rows = await discoveryDatabase().prepare('SELECT id, name, avatar, tagline, description, personality, background, greeting, tags, lorebook, provenance, voice, created_at FROM agent_profiles WHERE visitor = ? ORDER BY created_at DESC LIMIT 20').bind(visitor).all<{tags:string;lorebook:string;provenance:string}>();
    return respond(request, visitor, { agents: rows.results.map(row => {
      let lorebook: LoreEntry[] = [], provenance = {};
      try { lorebook = cleanLorebook(JSON.parse(row.lorebook || '[]')); } catch {}
      try { provenance = cleanProvenance(JSON.parse(row.provenance || '{}')); } catch {}
      return { ...row, tags: cleanTags(JSON.parse(row.tags || '[]')), lorebook, provenance };
    }) });
  } catch { return respond(request, visitor, { error: '智能体暂时无法加载，请重试。' }, 503); }
}
export async function POST(request: Request) {
  const visitor = identity(request);
  if (request.headers.get('origin') !== new URL(request.url).origin) return respond(request, visitor, { error: '请求来源无效。' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return respond(request, visitor, { error: '内容格式不正确。' }, 415);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 40_000) return respond(request, visitor, { error: '内容过长。' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const name = clean(body.name, 20), tagline = clean(body.tagline, 60), description = clean(body.description, 1000) ?? tagline, personality = clean(body.personality, 500), background = clean(body.background, 1000), greeting = clean(body.greeting, 300);
    const tags = cleanTags(body.tags);
    const lorebook = cleanLorebook(body.lorebook), provenance = cleanProvenance(body.provenance);
    const avatar = typeof body.avatar === 'string' && (avatarChoices.includes(body.avatar) || await ownsGeneratedImage(visitor, body.avatar)) ? body.avatar : null;
    const voice = typeof body.voice === 'string' && ['温柔', '清冷', '元气', '沉稳'].includes(body.voice) ? body.voice : null;
    if (!name || !avatar || !tagline || !description || !personality || !background || !greeting || !voice) return respond(request, visitor, { error: '请完整填写智能体资料，并检查字段长度。' }, 400);
    const safetyError = contentSafety([name, tagline, description, personality, background, greeting, ...tags, ...lorebook.map(entry => entry.content)]);
    if (safetyError) return respond(request, visitor, { error: safetyError }, 422);
    const count = await discoveryDatabase().prepare('SELECT COUNT(*) AS count FROM agent_profiles WHERE visitor = ?').bind(visitor).first<{ count: number }>();
    if ((count?.count ?? 0) >= 20) return respond(request, visitor, { error: '当前最多创建 20 个智能体。' }, 409);
    const id = crypto.randomUUID(), createdAt = new Date().toISOString();
    await discoveryDatabase().prepare('INSERT INTO agent_profiles (id, visitor, name, avatar, tagline, description, personality, background, greeting, tags, lorebook, provenance, voice, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, visitor, name, avatar, tagline, description, personality, background, greeting, JSON.stringify(tags), JSON.stringify(lorebook), JSON.stringify(provenance), voice, createdAt).run();
    return respond(request, visitor, { agent: { id, name, avatar, tagline, description, personality, background, greeting, tags, lorebook, provenance, voice, created_at: createdAt } }, 201);
  } catch { return respond(request, visitor, { error: '创建失败，填写内容仍保留，请重试。' }, 503); }
}
