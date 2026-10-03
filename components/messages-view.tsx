'use client';

/* oxlint-disable next/no-img-element -- Local avatar assets are already sized; avoid the preview runtime image shim. */

import { useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Bell, CheckCheck, ChevronRight, MessageCircle, MoreHorizontal, Pin, Search, Send, Settings2, Trash2, X } from 'lucide-react';
import { CharacterChat, type ChatMessage } from '@/components/character-chat';
import { NotificationCenter, notifications, type NoticeKind } from '@/components/notification-center';
import '@/app/messages-view.css';

type Contact = {
  id: number;
  name: string;
  time: string;
  preview: string;
  unread: number;
  image: string;
  pinned: boolean;
  activity: number;
};

type MessagesSession = {
  contacts: Contact[];
  chatHistories: Record<number, ChatMessage[]>;
  readIds: string[];
  notificationReplies: Record<string, string[]>;
  notificationDrafts: Record<string, string>;
  activeId: number | null;
  noticeKind: NoticeKind | null;
  query: string;
  showPreview: boolean;
  unreadOnly: boolean;
  sort: 'recent' | 'name';
};

export type MessagesState = {
  session: MessagesSession;
  setSession: Dispatch<SetStateAction<MessagesSession>>;
  unreadCount: number;
};

function createSession(): MessagesSession {
  return {
    contacts: [
      { id: 1, name: '许朝', time: '13:57', preview: '（指尖在桌面轻轻敲了一下）你终于来了。', unread: 2, image: '/avatars/avatar-17.webp', pinned: false, activity: 6 },
      { id: 2, name: '岚川', time: '13:55', preview: '（他整个人僵住，像是被你这个动作打乱了节奏）', unread: 1, image: '/avatars/avatar-07.jpg', pinned: false, activity: 5 },
      { id: 3, name: '沈羡安', time: '周一', preview: '（他轻轻笑了一声，直起身来，伸手朝旁边的小桌）', unread: 0, image: '/avatars/avatar-06.webp', pinned: false, activity: 4 },
      { id: 4, name: '傅甘', time: '周一', preview: '（兔耳轻轻抖了抖，没转身，声音闷在抱枕里）', unread: 0, image: '/avatars/avatar-08.webp', pinned: false, activity: 3 },
      { id: 5, name: '傅砚辞', time: '周一', preview: '（听到这个名字，他指尖在表带上停了一瞬）', unread: 0, image: '/avatars/avatar-11.webp', pinned: false, activity: 2 },
      { id: 6, name: '苏眠', time: '周日', preview: '新的日记写好了，只给你一个人看。', unread: 3, image: '/avatars/avatar-05.webp', pinned: false, activity: 1 },
    ],
    chatHistories: {},
    readIds: [],
    notificationReplies: {},
    notificationDrafts: {},
    activeId: null,
    noticeKind: null,
    query: '',
    showPreview: true,
    unreadOnly: false,
    sort: 'recent',
  };
}

// Keep this hook in the page that owns the main navigation. Its state stays in
// memory while MessagesView is unmounted, and is discarded on a page refresh.
export function useMessagesState(): MessagesState {
  const [session, setSession] = useState(createSession);
  const unreadCount = session.contacts.reduce((total, contact) => total + contact.unread, 0)
    + notifications.filter(item => !session.readIds.includes(item.id)).length;
  return { session, setSession, unreadCount };
}

function MessageDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="messages-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="messages-dialog-body">
      <header><h2 id={titleId}>{title}</h2><button type="button" aria-label="关闭弹窗" onClick={onClose}><X /></button></header>
      {children}
    </div>
  </dialog>;
}

