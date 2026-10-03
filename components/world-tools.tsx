'use client';
/* eslint-disable next/no-img-element -- The tool previews the current world's supplied artwork and avatar. */

import '@/app/world-tools.css';

import {
  BookOpen,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Compass,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type WorldTheme = 'default' | 'minimal' | 'midnight' | 'berry';
export type WorldFontSize = 'small' | 'standard' | 'large';
export type WorldToolSection =
  | 'menu'
  | 'diary'
  | 'memories'
  | 'calendar'
  | 'notes'
  | 'gallery'
  | 'audio'
  | 'settings';

export type WorldToolMessage = {
  name: string;
  text: string;
  user?: boolean;
};

export type WorldDiary = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};

export type WorldMemory = {
  id: string;
  sourceKey: string;
  worldTitle: string;
  speaker: string;
  text: string;
  createdAt: number;
};

export type WorldCalendarEvent = {
  id: string;
  date: string;
  title: string;
  complete: boolean;
};

type RemovedDiary = {
  item: WorldDiary;
  index: number;
};

export type WorldToolsState = {
  diaries: WorldDiary[];
  removedDiary: RemovedDiary | null;
  memories: WorldMemory[];
  events: WorldCalendarEvent[];
  readingNote: string;
  theme: WorldTheme;
  fontSize: WorldFontSize;
  saveDiary: (input: { id?: string; title: string; content: string }) => void;
  removeDiary: (id: string) => void;
  undoDiaryRemoval: () => void;
  addMemory: (input: Omit<WorldMemory, 'id' | 'createdAt'>) => void;
  removeMemory: (id: string) => void;
  addEvent: (input: { date: string; title: string }) => void;
  toggleEvent: (id: string) => void;
  removeEvent: (id: string) => void;
  setReadingNote: (value: string) => void;
  setTheme: (value: WorldTheme) => void;
  setFontSize: (value: WorldFontSize) => void;
};

type WorldToolsProps = {
  state: WorldToolsState;
  section?: WorldToolSection;
  world: { title: string; image: string; name: string; avatar: string };
  messages: WorldToolMessage[];
  sound: boolean;
  onSound: () => void;
  onPhone: () => void;
  onWallet: () => void;
  onAgents: () => void;
  onForum: () => void;
  onReset: () => void;
};

const sectionLabels: Record<WorldToolSection, string> = {
  menu: '世界工具',
  diary: '世界日记',
  memories: '纪念回忆',
  calendar: '日历事件',
  notes: '阅读笔记',
  gallery: '素材相册',
  audio: '台词朗读',
  settings: '世界设置',
};

const themes: Array<{ id: WorldTheme; label: string; hint: string }> = [
  { id: 'default', label: '默认', hint: '保留世界原本的氛围' },
  { id: 'minimal', label: '极简', hint: '更轻的卡片与背景' },
  { id: 'midnight', label: '午夜', hint: '深蓝夜色与冷光' },
  { id: 'berry', label: '莓果', hint: '柔和的莓红色调' },
];

const fontSizes: Array<{ id: WorldFontSize; label: string }> = [
  { id: 'small', label: '小' },
  { id: 'standard', label: '标准' },
  { id: 'large', label: '大' },
];

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function formatEventDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(year, month - 1, day));
}

