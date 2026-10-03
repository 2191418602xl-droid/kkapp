'use client';

/* oxlint-disable next/no-img-element -- Imported local previews and private stored avatars use dynamic URLs. */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, Check, ExternalLink, FileJson, FileText, Image, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { characterImportIssues, characterTagline, parseCharacterCard, type CharacterImportDraft } from '@/lib/character-card';
import type { AgentProfile } from '@/components/agent-studio';

const fallbackAvatar = '/avatars/avatar-01.webp';

export function CharacterCardImport({ onBack, onCreated }: { onBack: () => void; onCreated: (agent: AgentProfile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CharacterImportDraft | null>(null);
  const [avatar, setAvatar] = useState<Blob | undefined>();
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState<'PNG' | 'JSON' | 'TXT' | ''>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);

  const avatarPreview = useMemo(() => avatar ? URL.createObjectURL(avatar) : '', [avatar]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  async function read(file?: File) {
    if (!file || parsing || busy) return;
    setParsing(true); setError(''); setDraft(null); setFileName(file.name);
    try {
      const result = await parseCharacterCard(file);
      setDraft(result.draft); setAvatar(result.avatar); setWarnings(result.warnings); setSource(result.source);
    } catch (reason) {
      setAvatar(undefined); setWarnings([]); setSource('');
      setError(reason instanceof Error ? reason.message : '角色卡解析失败，请换一个文件重试。');
    } finally { setParsing(false); }
  }
  function choose(event: ChangeEvent<HTMLInputElement>) {
    void read(event.target.files?.[0]);
    event.target.value = '';
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void read(event.dataTransfer.files?.[0]);
  }
  function update<K extends keyof CharacterImportDraft>(key: K, value: CharacterImportDraft[K]) {
    setDraft(current => current ? { ...current, [key]: value } : current);
  }
  async function persist(nextDraft: CharacterImportDraft, nextAvatar?: Blob) {
      let avatarUrl = fallbackAvatar;
      if (nextAvatar) {
        const upload = await fetch('/api/media/imports', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: nextAvatar });
        const uploaded = await upload.json() as { image?: { url?: string }; error?: string };
        if (!upload.ok || !uploaded.image?.url) throw new Error(uploaded.error || '头像保存失败，请重试。');
        avatarUrl = uploaded.image.url;
      }
      const response = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: nextDraft.name,
        avatar: avatarUrl,
        tagline: characterTagline(nextDraft.description),
        description: nextDraft.description,
        personality: nextDraft.personality,
        background: nextDraft.scenario,
        greeting: nextDraft.greeting,
        tags: nextDraft.tags,
        lorebook: nextDraft.lorebook,
        provenance: nextDraft.provenance,
        voice: nextDraft.voice,
      }) });
      const data = await response.json() as { agent?: AgentProfile; error?: string };
      if (!response.ok || !data.agent) throw new Error(data.error || '角色创建失败，请重试。');
      onCreated(data.agent);
  }
  async function create() {
    if (!draft || characterImportIssues(draft).length || busy) return;
    setBusy(true); setError('');
    try {
      await persist(draft, avatar);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '角色创建失败，请重试。'); }
    finally { setBusy(false); }
  }
  async function importOpenExample() {
    if (busy || parsing) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/character-packs/default_Seraphina.png');
      if (!response.ok) throw new Error('开源示例包暂时无法读取。');
      const file = new File([await response.blob()], 'default_Seraphina.png', { type: 'image/png' });
      const result = await parseCharacterCard(file);
      result.draft.provenance = {
        author: 'OtisAlejandro', version: '1.0.0', notes: 'SillyTavern Default Bot contest winner',
        source: 'SillyTavern 1.19.0 官方默认示例', license: 'AGPL-3.0',
      };
      if (characterImportIssues(result.draft).length) throw new Error('开源示例包字段不完整，请使用手动上传预览。');
      await persist(result.draft, result.avatar);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '开源示例导入失败，请重试。'); }
    finally { setBusy(false); }
  }

  const liveIssues = draft ? characterImportIssues(draft) : [];
  const notes = [...new Set([
    ...warnings.filter(item => !/未识别，请在创建前补充|未包含可用头像/.test(item)),
    ...liveIssues.map(item => `${item.replace(/^请补充/, '')}未识别，请在创建前补充。`),
    ...(!avatar && draft ? ['角色卡未包含可用头像，将使用 Kirakira 默认头像。'] : []),
  ])];

  return <div className="screen scroll-screen agent-studio-screen import-screen">
    <header className="agent-studio-header"><button onClick={onBack} aria-label="返回创建角色"><ArrowLeft /></button><span><b>一键导入角色卡</b><small>支持 PNG / JSON / TXT</small></span></header>
    <input ref={input} className="import-file-input" type="file" accept=".png,.json,.txt,image/png,application/json,text/plain" onChange={choose} />
    {!draft && <div className="import-start">
      <section className="import-intro"><span><Upload /></span><div><small>KIRAKIRA IMPORT</small><h2>把熟悉的角色带进来</h2><p>角色卡只会先解析成预览。确认资料后，才会保存为你的私有角色。</p></div></section>
      <section className="import-open-example"><span><Sparkles /></span><div><small>OPEN SOURCE EXAMPLE</small><b>Seraphina + Eldoria</b><p>官方示例角色、开场剧情与 4 条动态世界设定。</p><a href="https://github.com/SillyTavern/SillyTavern" target="_blank" rel="noreferrer">OtisAlejandro · AGPL-3.0 <ExternalLink /></a></div><button type="button" disabled={busy} onClick={() => void importOpenExample()}>{busy ? <LoaderCircle className="import-spin" /> : <BookOpen />}{busy ? '正在导入…' : '一键导入'}</button></section>
      <div className={`import-dropzone${error ? ' has-error' : ''}`} onDragOver={event => event.preventDefault()} onDrop={drop}>
        {parsing ? <><LoaderCircle className="import-spin" /><b>正在读取角色卡…</b><p>正在识别角色信息与头像</p></> : <><Upload /><b>{error ? '换一个文件重试' : '选择角色卡文件'}</b><p>拖到这里，或点击选择文件</p><button type="button" onClick={() => input.current?.click()}>选择 PNG / JSON / TXT</button></>}
      </div>
      {error && <div className="import-error" role="alert"><AlertTriangle /><span><b>导入失败</b>{error}</span></div>}
      <div className="import-format-grid"><div><Image /><b>PNG</b><small>读取图片内的角色卡数据，并用作头像</small></div><div><FileJson /><b>JSON</b><small>兼容常见 Character Card V2 / V3 字段</small></div><div><FileText /><b>TXT</b><small>识别中英文标题分段的角色设定</small></div></div>
      <p className="import-privacy"><ShieldCheck />导入内容默认仅自己可见；创建前会检查字段完整性和基础内容安全。</p>
    </div>}
    {draft && <form className="agent-create-form import-preview" onSubmit={event => { event.preventDefault(); void create(); }}>
      <section className="import-summary">
        <div className="import-avatar"><img src={avatarPreview || fallbackAvatar} alt="导入角色头像预览" /><span>{source}</span></div>
        <div><small>已读取角色卡</small><h2>{draft.name || '等待补充角色名'}</h2><p>{fileName}</p></div>
        <Check />
      </section>
      {notes.length > 0 && <section className="import-warnings"><div><AlertTriangle /><b>请检查这些内容</b></div><ul>{notes.map(note => <li key={note}>{note}</li>)}</ul></section>}
      <section><div className="agent-step"><i>1</i><span><b>角色名片</b><small>核对角色名、人设和标签</small></span></div>
        <label>角色名<input required maxLength={20} value={draft.name} onChange={event => update('name', event.target.value)} placeholder="请输入角色名" />{!draft.name.trim() && <em>必填</em>}</label>
        <label>人设<textarea required maxLength={1000} rows={5} value={draft.description} onChange={event => update('description', event.target.value)} placeholder="角色身份、经历和核心设定" />{!draft.description.trim() && <em>必填</em>}</label>
        <label>标签<input maxLength={180} value={draft.tags.join('，')} onChange={event => update('tags', event.target.value.split(/[,，、]/).map(item => item.trim()).filter(Boolean).slice(0, 8))} placeholder="温柔，慢热，治愈" /><small>最多 8 个，用逗号分隔</small></label>
      </section>
      <section><div className="agent-step"><i>2</i><span><b>对话设定</b><small>这些内容会决定角色如何回应</small></span></div>
        <label>性格<textarea required maxLength={500} rows={4} value={draft.personality} onChange={event => update('personality', event.target.value)} placeholder="说话方式、在意的事和情绪反应" />{!draft.personality.trim() && <em>必填</em>}</label>
        <label>剧情背景<textarea required maxLength={1000} rows={5} value={draft.scenario} onChange={event => update('scenario', event.target.value)} placeholder="你们的关系、相遇地点和故事背景" />{!draft.scenario.trim() && <em>必填</em>}</label>
        <label>开场白<textarea required maxLength={300} rows={4} value={draft.greeting} onChange={event => update('greeting', event.target.value)} placeholder="第一次见面时，TA 会说什么？" />{!draft.greeting.trim() && <em>必填</em>}</label>
        <div className="agent-voice-row"><span>声音氛围</span>{(['温柔', '清冷', '元气', '沉稳'] as const).map(voice => <button type="button" key={voice} aria-pressed={draft.voice === voice} onClick={() => update('voice', voice)}>{voice}</button>)}</div>
      </section>
      {draft.lorebook.length > 0 && <section className="import-lorebook"><div className="agent-step"><i>3</i><span><b>世界书 / 剧情触发</b><small>聊天中出现关键词时，自动注入对应设定</small></span></div><div>{draft.lorebook.map(entry => <article key={entry.id}><BookOpen /><span><b>{entry.title}</b><small>{entry.constant ? '始终生效' : entry.keywords.length ? `触发：${entry.keywords.join('、')}` : '按需触发'}</small></span></article>)}</div></section>}
      {draft.provenance && <p className="import-provenance">来源：{draft.provenance.source}{draft.provenance.author ? ` · ${draft.provenance.author}` : ''}{draft.provenance.license ? ` · ${draft.provenance.license}` : ''}</p>}
      {error && <div className="import-error" role="alert"><AlertTriangle /><span><b>创建失败</b>{error}</span></div>}
      <div className="import-actions"><button type="button" className="import-retry" disabled={busy} onClick={() => input.current?.click()}><RefreshCw />重新上传</button><button className="agent-create-submit" disabled={busy || liveIssues.length > 0}><Check />{busy ? '正在创建…' : '确认并进入聊天'}</button></div>
      <p className="agent-create-note">确认后保存为当前浏览器的私有角色。角色由 AI 扮演，导入设定不能覆盖 Kirakira 的安全规则。</p>
    </form>}
  </div>;
}
