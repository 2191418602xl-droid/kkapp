export const FRONT_EVENTS = ['register_start','register_success','login_success','role_exposure','role_click','voice_play','chat_start','chat_send','ai_response_show','chat_continue','regenerate','dislike','story_enter','free_token_use','premium_feature_use','pay_click','pay_success'] as const;
export const AI_EVENTS = ['ai_request_start','understanding_result','context_recall','decision_result','generation_result','review_result'] as const;
export type E2EEvent = { id: string; source: string; event: string; user_id: string | null; session_id: string; message_id: string | null; trace_id: string | null; order_id: string | null; detail: string; created_at: string };
export const HAPPY_STEPS = [ ['注册','register_start','register_success'], ['登录','login_success'], ['浏览角色','role_exposure'], ['点击角色','role_click'], ['试听声音','voice_play'], ['开始聊天','chat_start'], ['发送消息','chat_send'], ['AI 链路',...AI_EVENTS], ['回复展示','ai_response_show'], ['继续聊天','chat_continue'], ['进入剧情','story_enter'], ['使用免费代币','free_token_use'], ['体验会员','premium_feature_use'], ['点击购买','pay_click'], ['支付成功','pay_success'] ];
export function acceptance(events: E2EEvent[]) {
 const detail=(e:E2EEvent)=>{try{return JSON.parse(e.detail) as Record<string,unknown>;}catch{return {};}};
 const same=(a:E2EEvent,b:E2EEvent)=>Boolean(a.user_id&&a.session_id&&a.user_id===b.user_id&&a.session_id===b.session_id);
 const messageSame=(a:E2EEvent,b:E2EEvent)=>same(a,b)&&Boolean(a.message_id&&a.trace_id&&a.message_id===b.message_id&&a.trace_id===b.trace_id);
 const corroborated=(e:E2EEvent,name:string,check:(d:Record<string,unknown>)=>boolean=()=>true)=>events.some(b=>b.source==='backend'&&b.event===name&&same(e,b)&&check(detail(b))&&(name==='account_registered'||name==='mock_voice_generated'||name==='mock_payment_settled'||name==='order_created'?(!e.order_id||e.order_id===b.order_id):messageSame(e,b)));
 const valid=(e:E2EEvent)=>{
  const d=detail(e);
  if(e.event==='register_success')return corroborated(e,'account_registered');
  if(e.event==='voice_play')return d.played===true&&corroborated(e,'mock_voice_generated',b=>b.characterId===d.characterId&&b.mode==='mock');
  if(e.event==='review_result')return e.source==='backend'&&d.approved===true;
  if(e.event==='free_token_use')return corroborated(e,'free_token_committed');
  if(e.event==='premium_feature_use')return corroborated(e,'premium_reply_committed');
  if(e.event==='pay_click')return Boolean(e.order_id)&&d.status==='pending'&&corroborated(e,'order_created',b=>b.status==='pending');
  if(e.event==='pay_success')return Boolean(e.order_id)&&d.status==='paid'&&d.membership==='paid'&&corroborated(e,'mock_payment_settled',b=>b.status==='paid'&&b.productType==='membership'&&b.membership==='paid'&&b.testMode===true);
  return true;
 };
 let cursor=-1,send:E2EEvent|undefined,role:unknown;
 const steps=HAPPY_STEPS.map(([name,...required])=>{
  let next=cursor;const missing:string[]=[];
  for(const event of required){
   const index=events.findIndex((e,i)=>i>next&&e.event===event&&valid(e)&&
    (!AI_EVENTS.includes(event as never)&&event!=='ai_response_show'||Boolean(send&&messageSame(e,send)))&&
    (!['voice_play','chat_start','chat_send'].includes(event)||!role||String(detail(e).characterId)===String(role)));
   if(index<0){missing.push(event);continue;} next=index;
   if(event==='role_click')role=detail(events[index]).characterId;
   if(event==='chat_send')send=events[index];
  }
  if(!missing.length)cursor=next;
  return {name,passed:missing.length===0,missing};
 });
 const responses=events.filter(e=>e.event==='ai_response_show');
 const traceLinked=responses.length>0&&responses.every(response=>{
  if(!response.user_id||!response.session_id||!response.message_id||!response.trace_id)return false;
  let index=-1;
  return [...AI_EVENTS,'ai_response_show'].every(name=>{const n=events.findIndex((e,i)=>i>index&&e.event===name&&messageSame(e,response)&&valid(e));if(n<0)return false;index=n;return true;});
 });
 const pay=events.find(e=>e.event==='pay_success'&&valid(e));
 const orderLinked=Boolean(pay&&events.some(e=>e.event==='pay_click'&&valid(e)&&e.order_id===pay.order_id&&same(e,pay)));
 const users=new Set(events.filter(e=>e.user_id).map(e=>e.user_id));
 const idsLinked=traceLinked&&orderLinked&&users.size===1;
 const names=new Set(events.filter(valid).map(e=>e.event));
 return {passed:steps.every(s=>s.passed)&&idsLinked,steps,idsLinked,traceLinked,orderLinked,missingEvents:[...FRONT_EVENTS,...AI_EVENTS].filter(e=>!names.has(e)),optionalEvents:['regenerate','dislike'],blockers:events.filter(e=>e.event==='ai_request_failed').map(e=>e.detail)};
}