export function useWorldTools(): WorldToolsState {
  const [diaries, setDiaries] = useState<WorldDiary[]>([]);
  const [removedDiary, setRemovedDiary] = useState<RemovedDiary | null>(null);
  const [memories, setMemories] = useState<WorldMemory[]>([]);
  const [events, setEvents] = useState<WorldCalendarEvent[]>([]);
  const [readingNote, setReadingNote] = useState('');
  const [theme, setTheme] = useState<WorldTheme>('default');
  const [fontSize, setFontSize] = useState<WorldFontSize>('standard');

  function saveDiary(input: { id?: string; title: string; content: string }) {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title || !content) return;
    if (input.id) {
      setDiaries((current) =>
        current.map((entry) =>
          entry.id === input.id
            ? { ...entry, title, content, updatedAt: Date.now() }
            : entry,
        ),
      );
    } else {
      setDiaries((current) => [
        { id: createId('diary'), title, content, updatedAt: Date.now() },
        ...current,
      ]);
    }
    setRemovedDiary(null);
  }

  function removeDiary(id: string) {
    const index = diaries.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    setRemovedDiary({ item: diaries[index], index });
    setDiaries((current) => current.filter((entry) => entry.id !== id));
  }

  function undoDiaryRemoval() {
    if (!removedDiary) return;
    setDiaries((current) => {
      const next = [...current];
      next.splice(
        Math.min(removedDiary.index, next.length),
        0,
        removedDiary.item,
      );
      return next;
    });
    setRemovedDiary(null);
  }

  function addMemory(input: Omit<WorldMemory, 'id' | 'createdAt'>) {
    setMemories((current) => {
      if (current.some((memory) => memory.sourceKey === input.sourceKey))
        return current;
      return [
        { ...input, id: createId('memory'), createdAt: Date.now() },
        ...current,
      ];
    });
  }

  function removeMemory(id: string) {
    setMemories((current) => current.filter((memory) => memory.id !== id));
  }

  function addEvent(input: { date: string; title: string }) {
    const title = input.title.trim();
    if (!input.date || !title) return;
    setEvents((current) => [
      ...current,
      { id: createId('event'), date: input.date, title, complete: false },
    ]);
  }

  function toggleEvent(id: string) {
    setEvents((current) =>
      current.map((event) =>
        event.id === id ? { ...event, complete: !event.complete } : event,
      ),
    );
  }

  function removeEvent(id: string) {
    setEvents((current) => current.filter((event) => event.id !== id));
  }

  return {
    diaries,
    removedDiary,
    memories,
    events,
    readingNote,
    theme,
    fontSize,
    saveDiary,
    removeDiary,
    undoDiaryRemoval,
    addMemory,
    removeMemory,
    addEvent,
    toggleEvent,
    removeEvent,
    setReadingNote,
    setTheme,
    setFontSize,
  };
}