export function MessagesView({ state, onUnreadChange }: {
  state?: MessagesState;
  onUnreadChange?: (count: number) => void;
}) {
  const ownState = useMessagesState();
  const { session, setSession, unreadCount } = state ?? ownState;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [optionsId, setOptionsId] = useState<number | null>(null);
  const [clearId, setClearId] = useState<number | null>(null);
  const searchId = useId();

  useEffect(() => { onUnreadChange?.(unreadCount); }, [onUnreadChange, unreadCount]);

  const updateSession = (patch: Partial<MessagesSession>) => setSession(current => ({ ...current, ...patch }));
  const activeContact = session.contacts.find(contact => contact.id === session.activeId);
  const optionsContact = session.contacts.find(contact => contact.id === optionsId);
  const clearContact = session.contacts.find(contact => contact.id === clearId);
  const unreadFor = (kind: NoticeKind) => notifications.filter(item => item.kind === kind && !session.readIds.includes(item.id)).length;
  const query = session.query.trim().toLocaleLowerCase();
  const visibleContacts = session.contacts.filter(contact => {
    if (session.unreadOnly && contact.unread === 0) return false;
    const searchable = [contact.name, contact.preview, ...(session.chatHistories[contact.id] ?? []).map(message => message.content)].join(' ').toLocaleLowerCase();
    return !query || searchable.includes(query);
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (session.sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : b.activity - a.activity));

  function markAllRead() {
    setSession(current => ({ ...current, readIds: notifications.map(item => item.id), contacts: current.contacts.map(contact => ({ ...contact, unread: 0 })) }));
  }

  function openConversation(id: number) {
    setSession(current => ({ ...current, activeId: id, contacts: current.contacts.map(contact => contact.id === id ? { ...contact, unread: 0 } : contact) }));
  }

  function updateContact(id: number, patch: Partial<Contact>) {
    setSession(current => ({ ...current, contacts: current.contacts.map(contact => contact.id === id ? { ...contact, ...patch } : contact) }));
    setOptionsId(null);
  }

  function clearConversation(id: number) {
    setSession(current => ({ ...current, chatHistories: { ...current.chatHistories, [id]: [] }, contacts: current.contacts.map(contact => contact.id === id ? { ...contact, preview: '暂无消息，来聊聊吧', unread: 0, time: '' } : contact) }));
    setClearId(null);
  }

  if (session.noticeKind) return <NotificationCenter kind={session.noticeKind} readIds={session.readIds}
    replies={session.notificationReplies} drafts={session.notificationDrafts} showPreview={session.showPreview}
    onReply={(id, text) => setSession(current => ({ ...current, notificationReplies: { ...current.notificationReplies, [id]: [...(current.notificationReplies[id] ?? []), text] }, notificationDrafts: { ...current.notificationDrafts, [id]: '' } }))}
    onDraftChange={(id, text) => setSession(current => ({ ...current, notificationDrafts: { ...current.notificationDrafts, [id]: text } }))}
    onRead={ids => setSession(current => ({ ...current, readIds: [...new Set([...current.readIds, ...ids])] }))}
    onBack={() => updateSession({ noticeKind: null })} />;

  if (activeContact) return <CharacterChat key={activeContact.id} contact={activeContact}
    messages={session.chatHistories[activeContact.id] ?? [{ role: 'assistant', content: activeContact.preview }]}
    onMessages={messages => setSession(current => ({ ...current, chatHistories: { ...current.chatHistories, [activeContact.id]: messages }, contacts: current.contacts.map(contact => contact.id === activeContact.id ? { ...contact, preview: messages.at(-1)?.content ?? '暂无消息，来聊聊吧', time: '刚刚', activity: Date.now(), unread: 0 } : contact) }))}
    onBack={() => updateSession({ activeId: null })} />;

  return <div className="screen scroll-screen messages-screen messages-view">
    <header className="messages-title"><h2>消息</h2><button type="button" aria-label="消息设置" onClick={() => setSettingsOpen(true)}><Settings2 /></button></header>
    <div className="messages-tools">
      <div className="messages-search"><Search aria-hidden="true" /><label className="messages-sr-only" htmlFor={searchId}>搜索角色或聊天内容</label><input id={searchId} type="search" value={session.query} placeholder="搜索角色或聊天内容" onChange={event => updateSession({ query: event.target.value })} onKeyDown={event => { if (event.key === 'Escape') updateSession({ query: '' }); }} />{session.query && <button type="button" aria-label="清空搜索" onClick={() => updateSession({ query: '' })}><X /></button>}</div>
      <button className="messages-read-all" type="button" disabled={unreadCount === 0} onClick={markAllRead}><CheckCheck />全部已读</button>
    </div>
    <section className="message-services" aria-label="通知分类">
      <button type="button" onClick={() => updateSession({ noticeKind: 'interaction' })}><span className="service-icon interaction"><Bell /></span><span><b>互动消息</b><small>{session.showPreview ? '赞、评论与新的共鸣' : '点击查看互动消息'}</small></span>{unreadFor('interaction') > 0 && <i aria-label={`${unreadFor('interaction')} 条未读`}>{unreadFor('interaction')}</i>}<ChevronRight /></button>
      <button type="button" onClick={() => updateSession({ noticeKind: 'system' })}><span className="service-icon system"><Send /></span><span><b>系统通知</b><small>{session.showPreview ? '九月创作者活动奖励公告' : '点击查看系统通知'}</small></span><em>今天</em>{unreadFor('system') > 0 && <i aria-label={`${unreadFor('system')} 条未读`}>{unreadFor('system')}</i>}<ChevronRight /></button>
    </section>
    <div className="messages-list-heading"><h3>角色会话</h3><button type="button" aria-pressed={session.unreadOnly} onClick={() => updateSession({ unreadOnly: !session.unreadOnly })}>只看未读</button></div>
    <p className="message-hint">点击会话右侧的更多按钮，可置顶、标记未读或重置列表预览</p>
    <div className="conversation-list messages-conversations">
      {visibleContacts.map(contact => <div className={`messages-conversation-row${contact.pinned ? ' is-pinned' : ''}`} key={contact.id} onContextMenu={event => { event.preventDefault(); setOptionsId(contact.id); }}>
        <button type="button" className="messages-conversation-main" onClick={() => openConversation(contact.id)} aria-label={`与${contact.name}聊天${contact.unread ? `，${contact.unread} 条未读` : ''}${contact.pinned ? '，已置顶' : ''}`}>
          <img src={contact.image} alt="" width={49} height={49} /><span className="messages-conversation-copy"><b>{contact.name}{contact.pinned && <Pin aria-label="已置顶" />}</b><small>{session.showPreview ? contact.preview : '点击查看会话'}</small></span>
          <span className="conversation-state"><time>{contact.time}</time>{contact.unread > 0 && <i>{contact.unread}</i>}</span>
        </button>
        <button type="button" className="messages-conversation-options" aria-label={`${contact.name}的会话选项`} aria-haspopup="dialog" onClick={() => setOptionsId(contact.id)}><MoreHorizontal /></button>
      </div>)}
      {visibleContacts.length === 0 && <div className="messages-empty" aria-live="polite"><MessageCircle /><b>{query ? '没有找到匹配的会话' : '暂时没有未读会话'}</b><p>{query ? '试试角色名，或聊过的一句话。' : '已读会话仍保留在全部会话中。'}</p><button type="button" onClick={() => updateSession({ query: '', unreadOnly: false })}>查看全部会话</button></div>}
    </div>
    <p className="messages-session-note">已登录的角色对话保存在账户中；列表设置仅保留在本次访问</p>

    {settingsOpen && <MessageDialog title="消息设置" onClose={() => setSettingsOpen(false)}>
      <label className="messages-setting" htmlFor={`${searchId}-preview`} aria-label="显示消息预览"><span><b>显示消息预览</b><small>在会话和通知列表中显示内容摘要</small></span><input id={`${searchId}-preview`} type="checkbox" checked={session.showPreview} onChange={event => updateSession({ showPreview: event.target.checked })} /></label>
      <label className="messages-setting" htmlFor={`${searchId}-unread`} aria-label="只看未读会话"><span><b>只看未读会话</b><small>隐藏已经读过的角色会话</small></span><input id={`${searchId}-unread`} type="checkbox" checked={session.unreadOnly} onChange={event => updateSession({ unreadOnly: event.target.checked })} /></label>
      <label className="messages-setting messages-setting-sort" htmlFor={`${searchId}-sort`} aria-label="会话排序"><span><b>会话排序</b><small>置顶会话始终排在前面</small></span><select id={`${searchId}-sort`} value={session.sort} onChange={event => updateSession({ sort: event.target.value === 'name' ? 'name' : 'recent' })}><option value="recent">最近聊天优先</option><option value="name">角色名称</option></select></label>
      <p className="messages-dialog-note">设置即时生效，仅保留在本次访问中。</p>
      <button type="button" className="messages-primary-action" onClick={() => setSettingsOpen(false)}>完成</button>
    </MessageDialog>}
    {optionsContact && <MessageDialog title={`${optionsContact.name}的会话`} onClose={() => setOptionsId(null)}>
      <div className="messages-option-list">
        <button type="button" onClick={() => updateContact(optionsContact.id, { pinned: !optionsContact.pinned })}><Pin />{optionsContact.pinned ? '取消置顶' : '置顶会话'}</button>
        <button type="button" onClick={() => updateContact(optionsContact.id, { unread: optionsContact.unread > 0 ? 0 : 1 })}><MessageCircle />{optionsContact.unread > 0 ? '标记为已读' : '标记为未读'}</button>
        <button type="button" className="messages-danger" onClick={() => { setClearId(optionsContact.id); setOptionsId(null); }}><Trash2 />重置列表预览</button>
      </div>
    </MessageDialog>}
    {clearContact && <MessageDialog title="重置列表预览？" onClose={() => setClearId(null)}>
      <p className="messages-confirm-copy">重置{clearContact.name}在当前列表中的摘要和未读标记。账户中的聊天记录仍保留，进入角色后会重新加载。</p>
      <div className="messages-confirm-actions"><button type="button" onClick={() => setClearId(null)}>取消</button><button type="button" className="messages-danger-button" onClick={() => clearConversation(clearContact.id)}>确认重置</button></div>
    </MessageDialog>}
  </div>;
}
