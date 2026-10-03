'use client';

/* oxlint-disable next/no-img-element -- Local avatars and supplied story/post images use explicit dimensions with the preview runtime's existing image rendering. */
import { useEffect, useId, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ArrowLeft, BookOpen, Bot, CalendarCheck, Check, ChevronRight, Gem, Heart, HelpCircle, MessageCircle, PenLine, Settings2, Sparkles, Trash2, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { dailyRewards, diamondPacks, type DiamondState } from '@/lib/diamonds';
import { ProfileEditor, useLocalProfile } from '@/components/profile-editor';
import type { WorldMemory } from '@/components/world-tools';
import '@/app/personal-library.css';
import { AccountPanel, useAccount } from '@/components/account-center';

export type PersonalLibraryProps = {
  initialSection?: '智能体' | '故事' | '动态' | '记忆簿';
  agents: { id: number | string; name: string; avatar: string; tagline: string }[];
  agentsStatus: 'loading' | 'ready' | 'error';
  agentsError: string;
  onRetryAgents: () => void;
  stories: { title: string; image: string; summary: string }[];
  posts: { id: number; copy: string; images: string[]; date: string; likes: number; commentsCount: number }[];
  memories: WorldMemory[];
  followingCount: number;
  onOpenAgent: (id: number | string) => void;
  onOpenStory: (title: string) => void;
  onOpenPost: (id: number) => void;
  onRemoveMemory: (id: string) => void;
  onAgents: () => void;
};

type PersonalTab = '阁楼' | '动态' | '橱窗';
type PersonalFilter = '智能体' | '故事' | '时刻' | '群聊' | '记忆簿';

export function useDiamondWallet() {
  const account = useAccount();
  const [wallet, setWallet] = useState<DiamondState | null>(null);
  // Reward eligibility is stored by account and date on the server.
  const [checkedThisVisit, setCheckedThisVisit] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setError('');
    try { const result = await fetch('/api/diamonds'); const data = await result.json() as DiamondState & { error?: string }; if (!result.ok) throw Error(data.error); setWallet(data); }
    catch (e) { setError(e instanceof Error ? e.message : '暂时无法连接钱包'); }
  }
  useEffect(() => { if (account.data?.authenticated) void refresh(); else setWallet(null); }, [account.data?.authenticated]);
  useEffect(() => { const update = () => void refresh(); window.addEventListener('kk-wallet-updated', update); return () => window.removeEventListener('kk-wallet-updated', update); }, []);
  async function transact(action: 'checkin' | 'purchase', pack?: string, requestId?: string) {
    if (busy) return false;
    setBusy(true); setError('');
    try {
      const result = await fetch('/api/diamonds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, pack, requestId }) });
      const data = await result.json() as DiamondState & { error?: string }; if (!result.ok) throw Error(data.error);
      setWallet(data);
      if (action === 'checkin') setCheckedThisVisit(true);
      window.dispatchEvent(new Event('kk-account-updated'));
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : '操作未完成'); return false; }
    finally { setBusy(false); }
  }
  return { wallet, checkedThisVisit, error, busy, refresh, transact };
}
type WalletControl = ReturnType<typeof useDiamondWallet>;