export function WorldTools({
  state,
  section,
  world,
  messages,
  sound,
  onSound,
  onPhone,
  onWallet,
  onAgents,
  onForum,
  onReset,
}: WorldToolsProps) {
  const [activeSection, setActiveSection] = useState<WorldToolSection>(
    section ?? 'menu',
  );
  const [requestedSection, setRequestedSection] = useState(section);
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [eventDate, setEventDate] = useState(todayValue);
  const [eventTitle, setEventTitle] = useState('');
  const [memoryView, setMemoryView] = useState<'conversation' | 'saved'>(
    'conversation',
  );
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  if (section !== requestedSection) {
    setRequestedSection(section);
    setActiveSection(section ?? 'menu');
  }

  const recentMessages = useMemo(
    () => messages.filter((message) => message.text.trim()).slice(-10),
    [messages],
  );
  const spokenLine =
    recentMessages.filter((message) => !message.user).at(-1)?.text ??
    recentMessages.at(-1)?.text ??
    '';
  const sortedEvents = useMemo(
    () =>
      [...state.events].sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
    [state.events],
  );

  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );

  function openSection(next: WorldToolSection) {
    setActiveSection(next);
    setSpeechError('');
  }

  function startNewDiary() {
    setEditingDiaryId(null);
    setDiaryTitle(`${world.title} · 今日记录`);
    setDiaryContent('');
  }

  function editDiary(entry: WorldDiary) {
    setEditingDiaryId(entry.id);
    setDiaryTitle(entry.title);
    setDiaryContent(entry.content);
  }

  function submitDiary(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!diaryTitle.trim() || !diaryContent.trim()) return;
    state.saveDiary({
      id: editingDiaryId ?? undefined,
      title: diaryTitle,
      content: diaryContent,
    });
    setEditingDiaryId(null);
    setDiaryTitle('');
    setDiaryContent('');
  }

  function submitEvent(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!eventDate || !eventTitle.trim()) return;
    state.addEvent({ date: eventDate, title: eventTitle });
    setEventTitle('');
  }

  function collectMemory(message: WorldToolMessage) {
    const sourceKey = `${world.title}\u0000${message.name}\u0000${message.text}`;
    state.addMemory({
      sourceKey,
      worldTitle: world.title,
      speaker: message.user ? '你' : message.name,
      text: message.text,
    });
  }

  function isCollected(message: WorldToolMessage) {
    const sourceKey = `${world.title}\u0000${message.name}\u0000${message.text}`;
    return state.memories.some((memory) => memory.sourceKey === sourceKey);
  }

  function toggleSpeech() {
    setSpeechError('');
    if (
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      setSpeechError('当前浏览器不支持文字朗读。');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!spokenLine) {
      setSpeechError('当前还没有可朗读的角色台词。');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenLine);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechError('浏览器朗读被中断，可以重新播放。');
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  const toolCards: Array<{
    id: WorldToolSection;
    label: string;
    hint: string;
    icon: typeof BookOpen;
    count?: number;
  }> = [
    {
      id: 'diary',
      label: '世界日记',
      hint: '写下本次访问里的故事',
      icon: BookOpen,
      count: state.diaries.length,
    },
    {
      id: 'memories',
      label: '纪念回忆',
      hint: '收藏当前对话片段',
      icon: Heart,
      count: state.memories.length,
    },
    {
      id: 'calendar',
      label: '日历事件',
      hint: '安排与完成故事日程',
      icon: CalendarDays,
      count: state.events.length,
    },
    {
      id: 'notes',
      label: '阅读笔记',
      hint: '所有世界共用一页笔记',
      icon: NotebookPen,
    },
    {
      id: 'gallery',
      label: '素材相册',
      hint: '查看世界封面与角色',
      icon: ImageIcon,
    },
    {
      id: 'audio',
      label: '台词朗读',
      hint: '用浏览器朗读角色台词',
      icon: Volume2,
    },
  ];

  return (
    <div className="world-tools">
      {activeSection !== 'menu' && (
        <button
          type="button"
          className="wt-back"
          onClick={() => openSection('menu')}
        >
          <ChevronRight />
          返回世界工具
        </button>
      )}

      <header className="wt-heading">
        <div>
          <small>{world.title}</small>
          <h4>{sectionLabels[activeSection]}</h4>
        </div>
        {activeSection === 'menu' && (
          <button type="button" onClick={() => openSection('settings')}>
            <Settings2 />
            设置
          </button>
        )}
      </header>

      {activeSection === 'menu' && (
        <>
          <div className="wt-world-card">
            <img src={world.image} alt={`${world.title}世界封面`} />
            <span>
              <small>当前世界</small>
              <b>{world.title}</b>
              <em>
                {world.name} · {recentMessages.length} 条最近对话
              </em>
            </span>
          </div>
          <div className="wt-tool-grid">
            {toolCards.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  type="button"
                  key={tool.id}
                  onClick={() => openSection(tool.id)}
                >
                  <span>
                    <Icon />
                  </span>
                  <b>{tool.label}</b>
                  <small>{tool.hint}</small>
                  {typeof tool.count === 'number' && tool.count > 0 && (
                    <i>{tool.count}</i>
                  )}
                </button>
              );
            })}
          </div>
          <section className="wt-links">
            <h5>已有入口</h5>
            <div>
              <button type="button" onClick={onPhone}>
                <Smartphone />
                <span>手机</span>
              </button>
              <button type="button" onClick={onWallet}>
                <CircleDollarSign />
                <span>钻石中心</span>
              </button>
              <button type="button" onClick={onAgents}>
                <Bot />
                <span>辅助 Agent</span>
              </button>
              <button type="button" onClick={onForum}>
                <Compass />
                <span>论坛</span>
              </button>
            </div>
          </section>
          <p className="wt-local-note">
            <ShieldCheck />
            日记、回忆、日历和笔记仅保留在本次页面访问中，刷新后清空。
          </p>
        </>
      )}

      {activeSection === 'diary' && (
        <section className="wt-section">
          <div className="wt-section-intro">
            <p>记录当前世界里的想法。内容不会跨刷新保存。</p>
            <button type="button" onClick={startNewDiary}>
              <Plus />
              新日记
            </button>
          </div>
          {(diaryTitle || diaryContent || editingDiaryId) && (
            <form className="wt-editor" onSubmit={submitDiary}>
              <input
                aria-label="日记标题"
                maxLength={50}
                value={diaryTitle}
                onChange={(event) => setDiaryTitle(event.target.value)}
                placeholder="日记标题"
              />
              <textarea
                aria-label="日记内容"
                maxLength={1500}
                rows={6}
                value={diaryContent}
                onChange={(event) => setDiaryContent(event.target.value)}
                placeholder="写下这段世界里值得记住的事……"
              />
              <div>
                <small>{diaryContent.length}/1500</small>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDiaryId(null);
                    setDiaryTitle('');
                    setDiaryContent('');
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!diaryTitle.trim() || !diaryContent.trim()}
                >
                  {editingDiaryId ? '保存修改' : '保存日记'}
                </button>
              </div>
            </form>
          )}
          {state.removedDiary && (
            <output className="wt-undo">
              <span>已移除“{state.removedDiary.item.title}”</span>
              <button type="button" onClick={state.undoDiaryRemoval}>
                <Undo2 />
                撤销
              </button>
            </output>
          )}
          {state.diaries.length ? (
            <div className="wt-entry-list">
              {state.diaries.map((entry) => (
                <article key={entry.id}>
                  <header>
                    <span>
                      <b>{entry.title}</b>
                      <small>{formatTime(entry.updatedAt)}</small>
                    </span>
                    <div>
                      <button type="button" onClick={() => editDiary(entry)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        aria-label={`移除${entry.title}`}
                        onClick={() => state.removeDiary(entry.id)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </header>
                  <p>{entry.content}</p>
                </article>
              ))}
            </div>
          ) : (
            !diaryTitle && (
              <EmptyState
                icon={BookOpen}
                title="还没有世界日记"
                copy="点击“新日记”，记录这一段剧情带给你的感受。"
              />
            )
          )}
        </section>
      )}

      {activeSection === 'memories' && (
        <section className="wt-section">
          <div className="wt-segmented">
            <button
              type="button"
              className={memoryView === 'conversation' ? 'is-active' : ''}
              onClick={() => setMemoryView('conversation')}
            >
              当前对话
            </button>
            <button
              type="button"
              className={memoryView === 'saved' ? 'is-active' : ''}
              onClick={() => setMemoryView('saved')}
            >
              已收藏 {state.memories.length}
            </button>
          </div>
          {memoryView === 'conversation' &&
            (recentMessages.length ? (
              <div className="wt-message-list">
                {recentMessages.map((message, index) => {
                  const collected = isCollected(message);
                  return (
                    <article key={`${message.name}-${index}-${message.text}`}>
                      <span>
                        <b>{message.user ? '你' : message.name}</b>
                        <p>{message.text}</p>
                      </span>
                      <button
                        type="button"
                        aria-pressed={collected}
                        disabled={collected}
                        onClick={() => collectMemory(message)}
                      >
                        {collected ? <Check /> : <Heart />}
                        {collected ? '已收藏' : '收藏'}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={MessageCircle}
                title="还没有对话"
                copy="与角色聊几句后，就能在这里选择值得纪念的片段。"
              />
            ))}
          {memoryView === 'saved' &&
            (state.memories.length ? (
              <div className="wt-memory-list">
                {state.memories.map((memory) => (
                  <article key={memory.id}>
                    <header>
                      <span>
                        <small>{memory.worldTitle}</small>
                        <b>{memory.speaker}</b>
                      </span>
                      <button
                        type="button"
                        aria-label="移除这条回忆"
                        onClick={() => state.removeMemory(memory.id)}
                      >
                        <Trash2 />
                      </button>
                    </header>
                    <p>{memory.text}</p>
                    <time>{formatTime(memory.createdAt)}</time>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Heart}
                title="还没有纪念回忆"
                copy="从当前对话中收藏一条片段，它会在本次访问中留在这里。"
              />
            ))}
        </section>
      )}

      {activeSection === 'calendar' && (
        <section className="wt-section">
          <form className="wt-event-form" onSubmit={submitEvent}>
            <label>
              日期
              <input
                type="date"
                required
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
              />
            </label>
            <label>
              事件
              <input
                maxLength={60}
                required
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="例如：和岚川去旧书店"
              />
            </label>
            <button type="submit" disabled={!eventDate || !eventTitle.trim()}>
              <Plus />
              新增事件
            </button>
          </form>
          {sortedEvents.length ? (
            <div className="wt-event-list">
              {sortedEvents.map((event) => (
                <article
                  className={event.complete ? 'is-complete' : ''}
                  key={event.id}
                >
                  <button
                    type="button"
                    className="wt-event-check"
                    aria-label={event.complete ? '标记为未完成' : '标记为完成'}
                    aria-pressed={event.complete}
                    onClick={() => state.toggleEvent(event.id)}
                  >
                    {event.complete && <Check />}
                  </button>
                  <span>
                    <time>{formatEventDate(event.date)}</time>
                    <b>{event.title}</b>
                  </span>
                  <button
                    type="button"
                    aria-label={`移除${event.title}`}
                    onClick={() => state.removeEvent(event.id)}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="还没有日历事件"
              copy="添加一个日期和标题，完成后可以勾选。"
            />
          )}
        </section>
      )}

      {activeSection === 'notes' && (
        <section className="wt-section wt-notes">
          <div className="wt-section-intro">
            <p>一页共用笔记。切换世界仍可继续写，刷新页面后清空。</p>
            <span>
              <Clock3 />
              本次访问
            </span>
          </div>
          <textarea
            aria-label="阅读笔记"
            maxLength={4000}
            rows={14}
            value={state.readingNote}
            onChange={(event) => state.setReadingNote(event.target.value)}
            placeholder="摘录喜欢的台词、记录剧情线索，或写下稍后想继续探索的方向……"
          />
          <small>
            {state.readingNote.length}/4000 · 输入后即时保存在当前页面状态
          </small>
        </section>
      )}

      {activeSection === 'gallery' && (
        <section className="wt-section">
          <p className="wt-section-copy">
            查看当前世界正在使用的封面与角色素材。
          </p>
          <div className="wt-gallery">
            <button
              type="button"
              onClick={() =>
                setPreview({ src: world.image, alt: `${world.title}世界封面` })
              }
            >
              <img src={world.image} alt={`${world.title}世界封面缩略图`} />
              <span>
                <b>世界封面</b>
                <small>{world.title}</small>
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                setPreview({ src: world.avatar, alt: `${world.name}角色头像` })
              }
            >
              <img src={world.avatar} alt={`${world.name}角色头像缩略图`} />
              <span>
                <b>角色素材</b>
                <small>{world.name}</small>
              </span>
            </button>
          </div>
          {preview && (
            <dialog open className="wt-preview" aria-label="素材预览">
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="关闭预览"
              >
                <X />
              </button>
              <img src={preview.src} alt={preview.alt} />
              <p>{preview.alt}</p>
            </dialog>
          )}
        </section>
      )}

      {activeSection === 'audio' && (
        <section className="wt-section wt-audio">
          <div className="wt-audio-avatar">
            <img src={world.avatar} alt={`${world.name}头像`} />
            <span>
              <small>当前角色</small>
              <b>{world.name}</b>
            </span>
          </div>
          <blockquote>
            {spokenLine || '当前还没有可朗读的角色台词。'}
          </blockquote>
          <button
            type="button"
            className="wt-audio-play"
            aria-pressed={speaking}
            onClick={toggleSpeech}
          >
            {speaking ? <Pause /> : <Play />}
            {speaking ? '停止朗读' : '浏览器朗读这句台词'}
          </button>
          {speechError && (
            <p className="wt-error" role="alert">
              {speechError}
            </p>
          )}
          <p className="wt-browser-note">
            <Volume2 />
            这是设备浏览器的文字转语音，不是角色真人语音，也不会发起通话。
          </p>
        </section>
      )}

      {activeSection === 'settings' && (
        <section className="wt-section wt-settings">
          <div className="wt-settings-group">
            <h5>播放</h5>
            <button
              type="button"
              className="wt-setting-row"
              aria-pressed={sound}
              onClick={onSound}
            >
              <span>
                {sound ? <Volume2 /> : <VolumeX />}
                <b>世界背景音乐</b>
              </span>
              <i className={sound ? 'is-on' : ''} />
            </button>
          </div>
          <div className="wt-settings-group">
            <h5>聊天皮肤</h5>
            <div className="wt-theme-grid">
              {themes.map((theme) => (
                <button
                  type="button"
                  className={
                    state.theme === theme.id
                      ? `is-selected wt-theme-${theme.id}`
                      : `wt-theme-${theme.id}`
                  }
                  aria-pressed={state.theme === theme.id}
                  key={theme.id}
                  onClick={() => state.setTheme(theme.id)}
                >
                  <span>
                    <i />
                    <i />
                  </span>
                  <b>{theme.label}</b>
                  <small>{theme.hint}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="wt-settings-group">
            <h5>文字大小</h5>
            <div className="wt-font-picker">
              {fontSizes.map((size) => (
                <button
                  type="button"
                  className={state.fontSize === size.id ? 'is-selected' : ''}
                  aria-pressed={state.fontSize === size.id}
                  key={size.id}
                  onClick={() => state.setFontSize(size.id)}
                >
                  <span
                    style={{
                      fontSize:
                        size.id === 'small'
                          ? 12
                          : size.id === 'large'
                            ? 20
                            : 16,
                    }}
                  >
                    文
                  </span>
                  {size.label}
                </button>
              ))}
            </div>
          </div>
          <div className="wt-settings-group">
            <h5>模型、记忆与隐私</h5>
            <div className="wt-truth-cards">
              <article>
                <Bot />
                <span>
                  <b>对话模型</b>
                  <p>
                    角色自由对话通过现有接口交给 DeepSeek
                    生成；未配置服务时会显示错误与重试。
                  </p>
                </span>
              </article>
              <article>
                <RotateCcw />
                <span>
                  <b>最近对话上下文</b>
                  <p>
                    每次最多发送当前世界最近 10
                    条消息。没有“无限记忆”或永久记住全部对话的承诺。
                  </p>
                </span>
              </article>
              <article>
                <ShieldCheck />
                <span>
                  <b>本次访问数据</b>
                  <p>
                    世界日记、纪念回忆、日历和阅读笔记只在当前页面状态中，不会加入模型请求，刷新后清空。
                  </p>
                </span>
              </article>
            </div>
          </div>
          <button
            type="button"
            className="wt-reset-button"
            onClick={() => setConfirmReset(true)}
          >
            开启新场景
          </button>
          {confirmReset && (
            <dialog open className="wt-confirm" aria-label="确认开启新场景">
              <div>
                <span>
                  <RotateCcw />
                </span>
                <h5>让故事走进新场景？</h5>
                <p>
                  将新场景提示填入聊天框，确认发送后由角色继续演绎，已有对话仍保留。
                </p>
                <footer>
                  <button type="button" onClick={() => setConfirmReset(false)}>
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReset(false);
                      onReset();
                    }}
                  >
                    确认开启
                  </button>
                </footer>
              </div>
            </dialog>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof BookOpen;
  title: string;
  copy: string;
}) {
  return (
    <div className="wt-empty">
      <Icon />
      <b>{title}</b>
      <p>{copy}</p>
    </div>
  );
}
