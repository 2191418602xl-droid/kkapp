'use client';

import { track,testMode } from '@/lib/e2e-client';
/* oxlint-disable next/no-img-element -- Supplied local avatars are rendered directly in the portable preview. */
import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ArrowLeft, Bot, Check, ChevronRight, ImageIcon, Plus, Search, Upload, WandSparkles, X } from 'lucide-react';
import { CharacterChat, type ChatMessage } from '@/components/character-chat';
import { CharacterCardImport } from '@/components/character-card-import';
import { MultimodalStudio } from '@/components/multimodal-studio';
import { LLMChat } from '@/components/llm-chat';
import { DiscoveryPlay } from '@/components/discovery-play';

export type AgentProfile = { id: number | string; name: string; avatar: string; tagline: string; description?: string; personality?: string; background?: string; greeting: string; tags?: string[]; voice: string };
const recommended: AgentProfile[] = [
  { id: 1, name: '许朝', avatar: '/avatars/avatar-17.webp', tagline: '冷静克制，也会认真记住你的感受', greeting: '（合上手边的书，抬眼看向你）来了？今天想从哪里开始说？', voice: '沉稳' },
  { id: 2, name: '岚川', avatar: '/avatars/avatar-07.jpg', tagline: '雨夜里总会替你留一把伞', greeting: '（把伞向你这边倾了倾）别站在雨里。先过来，再慢慢告诉我发生了什么。', voice: '温柔' },
  { id: 3, name: '沈羡安', avatar: '/avatars/avatar-06.webp', tagline: '从容温柔，偶尔会轻轻打趣你', greeting: '（替你拉开椅子，眼底带着一点笑）坐吧，我正好也在等一个愿意分享故事的人。', voice: '清冷' },
  { id: 5, name: '傅砚辞', avatar: '/avatars/avatar-11.webp', tagline: '寡言可靠，用行动回应每一次靠近', greeting: '（指尖在表带上停了一瞬）时间还早。你想说的话，我都听着。', voice: '沉稳' },
];
const avatars = ['/avatars/avatar-01.webp', '/avatars/avatar-02.webp', '/avatars/avatar-03.jpg', '/avatars/avatar-06.webp', '/avatars/avatar-09.webp', '/avatars/avatar-15.jpg'];
const initialForm = { name: '', avatar: '', tagline: '', personality: '', background: '', greeting: '', voice: '温柔' };

export function useAgentLibrary() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setStatus('loading'); setError('');
    try {
      const response = await fetch('/api/agents', { signal: controller.signal });
      const data = await response.json() as { agents?: AgentProfile[]; error?: string };
      if (!response.ok || !Array.isArray(data.agents)) throw new Error(data.error || '智能体暂时无法加载，请重试。');
      if (!controller.signal.aborted) { setAgents(data.agents); setStatus('ready'); }
    } catch (e) {
      if (pending.current === controller) { setError(controller.signal.aborted ? '加载超时，请检查网络后重试。' : e instanceof Error ? e.message : '智能体加载失败。'); setStatus('error'); }
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);
  // oxlint-disable-next-line react/react-compiler -- Synchronize the initial private-role list with the remote API and cancel it on unmount.
  useEffect(() => { void refresh(); return () => { pending.current?.abort(); pending.current = null; }; }, [refresh]);
  function add(agent: AgentProfile) {
    // Do not let an older in-flight list response remove the newly created role.
    pending.current?.abort();
    pending.current = null;
    setAgents(current => [agent, ...current.filter(item => item.id !== agent.id)]);
    setStatus('ready'); setError('');
    void refresh();
  }
  return { agents, status, error, refresh, add };
}

