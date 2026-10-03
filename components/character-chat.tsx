'use client';

/* oxlint-disable next/no-img-element -- Supplied local avatars are rendered directly in the portable preview. */
import { testHeaders, track, eventIds, flushEvents, testMode } from '@/lib/e2e-client';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { VoiceInput, VoiceReader } from '@/components/model-voice';
import { LoginLink, useAccount } from '@/components/account-center';
import type { ConversationAction, UnfinishedTurn } from '@/lib/conversations';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Contact = { id: number | string; name: string; image: string; preview: string; voice?: string };

export function CharacterChat({ contact, messages, onMessages, onBack, backLabel = '返回消息列表' }: {
  contact: Contact; messages: ChatMessage[];
  onMessages: (messages: ChatMessage[]) => void; onBack: () => void;
  backLabel?: string;
}) {
  const account = useAccount();
  const [draft, setDraft] = useState('');
  const [started,setStarted]=useState(false);
  const completed=useRef(false);
  const lastIds=useRef<{message_id?:string;trace_id?:string}>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const pending = useRef<{ requestId: string; prompt: string; action: ConversationAction } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  useEffect(() => {
    const check = new AbortController();
    setLoadingHistory(true); setError(''); pending.current = null;
    fetch(`/api/chat?characterId=${contact.id}`, { signal: check.signal,headers:testHeaders() }).then(async r => { const data = await r.json() as { configured: boolean; error?: string; messages?: ChatMessage[]; unfinished?: UnfinishedTurn | null }; if (!r.ok) throw new Error(data.error || '聊天记录加载失败'); return data; })
      .then(data => {
        if (check.signal.aborted) return;
        setConfigured(data.configured === true);
        const restored: ChatMessage[] = data.messages?.length ? data.messages : [{ role: 'assistant', content: contact.preview }];
        if (data.unfinished) {
          const { requestId, prompt, action, status } = data.unfinished;
          pending.current = { requestId, prompt, action };
          restored.push({ role: 'user', content: prompt });
          setError(status === 'pending' ? '上一条消息仍在处理或核对中，请稍后手动重试。不会自动重新发送。' : '上一条消息尚未完成，可使用原消息重试。');
        }
        onMessages(restored);
      })
      .catch(e => { if (!check.signal.aborted) setError(e instanceof Error ? e.message : '聊天记录加载失败'); })
      .finally(() => { if (!check.signal.aborted) setLoadingHistory(false); });
    return () => { check.abort(); controller.current?.abort(); };
  }, [contact.id, account.data?.authenticated]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy, error]);

  async function reply(history: ChatMessage[]) {
    if (lock.current || loadingHistory) return;
    if (!account.data?.authenticated) { setError('请先登录，再与角色对话。'); return; }
    lock.current = true; setBusy(true); setError('');
    const active = new AbortController(); controller.current = active;
    const timer = setTimeout(() => active.abort(), 30_000);
    const prompt = history.at(-1)?.content ?? '';
    if (!pending.current || pending.current.prompt !== prompt) pending.current = { requestId: crypto.randomUUID(), prompt, action: 'message' };
    track('chat_send',{characterId:contact.id},{message_id:pending.current.requestId,trace_id:`trace:${pending.current.requestId}`});
    try {
      await flushEvents();
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...testHeaders() },
        signal: active.signal, body: JSON.stringify({ characterId: contact.id, ...pending.current }) });
      const data = await response.json() as { error?: string; reply?: string; ids?:{message_id:string;trace_id:string};freeTokenUsed?:boolean;premiumFeatureUsed?:boolean };
      if (active.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || '发送失败，请重试。');
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('未收到回复，请重试。');
      onMessages([...history, { role: 'assistant', content: data.reply }]);
      lastIds.current=eventIds(data);completed.current=true;
      requestAnimationFrame(()=>{track('ai_response_show',{characterId:contact.id},lastIds.current);if(data.freeTokenUsed)track('free_token_use',{kind:'free_reply'},lastIds.current);if(data.premiumFeatureUsed)track('premium_feature_use',{feature:'member_chat_quota'},lastIds.current);});
      pending.current = null; window.dispatchEvent(new Event('kk-account-updated'));
    } catch (e) {
      setError(active.signal.aborted ? '请求已中断，请重试。' : e instanceof Error ? e.message : '连接失败，请重试。');
    } finally { clearTimeout(timer); lock.current = false; setBusy(false); }
  }
  function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || lock.current || configured === false || loadingHistory || !account.data?.authenticated) return;
    if(testMode()&&!started)return;
    if(completed.current)track('chat_continue',{characterId:contact.id});
    const history: ChatMessage[] = [...messages, { role: 'user', content: draft.trim() }];
    onMessages(history); setDraft(''); void reply(history);
  }
  return <div className="screen message-chat-screen ai-chat-screen">
    <header className="message-chat-header"><button onClick={onBack} aria-label={backLabel}><ArrowLeft /></button><span><b>{contact.name}</b><small>{busy ? '正在输入…' : 'AI 角色 · DeepSeek'}</small></span></header>
    <div className="character-chat" ref={log} role="log" aria-live="polite">
      <p className="ai-chat-note">虚构角色对话 · 聊天记录保存到你的账户。发送内容及最近对话交给 DeepSeek 处理。</p>
      {!account.data?.authenticated && <LoginLink>登录并保存对话</LoginLink>}
      {account.data?.account && <p className="ai-chat-note">今日剩余 {account.data.account.chatQuota?.freeRemaining ?? 0} 次免费回复 · 超出后每次成功回复 1 钻石</p>}
      {loadingHistory && <p className="ai-chat-note">正在恢复聊天记录…</p>}
      {configured === false && <output className="ai-chat-note">AI 对话尚未启用，等待管理员配置密钥。</output>}
      {messages.map((m, i) => m.role === 'user' ? <div className="my-bubble" key={i}>{m.content}</div> : <div className="character-bubble" key={i}><img src={contact.image} alt={contact.name} /><p>{m.content}</p></div>)}
      {busy && <div className="character-bubble"><img src={contact.image} alt="" /><p>正在输入…</p></div>}
      {error && <div className="ai-chat-error" role="alert">{error}{pending.current && <button onClick={() => void reply(messages)} disabled={busy}>重试回复</button>}</div>}
      {!busy && !error && messages.at(-1)?.role === 'user' && <div className="ai-chat-error"><button onClick={() => void reply(messages)}>继续获取回复</button></div>}
    </div>
    <VoiceReader characterId={contact.id} key={contact.id} text={[...messages].reverse().find(message => message.role === 'assistant')?.content ?? ''} initialVoice={contact.id === 6 ? 'claire' : contact.voice === '温柔' ? 'claire' : contact.voice === '元气' ? 'david' : contact.voice === '清冷' ? 'charles' : 'alex'} />
    {testMode() && <div className="ai-chat-note"><button onClick={()=>{setStarted(true);track('chat_start',{characterId:contact.id});}} disabled={started}>开始聊天</button>{completed.current&&<><button disabled={busy} onClick={()=>{track('regenerate',{characterId:contact.id},lastIds.current);pending.current={requestId:crypto.randomUUID(),prompt:'请重新表达上一条回复，保持人设。',action:'rewrite'};void reply([...messages,{role:'user',content:pending.current.prompt}]);}}>重新生成</button><button onClick={()=>track('dislike',{characterId:contact.id},lastIds.current)}>不喜欢这条回复</button></>}</div>}
    <form className="message-composer" onSubmit={send}><VoiceInput className="mm-mic" disabled={busy || !account.data?.authenticated} onText={text => setDraft(current => `${current}${current ? ' ' : ''}${text}`.slice(0, 1000))} /><input aria-label="发送消息" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} maxLength={1000} disabled={configured === false || loadingHistory || !account.data?.authenticated || (testMode()&&!started)} placeholder={!account.data?.authenticated ? '请先登录' : configured === false ? 'AI 尚未启用' : '和角色说点什么…'} /><button type="submit" disabled={busy || loadingHistory || !account.data?.authenticated || configured === false || !draft.trim() || (testMode()&&!started)} aria-label="发送"><Send /></button></form>
  </div>;
}
