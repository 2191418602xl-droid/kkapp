import { reserveChatQuota } from '@/lib/chat-server';
import { deepseekKey, deepseekCompletion } from '@/lib/deepseek';

type Message = { role: 'user' | 'assistant'; content: string };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: '不允许跨站请求。' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: '请使用 JSON 消息。' }, 415);
  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 20_000) return json({ error: '对话太长，请开启新对话。' }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: '消息格式不正确。' }, 400); }
  const messages = (input as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 20 ||
    messages.some((m: Message) => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 2000) ||
    messages.at(-1)?.role !== 'user') return json({ error: '消息格式不正确。' }, 400);
  const key = deepseekKey();
  if (!key) return json({ error: 'AI 对话尚未启用，请联系管理员配置模型密钥。' }, 503);
  try {
    if (!await reserveChatQuota()) return json({ error: '当前体验额度已用完，请稍后再试。' }, 429);
    const response = await deepseekCompletion([
        { role: 'system', content: '你是 kirakira 的 AI 角色创作助手。你已经问用户“你想创建什么角色？”。围绕用户的描述，帮助构思角色的名字、身份、性格、背景和开场白。信息不足时每次只问一个最关键的问题；信息足够时给出可直接使用的简洁角色设定，并允许用户继续修改。不要假称角色已保存或发布。若被问及身份，如实说明你是 AI 助手。' },
        ...messages.map((m: Message) => ({ role: m.role, content: m.content.trim() })),
    ]);
    if (!response.ok) return json({ error: response.status === 429 ? 'AI 正忙，请稍后重试。' : 'AI 服务暂时不可用，请稍后重试。' }, 502);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    return reply ? json({ reply: reply.slice(0, 4000) }) : json({ error: '暂时没有收到回复，请重试。' }, 502);
  } catch { return json({ error: '连接暂时中断或超时，请重试。' }, 503); }
}
