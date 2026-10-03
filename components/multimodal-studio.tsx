'use client';
/* oxlint-disable next/no-img-element -- Generated images use the private media endpoint. */
import { useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Download, ImagePlus, LoaderCircle, Square, Volume2, WandSparkles } from 'lucide-react';
import { MediaDialog } from '@/components/media-dialog';
import { mediaError, useModelSpeech } from '@/components/model-voice';
import { imageSizes, type GeneratedImage, type MediaStatus, type ModelVoice } from '@/lib/multimodal-shared';

function Studio({ initialPrompt, onUseImage }: { initialPrompt: string; onUseImage?: (url:string) => void }) {
  const [tab, setTab] = useState<'image'|'voice'>('image'), [prompt, setPrompt] = useState(initialPrompt);
  const [size, setSize] = useState<string>(imageSizes[0]);
  const [status, setStatus] = useState<MediaStatus | null>(null), [images, setImages] = useState<GeneratedImage[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GeneratedImage | null>(null), [voice, setVoice] = useState<ModelVoice>('claire');
  const [words, setWords] = useState('今天辛苦了。这里有一盏为你留着的灯，想说什么，我都听着。');
  const speech = useModelSpeech(); const pending = useRef<AbortController | null>(null); const lock = useRef(false);
  const voices = status?.voices ?? [];
  const activeVoice = voices.find(v => v.id === voice)?.id ?? voices[0]?.id;
  async function load(signal: AbortSignal) {
    setLoading(true); setError('');
    try {
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
      const response = await fetch('/api/media', { signal: bounded }); if (!response.ok) throw await mediaError(response); setStatus(await response.json() as MediaStatus);
      const library = await fetch('/api/media/images', { signal: bounded }); if (!library.ok) throw await mediaError(library);
      const data = await library.json() as {images:GeneratedImage[]}; setImages(data.images);
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : '加载失败。'); }
    finally { if (!signal.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); pending.current = controller; void load(controller.signal); return () => pending.current?.abort(); }, []);
  async function generate() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    const controller = new AbortController(); pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 125_000);
    try {
      const response = await fetch('/api/media/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ prompt, size }) });
      if (!response.ok) throw await mediaError(response);
      const data = await response.json() as {image:GeneratedImage};
      if (!controller.signal.aborted) { setImages(current => [data.image, ...current]); setSelected(data.image); }
    } catch (e) { setError(controller.signal.aborted ? '等待超时，请刷新图片库查看结果后再重试。' : e instanceof Error ? e.message : '生成失败。'); }
    finally { window.clearTimeout(timeout); lock.current = false; setBusy(false); }
  }
  return <div className="mm-studio">
    <div className="mm-tabs" role="group" aria-label="创作类型"><button type="button" aria-pressed={tab === 'image'} onClick={() => { speech.stop(); setTab('image'); }}><ImagePlus />文生图</button><button type="button" aria-pressed={tab === 'voice'} onClick={() => setTab('voice')}><AudioLines />声音工坊</button></div>
    {status && !(tab === 'image' ? status.image : status.speech) && <output className="mm-notice">{tab === 'image' ? status.imageProvider : status.speechProvider}尚未启用，等待管理员完成模型配置。</output>}
    {tab === 'image' ? <>
      <label>描述你想看到的画面<textarea maxLength={800} rows={4} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="例如：成年男性，黑发，白色衬衫，雨夜街角替你撑伞，细腻的二次元插画" /></label>
      <div className="mm-presets">{['成年角色头像，柔和光线，精致二次元插画', '海边书店，夕阳透过窗户，电影感场景', '古风长廊，夜色与灯笼，细腻国风插画'].map((example, i) => <button type="button" key={example} onClick={() => setPrompt(example)}>{['角色头像', '世界场景', '古风灵感'][i]}</button>)}</div>
      <div className="mm-ratios" role="group" aria-label="图片比例">{imageSizes.map((value, i) => <button type="button" key={value} aria-pressed={size === value} onClick={() => setSize(value)}>{['方形 1:1', '立绘 3:4', '壁纸 9:16'][i]}</button>)}</div>
      <button type="button" className="mm-primary" disabled={busy || !status?.image || !prompt.trim()} onClick={() => void generate()}>{busy ? <LoaderCircle className="mm-spin" /> : <WandSparkles />}{busy ? '正在绘制，请稍候…' : '生成图片'}</button>
      {busy && <p className="mm-help" role="status">关闭窗口后任务可能继续完成，可重新打开图片库查看。</p>}
      {selected && <figure className="mm-result"><img src={selected.url} alt={selected.prompt} /><figcaption><span>AI 生成</span><a href={selected.url} download><Download />下载</a>{onUseImage && <button type="button" onClick={() => onUseImage(selected.url)}><Check />用作角色头像</button>}</figcaption></figure>}
      <div className="mm-library-heading"><b>我的图片 · {images.length}</b><button type="button" disabled={busy || loading} onClick={() => { const controller = new AbortController(); pending.current = controller; void load(controller.signal); }}>刷新图片库</button></div>
      {loading ? <p role="status">正在加载图片…</p> : images.length ? <div className="mm-library">{images.map(image => <button type="button" key={image.id} aria-label={`查看图片：${image.prompt}`} onClick={() => setSelected(image)}><img src={image.url} alt={image.prompt} /><span>AI 生成</span></button>)}</div> : <div className="mm-empty"><ImagePlus /><p>写下第一段描述，创造你的角色与世界。</p></div>}
      <small>描述将发送至{status?.imageProvider || '所配置的生图服务'}。图片保存在当前浏览器对应的私人图片库（最多 30 张）；清除 Cookie 或换设备后无法找回，请及时下载。</small>
    </> : <>
      <label>选择声线<select value={activeVoice ?? ''} disabled={!voices.length} onChange={e => { speech.stop(); setVoice(e.target.value as ModelVoice); }}>{voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
      <label>让 TA 说的话<textarea maxLength={500} rows={4} value={words} onChange={e => { speech.stop(); setWords(e.target.value); }} /></label>
      <button type="button" className="mm-primary" disabled={!status?.speech || !activeVoice || !words.trim()} onClick={() => speech.state === 'idle' ? activeVoice && void speech.speak(words, activeVoice) : speech.stop()}>{speech.state === 'loading' ? <LoaderCircle className="mm-spin" /> : speech.state === 'playing' ? <Square /> : <Volume2 />}{speech.state === 'idle' ? '生成并试听' : speech.state === 'loading' ? '取消生成' : '停止播放'}</button>
      {speech.url && <a className="mm-download" href={speech.url} download="kirakira-voice.mp3"><Download />下载上次合成声音</a>}
      {speech.error && <p className="mm-error" role="alert">{speech.error}</p>}
      <small>AI 合成声音。文本将发送至{status?.speechProvider || '所配置的语音服务'}，音频仅保留在本次窗口，可下载保存。</small>
    </>}
    {error && <p className="mm-error" role="alert">{error}</p>}
  </div>;
}
export function MultimodalStudio({ initialPrompt = '', onUseImage, compact = false }: { initialPrompt?:string; onUseImage?: (url:string) => void; compact?:boolean }) {
  const [open, setOpen] = useState(false);
  return <MediaDialog open={open} setOpen={setOpen} title="AI 创作" description="为相遇画一张图，为角色赋予声音" trigger={<button className={compact ? 'mm-entry compact' : 'mm-entry'} type="button"><WandSparkles /><span>{onUseImage ? 'AI 生成头像' : 'AI 创作'}</span></button>}><Studio initialPrompt={initialPrompt} onUseImage={onUseImage ? url => { onUseImage(url); setOpen(false); } : undefined} /></MediaDialog>;
}