export function PersonalView({ control, onWallet, onWorld, onForum, initialSection = '智能体', agents, agentsStatus, agentsError, onRetryAgents, stories, posts, memories, followingCount, onOpenAgent, onOpenStory, onOpenPost, onRemoveMemory, onAgents }: PersonalLibraryProps & { control: WalletControl; onWallet: () => void; onWorld: () => void; onForum: () => void }) {
  const account = useAccount();
  const { wallet: storedWallet, busy, error, transact, refresh } = control;
  const { profile, setProfile, hydrated } = useLocalProfile();
  const [editing, setEditing] = useState(false);
  const [profileStatus, setProfileStatus] = useState('');
  const profileTitleId = useId();
  const profilePopupRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const wallet = storedWallet;
  const [checkinOpen, setCheckinOpen] = useState(true);
  const [tab, setTab] = useState<PersonalTab>(initialSection === '动态' ? '动态' : '阁楼');
  const [filter, setFilter] = useState<PersonalFilter>(initialSection === '动态' ? '智能体' : initialSection);
  const [memoryToRemove, setMemoryToRemove] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState('');
  const [info, setInfo] = useState('');
  const libraryCounts: Record<PersonalFilter, number | string> = {
    智能体: agentsStatus === 'ready' ? agents.length : agentsStatus === 'loading' ? '读取中' : '未读取',
    故事: stories.length,
    时刻: '未开放',
    群聊: '未开放',
    记忆簿: memories.length,
  };
  const currentDay = storedWallet ? (storedWallet.checked ? Math.max(storedWallet.streak - 1, 0) : storedWallet.streak) % 7 : 0;
  function openCheckin() {
    if (!account.data?.authenticated) setInfo('当前无法领取每日钻石。');
    else if (wallet?.checked) setInfo('今日签到奖励已领取，明天再来领取钻石吧。');
    else setCheckinOpen(true);
  }
  function openProfile(trigger: HTMLButtonElement) {
    profileTriggerRef.current = trigger;
    setProfileStatus('');
    setEditing(true);
  }
  return <div className="screen scroll-screen personal-screen">
    <AccountPanel onExplore={onAgents} onWallet={onWallet} />
    <header className="personal-tools"><button aria-label="每日签到" onClick={openCheckin}><CalendarCheck /></button><button aria-label="邀请好友" onClick={() => setInfo('邀请好友：分享 kirakira 的公开链接，和朋友一起探索故事。')}><Users /></button><button aria-label="个人设置" onClick={() => setInfo('登录后，角色对话、剧情、钻石和订单保存到你的账户。头像和简介暂为当前设备偏好。')}><Settings2 /><i /></button></header>
    <section className="personal-identity"><img src={profile.avatar} alt={`${profile.name}的头像`} width={78} height={78} /><div><h2>{profile.name} <span>◆ Lv 0</span></h2><small>{account.data?.authenticated ? '账户已连接' : '访客浏览'}</small></div></section>
    <p className="personal-bio">{profile.bio || '还没有写简介'}</p>
    <div className="personal-tags"><button disabled={!hydrated} onClick={event => openProfile(event.currentTarget)}>＋ 个人资料</button><button onClick={() => setInfo('我的称号：初遇星光 · 开始第一段故事的纪念。')}>♛ 我的称号</button></div>
    {profileStatus && <p className="profile-save-status" role="status">{profileStatus}</p>}
    <section className="personal-stats">{['订阅者', '订阅', '被连接', '被关注'].map(label => <button key={label} aria-label={label === '订阅' ? `订阅 ${followingCount}，查看世界动态` : `${label}统计暂未开放`} onClick={label === '订阅' ? onForum : () => setInfo(`${label}统计暂未开放。`)}><b>{label === '订阅' ? followingCount : '—'}</b><span>{label}</span></button>)}<button className="personal-edit" aria-label="编辑个人资料" disabled={!hydrated} onClick={event => openProfile(event.currentTarget)}><PenLine /></button></section>
    <button className="personal-world-banner" onClick={onWorld}><Sparkles /><span><b>我的小世界</b><small>你的天地 · 你的故事</small></span><ChevronRight /></button>
    <section className="personal-diamonds"><header><span>💎 钻石</span><b><i />{wallet?.balance ?? '—'}</b></header><div><button onClick={onWallet}>购买 <ChevronRight /></button><button onClick={openCheckin}>每日签到领钻石 <ChevronRight /></button></div></section>
    {error && <button className="diamond-error" onClick={refresh}>{error} 点击重试</button>}
    <div className="personal-shortcuts"><button onClick={onWallet}><Gem />钻石福利 <em>New</em></button><button onClick={openCheckin}><CalendarCheck />每日签到</button><button onClick={onForum}><BookOpen />世界动态</button></div>
    <nav className="personal-tabs" aria-label="个人内容分类">{(['阁楼', '动态', '橱窗'] as const).map(label => <button key={label} aria-pressed={tab === label} className={tab === label ? 'active' : ''} onClick={() => { setTab(label); setMemoryToRemove(null); }}>{label}{label === '动态' && <small>{posts.length}</small>}</button>)}</nav>
    {tab === '阁楼' && <div className="personal-filters" aria-label="阁楼分类">{(['智能体', '故事', '时刻', '群聊', '记忆簿'] as const).map(label => <button aria-pressed={filter === label} className={filter === label ? 'active' : ''} key={label} onClick={() => { setFilter(label); setMemoryToRemove(null); setLibraryNotice(''); }}><span>{label}</span><small>{libraryCounts[label]}</small></button>)}</div>}
    <section className="personal-library" aria-label={tab === '阁楼' ? filter : tab}>
      {tab === '阁楼' && filter === '智能体' && <>
        <p className="personal-library-note">登录后自建角色保存到你的账户，仅自己可见；访客角色保留在原浏览器。</p>
        {agentsStatus === 'loading' ? <output className="personal-library-state"><Bot /><b>正在读取你的智能体…</b></output>
          : agentsStatus === 'error' ? <div className="personal-library-state personal-library-error" role="alert"><Bot /><b>智能体暂时没有读取成功</b><p>{agentsError || '请稍后重试。'}</p><button onClick={onRetryAgents}>重新加载</button></div>
          : agents.length ? <div className="personal-agent-grid">{agents.map(agent => <button className="personal-agent-card" key={agent.id} onClick={() => onOpenAgent(agent.id)} aria-label={`与${agent.name}对话`}><img src={agent.avatar} alt="" width={64} height={64} loading="lazy" /><strong>{agent.name}</strong><p>{agent.tagline}</p><span>开始对话 <ChevronRight /></span></button>)}</div>
          : <div className="personal-library-state"><Bot /><b>还没有自己的智能体</b><p>写下角色设定，创建下一场相遇。</p><button onClick={onAgents}>去创建智能体 <ChevronRight /></button></div>}
        {agentsStatus === 'ready' && agents.length > 0 && <button className="personal-library-more" onClick={onAgents}>查看我的智能体 <ChevronRight /></button>}
      </>}
      {tab === '阁楼' && filter === '故事' && <>
        <p className="personal-library-note">收藏故事仅保留在本次页面访问中。</p>
        {stories.length ? <div className="personal-story-grid">{stories.map(story => <button className="personal-story-card" key={story.title} onClick={() => onOpenStory(story.title)} aria-label={`查看收藏故事：${story.title}`}><img src={story.image} alt="" width={180} height={240} loading="lazy" /><span><strong>{story.title}</strong><p>{story.summary}</p><small>查看故事 <ChevronRight /></small></span></button>)}</div>
          : <div className="personal-library-state"><BookOpen /><b>还没有收藏的故事</b><p>在世界详情的“更多”中收藏喜欢的故事。</p><button onClick={onWorld}>去探索世界 <ChevronRight /></button></div>}
      </>}
      {tab === '动态' && <>
        <p className="personal-library-note">你发布的演示动态仅保留在本次页面访问中。</p>
        {posts.length ? <div className="personal-post-list">{posts.map(post => <button className="personal-post-card" key={post.id} onClick={() => onOpenPost(post.id)} aria-label={`查看动态：${post.copy.slice(0, 30)}`}><span className="personal-post-author"><img src={profile.avatar} alt="" width={36} height={36} /><span><strong>{profile.name}</strong><small>{post.date}</small></span></span><p>{post.copy}</p>{post.images.length > 0 && <span className="personal-post-images">{post.images.map((src, index) => <img key={`${src}-${index}`} src={src} alt={`动态图片 ${index + 1}`} width={120} height={120} loading="lazy" />)}</span>}<span className="personal-post-footer"><span><Heart aria-hidden="true" />{post.likes} 赞</span><span><MessageCircle aria-hidden="true" />{post.commentsCount} 评论</span><ChevronRight aria-hidden="true" /></span></button>)}</div>
          : <div className="personal-library-state"><MessageCircle /><b>还没有发布的动态</b><p>在世界动态分享此刻的心情或故事。</p><button onClick={onForum}>去发布动态 <ChevronRight /></button></div>}
      </>}
      {tab === '阁楼' && filter === '记忆簿' && <>
        <p className="personal-library-note">收藏的对话片段仅保留在本次页面访问中。</p>
        {libraryNotice && <output className="personal-library-notice">{libraryNotice}</output>}
        {memories.length ? <div className="personal-memory-list">{memories.map(memory => <article className="personal-memory-card" key={memory.id}><header><span><small>{memory.worldTitle}</small><strong>{memory.speaker}</strong></span><button aria-label={`移除${memory.speaker}的这条回忆`} onClick={() => { setMemoryToRemove(memory.id); setLibraryNotice(''); }}><Trash2 /></button></header><p>{memory.text}</p><time dateTime={new Date(memory.createdAt).toISOString()}>{new Date(memory.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>{memoryToRemove === memory.id && <fieldset className="personal-memory-confirm" aria-label="确认移除回忆"><p>从记忆簿移除这条回忆？原对话不受影响。</p><div><button onClick={() => setMemoryToRemove(null)}>保留</button><button onClick={() => { onRemoveMemory(memory.id); setMemoryToRemove(null); setLibraryNotice('已从记忆簿移除这条回忆。'); }}>确认移除</button></div></fieldset>}</article>)}</div>
          : <div className="personal-library-state"><Heart /><b>还没有收藏的回忆</b><p>打开世界工具的“纪念回忆”，收藏值得留下的对话。</p><button onClick={onWorld}>去世界看看 <ChevronRight /></button></div>}
      </>}
      {tab === '阁楼' && (filter === '时刻' || filter === '群聊') && <div className="personal-library-state"><Sparkles /><b>{filter}功能暂未开放</b><p>{filter === '时刻' ? '这里还不支持保存或查看时刻。' : '这里还不支持创建或加入群聊。'}</p></div>}
      {tab === '橱窗' && <div className="personal-library-state"><Gem /><b>橱窗功能暂未开放</b><p>当前没有上架或购买橱窗内容的功能。</p></div>}
    </section>
    <Dialog open={checkinOpen && wallet?.checked === false} onOpenChange={setCheckinOpen}><DialogPrimitive.Portal><DialogPrimitive.Backdrop className="checkin-backdrop" /><DialogPrimitive.Viewport className="checkin-viewport"><DialogPrimitive.Popup className="checkin-dialog">
      <button className="diamond-close" aria-label="关闭签到" onClick={() => setCheckinOpen(false)}><X /></button>
      <div className="checkin-heading"><div><DialogTitle>每日签到<span> ✨</span></DialogTitle><DialogDescription>连续签到得更多钻石</DialogDescription></div><span className="checkin-gems" aria-hidden="true">💎</span></div>
      <div className="checkin-totals"><div><strong>{wallet?.reward ?? 1}<span>💎</span></strong><small>{wallet?.checked ? '今日奖励已到账' : '签到领钻石'}</small></div><span>↗</span><div><strong>10<span>💎</span></strong><small>视频奖励 · 敬请期待</small></div></div>
      <div className="checkin-week">{dailyRewards.map((reward, index) => <div key={index} className={`${index === currentDay ? 'today' : ''} ${index < currentDay || (index === currentDay && wallet?.checked) ? 'claimed' : ''}`}><small>{index === currentDay ? '今天' : `${index + 1} 天`}</small><span>{index < currentDay || (index === currentDay && wallet?.checked) ? <Check /> : '💎'}</span><b>{reward}</b></div>)}</div>
      <div className="checkin-recommend-heading">每日推荐 <button onClick={() => { setCheckinOpen(false); onWorld(); }}>全部 <ChevronRight /></button></div>
      <div className="checkin-recommend">{[['💞', '心动故事'], ['🔮', '探索世界'], ['💌', '好友动态'], ['💎', '钻石福利']].map(([icon, label], index) => <button key={label} onClick={() => { setCheckinOpen(false); if (index === 3) onWallet(); else if (index === 2) onForum(); else onWorld(); }}><span>{icon}</span><small>{label}</small></button>)}</div>
      {error && <p className="diamond-error">{error}</p>}
      <div className="checkin-actions"><button disabled={!wallet || busy} onClick={() => { if (wallet?.checked) setCheckinOpen(false); else void transact('checkin'); }}>{busy ? '领取中…' : wallet?.checked ? '今日已签到' : '签到'}</button><button onClick={() => setInfo('视频奖励暂未接入广告服务，当前不能领取额外钻石。每日签到可以正常领取。')}>视频奖励 · 暂未开放</button></div>
      <small className="diamond-disclaimer">每日奖励只发放一次（北京时间）· 登录账户保存余额 · 钻石不可提现</small>
    </DialogPrimitive.Popup></DialogPrimitive.Viewport></DialogPrimitive.Portal></Dialog>
    <Dialog open={editing} onOpenChange={setEditing}><DialogPrimitive.Portal><DialogPrimitive.Backdrop className="profile-backdrop" /><DialogPrimitive.Viewport className="profile-viewport"><DialogPrimitive.Popup ref={profilePopupRef} className="profile-popup" aria-labelledby={profileTitleId} initialFocus={profilePopupRef} finalFocus={profileTriggerRef}>
      {editing && <ProfileEditor profile={profile} titleId={profileTitleId} onClose={() => setEditing(false)} onSave={next => {
        const result = setProfile(next);
        if (result !== 'invalid') {
          setEditing(false);
          setProfileStatus(result === 'persisted' ? '资料已保存到当前浏览器。' : '资料已在本次页面中更新，但浏览器无法保存；刷新后可能丢失。');
        }
        return result;
      }} />}
    </DialogPrimitive.Popup></DialogPrimitive.Viewport></DialogPrimitive.Portal></Dialog>
    <InfoDialog info={info} onClose={() => setInfo('')} />
  </div>;
}

function InfoDialog({ info, onClose }: { info: string; onClose: () => void }) { return <Dialog open={Boolean(info)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="diamond-info"><DialogTitle>温馨提示</DialogTitle><DialogDescription>{info}</DialogDescription><button className="diamond-primary" onClick={onClose}>知道了</button></DialogContent></Dialog>; }

export function DiamondWalletView({ control, onBack, backLabel = '返回上一页' }: { control: WalletControl; onBack: () => void; backLabel?: string }) {
  const { wallet, error, busy, transact, refresh } = control;
  const { profile } = useLocalProfile();
  const [tab, setTab] = useState('钱包');
  const [shopTab, setShopTab] = useState('购买礼包');
  const [selected, setSelected] = useState<(typeof diamondPacks)[number] | null>(null);
  const [requestId, setRequestId] = useState('');
  const [success, setSuccess] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [info, setInfo] = useState('');
  function choose(pack: (typeof diamondPacks)[number]) { setSelected(pack); setRequestId(crypto.randomUUID()); setSuccess(false); }
  return <div className="screen diamond-wallet-screen">
    <header className="diamond-wallet-header"><button onClick={onBack} aria-label={backLabel}><ArrowLeft /></button><nav>{['钱包', '收入'].map(label => <button key={label} onClick={() => setTab(label)} className={tab === label ? 'active' : ''}>{label}</button>)}</nav><button aria-label="钱包说明" onClick={() => setInfo('这是 kirakira 演示钱包。购买不会真实扣款，钻石无现金价值、不可转赠或提现。真实支付尚未接入。')}><HelpCircle /></button></header>
    <main className="diamond-wallet-scroll">
      {tab === '钱包' ? <>
        <div className="diamond-level-ruler">{[0, 1, 2, 3, 4].map(level => <span className={level === 0 ? 'active' : ''} key={level}>│<small>Lv{level}</small></span>)}</div>
        <div className="diamond-section-heading"><h3>星愿等级 <HelpCircle /></h3><button onClick={() => setInfo('星愿等级尚未开放升级。当前为 Lv.0，演示购买不会增加真实消费经验。')}>如何提升 <ChevronRight /></button></div>
        <section className="diamond-level-card"><header><img src={profile.avatar} alt={`${profile.name}的头像`} width={28} height={28} /><b>{profile.name}</b></header><strong>Lv0</strong><p>0 / 200 Exp</p><div className="diamond-level-progress"><i /></div><small>还差 200 升级到 Lv.1</small></section>
        <section className="diamond-perks"><div className="diamond-section-heading"><span>Lv.0 解锁权益 · <em>2 项</em></span><button onClick={() => setInfo('等级权益预览，星尘和折扣券暂未开放兑换。签到钻石和演示购买已可体验。')}>权益说明 <ChevronRight /></button></div><div className="diamond-perk-grid"><article><b>星尘 × 200</b><small>限定池体验奖励</small><span>✨</span><button onClick={() => setInfo('星尘奖励暂未开放，请先体验每日签到领取钻石。')}>查看</button></article><article><b>礼包 8 折券 × 1</b><small>领取后限时 1 个月使用</small><span>🎟️</span><button onClick={() => setInfo('优惠券为权益预览，真实兑换暂未开放。')}>查看</button></article></div></section>
        <nav className="diamond-shop-tabs">{['购买礼包', '购买钻石'].map(label => <button key={label} onClick={() => setShopTab(label)} className={shopTab === label ? 'active' : ''}>{label}</button>)}</nav>
        {shopTab === '购买礼包' ? <><button className="diamond-starter-pack" disabled={wallet?.starterBought} onClick={() => choose(diamondPacks[0])}><header><b>萌新体验包</b><em>600 钻石 · 限购 1 次</em></header><div><ul><li>600 枚演示钻石</li><li>体验完整购买流程</li><li>钻石到账可查看明细</li></ul><span>💎</span></div><footer><strong>¥6</strong><span>{wallet?.starterBought ? '已购买' : '立即体验'} <ChevronRight /></span></footer></button><div className="diamond-locked-packs">{[['初级补给包', '5,000', '28', '1'], ['中级补给包', '10,000', '60', '3']].map(([title, amount, price, level]) => <article key={title}><small>🔒 Lv.{level}</small><h3>{title}</h3><div>💎 <b>× {amount}</b></div><p>等级礼包尚未开放</p><button disabled>🔒 ¥{price}.00</button></article>)}</div></> : <div className="diamond-packs">{diamondPacks.slice(1).map(pack => <button key={pack.id} onClick={() => choose(pack)}><span>💎</span><b>{pack.amount.toLocaleString()}</b><small>¥{pack.price}</small></button>)}</div>}
        <p className="diamond-disclaimer">套餐为演示配置，非星野官方定价。不会产生真实扣费。</p>
      </> : <section className="diamond-income"><Gem /><h2>暂无收入</h2><p>演示钻石不能兑换现金或提现。</p></section>}
      {error && <button className="diamond-error" onClick={refresh}>{error} 点击重试</button>}
    </main>
    <footer className="diamond-wallet-bottom"><div><b>💎 {wallet?.balance ?? '—'}</b><button onClick={() => setHistoryOpen(true)}>明细 <ChevronRight /></button></div><p>演示余额 · 仅用于当前访客的原型体验</p></footer>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent className="diamond-purchase"><DialogTitle>{success ? '钻石已到账' : '确认购买钻石'}</DialogTitle><DialogDescription>{success ? '本次为模拟购买，没有产生真实扣款。' : '原型演示订单，不会调用真实支付。'}</DialogDescription><span className="diamond-purchase-icon">{success ? '🎉' : '💎'}</span><h3>{selected?.amount.toLocaleString()} 钻石</h3><p>{selected?.title} · ¥{selected?.price}</p>{error && <p className="diamond-error">{error}</p>}<button disabled={busy || !wallet} className="diamond-primary" onClick={async () => { if (success) { setSelected(null); return; } if (selected && await transact('purchase', selected.id, requestId)) setSuccess(true); }}>{busy ? '处理中…' : success ? '完成' : '模拟支付 · 确认到账'}</button>{!success && <button className="diamond-cancel" disabled={busy} onClick={() => setSelected(null)}>暂不购买</button>}</DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="diamond-history"><DialogTitle>钻石明细</DialogTitle><DialogDescription>当前余额：{wallet?.balance ?? '—'} 钻石</DialogDescription><div>{wallet?.history.map(item => <article key={item.id}><span><b>{item.kind}</b><small>{new Date(item.created_at).toLocaleString('zh-CN')}</small></span><strong>+{item.amount}</strong></article>)}<article><span><b>初始体验钻石</b><small>欢迎来到 kirakira</small></span><strong>+5</strong></article></div></DialogContent></Dialog>
    <InfoDialog info={info} onClose={() => setInfo('')} />
  </div>;
}