export function AgentStudio({ library, active, onSelect, onBack, mineRequest, backLabel = '返回智能体列表' }: {
  library: ReturnType<typeof useAgentLibrary>;
  active: AgentProfile | null;
  onSelect: (agent: AgentProfile) => void;
  onBack: () => void;
  mineRequest: number;
  backLabel?: string;
}) {
  const { agents } = library;
  useEffect(()=>{const seen=new Set<Element>();const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting&&!seen.has(entry.target)){seen.add(entry.target);track('role_exposure',{characterId:(entry.target as HTMLElement).dataset.roleId});}}),{threshold:0.4});const timer=setInterval(()=>{if(testMode()&&!sessionStorage.getItem('kk-login-pending'))document.querySelectorAll('[data-role-id]').forEach(el=>observer.observe(el));},500);return()=>{clearInterval(timer);observer.disconnect();};},[]);
  const [tab, setTab] = useState<'推荐' | '我的'>('推荐');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [worldMode, setWorldMode] = useState<'create' | 'drafts' | null>(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [imageStyle, setImageStyle] = useState<'清新动漫' | '厚涂漫画' | '写实人像'>('清新动漫');
  const [imageDescription, setImageDescription] = useState('');
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  const [seenMineRequest, setSeenMineRequest] = useState(mineRequest);
  if (seenMineRequest !== mineRequest) {
    setSeenMineRequest(mineRequest); setTab('我的'); setQuery(''); setCreating(false); setImporting(false); setAssisting(false); setWorldMode(null);
  }
  async function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form.avatar) { setError('请先生成图片或选择现有形象。'); return; } setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json() as { agent?: AgentProfile; error?: string };
      if (!response.ok || !data.agent) throw new Error(data.error || '创建失败。');
      library.add(data.agent);
      setForm(initialForm); setCreating(false); setTab('我的'); setStatus('智能体已创建，可以开始对话');
    } catch (e) { setError(e instanceof Error ? e.message : '创建失败，请重试。'); }
    finally { setBusy(false); }
  }
  if (worldMode) return <DiscoveryPlay name="创作中心" worlds={[]} onWorld={() => {}} onBack={() => setWorldMode(null)} initialCreatorMode={worldMode} />;
  if (active) {
    const key = String(active.id);
    return <CharacterChat contact={{ id: active.id, name: active.name, image: active.avatar, preview: active.greeting, voice: active.voice }} messages={histories[key] ?? [{ role: 'assistant', content: active.greeting }]} onMessages={messages => setHistories(current => ({ ...current, [key]: messages }))} onBack={onBack} backLabel={backLabel} />;
  }
  if (assisting) return <div className="screen creator-ai-screen"><div className="creator-ai-toolbar"><button onClick={() => setAssisting(false)}><ArrowLeft />创作者中心</button><button onClick={() => { setAssisting(false); setCreating(true); }}>填写角色资料<ChevronRight /></button></div><LLMChat onUseDraft={draft => { setForm(value => ({ ...value, background: draft.slice(0, 1000) })); setAssisting(false); setCreating(true); }} /></div>;
  if (importing) return <CharacterCardImport onBack={() => setImporting(false)} onCreated={agent => {
    library.add(agent); setImporting(false); setCreating(false); setTab('我的'); setStatus('角色卡已导入'); onSelect(agent);
  }} />;
  if (creating) return <div className="screen scroll-screen agent-studio-screen agent-create-screen">
    <header className="agent-studio-header"><button type="button" onClick={() => setCreating(false)} aria-label="返回创作"><ArrowLeft /></button><span><b>创建角色</b><small>让你想象中的 TA 有形象、有故事</small></span></header>
    <form className="agent-create-form" onSubmit={create}>
      <section className="agent-visual-section">
        <div className="agent-step"><i>1</i><span><b>角色形象</b><small>先选一张形象，也可以描述并生成</small></span></div>
        {form.avatar && <div className="agent-visual-preview"><img src={form.avatar} alt="已选择的角色形象" /><span><ImageIcon />已选择形象</span></div>}
        <div className="agent-style-heading">绘画风格</div>
        <div className="agent-style-options">{(['清新动漫', '厚涂漫画', '写实人像'] as const).map(style => <button type="button" key={style} aria-pressed={imageStyle === style} onClick={() => setImageStyle(style)}>{style}</button>)}</div>
        <label>形象描述<textarea maxLength={300} rows={3} value={imageDescription} onChange={e => setImageDescription(e.target.value)} placeholder="描述发型、服装、神情和场景…" /></label>
        <div className="agent-generated-avatar"><MultimodalStudio initialPrompt={`${imageStyle}，成年角色形象，${imageDescription.trim() || form.tagline || '柔和光线，细腻人物肖像'}`} onUseImage={avatar => setForm(value => ({ ...value, avatar }))} /></div>
        <div className="agent-style-heading">或者选择现有形象</div>
        <div className="agent-avatar-picker">{avatars.map(avatar => <button type="button" key={avatar} className={form.avatar === avatar ? 'selected' : ''} aria-label="选择角色形象" aria-pressed={form.avatar === avatar} onClick={() => setForm(value => ({ ...value, avatar }))}><img src={avatar} alt="" />{form.avatar === avatar && <Check />}</button>)}</div>
      </section>
      <section><div className="agent-step"><i>2</i><span><b>角色资料</b><small>名字、身份和你们的故事</small></span></div><label>角色名字<input required maxLength={20} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="给 TA 起一个名字" /></label><label>一句话介绍<input required maxLength={60} value={form.tagline} onChange={e => setForm(v => ({ ...v, tagline: e.target.value }))} placeholder="例如：总会在雨夜为你留灯的人" /></label><label>性格设定<textarea required maxLength={500} rows={4} value={form.personality} onChange={e => setForm(v => ({ ...v, personality: e.target.value }))} placeholder="TA 如何说话、在意什么、遇到冲突会怎样回应…" /></label><label>身份与背景<textarea required maxLength={1000} rows={5} value={form.background} onChange={e => setForm(v => ({ ...v, background: e.target.value }))} placeholder="TA 的身份、你们的关系、故事发生在哪里…" /></label></section>
      <section><div className="agent-step"><i>3</i><span><b>初次见面</b><small>设定 TA 的声音和第一句话</small></span></div><div className="agent-voice-row"><span>声音氛围</span>{['温柔', '清冷', '元气', '沉稳'].map(voice => <button type="button" key={voice} aria-pressed={form.voice === voice} onClick={() => setForm(v => ({ ...v, voice }))}>{voice}</button>)}</div><label>开场白<textarea required maxLength={300} rows={3} value={form.greeting} onChange={e => setForm(v => ({ ...v, greeting: e.target.value }))} placeholder="TA 会怎样与你打招呼？" /></label></section>
      {error && <p className="agent-form-error" role="alert">{error}</p>}
      <button className="agent-create-submit" disabled={busy}><WandSparkles />{busy ? '正在创建…' : '创建角色'}</button>
      <p className="agent-create-note">创建后仅自己可见。角色由 AI 扮演，可在“我的角色”中继续对话。</p>
    </form>
  </div>;
  const visible = (tab === '推荐' ? recommended : agents).filter(agent => `${agent.name}${agent.tagline}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="screen scroll-screen agent-studio-screen agent-create-home">
    <header className="agent-studio-title"><span><small>KIRAKIRA · CREATOR STUDIO</small><h2>创作者中心</h2></span><button type="button" className="creator-import-top" onClick={() => setImporting(true)} title="导入 PNG、JSON、TXT 角色卡及世界书"><Upload size={18} />一键导入</button></header>
    <section className="agent-create-hero"><img src="/avatars/avatar-17.webp" alt="" /><div className="agent-create-hero-content"><small>把想象变成相遇</small><h3>创建一个<br />只属于你的角色</h3><p>定下 TA 的形象、性格和第一句话。</p><button type="button" onClick={() => setCreating(true)}><Plus />创建角色<ChevronRight /></button></div></section>
    <div className="creator-action-grid"><button type="button" onClick={() => setAssisting(true)}><WandSparkles /><b>AI 辅助创作</b><small>一起打磨人设、关系与故事</small></button><button type="button" onClick={() => setWorldMode('create')}><Plus /><b>创建世界／剧情</b><small>编写世界背景、关系与开场</small></button><button type="button" onClick={() => setWorldMode('drafts')}><Upload /><b>草稿箱</b><small>找回之前保存的世界，继续编辑</small></button><button type="button" onClick={() => { setTab('我的'); setQuery(''); requestAnimationFrame(() => document.getElementById('creator-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}><Bot /><b>我的作品</b><small>查看已创建角色，进入试聊</small></button></div>
    <div id="creator-works" className="agent-studio-tabs">{(['推荐', '我的'] as const).map(item => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item === '推荐' ? '灵感角色' : '我的角色'}{item === '我的' && <i>{library.status === 'ready' ? agents.length : '—'}</i>}</button>)}</div>
    <label className="agent-search"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={tab === '我的' ? '搜索我的角色' : '搜索灵感角色'} />{query && <button onClick={() => setQuery('')} aria-label="清空"><X /></button>}</label>
    {status && <output className="agent-studio-status"><Check />{status}</output>}
    {tab === '我的' && library.status === 'error' && <p className="agent-studio-error" role="alert">{library.error}<button onClick={() => void library.refresh()}>重试</button></p>}
    {tab === '我的' && library.status === 'loading' && <output className="agent-studio-status">正在加载你的智能体…</output>}
    {visible.length ? <div className="agent-card-grid">{visible.map(agent => <button data-role-id={agent.id} key={agent.id} onClick={() => {track('role_click',{characterId:agent.id});onSelect(agent);}}><img src={agent.avatar} alt={`${agent.name}头像`} /><span className="agent-card-shade" /><span className="agent-card-copy"><small>{agent.voice}声线</small><b>{agent.name}</b><em>{agent.tagline}</em></span><i><Bot />开始对话<ChevronRight /></i></button>)}</div> : (tab === '推荐' || library.status === 'ready') && <div className="agent-empty"><Bot /><b>{query ? '没有找到智能体' : '还没有自己的智能体'}</b><p>{query ? '换个名字或关键词试试。' : '写下名字、性格和故事背景，创建一个只属于你的角色。'}</p>{!query && <button onClick={() => setCreating(true)}><Plus />创建第一个智能体</button>}</div>}
    <p className="agent-disclosure">AI 生成内容仅供虚构角色互动。自建智能体按当前浏览器区分，清除 Cookie 或换设备后无法找回。</p>
  </div>;
}
