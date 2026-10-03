import { record, sessionId, testEnabled } from '@/lib/e2e-server';
import { chatRuntime } from '@/lib/chat-server';
import { runRoleModel,resolveRoleContext } from '@/lib/role-model';
import { signedInUser, resourceOwner, privateJson, flowInput, FlowError } from '@/lib/account-identity';
import { ensureAccount, reserveChatReply, commitChatReply, refundChatReply } from '@/lib/account-commerce';
import { AccountError } from '@/lib/account-shared';
import { validCharacterId, worldName, getConversation, openConversation, conversationHistory, latestUnfinishedTurn, beginTurn, failTurn, completedTurnStatements } from '@/lib/conversations';

const configured = () => Boolean(chatRuntime().DEEPSEEK_API_KEY?.trim());
function parseCharacter(value: unknown) { return typeof value === 'string' && /^[1-6]$/.test(value) ? Number(value) : value; }
async function checkCharacter(request: Request, id: string | number) {
  if (typeof id === 'string' && !await chatRuntime().DB.prepare('SELECT id FROM agent_profiles WHERE id = ? AND visitor = ?').bind(id, resourceOwner(request)).first()) throw new FlowError('找不到这个角色。', 404);
}
function failure(error: unknown) {
  return error instanceof FlowError || error instanceof AccountError ? privateJson({ error: error.message }, error.status) : privateJson({ error: '对话暂时没有完成，请重试。' }, 503);
}
export async function GET(request: Request) {
  const user = signedInUser(request), params = new URL(request.url).searchParams;
  if (!user || !params.has('characterId')) return privateJson({ configured: configured(), authenticated: Boolean(user), messages: [], stage: 0, unfinished: null });
  try {
    const id = parseCharacter(params.get('characterId')); if (!validCharacterId(id)) throw new FlowError('角色不正确。');
    await checkCharacter(request, id);
    const conversation = await getConversation(chatRuntime().DB, user.id, id, worldName(params.get('world') ?? ''));
    return privateJson({ configured: configured(), authenticated: true, messages: conversation ? await conversationHistory(chatRuntime().DB, conversation.id) : [], stage: conversation?.stage ?? 0, unfinished: conversation ? await latestUnfinishedTurn(chatRuntime().DB, conversation.id) : null });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = signedInUser(request);
  if (!user) return privateJson({ error: '请先注册或登录，再与角色对话。' }, 401);
  const db = chatRuntime().DB;
  let turn: { conversationId: string; requestId: string; lease: string; reservationId?: string } | undefined;
  try {
    const input = await flowInput(request), characterId = parseCharacter(input.characterId);
    if (!validCharacterId(characterId) || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 1000 || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.requestId)) throw new FlowError('角色或消息格式不正确。');
    const trace_id=`trace:${input.requestId}`, ids={message_id:input.requestId,trace_id};
    await record(request,'ai_request_start',{characterId},ids);
    const action = input.action ?? 'message'; if (!['message', 'continue', 'rewrite'].includes(action as string)) throw new FlowError('操作不正确。');
    const world = worldName(input.world), prompt = input.prompt.trim();
    if (input.context !== undefined && (typeof input.context !== 'string' || input.context.length > 1000)) throw new FlowError('剧情信息过长。');
    await checkCharacter(request, characterId);
    await ensureAccount(db, user.id);
    const conversation = await openConversation(db, user.id, characterId, world);
    const started = await beginTurn(db, conversation, input.requestId, action as string, prompt);
    if (started.replay !== null) return privateJson({ reply: started.replay, stage: conversation.stage, replayed: true, ids });
    turn = { conversationId: conversation.id, requestId: input.requestId, lease: started.lease };
    if (started.abandoned) await refundChatReply(db, user.id, started.abandoned);
    // Preserve the user's explicitly requested WeChat scene without charging
    // a model reply. Persist it through the same account conversation service.
    if (world === '微聊' && characterId === 2 && prompt === '我想你了') {
      const reply = '我也是，很想和你见面，我去找你吧';
      await db.batch(completedTurnStatements(db, conversation, input.requestId, started.lease, reply, action as string));
      turn = undefined;
      return privateJson({ reply, stage: conversation.stage + 1, preset: true });
    }
    if (!configured()) throw new FlowError('AI 对话尚未启用，请等待管理员配置。', 503);
    const reservation = await reserveChatReply(db, user.id, started.id);
    turn.reservationId = reservation.reservationId;
    const history = (await conversationHistory(db, conversation.id)).slice(-8);
    const emotion=/累|烦|难过|伤心|焦虑/.test(prompt)?'distressed':/开心|高兴/.test(prompt)?'positive':'neutral';
    const intent=action==='continue'?'story_continue':emotion==='distressed'?'emotional_support':'conversation';
    await record(request,'understanding_result',{intent,emotion,method:'rules-v1'},ids);
    const recallMessages=[...history,{role:'user',content:prompt}];
    if(world)recallMessages.unshift({role:'user',content:`当前虚构世界：${world}。开场资料：${String(input.context??'').slice(0,1000)}`});
    const roleContext=await resolveRoleContext(request,characterId,recallMessages);
    await record(request,'context_recall',{method:'saved_recent_conversation-and-persona-keyword-retrieval',conversation_id:conversation.id,count:history.length,memory:history.map(m=>({role:m.role,content:m.content.slice(0,200)})),rag:roleContext.persona},ids);
    const decision={strategy:emotion==='distressed'?'empathy':'natural_roleplay',story_advance:action==='continue'&&emotion!=='distressed'};
    await record(request,'decision_result',decision,ids);
    const messages = [...history];
    if (world) messages.unshift({ role: 'user', content: `当前虚构世界：${world}。开场资料：${String(input.context ?? '').slice(0, 1000)}` });
    messages.push({ role: 'user', content: prompt });
    messages.splice(messages.length-1,0,{role:'user',content:`本轮回复策略参考：${decision.strategy}。${emotion==='distressed'?'先接住情绪，不主动推进剧情。':'自然承接对话。'}此参考不覆盖角色和安全规则。`});
    const headers = new Headers(request.headers); headers.set('content-type', 'application/json'); headers.delete('content-length'); headers.set('x-kk-message-id',input.requestId); headers.set('x-kk-trace-id',trace_id);
    const response = await runRoleModel(new Request(request.url, { method: 'POST', headers, body: JSON.stringify({ characterId, messages }) }),roleContext);
    const result = await response.json() as { reply?: string; error?: string };
    if (!response.ok || !result.reply) throw new FlowError(result.error ?? '暂时没有收到回复，请重试。', response.status >= 400 ? response.status : 502);
    await record(request,'generation_result',{provider:'deepseek',characters:result.reply.length,reply:result.reply},ids);
    const approved=result.reply.trim().length>0 && !/你只能依赖我|不许离开我|只有我能理解你/.test(result.reply);
    await record(request,'review_result',{approved,method:'rule-based-nonempty-and-dependency-check',limits:'不是独立模型评审'},ids);
    if(!approved) throw new FlowError('回复未通过审核，请重新生成。',422);
    const member=await db.prepare('SELECT account FROM membership_trials WHERE account = ? AND expires_at > ? UNION SELECT account FROM memberships WHERE account = ? AND expires_at > ?').bind(user.id,new Date().toISOString(),user.id,new Date().toISOString()).first();
    await commitChatReply(db, user.id, reservation.reservationId, completedTurnStatements(db, conversation, input.requestId, started.lease, result.reply, action as string));
    turn = undefined;
    if(!reservation.paid) await record(request,'free_token_committed',{cost:0,conversation_id:conversation.id},ids);
    if(member) await record(request,'premium_reply_committed',{dailyLimit:20},ids);
    turn = undefined;
    return privateJson({ reply: result.reply, stage: conversation.stage + (action === 'rewrite' ? 0 : 1), ids, freeTokenUsed:!reservation.paid, premiumFeatureUsed:Boolean(member) });
  } catch (error) {
    await record(request,'ai_request_failed',{error:error instanceof Error?error.message:'failed'},turn?{message_id:turn.requestId,trace_id:`trace:${turn.requestId}`}:{ });
    if (turn) {
      try { if (turn.reservationId) await refundChatReply(db, user.id, turn.reservationId); await failTurn(db, turn.conversationId, turn.requestId, turn.lease); }
      catch { return privateJson({ error: '对话正在核对，请稍后使用同一消息重试。不会重复收取已完成的回复。' }, 503); }
    }
    return failure(error);
  }
}
