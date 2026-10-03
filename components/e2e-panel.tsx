'use client';
import {useEffect,useState} from 'react';
import {enableTest,testHeaders,testSession,track,flushEvents,nextRun,type E2EEvent} from '@/lib/e2e-client';
import {acceptance,FRONT_EVENTS,AI_EVENTS} from '@/lib/e2e-shared';
import {useAccount} from '@/components/account-center';
import '@/app/e2e.css';
type Snapshot={enabled:boolean;events:E2EEvent[];user_id:string|null;capabilities?:Record<string,unknown>};
export function E2EPanel(){
 const account=useAccount(); const [ready,setReady]=useState(false),[open,setOpen]=useState(false),[data,setData]=useState<Snapshot|null>(null),[error,setError]=useState('');
 const [tab,setTab]=useState('验收');
 async function refresh(){try{await flushEvents();const r=await fetch('/api/test',{headers:testHeaders()});if(!r.ok)throw new Error('测试记录读取失败');setData(await r.json());}catch(e){setError(e instanceof Error?e.message:'读取失败');}}
 useEffect(()=>{let alive=true;fetch('/api/test').then(r=>r.json() as Promise<Snapshot>).then(d=>{if(!alive||!d.enabled)return;enableTest(true);setReady(true);track('product_enter');void account.refresh();void refresh();});const fail=()=>setError('有埋点保存失败，请刷新验收检查缺失项');window.addEventListener('kk-e2e-save-error',fail);return()=>{alive=false;window.removeEventListener('kk-e2e-save-error',fail);};},[]);
 useEffect(()=>{if(!open)return;void refresh();const timer=setInterval(()=>void refresh(),2000);return()=>clearInterval(timer);},[open]);
 if(!ready)return null;
 const report=acceptance(data?.events??[]), events=data?.events??[];
 function download(){const blob=new Blob([JSON.stringify({generatedAt:new Date().toISOString(),...data,acceptance:report},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Kirakira-E2E验收.json';a.click();URL.revokeObjectURL(url);}
 return <><button className="e2e-toggle" onClick={()=>setOpen(!open)}>测试面板 · Mock</button>{open&&<aside className="e2e-panel" aria-label="E2E 测试面板"><header><b>Kirakira E2E 测试</b><button onClick={()=>setOpen(false)} aria-label="关闭测试面板">×</button></header><p>本地官方模拟登录 · 语音为测试提示音 · 支付不扣款</p><nav>{['验收','事件','AI Trace','指引'].map(t=><button key={t} onClick={()=>setTab(t)} aria-pressed={tab===t}>{t}</button>)}</nav><p>user_id: {data?.user_id??'未登录'}<br/>session_id: {testSession()}</p>
 {tab==='验收'&&<><strong>{report.passed?'Happy Path 已通过':'等待完成 / 有未通过步骤'}</strong>{report.steps.map(s=><p key={s.name}>{s.passed?'✓':'○'} {s.name}{s.missing.length>0&&<small>缺失：{s.missing.join(', ')}</small>}</p>)}<p>ID 串联：{report.idsLinked?'通过':'未通过'} · Trace {report.traceLinked?'✓':'○'} · Order {report.orderLinked?'✓':'○'}</p><p>未覆盖事件：{report.missingEvents.join(', ')||'无'}<br/>重生成和点踩属于补充场景，不阻塞 Happy Path。</p>{report.blockers.map((b,i)=><p key={i} role="alert">{b}</p>)}</>}
 {tab==='事件'&&events.map(e=><details key={e.id}><summary>{e.source} · {e.event}</summary><pre>{JSON.stringify(e,null,2)}</pre></details>)}
 {tab==='AI Trace'&&events.filter(e=>[...AI_EVENTS,'ai_request_failed'].includes(e.event as never)).map(e=><details key={e.id}><summary>{e.event} · {e.trace_id}</summary><pre>{e.detail}</pre><small>message_id: {e.message_id}</small></details>)}
 {tab==='指引'&&<><ol><li>退出原模拟登录，首次进入新测试数据库；点击注册 / 登录。</li><li>进入智能体，选择岚川；试听 Mock 提示音，再点开始聊天。</li><li>发送“今天工作真的好累”，等回复；再发送“我喜欢雨天的书店”。</li><li>进入世界，在免费额度内继续一次剧情。</li><li>到我的 → 钻石与会员 → 领取体验；再聊天一次，使用会员免费额度。</li><li>选择 30 天会员，创建待支付订单；到订单点 Mock 支付成功。</li><li>刷新验收，查看缺失事件、ID 和 Trace，导出结果。</li></ol><p>真实语音、真实支付未接入；正式 ChatGPT 登录需另行线上验证。理解/审核为规则实现，Memory 为真实已保存的近期聊天；自建角色使用关键词设定召回。</p><pre>{JSON.stringify(data?.capabilities,null,2)}</pre></>}
 {error&&<p role="alert">{error}</p>}<footer><button onClick={()=>void refresh()}>刷新验收</button><button onClick={download}>导出结果</button><button onClick={async()=>{nextRun();track('product_enter');await flushEvents();window.location.href='/signout-with-chatgpt?return_to=%2F';}}>新一轮注册</button></footer></aside>}</>;
}
