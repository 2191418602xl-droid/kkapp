'use client';

/* oxlint-disable next/no-img-element -- Local avatar assets are already sized; avoid the preview runtime image shim. */

import { useId, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export type NoticeKind = 'interaction' | 'system';
const notificationAvatars = ['avatar-01.webp', 'avatar-02.webp', 'avatar-03.jpg', 'avatar-04.jpg', 'avatar-05.webp', 'avatar-06.webp', 'avatar-07.jpg', 'avatar-08.webp', 'avatar-09.webp'];
export const notifications = [
  ...[
    ['南枝写梦', '赞', '赞了你的动态', '雨停以后，我还是想和你一起走。'],
    ['苏眠', '评论', '评论了你的动态', '最后那句明天见，真的有被温柔到。'],
    ['小灰银鱼', '共鸣', '与你的世界产生了共鸣', '《雨夜来信》· 旧车站的约定'],
    ['月桂树', '评论', '回复了你的评论', '我也觉得，解释清楚比一句对不起更重要。'],
    ['甜桃汽水', '赞', '赞了你的评论', '喜欢这种慢慢重新认识的关系。'],
    ['晚风来信', '共鸣', '与你的世界产生了共鸣', '《雨夜来信》· 雨后的明天'],
    ['星河拾梦', '评论', '评论了你的动态', '可以分享下一段故事吗？想看旧书店的约会！'],
    ['山间月', '赞', '赞了你的动态', '把每一次心动，写进我的小世界。'],
    ['云朵收藏家', '共鸣', '与你的世界产生了共鸣', '《雨夜来信》· 一封迟到的信'],
  ].map(([name, category, title, body], i) => ({ id: `interaction-${i}`, kind: 'interaction' as const, name, category, title, body, time: i < 3 ? '今天' : '昨天', image: `/avatars/${notificationAvatars[i]}` })),
  ...[
    ['九月创作者活动奖励公告', '本条为活动演示公告。你可以在发现页浏览世界，在论坛分享故事片段。真实征集、评选及奖励发放尚未开放，不需要提交个人信息或支付费用。'],
    ['每日签到说明', '在「我的」点击每日签到即可体验领取钻石。刷新页面会恢复未签到展示，但同一访客每天只发放一次奖励。演示钻石无现金价值。'],
    ['首页背景音乐已上线', '点击世界首页右上角的声音图标播放或暂停背景音乐。离开世界首页后音乐会暂停；首次播放需要点击开启。'],
    ['社区交流小提醒', '分享故事时请尊重他人，不发布他人的隐私信息。当前互动消息为示例数据，回复仅保留在本次页面体验中，不会发送给真实用户。'],
  ].map(([title, body], i) => ({ id: `system-${i}`, kind: 'system' as const, name: 'kirakira', category: '通知', title, body, time: i === 0 ? '今天' : '本周', image: '' })),
];

export function NotificationCenter({ kind, readIds, onRead, onBack, replies: savedReplies, drafts: savedDrafts, onReply, onDraftChange, showPreview = true }: {
  kind: NoticeKind;
  readIds: string[];
  onRead: (ids: string[]) => void;
  onBack: () => void;
  replies?: Record<string, string[]>;
  drafts?: Record<string, string>;
  onReply?: (id: string, text: string) => void;
  onDraftChange?: (id: string, text: string) => void;
  showPreview?: boolean;
}) {
  const [filter, setFilter] = useState('全部');
  const [selected, setSelected] = useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = useState<Record<string, string>>({});
  const [localReplies, setLocalReplies] = useState<Record<string, string[]>>({});
  const replyId = useId();
  const replies = savedReplies ?? localReplies;
  const drafts = savedDrafts ?? localDrafts;
  const items = notifications.filter(item => item.kind === kind);
  const detail = items.find(item => item.id === selected);
  const draft = detail ? drafts[detail.id] ?? '' : '';

  function changeDraft(id: string, text: string) {
    if (onDraftChange) onDraftChange(id, text);
    else setLocalDrafts(current => ({ ...current, [id]: text }));
  }

  function sendReply(id: string) {
    const text = draft.trim();
    if (!text) return;
    if (onReply) onReply(id, text);
    else setLocalReplies(current => ({ ...current, [id]: [...(current[id] ?? []), text] }));
    changeDraft(id, '');
  }

  return <div className="screen scroll-screen messages-screen notice-center">
    <header className="notice-header"><button type="button" aria-label={detail ? '返回通知列表' : '返回消息列表'} onClick={() => { if (detail) setSelected(null); else onBack(); }}><ArrowLeft /></button><h2>{detail ? '消息详情' : kind === 'interaction' ? '互动消息' : '系统通知'}</h2>{!detail && <button type="button" disabled={items.every(item => readIds.includes(item.id))} onClick={() => onRead(items.map(item => item.id))}>全部已读</button>}</header>
    <p className="notice-demo">演示消息 · 不代表真实用户互动</p>
    {detail ? <article className="notice-detail"><small>{detail.name} · {detail.time}</small><h3>{detail.title}</h3><p>{detail.body}</p>
      <div aria-live="polite">{(replies[detail.id] ?? []).map((reply, i) => <p className="notice-reply" key={i}>我：{reply}</p>)}{(replies[detail.id]?.length ?? 0) > 0 && <p className="notice-reply-status">回复已保留在本次演示中，不会发送给真实用户。</p>}</div>
      {detail.category === '评论' && <form onSubmit={event => { event.preventDefault(); sendReply(detail.id); }}><label htmlFor={replyId}>回复评论（本次演示）</label><textarea id={replyId} value={draft} maxLength={300} onChange={event => changeDraft(detail.id, event.target.value)} placeholder="写下你的回复…" /><small className="notice-reply-count">{draft.length}/300</small><button disabled={!draft.trim()} type="submit">保存演示回复</button></form>}
    </article> : <>
      {kind === 'interaction' && <nav className="notice-filters" aria-label="互动分类">{['全部', '赞', '评论', '共鸣'].map(label => <button type="button" key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}</nav>}
      <div className="notice-list">{items.filter(item => filter === '全部' || item.category === filter || kind === 'system').map(item => <button type="button" key={item.id} onClick={() => { onRead([item.id]); setSelected(item.id); }} aria-label={`${item.name}，${item.title}${readIds.includes(item.id) ? '' : '，未读'}`}>
        {item.image && <img src={item.image} alt="" width={42} height={42} />}<span><small>{item.name} · {item.time}</small><b>{item.title}</b><p>{showPreview ? item.body : '点击查看消息详情'}</p>{(replies[item.id]?.length ?? 0) > 0 && <small className="notice-replied">已回复 {replies[item.id].length} 次</small>}</span>{!readIds.includes(item.id) && <i aria-label="未读" />}<ChevronRight />
      </button>)}</div>
    </>}
  </div>;
}
