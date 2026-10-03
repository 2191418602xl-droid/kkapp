import { chatRuntime } from '@/lib/chat-server';
import { FRONT_EVENTS, acceptance, type E2EEvent } from '@/lib/e2e-shared';
import { record, requireTest, sessionId, testEnabled } from '@/lib/e2e-server';
import { flowInput, FlowError, privateJson, signedInUser } from '@/lib/account-identity';
export async function GET(request: Request) {
 if (!testEnabled(request)) return privateJson({enabled:false});
 const session=sessionId(request); if (!session) return privateJson({enabled:true,events:[]});
 const user=signedInUser(request);
 const result=await chatRuntime().DB.prepare('SELECT * FROM e2e_events WHERE session_id = ? AND (user_id = ? OR user_id IS NULL) ORDER BY created_at, rowid LIMIT 2000').bind(session,user?.id??'').all<E2EEvent>();
 const events=result.results;
 return privateJson({enabled:true,user_id:user?.id??null,session_id:session,events,acceptance:acceptance(events),capabilities:{aiConfigured:Boolean(chatRuntime().DEEPSEEK_API_KEY?.trim()),voice:'mock',payment:'mock',auth:'official-local-simulator',memory:'recent saved conversation + keyword lorebook',understanding:'rule-based',reviewer:'rule-based'}});
}
export async function POST(request: Request) {
 try {
  requireTest(request); const input=await flowInput(request);
  if (!sessionId(request)||typeof input.event!=='string'||![...FRONT_EVENTS,'product_enter','voice_failed'].includes(input.event as never)) throw new FlowError('事件无效。');
  const ids: {id?:string;message_id?:string;trace_id?:string;order_id?:string}={};
  for(const key of ['id','message_id','trace_id','order_id'] as const) if(typeof input[key]==='string'&&input[key].length<=100) ids[key]=input[key];
  await record(request,input.event,input.detail??{},ids,'frontend'); return privateJson({saved:true});
 } catch(e) {return privateJson({error:e instanceof Error?e.message:'保存失败'},e instanceof FlowError?e.status:503);}
}
