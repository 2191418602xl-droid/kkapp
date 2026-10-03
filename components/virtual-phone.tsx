'use client';
import { useAccount, LoginLink } from '@/components/account-center';
import type { UnfinishedTurn } from '@/lib/conversations';
/* eslint-disable next/no-img-element -- This simulated phone uses bundled local character and feed assets. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  ArrowLeft,
  BellOff,
  ChevronRight,
  CircleUserRound,
  Compass,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';

type PhoneTab = 'wechat' | 'contacts' | 'discover' | 'me';
type MessageRole = 'user' | 'assistant';

type PhoneContact = {
  id: number;
  name: string;
  avatar: string;
  tagline: string;
  bio: string;
  greeting: string;
};

type PhoneMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

type RetryPayload = {
  contactId: number;
  history: PhoneMessage[];
};

const contacts: PhoneContact[] = [
  {
    id: 1,
    name: '许朝',
    avatar: '/avatars/avatar-17.webp',
    tagline: '冷静克制，也会认真记住你的感受',
    bio: '习惯把关心藏进简短的话里。看起来冷静疏离，其实会记住你随口提过的每一件小事。',
    greeting: '（指尖在桌面轻轻敲了一下）你终于来了。今天过得怎么样？',
  },
  {
    id: 2,
    name: '岚川',
    avatar: '/avatars/avatar-07.jpg',
    tagline: '雨夜里总会替你留一把伞',
    bio: '温柔可靠，习惯用具体的小事表达关心。雨天会提醒你带伞，也会耐心等你把没说完的话说完。',
    greeting: '别忘了带伞。还有，晚饭别只喝咖啡。',
  },
  {
    id: 3,
    name: '沈羡安',
    avatar: '/avatars/avatar-06.webp',
    tagline: '从容温柔，偶尔会轻轻打趣你',
    bio: '说话从容，喜欢书和安静的下午。会认真听你的选择，也会在你紧张时轻轻开个玩笑。',
    greeting: '（替你拉开椅子，眼底带着一点笑）坐吧，我正好在等你。',
  },
  {
    id: 4,
    name: '傅甘',
    avatar: '/avatars/avatar-08.webp',
    tagline: '亲近以后，会把柔软的一面留给你',
    bio: '有点腼腆，也有一点藏不住的可爱。熟悉之后会主动分享情绪，但始终尊重你的边界。',
    greeting: '（兔耳轻轻抖了抖）你来啦……我刚刚还在想，要不要先给你发消息。',
  },
  {
    id: 5,
    name: '傅砚辞',
    avatar: '/avatars/avatar-11.webp',
    tagline: '寡言可靠，用行动回应每一次靠近',
    bio: '沉稳、有责任心，不擅长说漂亮话。比起承诺，他更愿意用行动给出回答。',
    greeting: '（指尖在表带上停了一瞬）时间还早。你想说的话，我都听着。',
  },
  {
    id: 6,
    name: '苏眠',
    avatar: '/avatars/avatar-05.webp',
    tagline: '把生活里的小确幸写进日记',
    bio: '温柔细腻，喜欢日记、花和傍晚的风。擅长倾听，也愿意分享那些被忽略的小小快乐。',
    greeting: '新的日记写好了，只给你一个人看。你今天也有想收藏的瞬间吗？',
  },
];

const discoveries = [
  {
    id: 'rain-letter',
    contactId: 2,
    image: '/discover/material-12.png',
    copy: '雨停以后，路灯把积水照得很亮。有人撑着伞，在旧车站等一句迟到很久的回答。',
    likes: 1286,
  },
  {
    id: 'bookstore',
    contactId: 3,
    image: '/discover/material-01.webp',
    copy: '旧书店今天多了一张靠窗的座位。翻到书签那一页时，刚好有人推门进来。',
    likes: 864,
  },
  {
    id: 'flower-wind',
    contactId: 6,
    image: '/discover/material-09.jpg',
    copy: '把傍晚的风和新开的花记在同一页里。平凡的一天，也有值得收藏的部分。',
    likes: 532,
  },
];

const tabItems: Array<{
  id: PhoneTab;
  label: string;
  icon: typeof MessageCircle;
}> = [
  { id: 'wechat', label: '微信', icon: MessageCircle },
  { id: 'contacts', label: '通讯录', icon: Users },
  { id: 'discover', label: '发现', icon: Compass },
  { id: 'me', label: '我', icon: CircleUserRound },
];

function initialHistory(contact: PhoneContact): PhoneMessage[] {
  return [
    {
      id: `${contact.id}-greeting`,
      role: 'assistant',
      content: contact.greeting,
    },
  ];
}

function initialHistories() {
  return Object.fromEntries(
    contacts.map((contact) => [contact.id, initialHistory(contact)]),
  ) as Record<number, PhoneMessage[]>;
}

function messageId(contactId: number, role: MessageRole) {
  return `${contactId}-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function updateTextRecord(key: number, value: string) {
  return (current: Record<number, string>) => ({ ...current, [key]: value });
}

export function VirtualPhone({ onClose }: { onClose: () => void }) {
  const account = useAccount();
  const accountId = account.data?.account?.accountId;
  const authenticated = Boolean(account.data?.authenticated);
  const pendingRequests = useRef(new Map<number, { requestId: string; messageId: string; action: UnfinishedTurn['action'] }>());
  const [loadingChat, setLoadingChat] = useState(false);
  const [tab, setTab] = useState<PhoneTab>('wechat');
  const [selectedContactId, setSelectedContactId] = useState(2);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [chatOrigin, setChatOrigin] = useState<PhoneTab>('wechat');
  const [recentIds, setRecentIds] = useState<number[]>([2]);
  const [histories, setHistories] =
    useState<Record<number, PhoneMessage[]>>(initialHistories);
  const [draft, setDraft] = useState('');
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [retryPayloads, setRetryPayloads] = useState<
    Record<number, RetryPayload | undefined>
  >({});
  const [query, setQuery] = useState('');
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [mutedIds, setMutedIds] = useState<number[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const locksRef = useRef(new Set<number>());
  const controllersRef = useRef(new Map<number, AbortController>());

  const selectedContact =
    contacts.find((contact) => contact.id === selectedContactId) ?? contacts[1];
  const activeContact = contacts.find((contact) => contact.id === activeChatId);
  const activeMessages = activeContact
    ? (histories[activeContact.id] ?? initialHistory(activeContact))
    : [];
  const activeBusy = loadingChat || (activeContact ? busyIds.includes(activeContact.id) : false);
  const activeError = activeContact ? (errors[activeContact.id] ?? '') : '';

  useEffect(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    locksRef.current.clear();
    pendingRequests.current.clear();
    setHistories(initialHistories());
    setErrors({});
    setRetryPayloads({});
    setBusyIds([]);
    setRecentIds([2]);
    setDraft('');
    setShowChatInfo(false);
  }, [accountId, authenticated]);

  useEffect(() => {
    if (!activeChatId || !authenticated || locksRef.current.has(activeChatId)) return;
    const contact = contacts.find((item) => item.id === activeChatId)!;
    const controller = new AbortController(); setLoadingChat(true);
    setErrors(updateTextRecord(activeChatId, ''));
    fetch(`/api/chat?characterId=${activeChatId}&world=${encodeURIComponent('微聊')}`, { signal: controller.signal })
      .then(async response => { const data = await response.json() as { messages?: { role: MessageRole; content: string }[]; unfinished?: UnfinishedTurn | null; error?: string }; if (!response.ok) throw new Error(data.error || '聊天记录读取失败'); return data; })
      .then(data => {
        if (controller.signal.aborted) return;
        pendingRequests.current.delete(activeChatId);
        setRetryPayloads((current) => ({ ...current, [activeChatId]: undefined }));
        const history: PhoneMessage[] = data.messages?.length
          ? data.messages.map((message, index) => ({ ...message, id: `${activeChatId}-saved-${index}` }))
          : initialHistory(contact);
        if (data.unfinished) {
          const unfinished = data.unfinished;
          const pendingMessageId = `${activeChatId}-unfinished-${unfinished.requestId}`;
          history.push({ id: pendingMessageId, role: 'user', content: unfinished.prompt });
          pendingRequests.current.set(activeChatId, { requestId: unfinished.requestId, messageId: pendingMessageId, action: unfinished.action });
          setRetryPayloads((current) => ({ ...current, [activeChatId]: { contactId: activeChatId, history } }));
          setErrors(updateTextRecord(activeChatId, unfinished.status === 'pending'
            ? '上条消息仍在处理中，请稍后手动重试。'
            : '上条消息未完成，请重试。'));
        }
        setHistories((current) => ({ ...current, [activeChatId]: history }));
      })
      .catch(error => { if (!controller.signal.aborted) setErrors(updateTextRecord(activeChatId, error instanceof Error ? error.message : '读取失败')); })
      .finally(() => { if (!controller.signal.aborted) setLoadingChat(false); });
    return () => { controller.abort(); setLoadingChat(false); };
  }, [activeChatId, accountId, authenticated]);

  const visibleContacts = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return clean
      ? contacts.filter((contact) =>
          `${contact.name}${contact.tagline}`.toLowerCase().includes(clean),
        )
      : contacts;
  }, [query]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [activeMessages.length, activeBusy, activeError]);

  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
      locksRef.current.clear();
    },
    [],
  );

  function openChat(contactId: number, origin: PhoneTab) {
    setSelectedContactId(contactId);
    setChatOrigin(origin);
    setTab('wechat');
    setActiveChatId(contactId);
    setRecentIds((current) => [
      contactId,
      ...current.filter((id) => id !== contactId),
    ]);
    setShowChatInfo(false);
    setDraft('');
  }

  function closeChat() {
    setActiveChatId(null);
    setShowChatInfo(false);
    setDraft('');
    setTab(chatOrigin);
  }

  function switchTab(next: PhoneTab) {
    setActiveChatId(null);
    setShowChatInfo(false);
    setDraft('');
    setTab(next);
  }

  function setBusy(contactId: number, busy: boolean) {
    setBusyIds((current) =>
      busy
        ? [...current.filter((id) => id !== contactId), contactId]
        : current.filter((id) => id !== contactId),
    );
  }

  async function requestReply(contactId: number, history: PhoneMessage[]) {
    if (locksRef.current.has(contactId)) return;
    if (!account.data?.authenticated) { setErrors(updateTextRecord(contactId, '请先登录，再与角色对话。')); return; }
    const last = history.at(-1)!;
    if (pendingRequests.current.get(contactId)?.messageId !== last.id) pendingRequests.current.set(contactId, { requestId: crypto.randomUUID(), messageId: last.id, action: 'message' });
    const pending = pendingRequests.current.get(contactId)!;
    locksRef.current.add(contactId);
    setBusy(contactId, true);
    setErrors((current) => ({ ...current, [contactId]: '' }));
    setRetryPayloads((current) => ({ ...current, [contactId]: undefined }));

    const controller = new AbortController();
    controllersRef.current.set(contactId, controller);
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          characterId: contactId,
          world: '微聊', action: pending.action, prompt: last.content,
          requestId: pending.requestId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      if (controllersRef.current.get(contactId) !== controller) return;
      if (!response.ok || !data.reply?.trim())
        throw new Error(data.error || '暂时没有收到回复，请重试。');
      const reply: PhoneMessage = {
        id: messageId(contactId, 'assistant'),
        role: 'assistant',
        content: data.reply.trim(),
      };
      setHistories((current) => ({
        ...current,
        [contactId]: [...history, reply],
      }));
      pendingRequests.current.delete(contactId);
      window.dispatchEvent(new Event('kk-account-updated'));
    } catch (error) {
      if (controllersRef.current.get(contactId) !== controller) return;
      const errorMessage = controller.signal.aborted
        ? '连接超时，请重试。'
        : error instanceof Error
          ? error.message
          : '连接失败，请重试。';
      setErrors(updateTextRecord(contactId, errorMessage));
      setRetryPayloads((current) => ({
        ...current,
        [contactId]: { contactId, history },
      }));
    } finally {
      window.clearTimeout(timeout);
      if (controllersRef.current.get(contactId) === controller) {
        controllersRef.current.delete(contactId);
        locksRef.current.delete(contactId);
        setBusy(contactId, false);
      }
    }
  }

  function sendMessage(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!activeContact || activeBusy || !account.data?.authenticated || locksRef.current.has(activeContact.id) || pendingRequests.current.has(activeContact.id)) return;
    const clean = draft.trim();
    if (!clean) return;
    const nextHistory = [
      ...(histories[activeContact.id] ?? initialHistory(activeContact)),
      {
        id: messageId(activeContact.id, 'user'),
        role: 'user' as const,
        content: clean,
      },
    ];
    setHistories((current) => ({
      ...current,
      [activeContact.id]: nextHistory,
    }));
    setErrors((current) => ({ ...current, [activeContact.id]: '' }));
    setDraft('');
    void requestReply(activeContact.id, nextHistory);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === 'Enter' &&
      (composingRef.current || event.nativeEvent.isComposing)
    )
      event.preventDefault();
  }

  function retryReply(contactId: number) {
    const payload = retryPayloads[contactId];
    if (payload) void requestReply(payload.contactId, payload.history);
  }

  function clearConversation(contact: PhoneContact) {
    controllersRef.current.get(contact.id)?.abort();
    controllersRef.current.delete(contact.id);
    locksRef.current.delete(contact.id);
    pendingRequests.current.delete(contact.id);
    setBusy(contact.id, false);
    setHistories((current) => ({
      ...current,
      [contact.id]: initialHistory(contact),
    }));
    setErrors((current) => ({ ...current, [contact.id]: '' }));
    setRetryPayloads((current) => ({ ...current, [contact.id]: undefined }));
    setShowChatInfo(false);
  }

  function toggleLike(postId: string) {
    setLikedPosts((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    );
  }

  return (
    <div className="virtual-phone-screen">
      <header className="vp-app-header">
        <div>
          <small>沉浸玩法</small>
          <h2>TA 的手机</h2>
        </div>
        <button type="button" onClick={onClose}>
          <X />
          关闭
        </button>
      </header>

      <section className="vp-device" aria-label="角色的虚拟手机">
        <div className="vp-status">
          <b>17:41</b>
          <span aria-label="信号良好，已连接无线网络，电量充足">▮▮▮ ᯤ ▰</span>
        </div>

        {activeContact ? (
          <>
            <header className="vp-titlebar vp-chat-titlebar">
              <button type="button" onClick={closeChat} aria-label="返回">
                <ArrowLeft />
              </button>
              <button
                type="button"
                className="vp-chat-person"
                onClick={() => setShowChatInfo(true)}
              >
                <b>{activeContact.name}</b>
                <small>{activeBusy ? '正在输入…' : 'AI 角色'}</small>
              </button>
              <button
                type="button"
                onClick={() => setShowChatInfo(true)}
                aria-label="聊天信息"
              >
                <MoreHorizontal />
              </button>
            </header>
            <div
              className="vp-chat-log"
              ref={logRef}
              role="log"
              aria-live="polite"
              aria-label={`与${activeContact.name}的聊天记录`}
            >
              <time>今天 17:38</time>
              {activeMessages.map((message) => (
                <div
                  className={`vp-message vp-message-${message.role}`}
                  key={message.id}
                >
                  {message.role === 'assistant' && (
                    <img src={activeContact.avatar} alt="" />
                  )}
                  <p>{message.content}</p>
                </div>
              ))}
              {activeBusy && (
                <div className="vp-message vp-message-assistant vp-message-loading">
                  <img src={activeContact.avatar} alt="" />
                  <p>
                    <i />
                    <i />
                    <i />
                  </p>
                </div>
              )}
              {activeError && (
                <div className="vp-chat-error" role="alert">
                  <span>{activeError}</span>
                  {retryPayloads[activeContact.id] && <button
                    type="button"
                    onClick={() => retryReply(activeContact.id)}
                    disabled={activeBusy}
                  >
                    手动重试
                  </button>}
                </div>
              )}
            </div>
            <form className="vp-composer" onSubmit={sendMessage}>
              {!account.data?.authenticated && <LoginLink>登录</LoginLink>}
              <input
                aria-label={`发消息给${activeContact.name}`}
                placeholder={retryPayloads[activeContact.id] ? '请先重试上条消息' : '发消息'}
                value={draft}
                maxLength={1000}
                onChange={(event) => setDraft(event.target.value)}
                onCompositionStart={() => {
                  composingRef.current = true;
                }}
                onCompositionEnd={() => {
                  composingRef.current = false;
                }}
                onKeyDown={handleComposerKeyDown}
              />
              <button
                type="submit"
                disabled={!draft.trim() || activeBusy || !account.data?.authenticated || Boolean(retryPayloads[activeContact.id])}
                aria-label="发送消息"
              >
                <Send />
              </button>
            </form>

            {showChatInfo && (
              <dialog open className="vp-chat-info" aria-label="聊天信息">
                <header>
                  <button
                    type="button"
                    onClick={() => setShowChatInfo(false)}
                    aria-label="返回聊天"
                  >
                    <ArrowLeft />
                  </button>
                  <b>聊天信息</b>
                  <span />
                </header>
                <button
                  type="button"
                  className="vp-profile-link"
                  onClick={() => {
                    setSelectedContactId(activeContact.id);
                    setActiveChatId(null);
                    setShowChatInfo(false);
                    setTab('me');
                  }}
                >
                  <img
                    src={activeContact.avatar}
                    alt={`${activeContact.name}头像`}
                  />
                  <span>
                    <b>{activeContact.name}</b>
                    <small>{activeContact.tagline}</small>
                  </span>
                  <ChevronRight />
                </button>
                <button
                  type="button"
                  className="vp-setting-row"
                  aria-pressed={mutedIds.includes(activeContact.id)}
                  onClick={() =>
                    setMutedIds((current) =>
                      current.includes(activeContact.id)
                        ? current.filter((id) => id !== activeContact.id)
                        : [...current, activeContact.id],
                    )
                  }
                >
                  <span>
                    <BellOff />
                    消息免打扰
                  </span>
                  <i
                    className={
                      mutedIds.includes(activeContact.id) ? 'is-on' : ''
                    }
                  />
                </button>
                <button
                  type="button"
                  className="vp-clear-chat"
                  onClick={() => clearConversation(activeContact)}
                  disabled={activeBusy}
                >
                  重置本机预览
                </button>
                <p>仅重置当前页面的聊天预览，不删除云端记录。刷新或重新打开聊天后，会恢复已保存的对话和未完成消息。</p>
              </dialog>
            )}
          </>
        ) : (
          <>
            {tab === 'wechat' && (
              <>
                <header className="vp-titlebar">
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="退出虚拟手机"
                  >
                    <ArrowLeft />
                  </button>
                  <b>微信</b>
                  <button
                    type="button"
                    onClick={() => switchTab('contacts')}
                    aria-label="发起新聊天"
                  >
                    <Users />
                  </button>
                </header>
                <div className="vp-page vp-conversation-list">
                  {recentIds.map((id) => {
                    const contact = contacts.find((item) => item.id === id);
                    if (!contact) return null;
                    const history = histories[id] ?? initialHistory(contact);
                    const last = history.at(-1)?.content ?? contact.greeting;
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => openChat(id, 'wechat')}
                      >
                        <img src={contact.avatar} alt={`${contact.name}头像`} />
                        <span>
                          <b>{contact.name}</b>
                          <small>{last}</small>
                        </span>
                        <time>
                          {history.length > 1
                            ? '刚刚'
                            : id === 2
                              ? '17:40'
                              : '今天'}
                        </time>
                      </button>
                    );
                  })}
                  <div className="vp-empty-note">
                    <MessageCircle />
                    <b>角色生活正在继续</b>
                    <p>从通讯录选择角色后，会话会出现在这里。</p>
                  </div>
                </div>
              </>
            )}

            {tab === 'contacts' && (
              <>
                <header className="vp-titlebar">
                  <span />
                  <b>通讯录</b>
                  <span />
                </header>
                <div className="vp-page vp-contacts-page">
                  <label className="vp-search">
                    <Search />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索角色"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="清空搜索"
                      >
                        <X />
                      </button>
                    )}
                  </label>
                  <p className="vp-section-label">
                    角色联系人 · {visibleContacts.length}
                  </p>
                  {visibleContacts.length ? (
                    visibleContacts.map((contact) => (
                      <button
                        type="button"
                        className="vp-contact"
                        key={contact.id}
                        onClick={() => openChat(contact.id, 'contacts')}
                      >
                        <img src={contact.avatar} alt={`${contact.name}头像`} />
                        <span>
                          <b>{contact.name}</b>
                          <small>{contact.tagline}</small>
                        </span>
                        <ChevronRight />
                      </button>
                    ))
                  ) : (
                    <div className="vp-search-empty">
                      <Search />
                      <b>没有找到角色</b>
                      <p>换个名字或关键词试试。</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'discover' && (
              <>
                <header className="vp-titlebar">
                  <span />
                  <b>发现</b>
                  <span />
                </header>
                <div className="vp-page vp-discover-page">
                  {discoveries.map((post) => {
                    const contact = contacts.find(
                      (item) => item.id === post.contactId,
                    )!;
                    const liked = likedPosts.includes(post.id);
                    return (
                      <article className="vp-discovery-card" key={post.id}>
                        <header>
                          <img
                            src={contact.avatar}
                            alt={`${contact.name}头像`}
                          />
                          <span>
                            <b>{contact.name}</b>
                            <small>今天 16:20</small>
                          </span>
                          <button
                            type="button"
                            onClick={() => openChat(contact.id, 'discover')}
                          >
                            和 TA 聊聊
                          </button>
                        </header>
                        <img
                          className="vp-discovery-image"
                          src={post.image}
                          alt={`${contact.name}发布的动态配图`}
                        />
                        <p>{post.copy}</p>
                        <button
                          type="button"
                          className={liked ? 'vp-like is-liked' : 'vp-like'}
                          aria-pressed={liked}
                          onClick={() => toggleLike(post.id)}
                        >
                          <Heart fill={liked ? 'currentColor' : 'none'} />
                          {post.likes + (liked ? 1 : 0)}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            {tab === 'me' && (
              <>
                <header className="vp-titlebar">
                  <span />
                  <b>角色资料</b>
                  <span />
                </header>
                <div className="vp-page vp-me-page">
                  <section className="vp-me-hero">
                    <img
                      src={selectedContact.avatar}
                      alt={`${selectedContact.name}头像`}
                    />
                    <span>
                      <b>{selectedContact.name}</b>
                      <small>{selectedContact.tagline}</small>
                    </span>
                  </section>
                  <section className="vp-bio-card">
                    <small>关于 TA</small>
                    <p>{selectedContact.bio}</p>
                  </section>
                  <button
                    type="button"
                    className="vp-primary-action"
                    onClick={() => openChat(selectedContact.id, 'me')}
                  >
                    <MessageCircle />
                    发消息
                  </button>
                  <p className="vp-section-label">切换角色资料</p>
                  <div className="vp-avatar-strip">
                    {contacts.map((contact) => (
                      <button
                        type="button"
                        key={contact.id}
                        className={
                          contact.id === selectedContact.id ? 'is-selected' : ''
                        }
                        onClick={() => setSelectedContactId(contact.id)}
                        aria-label={`查看${contact.name}的资料`}
                      >
                        <img src={contact.avatar} alt="" />
                        <small>{contact.name}</small>
                      </button>
                    ))}
                  </div>
                  <p className="vp-disclosure">
                    角色与对话均为虚构内容。AI 回复由 DeepSeek 生成。
                  </p>
                </div>
              </>
            )}

            <nav className="vp-tabbar" aria-label="虚拟手机导航">
              {tabItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={tab === item.id ? 'is-active' : ''}
                    aria-current={tab === item.id ? 'page' : undefined}
                    onClick={() => switchTab(item.id)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
