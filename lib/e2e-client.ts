import type { E2EEvent } from './e2e-shared';
let enabled=false, session='', user: string|null=null;
let ids: {message_id?:string;trace_id?:string;order_id?:string}={};
let queue=Promise.resolve();
export function testMode(){return enabled;}
export function testSession(){ if(!session && typeof window!=='undefined') {session=sessionStorage.getItem('kk-e2e-session')||crypto.randomUUID();sessionStorage.setItem('kk-e2e-session',session);} return session; }
export function testHeaders(): Record<string,string>{return enabled?{'x-kk-session-id':testSession()}:{};}
let transportInstalled=false;
export function enableTest(value:boolean){
 enabled=value;testSession();
 if(typeof window!=='undefined'&&!transportInstalled){
  transportInstalled=true;const original=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   const url=new URL(input instanceof Request?input.url:String(input),window.location.href);
   if(enabled&&url.origin===window.location.origin&&url.pathname.startsWith('/api/')){
    const headers=new Headers(input instanceof Request?input.headers:undefined);new Headers(init?.headers).forEach((v,k)=>headers.set(k,v));headers.set('x-kk-session-id',testSession());
    return original(input,{...init,headers});
   }
   return original(input,init);
  };
 }
}
export function setTestUser(value:string|null){user=value;}
export function setTestIds(value: typeof ids){ids={...ids,...value};}
export function track(event:string, detail:Record<string,unknown>={}, explicit: typeof ids={}) {
 if(!enabled)return;
 const payload={id:crypto.randomUUID(),event,detail,...ids,...explicit};
 queue=queue.then(async()=>{const response=await fetch('/api/test',{method:'POST',headers:{'Content-Type':'application/json',...testHeaders()},body:JSON.stringify(payload),keepalive:true});if(!response.ok)throw new Error('埋点保存失败');}).catch(()=>{window.dispatchEvent(new Event('kk-e2e-save-error'));});
}
export async function flushEvents(){await queue;}
export function nextRun(){session=crypto.randomUUID();sessionStorage.setItem('kk-e2e-session',session);ids={};}
export function eventIds(data:{ids?:typeof ids}){if(data.ids)setTestIds(data.ids);return data.ids??{};}
export type { E2EEvent };
