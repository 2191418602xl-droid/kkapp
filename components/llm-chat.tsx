'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { MessageCircle, Plus, Send, Sparkles } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };
const opening: Message = { role: 'assistant', content: '你想创建什么角色？' };

export function LLMChat() {
  const [messages, setMessages] = useState<Message[]>([opening]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy, error]);
  useEffect(() => () => controller.current?.abort(), []);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    setError('');
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch('/api/llm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-20) }), signal: abort.signal });
      const result = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !result.reply) throw new Error(result.error || '暂时没有收到回复，请重试。');
      setMessages(current => [...current, { role: 'assistant', content: result.reply! }]);
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : '发送失败，请重试。');
    } finally {
      if (controller.current === abort) controller.current = null;
      setBusy(false);
    }
  }

  function newConversation() {
    controller.current?.abort();
    controller.current = null;
    setMessages([opening]);
    setDraft('');
    setBusy(false);
    setError('');
  }

  function retry() {
    const last = messages.at(-1);
    if (!last || last.role !== 'user' || busy) return;
    setMessages(current => current.slice(0, -1));
    setDraft(last.content);
    setError('');
  }

  return <section className="llm-chat" aria-label="大模型对话">
    <header className="llm-chat-header"><div className="llm-chat-heading"><span className="llm-chat-mark"><Sparkles aria-hidden="true" /></span><div><h1>角色创造</h1></div></div><button type="button" className="llm-chat-new" onClick={newConversation} aria-label="开启新对话" title="开启新对话"><Plus aria-hidden="true" /></button></header>
    <div className="llm-chat-messages" role="log" aria-live="polite">
      {messages.map((message, index) => <div key={index} className={`llm-chat-message ${message.role}`}><span className="llm-chat-avatar" aria-hidden="true">{message.role === 'assistant' ? <Sparkles /> : <MessageCircle />}</span><div className="llm-chat-bubble">{message.content}</div></div>)}
      {busy && <div className="llm-chat-message assistant"><span className="llm-chat-avatar"><Sparkles aria-hidden="true" /></span><div className="llm-chat-bubble llm-chat-thinking" role="status">正在思考…</div></div>}
      {error && <div className="llm-chat-error" role="alert"><span>{error}</span><button type="button" onClick={retry}>重试</button></div>}
      <div ref={bottom} />
    </div>
    <form className="llm-chat-composer" onSubmit={send}><textarea aria-label="描述想创建的角色" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="描述你想创建的角色…" rows={1} maxLength={2000} /><button type="submit" disabled={!draft.trim() || busy} aria-label="发送消息"><Send aria-hidden="true" /></button></form>
  </section>;
}
