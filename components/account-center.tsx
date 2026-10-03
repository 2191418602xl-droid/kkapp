'use client';
/* oxlint-disable next/no-html-link-for-pages -- Platform login/logout must be top-level browser navigations, never client routing. */
import { testHeaders, track, setTestUser, setTestIds, testMode,enableTest,flushEvents } from '@/lib/e2e-client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Crown, Gem, LogIn, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { AccountState, OrderRow, Product } from '@/lib/account-shared';
import '@/app/account-center.css';

type AccountSnapshot = { authenticated: boolean; user?: { name: string }; account?: AccountState; products?: Product[]; orders?: OrderRow[]; paymentAvailable?: boolean; gmv?: { totalFen: number; orderCount: number } };
type AccountControl = { data: AccountSnapshot | null; error: string; loading: boolean; busy: boolean; refresh: () => Promise<void>; act: (action: string, input?: Record<string, unknown>) => Promise<boolean> };
const AccountContext = createContext<AccountControl | null>(null);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AccountSnapshot | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const mode=await fetch('/api/test').then(r=>r.json() as Promise<{enabled:boolean}>).catch(()=>({enabled:false}));enableTest(mode.enabled===true);
      const response = await fetch('/api/account', { cache: 'no-store',headers:testHeaders() });
      const next = await response.json() as AccountSnapshot & { error?: string }; if (!response.ok) throw new Error(next.error || '账户暂时无法加载');
      setData(next); setError('');
      if((next as AccountSnapshot & {registered?:boolean}).registered)track('register_success',{auth:'official-local-simulator'});
      if(next.account){setTestUser(next.account.accountId);if(sessionStorage.getItem('kk-login-pending')){track('login_success',{auth:'official-local-simulator'});sessionStorage.removeItem('kk-login-pending');}}
    } catch (e) { setError(e instanceof Error ? e.message : '账户加载失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const update = () => void refresh(); queueMicrotask(update); window.addEventListener('kk-account-updated', update); return () => window.removeEventListener('kk-account-updated', update); }, [refresh]);
  async function act(action: string, input: Record<string, unknown> = {}) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json',...testHeaders() }, body: JSON.stringify({ ...input, action }) });
      const next = await response.json() as AccountSnapshot & { error?: string }; if (!response.ok) throw new Error(next.error || '操作没有完成，请重试');
      setData(next);
      if(action==='order'){const order=next.orders?.find(o=>o.idempotencyKey===input.idempotencyKey);if(order){setTestIds({order_id:order.id});track('pay_click',{productId:order.productId,status:order.status},{order_id:order.id});}}
      if(action==='mock-pay'){const order=next.orders?.find(o=>o.id===input.orderId);if(order?.status==='paid')track('pay_success',{status:order.status,membership:next.account?.membership.kind,mock:true},{order_id:order.id});}
      window.dispatchEvent(new Event('kk-wallet-updated')); return true;
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  return <AccountContext value={{ data, error, loading, busy, refresh, act }}>{children}</AccountContext>;
}
export function useAccount() { const context = useContext(AccountContext); if (!context) throw new Error('AccountProvider required'); return context; }
export function LoginLink({ children = '注册 / 登录' }: { children?: ReactNode }) {
  const [host, setHost] = useState('');
  useEffect(() => { if (['localhost', '127.0.0.1'].includes(window.location.hostname)) queueMicrotask(() => setHost('')); }, []);
  return <a onClick={async event => {if(testMode()){event.preventDefault();const target=event.currentTarget.href;track('register_start',{auth:'official-local-simulator'});sessionStorage.setItem('kk-login-pending','1');await flushEvents();window.location.href=target;}}} className="account-login" href={`${host}/signin-with-chatgpt?return_to=%2F%3Fwelcome%3D1`} target="_top" title={host ? '前往已发布站点登录并保存账户' : undefined}><LogIn size={18} />{children}</a>;
}
export function AccountEntry({ onOpen }: { onOpen: () => void }) {
  const { data, loading } = useAccount();
  if (loading || !data?.authenticated) return null;
  return <div className="account-entry"><button onClick={onOpen}><Gem size={15} />{data.account?.wallet.balance ?? 0}<span>我的账户</span></button></div>;
}
export function AccountPanel({ onExplore, onWallet }: { onExplore: () => void; onWallet: () => void }) {
  const { data, error, busy, refresh, act } = useAccount();
  if (!data?.authenticated) return null;
  const account = data?.account;
  return <section className="account-panel" aria-label="我的账户">
    <header><div><small>已登录</small><h3>{data.user?.name || '星光旅人'}</h3></div><a href="/signout-with-chatgpt?return_to=%2F" target="_top">退出登录</a></header>
    <div className="account-metrics"><span><b>{account?.wallet.balance ?? 0}</b>钻石余额</span><span><b>{account?.chatQuota?.freeRemaining ?? 0}</b>今日免费回复</span><span><b>{account?.membership.kind === 'none' ? '普通' : account?.membership.kind === 'trial' ? '体验中' : '会员'}</b>账户权益</span></div>
    <div className="account-actions"><button onClick={onExplore}>选择角色，继续故事</button><button onClick={onWallet}>钻石与会员</button></div>
    {account?.membership.kind === 'none' && !account.membership.trialUsed && <button className="account-trial" disabled={busy} onClick={() => void act('trial')}><Crown />领取 24 小时会员体验 · 每账户一次</button>}
    {account?.membership.expiresAt && <small className="account-expiry">权益到期：{new Date(account.membership.expiresAt).toLocaleString('zh-CN')}</small>}
    {error && <p className="account-error" role="alert">{error}<button onClick={() => void refresh()}>重试</button></p>}
  </section>;
}

const orderLabels: Record<string, string> = { pending: '待支付', paid: '已付款', fulfilled: '已到账', cancelled: '已取消', failed: '支付失败' };
export function CommerceView({ onBack, onExplore }: { onBack: () => void; onExplore: () => void }) {
  const { data, error, loading, busy, refresh, act } = useAccount();
  const [tab, setTab] = useState<'diamonds' | 'membership' | 'orders'>('diamonds');
  const [selected, setSelected] = useState<Product | null>(null), [created, setCreated] = useState(false), [idempotencyKey, setIdempotencyKey] = useState('');
  const account = data?.account;
  const products = data?.products?.filter(product => product.type === tab) ?? [];
  return <div className="screen commerce-screen">
    <header className="commerce-header"><button onClick={onBack} aria-label="返回上一页"><ArrowLeft /></button><h2>钻石与会员</h2><button onClick={() => void refresh()} aria-label="刷新账户"><RefreshCw /></button></header>
    <div className="commerce-scroll">
      {!data?.authenticated ? <p className="commerce-note">钻石与会员暂不可用。</p> : <>
        <section className="commerce-balance"><small>我的钻石</small><h1><Gem />{account?.wallet.balance ?? '—'}</h1><button disabled={busy || account?.wallet.checked} onClick={() => void act('checkin')}>{account?.wallet.checked ? <><Check />今日已领取</> : `领取今日免费钻石 +${account?.wallet.reward ?? 1}`}</button></section>
        <section className="commerce-benefits"><Crown /><div><h3>{account?.membership.kind === 'none' ? '让故事多聊一会儿' : '会员权益已生效'}</h3><p>普通账户每日 3 次免费回复；会员每日 20 次。超出后每次成功回复使用 1 钻石，服务失败不扣除。</p>{account?.membership.expiresAt && <small>有效期至 {new Date(account.membership.expiresAt).toLocaleString('zh-CN')}</small>}</div>{account?.membership.kind === 'none' && !account.membership.trialUsed && <button disabled={busy} onClick={() => void act('trial')}>免费体验 24 小时</button>}<button onClick={onExplore}>去体验对话</button></section>
        <nav className="commerce-tabs">{([['diamonds', '购买钻石'], ['membership', '会员权益'], ['orders', '订单与明细']] as const).map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
        {tab !== 'orders' ? <><div className="commerce-products">{products.map(product => <button key={product.id} disabled={product.once && account?.wallet.starterBought} onClick={() => { setSelected(product); setCreated(false); setIdempotencyKey(crypto.randomUUID()); }}>{product.type === 'membership' ? <Crown /> : <Gem />}<b>{product.title}</b><strong>¥{(product.priceFen / 100).toFixed(2)}</strong><small>{product.type === 'membership' ? '30 天 · 每日 20 次免费回复' : product.once ? '每账户限购一次' : `${product.amount.toLocaleString()} 钻石`}</small></button>)}</div><p className="commerce-note">支付服务待接入。可查看套餐和创建待支付订单，当前不会扣款或发放购买权益。套餐价格为本项目配置。</p></> : <>
          <h3>我的订单</h3>{!data.orders?.length && <p className="commerce-note">还没有订单</p>}{data.orders?.map(order => <article className="commerce-order" key={order.id}><div><b>{order.productTitle}</b><small>{new Date(order.createdAt).toLocaleString('zh-CN')}</small><small>订单尾号 {order.id.slice(-8)}{order.testMode ? ' · 测试订单' : ''}</small></div><span>¥{(order.priceFen / 100).toFixed(2)}<small>{orderLabels[order.status] ?? order.status}</small>{order.status === 'pending' && testMode() && <button disabled={busy} onClick={() => void act('mock-pay',{orderId:order.id})}>Mock 支付成功 · 不扣款</button>}{order.status === 'pending' && <button disabled={busy} onClick={() => void act('cancel-order', { orderId: order.id })}>取消订单</button>}</span></article>)}
          <h3>钻石流水</h3>{account?.wallet.history.map(item => <article className="commerce-order" key={item.id}><div><b>{item.kind}</b><small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small></div><strong>{item.amount > 0 ? '+' : ''}{item.amount}</strong></article>)}
          <p className="commerce-note">本账户已核验成交：¥{((data.gmv?.totalFen ?? 0) / 100).toFixed(2)} · {data.gmv?.orderCount ?? 0} 笔。待支付、取消、测试订单不计入成交金额。</p>
        </>}
      </>}
      {loading && <p>正在读取…</p>}{error && <p className="account-error" role="alert">{error}</p>}
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent className="commerce-dialog"><DialogTitle>{created ? '待支付订单已创建' : '确认套餐'}</DialogTitle><DialogDescription>{created ? '支付服务尚未接入。本次没有扣款，也没有增加余额或会员时长。可在订单中查看或取消。' : '订单金额由服务器确认。当前支付未开放，创建订单不会扣款。'}</DialogDescription><h3>{selected?.title}</h3><strong>¥{((selected?.priceFen ?? 0) / 100).toFixed(2)}</strong>{error && <p className="account-error" role="alert">{error}</p>}<button className="account-login" disabled={busy} onClick={async () => { if (created) { setSelected(null); setTab('orders'); return; } if (selected && await act('order', { productId: selected.id, idempotencyKey })) setCreated(true); }}>{busy ? '处理中…' : created ? '查看订单' : '创建待支付订单'}</button></DialogContent></Dialog>
  </div>;
}
