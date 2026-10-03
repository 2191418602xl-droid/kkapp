'use client';
import { track, testHeaders, testMode } from '@/lib/e2e-client';
import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Mic, Square, Volume2 } from 'lucide-react';
import { type MediaStatus, type ModelVoice } from '@/lib/multimodal-shared';
import { MediaDialog } from '@/components/media-dialog';

export async function mediaError(response: Response) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(data?.error || '服务暂时不可用，请重试。');
}
export function useModelSpeech(characterId?:number|string) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState(''), [url, setUrl] = useState('');
  const operation = useRef<AbortController | null>(null), audio = useRef<HTMLAudioElement | null>(null);
  const blobUrl = useRef(''), cached = useRef('');
  function stop() { operation.current?.abort(); operation.current = null; audio.current?.pause(); setState('idle'); }
  useEffect(() => () => { operation.current?.abort(); audio.current?.pause(); if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); }, []);
  async function speak(text: string, voice: ModelVoice) {
    stop(); setError('');
    const controller = new AbortController(); operation.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 55_000);
    try {
      const cacheKey = `${voice}:${text}`;
      if (cached.current !== cacheKey || !audio.current) {
        setState('loading');
        const response = await fetch('/api/media/speech', { method: 'POST', headers: { 'Content-Type': 'application/json', ...testHeaders() }, signal: controller.signal, body: JSON.stringify({ text, voice,characterId }) });
        if (!response.ok) throw await mediaError(response);
        const blob = await response.blob(); if (controller.signal.aborted) return;
        if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = URL.createObjectURL(blob); setUrl(blobUrl.current);
        audio.current = new Audio(blobUrl.current); cached.current = cacheKey;
      }
      const player = audio.current!;
      player.onended = () => setState('idle');
      player.onerror = () => { setState('idle'); setError('音频无法播放，请重试。'); };
      player.currentTime = 0; await player.play(); if (!controller.signal.aborted) {setState('playing');track('voice_play',{voice,characterId,played:true,mode:testMode()?'mock':'real'});}
    } catch (e) {
      if (operation.current === controller) { setState('idle'); setError(controller.signal.aborted ? '声音生成超时，请重试。' : e instanceof Error ? e.message : '声音播放失败。'); }
    } finally { window.clearTimeout(timer); }
  }
  return { state, error, url, speak, stop };
}
export function VoiceReader({ text, initialVoice = 'alex',characterId }: { text: string; initialVoice?: ModelVoice; characterId?:number|string }) {
  const speech = useModelSpeech(characterId); const [voice, setVoice] = useState<ModelVoice>(initialVoice);
  const [status, setStatus] = useState<MediaStatus | null>(null), [statusError, setStatusError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/media', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async response => { if (!response.ok) throw await mediaError(response); return response.json() as Promise<MediaStatus>; })
      .then(setStatus).catch(() => { if (!controller.signal.aborted) setStatusError('无法获取语音服务状态，请重新打开朗读面板。'); });
    return () => controller.abort();
  }, []);
  const voices = status?.voices ?? [], activeVoice = voices.find(item => item.id === voice)?.id ?? voices[0]?.id;
  return <div className="mm-reader">
    <label>角色声线<select value={activeVoice ?? ''} disabled={!voices.length} onChange={event => { speech.stop(); setVoice(event.target.value as ModelVoice); }}>{voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
    <button type="button" onClick={() => speech.state === 'idle' ? activeVoice && void speech.speak(text.slice(0, 500), activeVoice) : speech.stop()} disabled={!text.trim() || !status?.speech || !activeVoice}>
      {speech.state === 'loading' ? <LoaderCircle className="mm-spin" /> : speech.state === 'playing' ? <Square /> : <Volume2 />}{speech.state === 'loading' ? '取消生成' : speech.state === 'playing' ? '停止朗读' : testMode()?'试听声音 · Mock':'模型朗读'}
    </button><small>{testMode()?'Mock 测试提示音 · 用于验证播放器，不代表角色真实声音':<>AI 合成声音 · 每次最多 500 字 · 文本发送至{status?.speechProvider || '所配置的语音服务'}</>}</small>
    {status && !status.speech && <output className="mm-notice">语音模型尚未启用，等待管理员配置。</output>}
    {statusError && <p className="mm-error" role="alert">{statusError}</p>}
    {speech.error && <p className="mm-error" role="alert">{speech.error}</p>}
  </div>;
}
// Native recording is converted locally to mono PCM WAV for provider compatibility.
async function recordingWav(blob: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.min(480000, Math.floor(decoded.duration * 16000));
    if (frames < 1600) throw new Error('录音太短，请重新录制。');
    const offline = new OfflineAudioContext(1, frames, 16000);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
    const write = (offset: number, value: string) => { [...value].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0))); };
    write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, i) => { const value = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true); });
    return new Blob([buffer], { type: 'audio/wav' });
  } finally { await context.close(); }
}
function Recorder({ onText }: { onText: (text: string) => void }) {
  const [phase, setPhase] = useState<'idle' | 'permission' | 'recording' | 'preparing' | 'review' | 'transcribing'>('idle');
  const [error, setError] = useState(''), [preview, setPreview] = useState(''), [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0), [available, setAvailable] = useState<boolean | null>(null);
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const clip = useRef<Blob | null>(null), clipUrl = useRef('');
  const alive = useRef(true), generation = useRef(0), timer = useRef<number | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true; const check = new AbortController();
    fetch('/api/media', { signal: AbortSignal.any([check.signal, AbortSignal.timeout(15_000)]) }).then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<MediaStatus>; }).then(s => setAvailable(s.transcription)).catch(() => { if (!check.signal.aborted) setError('无法获取声音服务状态，请关闭后重试。'); });
    return () => { alive.current = false; generation.current++; check.abort(); controller.current?.abort(); window.clearInterval(timer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); if (clipUrl.current) URL.revokeObjectURL(clipUrl.current); };
  }, []);
  async function start() {
    if (['permission', 'recording', 'preparing'].includes(phase)) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('此浏览器无法录音，请使用支持麦克风的 HTTPS 浏览器。'); return; }
    const run = ++generation.current; setError(''); setText(''); setPhase('permission');
    try {
      const tracks = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || run !== generation.current) { tracks.getTracks().forEach(t => t.stop()); return; }
      stream.current = tracks;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(mime => MediaRecorder.isTypeSupported(mime));
      const rec = new MediaRecorder(tracks, mimeType ? { mimeType } : undefined); recorder.current = rec;
      const chunks: Blob[] = []; let bytes = 0;
      rec.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes > 5_000_000 && rec.state === 'recording') rec.stop(); } };
      rec.onstop = async () => {
        window.clearInterval(timer.current); tracks.getTracks().forEach(t => t.stop());
        if (!alive.current || run !== generation.current) return; setPhase('preparing');
        try {
          const wav = await recordingWav(new Blob(chunks, { type: rec.mimeType }));
          if (!alive.current || run !== generation.current) return;
          clip.current = wav; if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
          clipUrl.current = URL.createObjectURL(wav); setPreview(clipUrl.current); setPhase('review');
        } catch { if (alive.current && run === generation.current) { setError('录音无法读取，请重录或改用文字输入。'); setPhase('idle'); } }
      };
      rec.onerror = () => { generation.current++; window.clearInterval(timer.current); tracks.getTracks().forEach(t => t.stop()); if (alive.current) { setError('录音中断，请重试。'); setPhase('idle'); } };
      rec.start(250); setPhase('recording'); setSeconds(0); const started = Date.now();
      timer.current = window.setInterval(() => { const elapsed = Math.floor((Date.now() - started) / 1000); setSeconds(Math.min(30, elapsed)); if (elapsed >= 30 && rec.state === 'recording') rec.stop(); }, 250);
    } catch (e) { stream.current?.getTracks().forEach(t => t.stop()); if (alive.current && run === generation.current) { setPhase('idle'); setError(e instanceof DOMException && e.name === 'NotAllowedError' ? '没有获得麦克风权限，请允许后重试；也可以继续文字输入。' : '麦克风不可用，请检查设备后重试。'); } }
  }
  async function transcribe() {
    if (!clip.current || phase === 'transcribing') return;
    const active = new AbortController(); controller.current = active; setPhase('transcribing'); setError('');
    const timeout = window.setTimeout(() => active.abort(), 55_000);
    try {
      const response = await fetch('/api/media/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: clip.current, signal: active.signal });
      if (!response.ok) throw await mediaError(response);
      const data = await response.json() as {text:string}; if (alive.current) setText(data.text);
    } catch (e) { if (alive.current) setError(active.signal.aborted ? '转写已取消或超时，录音仍保留，可重新识别。' : e instanceof Error ? e.message : '转写失败。'); }
    finally { window.clearTimeout(timeout); if (alive.current) setPhase('review'); }
  }
  return <div className="mm-recorder">
    <p>录音最多 30 秒。先试听，确认后交给硅基流动识别；识别结果可以编辑，不会自动发给角色。</p>
    {available === false && <output className="mm-notice">语音识别尚未启用，等待管理员配置。</output>}
    <button className="mm-record-button" type="button" disabled={available !== true || ['permission', 'preparing', 'transcribing'].includes(phase)} onClick={() => phase === 'recording' ? recorder.current?.stop() : void start()}>
      {phase === 'recording' ? <Square /> : <Mic />}{phase === 'recording' ? `结束录音 ${seconds}/30 秒` : phase === 'permission' ? '等待麦克风权限…' : phase === 'preparing' ? '正在处理录音…' : preview ? '重新录制' : '开始录音'}
    </button>
    {preview && !['recording', 'preparing', 'permission'].includes(phase) && <div className="mm-record-review"><audio controls src={preview} preload="metadata" /><button className="mm-primary" type="button" onClick={() => phase === 'transcribing' ? controller.current?.abort() : void transcribe()}>{phase === 'transcribing' ? '取消识别' : '识别为文字'}</button></div>}
    {text && <label>确认识别结果<textarea value={text} maxLength={1000} rows={4} onChange={e => setText(e.target.value)} /><button className="mm-primary" type="button" disabled={!text.trim()} onClick={() => onText(text.trim())}><Check />填入聊天输入框</button></label>}
    {error && <p className="mm-error" role="alert">{error}</p>}<small>原始录音不保存在本站。关闭此窗口会停止录音并丢弃本次临时内容。</small>
  </div>;
}
export function VoiceInput({ onText, className = '', disabled = false }: { onText: (text:string) => void; className?: string; disabled?:boolean }) {
  const [open, setOpen] = useState(false);
  return <MediaDialog open={open} setOpen={setOpen} title="语音输入" description="把想说的话，变成文字" trigger={<button type="button" className={className} disabled={disabled} aria-label="语音输入"><Mic /></button>}><Recorder onText={text => { onText(text); setOpen(false); }} /></MediaDialog>;
}
