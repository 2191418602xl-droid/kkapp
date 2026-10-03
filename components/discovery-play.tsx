'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronRight, Heart, Sprout, Droplets, BookOpen, Mail, Headphones, Check, Trophy } from 'lucide-react';
import { beijingDay, boardReply, boardWinner, companions, emptyDiscovery, jobScenes, partnerTasks, questions, type DiscoveryState, type Entry } from '@/lib/discovery';

type World = { title: string; image: string; likes: number; replies: number; excerpt: string };
export function DiscoveryPlay({ name, worlds, onWorld, onBack, initialCreatorMode = 'create' }: { name: string; worlds: World[]; onWorld: (title: string) => void; onBack: () => void; initialCreatorMode?: 'create' | 'drafts' }) {
  const [creatorMode, setCreatorMode] = useState(initialCreatorMode);
  const [state, setState] = useState<DiscoveryState>(emptyDiscovery);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [person, setPerson] = useState('lanchuan');
  const [title, setTitle] = useState(''), [copy, setCopy] = useState(''), [editing, setEditing] = useState<string | undefined>();
  const [mood, setMood] = useState('平静'), [hours, setHours] = useState(24), [question, setQuestion] = useState(0);
  const [sort, setSort] = useState('热度'), [job, setJob] = useState(0), [ending, setEnding] = useState('');
  const [board, setBoard] = useState<number[]>(Array(81).fill(0)), [previous, setPrevious] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false), [remaining, setRemaining] = useState(0);
  const audio = useRef<HTMLAudioElement>(null), saveLock = useRef(false);
  const selected = companions.find(c => c.id === person)!;
  const day = beijingDay();
  async function reload() {
    setError('');
    try { const r = await fetch('/api/discovery'); if (!r.ok) throw new Error('加载失败，请重试。');
      setState(await r.json() as DiscoveryState); setReady(true);
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败。'); }
  }
  useEffect(() => { void reload(); }, []);
  useEffect(() => { if (!remaining) return; const timer = setTimeout(() => {
    if (remaining === 1) { audio.current?.pause(); setPlaying(false); }
    setRemaining(remaining - 1);
  }, 1000); return () => clearTimeout(timer); }, [remaining]);
  async function save(action: Record<string, unknown>) {
    if (saveLock.current || !ready) return false;
    saveLock.current = true; setBusy(true); setError(''); setStatus('');
    try {
      const response = await fetch('/api/discovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, companion: person, revision: state.revision }) });
      const data = await response.json() as DiscoveryState & { error?: string };
      if (!response.ok) throw new Error(data.error || '保存失败。');
      setState(data); setStatus('已保存'); return true;
    } catch (e) { setError(e instanceof Error ? e.message : '网络暂时不可用。'); return false;
    } finally { saveLock.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const action = name === '星光日记' ? 'diary' : name === '创作中心' ? 'draft' : 'letter';
    if (await save({ action, title, text: copy, mood, hours, id: editing })) { setTitle(''); setCopy(''); setEditing(undefined); if (name === '创作中心') setCreatorMode('drafts'); }
  }
  function edit(entry: Entry) { setTitle(entry.title); setCopy(entry.text); setEditing(entry.id); setMood(entry.mood ?? '平静'); setPerson(entry.companion); setCreatorMode('create'); }
  const people = <div className="play-people" aria-label="选择搭档">{companions.map(c => <button key={c.id} aria-pressed={person === c.id} className={person === c.id ? 'chosen' : ''} onClick={() => { setPerson(c.id); setStatus(''); }}><img src={c.image} alt="" /><span>{c.name}</span></button>)}</div>;
  const entryList = (entries: Entry[], editable: boolean) => entries.length ? <div className="play-entries">{entries.map(entry => <article className="play-panel" key={entry.id}><div className="play-between"><h3>{entry.title}</h3>{editable && <button className="play-link" onClick={() => edit(entry)}>编辑</button>}</div><small>{new Date(entry.date).toLocaleDateString('zh-CN')} · {companions.find(c => c.id === entry.companion)?.name}{entry.mood && ` · ${entry.mood}`}</small>{entry.openAt && Date.parse(entry.openAt) > Date.now() ? <p className="play-muted">信件已封存，将于 {new Date(entry.openAt).toLocaleString('zh-CN')} 开启。到时点击下方「重新加载记录」。</p> : <p className="play-prose">{entry.text}</p>}</article>)}</div> : <p className="play-empty">这里还没有记录，写下第一篇吧。</p>;
  const writing = (label: string, placeholder: string) => <form className="play-panel play-form" onSubmit={submit}><h3>{editing ? '编辑记录' : label}</h3><label>标题<input required maxLength={60} value={title} onChange={e => setTitle(e.target.value)} placeholder="给这一刻取个名字" /></label><label>{name === '创作中心' ? '角色与世界设定' : '正文'}<textarea required maxLength={2000} rows={6} value={copy} onChange={e => setCopy(e.target.value)} placeholder={placeholder} /></label><div className="play-between"><small>{copy.length}/2000</small><button className="play-primary" disabled={!ready || busy}>{busy ? '保存中…' : name === '时差信箱' ? '封存这封信' : '保存'} </button></div>{editing && <button type="button" className="play-link" onClick={() => { setEditing(undefined); setTitle(''); setCopy(''); }}>取消编辑</button>}</form>;

  return <div className="screen scroll-screen discovery-play">
    <header className="play-header"><button onClick={onBack} aria-label="返回发现"><ArrowLeft /></button><h2>{name}</h2><span>拾起日常</span></header>
    <div className="play-content">
      {error && <div className="play-error" role="alert">{error}<button onClick={() => void reload()}>重新加载记录</button></div>}
      {status && <p className="play-status" role="status"><Check size={16} />{status}</p>}
      {!ready && !error && <p role="status">正在加载你的记录…</p>}

      {name === '关系花园' && <>{people}<section className="play-panel garden-panel"><div className="play-eyebrow"><Sprout size={16} /> 与{selected.name}的关系花园</div><img className="play-portrait" src={selected.image} alt={selected.name} /><h1>{(state.garden[person]?.water ?? 0) < 3 ? '初见 · 萌芽' : (state.garden[person]?.water ?? 0) < 7 ? '相知 · 抽叶' : '陪伴 · 花开'}</h1><p>{selected.note}</p><div className="play-between"><span>已陪伴浇水 {state.garden[person]?.water ?? 0} 天</span><span>{Math.min(state.garden[person]?.water ?? 0, 7)}/7</span></div><progress max={7} value={Math.min(state.garden[person]?.water ?? 0, 7)} /><button className="play-primary" disabled={!ready || busy || state.garden[person]?.day === day} onClick={() => void save({ action: 'water' })}><Droplets size={18} />{state.garden[person]?.day === day ? '今天已浇水' : '为关系浇一滴水'}</button><small>每天一次，北京时间零点刷新。第 3 天抽叶，第 7 天花开。</small></section><section className="play-panel"><h3>把陪伴留在生活里</h3><p>浇水记录只代表你在这里留下的足迹，不评判现实关系。</p><div className="play-milestones">{['1 天 · 初见', '3 天 · 相知', '7 天 · 花开'].map((m, i) => <span key={m} className={(state.garden[person]?.water ?? 0) >= [1, 3, 7][i] ? 'reached' : ''}>{m}</span>)}</div></section></>}

      {name === '心动问答' && <>{people}<section className="play-panel"><div className="play-eyebrow"><Heart size={16} /> 慢慢了解彼此 · {question + 1}/{questions.length}</div><h1>{questions[question]}</h1><textarea aria-label="你的回答" rows={5} maxLength={500} value={copy} onChange={e => setCopy(e.target.value)} placeholder="不用完美，真实的回答就很好。" /><button className="play-primary" disabled={!ready || busy || !copy.trim()} onClick={async () => { if (await save({ action: 'answer', index: question, text: copy })) setCopy(''); }}>保存我的回答</button>{state.answers[`${person}:${question}`] && <blockquote><small>你的回答</small><p>{state.answers[`${person}:${question}`]}</p></blockquote>}<div className="play-between"><button disabled={question === 0} onClick={() => { setQuestion(question - 1); setCopy(''); }}>上一题</button><button disabled={question === questions.length - 1} onClick={() => { setQuestion(question + 1); setCopy(''); }}>下一题</button></div></section><p className="play-muted">这是自我表达问卷，不是心理测评或匹配分数。回答按搭档分别保存。</p></>}

      {name === '星光日记' && <>{people}<div className="play-eyebrow"><BookOpen size={16} /> 今天的心情</div><div className="play-chips">{['开心', '平静', '想念', '低落'].map(m => <button key={m} aria-pressed={mood === m} onClick={() => setMood(m)}>{m}</button>)}</div>{writing('写下今天', '今天，有什么想留给未来的自己？')}<h3>我的日记 · {state.diaries.length}</h3>{entryList(state.diaries, true)}</>}

      {name === '创作中心' && <><section className="play-panel"><h1>世界与剧情</h1><p>保存角色设定、世界背景和开场白。草稿仅自己可见。</p></section><div className="play-chips"><button aria-pressed={creatorMode === 'create'} onClick={() => setCreatorMode('create')}>创建世界／剧情</button><button aria-pressed={creatorMode === 'drafts'} onClick={() => setCreatorMode('drafts')}>草稿箱 · {state.drafts.length}</button></div>{creatorMode === 'create' ? writing('新建世界草稿', '角色是谁？你们在哪里相遇？写下背景、性格和第一句话…') : <><h3>草稿箱 · {state.drafts.length}</h3>{entryList(state.drafts, true)}</>}</>}

      {name === '时差信箱' && <>{people}<section className="play-panel"><div className="play-eyebrow"><Mail size={16} /> 寄给未来的自己 · 关于{selected.name}</div><p>把想说的话封存，等未来的你回来开启。</p><div className="play-chips">{[[0, '现在开启'], [24, '明天此刻'], [168, '一周以后']].map(([h, label]) => <button key={h} aria-pressed={hours === h} onClick={() => setHours(Number(h))}>{label}</button>)}</div></section>{writing('写一封时差信', '等你读到这里的时候…')}<h3>我的信箱 · {state.letters.length}</h3>{entryList(state.letters, false)}<p className="play-muted">站内定时开启，不会发送真实邮件或推送。</p></>}

      {name === '搭档任务' && <>{people}<section className="play-panel"><div className="play-eyebrow">TODAY TOGETHER</div><h1>今天，也一起好好生活</h1><p>{selected.name}的陪伴清单 · 完成后由你亲自确认</p>{partnerTasks.map((task, i) => <div className="play-task" key={task}><span><b>{task}</b><small>{i === 2 ? '可以去星光日记记下来' : '按自己的节奏完成就好'}</small></span><button disabled={!ready || busy || state.tasks[`${person}:${i}`] === day} onClick={() => void save({ action: 'task', index: i })}>{state.tasks[`${person}:${i}`] === day ? <Check aria-label="已完成" /> : '完成'}</button></div>)}</section><p className="play-muted">每日零点更新。不发放钻石，不需要上传证明。</p></>}

      {name === '打工人生' && <><div className="play-between"><h3>今日兼职</h3><span>体验金币 {state.job.coins}</span></div><div className="play-chips">{jobScenes.map((s, i) => <button key={s.title} aria-pressed={job === i} onClick={() => { setJob(i); setEnding(''); }}>{s.title}</button>)}</div><section className="play-panel"><div className="play-eyebrow">一份工作 · 一个小故事</div><h1>{jobScenes[job].title}</h1><p>{jobScenes[job].intro}</p>{jobScenes[job].choices.map((c, i) => <button className="play-choice" key={c} disabled={!ready || busy || (state.job.day === day && state.job.completed.includes(job))} onClick={async () => { if (await save({ action: 'job', index: job, choice: i })) setEnding(jobScenes[job].endings[i]); }}>{c}<ChevronRight size={16} /></button>)}{ending && <blockquote>{ending}<p>本次获得 20 体验金币。</p></blockquote>}{state.job.day === day && state.job.completed.includes(job) && <p className="play-status">今天已完成这份工作，明天再来。</p>}</section><p className="play-muted">互动短篇体验，每份工作每天一次。金币仅作进度记录，不可兑换或提现。</p></>}

      {name === '双色棋局' && <><section className="play-panel"><div className="play-eyebrow">GOMOKU · 轻量五子棋</div><h1>{boardWinner(board) === 1 ? '你赢了！' : boardWinner(board) === 2 ? '电脑获胜，再来一局？' : board.every(Boolean) ? '和棋' : '轮到你落子'}</h1><p>你执粉棋，电脑执白棋。横、竖、斜连成五子即胜。</p><div className="play-board" aria-label="九乘九棋盘">{board.map((stone, i) => <button key={i} aria-label={`第${Math.floor(i / 9) + 1}行第${i % 9 + 1}列${stone ? stone === 1 ? '粉棋' : '白棋' : '空位'}`} disabled={!!stone || !!boardWinner(board)} onClick={() => { const next = [...board]; next[i] = 1; setPrevious(board); if (!boardWinner(next)) { const move = boardReply(next); if (move >= 0) next[move] = 2; } setBoard(next); }}>{stone > 0 && <span className={stone === 1 ? 'pink-stone' : 'white-stone'} />}</button>)}</div><div className="play-between"><button disabled={!previous.length} onClick={() => { setBoard(previous); setPrevious([]); }}>悔棋一步</button><button onClick={() => { setBoard(Array(81).fill(0)); setPrevious([]); }}>重新开始</button></div></section><p className="play-muted">本地电脑对弈，不消耗 AI 额度。离开此页会重置棋局。</p></>}

      {name === '深夜电台' && <><section className="play-panel radio-panel"><div className="play-eyebrow"><Headphones size={16} /> 今晚，给自己一点空白</div><img className="play-radio-cover" src={worlds[0]?.image} alt="电台封面" /><h1>Sleepy Chill（裂空调）</h1><p>DJ.俞陀 · 用户提供的音乐片段</p><audio ref={audio} src="/sleepy-chill.m4a" loop controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setError('音乐暂时无法加载。')} /><p>{playing ? '正在播放' : '点击播放，开始今晚的陪伴'}</p><h3>睡眠定时</h3><div className="play-chips">{[0, 5, 15, 30].map(m => <button key={m} onClick={() => setRemaining(m * 60)}>{m === 0 ? '关闭定时' : `${m} 分钟`}</button>)}</div><small>{remaining ? `将在 ${Math.ceil(remaining / 60)} 分钟后停止` : '未设置自动停止'}</small></section><p className="play-muted">音乐离开页面即停止，不会自动播放。定时在当前页面运行。</p></>}

      {name === '热度榜' && <><div className="play-eyebrow"><Trophy size={16} /> 发现更多值得进入的世界</div><div className="play-chips">{['热度', '共鸣'].map(s => <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}>{s}榜</button>)}</div><p className="play-muted">根据当前演示作品数据排序，非实时全站榜单。</p><div className="play-ranking">{[...worlds].sort((a, b) => sort === '热度' ? b.likes - a.likes : b.replies - a.replies).slice(0, 10).map((world, i) => <button key={world.title} onClick={() => onWorld(world.title)}><strong>{String(i + 1).padStart(2, '0')}</strong><img src={world.image} alt="" /><span><b>{world.title}</b><small>{sort === '热度' ? world.likes : world.replies} {sort}</small></span><ChevronRight size={18} /></button>)}</div></>}

      {ready && !['双色棋局', '深夜电台', '热度榜'].includes(name) && <footer className="play-footer"><p>记录保存在服务器，按当前浏览器区分；清除 Cookie 或换设备后无法找回。每类文字记录最多 50 条。</p><button className="play-link" disabled={busy} onClick={() => void reload()}>重新加载记录</button></footer>}
    </div>
  </div>;
}
