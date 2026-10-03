import { chatRuntime } from '@/lib/chat-server';

// All text AI features share this server-only credential and model configuration.
export function deepseekKey() {
  const runtime = chatRuntime();
  return runtime.deepseek?.trim() || runtime.DEEPSEEK_API_KEY?.trim();
}

export function deepseekCompletion(messages: { role: string; content: string }[]) {
  const key = deepseekKey();
  if (!key) throw new Error('DeepSeek is not configured');
  return fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: 'deepseek-flash', stream: false, max_tokens: 8192,
      thinking: { type: 'enabled' }, reasoning_effort: 'high', messages,
    }),
  });
}
