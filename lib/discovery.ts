export const companions = [
  { id: 'lanchuan', name: '岚川', image: '/avatars/avatar-07.jpg', note: '把平凡的今天，也过得值得记住。' },
  { id: 'sumian', name: '苏眠', image: '/avatars/avatar-05.webp', note: '你的小小心事，我都会认真听。' },
  { id: 'xuchao', name: '许朝', image: '/avatars/avatar-17.webp', note: '不必着急，我陪你慢慢来。' },
];
export const questions = ['如果今天多出一小时，你想和我做什么？', '难过的时候，你更需要陪伴还是独处？', '你记忆里最温柔的一个瞬间是什么？', '下一次见面，你想选在什么地方？', '有什么小愿望，想让我们一起完成？'];
export const partnerTasks = ['喝一杯水，照顾好自己', '出门走十分钟，留意一处风景', '记下今天值得感谢的一件事'];
export const jobScenes = [
  { title: '雨天咖啡馆', intro: '岚川把围裙递给你。第一位客人带着湿漉漉的伞走进来。', choices: ['先递上纸巾，再询问口味', '推荐今天的热可可'], endings: ['客人接过纸巾笑了。岚川悄悄向你竖起拇指：“你很会照顾人。”', '热气在杯口升起。“雨天和可可很配。”岚川替你端稳托盘。'] },
  { title: '街角花店', intro: '苏眠正整理花束，一位客人想为久未见面的朋友挑一束花。', choices: ['选向日葵，祝愿重逢快乐', '选满天星，留一点温柔'], endings: ['你们把花束系上亮色丝带。苏眠说：“收到的人一定会笑。”', '细碎花朵像星光。苏眠认真写好卡片：“思念也有很轻的重量。”'] },
  { title: '深夜书店', intro: '许朝把最后一摞书放好，窗边还坐着一位读者。', choices: ['轻声提醒打烊时间', '先帮读者找到书签'], endings: ['读者道了谢。许朝合上门：“今天也辛苦了，回去好好休息。”', '读者把书签夹好。许朝看着你笑：“原来你也会舍不得故事结束。”'] },
];
export type Entry = { id: string; title: string; text: string; date: string; companion: string; mood?: string; openAt?: string };
export type DiscoveryState = {
  revision: number; diaries: Entry[]; drafts: Entry[]; letters: Entry[];
  garden: Record<string, { water: number; day: string }>;
  answers: Record<string, string>; tasks: Record<string, string>;
  job: { day: string; completed: number[]; coins: number };
};
export const emptyDiscovery = (): DiscoveryState => ({ revision: 0, diaries: [], drafts: [], letters: [], garden: {}, answers: {}, tasks: {}, job: { day: '', completed: [], coins: 0 } });
export const beijingDay = (now = Date.now()) => new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
export function updateDiscovery(state: DiscoveryState, input: Record<string, unknown>, now = Date.now()): DiscoveryState {
  const next = structuredClone(state), day = beijingDay(now);
  const text = (value: unknown, max: number) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('请检查填写内容和长度。');
    return value.trim();
  };
  const companion = String(input.companion ?? 'lanchuan');
  if (!companions.some(c => c.id === companion)) throw new Error('请选择角色。');
  if (['diary', 'draft', 'letter'].includes(String(input.action))) {
    const key = input.action === 'diary' ? 'diaries' : input.action === 'draft' ? 'drafts' : 'letters';
    const title = text(input.title, 60), copy = text(input.text, 2000);
    const existing = typeof input.id === 'string' ? next[key].findIndex(e => e.id === input.id) : -1;
    if (input.id && existing < 0) throw new Error('记录不存在，请刷新后重试。');
    if (existing < 0 && next[key].length >= 50) throw new Error('当前最多保存 50 条记录。');
    if (key === 'letters' && existing >= 0) throw new Error('已封存的信件不能修改。');
    const entry: Entry = { id: existing >= 0 ? next[key][existing].id : crypto.randomUUID(), title, text: copy, date: new Date(now).toISOString(), companion };
    if (key === 'diaries') entry.mood = ['开心', '平静', '想念', '低落'].includes(String(input.mood)) ? String(input.mood) : '平静';
    if (key === 'letters') {
      const hours = Number(input.hours);
      if (![0, 24, 168].includes(hours)) throw new Error('请选择有效的送达时间。');
      entry.openAt = new Date(now + hours * 3600_000).toISOString();
    }
    if (existing >= 0) next[key][existing] = entry; else next[key].unshift(entry);
  } else if (input.action === 'water') {
    const current = next.garden[companion] ?? { water: 0, day: '' };
    if (current.day === day) throw new Error('今天已经浇过水，明天再来吧。');
    next.garden[companion] = { water: current.water + 1, day };
  } else if (input.action === 'answer') {
    const index = Number(input.index);
    if (!Number.isInteger(index) || !questions[index]) throw new Error('题目不存在。');
    next.answers[`${companion}:${index}`] = text(input.text, 500);
  } else if (input.action === 'task') {
    const index = Number(input.index);
    if (!Number.isInteger(index) || !partnerTasks[index]) throw new Error('任务不存在。');
    next.tasks[`${companion}:${index}`] = day;
  } else if (input.action === 'job') {
    const index = Number(input.index), choice = Number(input.choice);
    if (!Number.isInteger(index) || !jobScenes[index] || ![0, 1].includes(choice)) throw new Error('请选择工作和行动。');
    if (next.job.day !== day) next.job = { ...next.job, day, completed: [] };
    if (next.job.completed.includes(index)) throw new Error('这份工作今天已完成。');
    next.job.completed.push(index); next.job.coins += 20;
  } else throw new Error('不支持的操作。');
  next.revision++;
  return next;
}

export function boardWinner(board: number[], size = 9) {
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const x = i % size, y = Math.floor(i / size);
      if (x + 4 * dx >= size || y + 4 * dy < 0 || y + 4 * dy >= size) continue;
      if ([1, 2, 3, 4].every(k => board[(y + k * dy) * size + x + k * dx] === board[i])) return board[i];
    }
  }
  return 0;
}
export function boardReply(board: number[]) {
  const available = board.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
  for (const stone of [2, 1]) for (const i of available) {
    const candidate = [...board]; candidate[i] = stone;
    if (boardWinner(candidate)) return i;
  }
  return available.sort((a, b) => {
    const score = (i: number) => board.reduce((sum, v, j) => sum + (v && Math.abs(i % 9 - j % 9) <= 1 && Math.abs(Math.floor(i / 9) - Math.floor(j / 9)) <= 1 ? 5 : 0), 0) - Math.abs(i % 9 - 4) - Math.abs(Math.floor(i / 9) - 4);
    return score(b) - score(a);
  })[0] ?? -1;
}
