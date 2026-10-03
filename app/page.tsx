'use client';

import { E2EPanel } from '@/components/e2e-panel';
import { track,testHeaders,eventIds,flushEvents } from '@/lib/e2e-client';
import { DiscoveryPlay } from '@/components/discovery-play';
import { AgentStudio, useAgentLibrary, type AgentProfile } from '@/components/agent-studio';
import { useLocalProfile } from '@/components/profile-editor';
import { VirtualPhone } from '@/components/virtual-phone';
import { MessagesView, useMessagesState } from '@/components/messages-view';
import { WorldTools, useWorldTools, type WorldToolsState } from '@/components/world-tools';
import { MultimodalStudio } from '@/components/multimodal-studio';
import { VoiceInput, VoiceReader } from '@/components/model-voice';
import { AccountProvider, AccountEntry, CommerceView, useAccount } from '@/components/account-center';

import { FormEvent, useMemo, useState, useRef, useEffect, type Dispatch, type SetStateAction, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronRight,
  CircleUserRound,
  Copy,
  Download,
  Gem,
  Heart,
  Image as ImageIcon,
  Grid2X2,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  Orbit,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PersonalView, useDiamondWallet } from '@/components/diamond-center';
import { copyShareText, worldShareUrl } from '@/lib/world-sharing';

type View = 'world' | 'discover' | 'agent' | 'llm' | 'community' | 'forum' | 'profile' | 'membership' | 'phone' | 'detail';
type HomePanel = 'comments' | 'call' | 'friends' | 'more' | 'share' | 'settings' | null;
type StoryAction = 'continue' | 'rewrite' | null;
type ShareTarget = 'wechat' | 'moments' | 'qq' | 'weibo' | 'system' | 'copy' | 'save';
type ShareStyle = 'night' | 'paper' | 'film';

type WorldMessage = {
  id: number;
  name: string;
  avatar: string;
  voice?: string;
  text: string;
  user?: boolean;
};

type WorldComment = {
  id: number;
  author: string;
  copy: string;
  likes: number;
  liked: boolean;
  avatar: string;
};

type ForumPost = {
  id: number;
  author: string;
  handle: string;
  date: string;
  location: string;
  avatar: string;
  copy: string;
  images: string[];
  world?: string;
  worldSnapshot?: HomeScript;
  isMine?: boolean;
  likes: number;
  liked: boolean;
  subscribed: boolean;
  comments: { id: number; author: string; copy: string }[];
};

const avatarImages = {
  lanchuan: '/avatars/avatar-07.jpg',
  sumian: '/avatars/avatar-05.webp',
  xuzhouxun: '/avatars/avatar-15.jpg',
  user: '/avatars/avatar-18.jpg',
  xuchao: '/avatars/avatar-17.webp',
  shenxianan: '/avatars/avatar-06.webp',
  fugan: '/avatars/avatar-08.webp',
  fuyanci: '/avatars/avatar-11.webp',
  qingyan: '/avatars/avatar-01.webp',
  liuxinwan: '/avatars/avatar-02.webp',
  yehangxing: '/avatars/avatar-03.jpg',
  tiantaoqishui: '/avatars/avatar-04.jpg',
  wudao: '/avatars/avatar-09.webp',
  lansehuisheng: '/avatars/avatar-10.webp',
  zhifeiji: '/avatars/avatar-11.webp',
  beidao: '/avatars/avatar-12.jpg',
  xiaomian: '/avatars/avatar-13.jpg',
  baixuyan: '/avatars/avatar-14.jpg',
  ningan: '/avatars/avatar-16.webp',
} as const;

const initialWorldComments: WorldComment[] = [
  { id: 1, author: '纸飞机', copy: '这里的雨声音效好有氛围。', likes: 126, liked: false, avatar: avatarImages.zhifeiji },
  { id: 2, author: '北岛', copy: '岚川第二段回复接上了三年前的记忆。', likes: 89, liked: false, avatar: avatarImages.beidao },
  { id: 3, author: '小眠', copy: '求一个不拆信的分支！', likes: 42, liked: false, avatar: avatarImages.xiaomian },
];

const discoverCards = [
  {
    title: '余烬之后，和你重逢',
    excerpt: '废墟尽头的灯重新亮起，他朝你伸出了手。',
    author: '南枝写梦',
    image: '/discover/material-01.webp',
    category: '剧情',
    tags: ['#现代', '#反差'],
    likes: 1909,
    replies: 228,
    height: 272,
    featured: true,
  },
  {
    title: '窗边的第七封信',
    excerpt: '那年夏天，你们约好一个月后再见。',
    author: '小友银鱼',
    image: '/discover/material-02.png',
    category: '恋爱',
    tags: ['#温柔', '#年上'],
    likes: 1310,
    replies: 96,
    height: 224,
    featured: true,
  },
  {
    title: '零点电台只为你开',
    excerpt: '凌晨两点，陌生主播念出了只有你知道的名字。',
    author: '失眠航线',
    image: '/discover/material-03.jpg',
    category: '治愈',
    tags: ['#温柔', '#现代'],
    likes: 886,
    replies: 74,
    height: 206,
    featured: false,
  },
  {
    title: '月下长安客',
    excerpt: '你是他此生唯一算错的一卦。',
    author: '青崖',
    image: '/discover/material-04.png',
    category: '古风',
    tags: ['#偏执', '#宿命'],
    likes: 2431,
    replies: 317,
    height: 286,
    featured: true,
  },
  {
    title: '雨停之前别说再见',
    excerpt: '整座城市都在下雨，只有他的伞向你倾斜。',
    author: '岛屿来信',
    image: '/discover/material-05.jpg',
    category: '恋爱',
    tags: ['#现代', '#甜宠'],
    likes: 1568,
    replies: 142,
    height: 238,
    featured: false,
  },
  {
    title: '无限列车第十三站',
    excerpt: '广播说不要回头，可你的座位后传来了熟悉的声音。',
    author: '白噪声',
    image: '/discover/material-06.webp',
    category: '无限流',
    tags: ['#反差', '#群像'],
    likes: 3266,
    replies: 451,
    height: 300,
    featured: true,
  },
  {
    title: '玫瑰失序',
    excerpt: '所有人都说他危险，可他只在你面前收起锋芒。',
    author: '白昼鸢尾',
    image: '/discover/material-07.jpg',
    category: '女性向',
    tags: ['#偏执', '#甜宠'],
    likes: 2118,
    replies: 283,
    height: 250,
    featured: true,
  },
  {
    title: '合租室友今天也很可疑',
    excerpt: '他记得你的每个习惯，却说你们只是普通室友。',
    author: '苏打软糖',
    image: '/discover/material-08.webp',
    category: '剧情',
    tags: ['#现代', '#甜宠'],
    likes: 972,
    replies: 118,
    height: 214,
    featured: false,
  },
  {
    title: '玫瑰庄园的晚宴',
    excerpt: '午夜钟声响起时，宾客中少了一个人，也多了一封邀请函。',
    author: '雾岛来客',
    image: '/discover/material-09.jpg',
    category: '剧情',
    tags: ['#偏执', '#群像'],
    likes: 1786,
    replies: 204,
    height: 284,
    featured: true,
  },
  {
    title: '今天也请多喜欢我一点',
    excerpt: '新来的同桌看起来很乖，只有你知道他藏着怎样的秘密。',
    author: '甜桃汽水',
    image: '/discover/material-10.jpg',
    category: '恋爱',
    tags: ['#甜宠', '#现代'],
    likes: 1247,
    replies: 109,
    height: 232,
    featured: false,
  },
  {
    title: '神明落在我窗台',
    excerpt: '失去记忆的神明暂住你家，并认真学习怎样成为普通人。',
    author: '月桂树',
    image: '/discover/material-11.jpg',
    category: '女性向',
    tags: ['#温柔', '#甜宠'],
    likes: 2894,
    replies: 336,
    height: 306,
    featured: true,
  },
  {
    title: '春风不识旧时人',
    excerpt: '重回十六岁那年，你决定改写那场迟到七年的告别。',
    author: '折柳',
    image: '/discover/material-12.png',
    category: '古风',
    tags: ['#年上', '#宿命'],
    likes: 2016,
    replies: 261,
    height: 258,
    featured: true,
  },
  {
    title: '凌晨三点的便利店',
    excerpt: '每个失眠的人都能在这里换走一段不愿记起的往事。',
    author: '暖光研究所',
    image: '/discover/material-02.png',
    category: '治愈',
    tags: ['#现代', '#温柔'],
    likes: 752,
    replies: 63,
    height: 216,
    featured: false,
  },
  {
    title: '黑塔守则第九条',
    excerpt: '不要相信镜子里的自己——尤其当它先对你笑的时候。',
    author: '纸上迷宫',
    image: '/discover/material-09.jpg',
    category: '无限流',
    tags: ['#反差', '#群像'],
    likes: 4118,
    replies: 587,
    height: 294,
    featured: true,
  },
  {
    title: '和顶流假装恋爱的第七天',
    excerpt: '合约上写着禁止心动，可他在镜头外先牵住了你的手。',
    author: '椰子星球',
    image: '/discover/material-04.png',
    category: '恋爱',
    tags: ['#现代', '#反差'],
    likes: 3372,
    replies: 418,
    height: 266,
    featured: true,
  },
  {
    title: '宫墙外的雪',
    excerpt: '你替他守了三年秘密，等来的却是一纸赐婚诏书。',
    author: '长夜未央',
    image: '/discover/material-03.jpg',
    category: '古风',
    tags: ['#偏执', '#年上'],
    likes: 2655,
    replies: 391,
    height: 312,
    featured: false,
  },
  {
    title: '我们仍未发送的语音',
    excerpt: '分开后的第一百天，你收到了一条发送于过去的留言。',
    author: '蓝色回声',
    image: '/discover/material-08.webp',
    category: '治愈',
    tags: ['#温柔', '#现代'],
    likes: 1106,
    replies: 87,
    height: 226,
    featured: false,
  },
  {
    title: '危险关系观察日记',
    excerpt: '你的任务是观察他、记录他，以及绝对不要爱上他。',
    author: '夜航星',
    image: '/discover/material-12.png',
    category: '女性向',
    tags: ['#偏执', '#反差'],
    likes: 3094,
    replies: 445,
    height: 278,
    featured: true,
  },
];

const discoverModules = [
  { name: '热度榜', icon: '/module-icons/heat.png', tone: 'rose', fresh: false },
  { name: '创作中心', icon: '/module-icons/create.png', tone: 'violet', fresh: false },
  { name: '心动问答', icon: '/module-icons/question.png', tone: 'green', fresh: true },
  { name: '打工人生', icon: '/module-icons/job.png', tone: 'amber', fresh: true },
  { name: '星光日记', icon: '/module-icons/diary.png', tone: 'cream', fresh: true },
  { name: '关系花园', icon: '/module-icons/garden.png', tone: 'sage', fresh: true },
  { name: '深夜电台', icon: '/module-icons/radio.webp', tone: 'pink', fresh: true },
  { name: '双色棋局', icon: '/module-icons/chess.png', tone: 'wine', fresh: true },
  { name: '时差信箱', icon: '/module-icons/mail.png', tone: 'navy', fresh: true },
  { name: '搭档任务', icon: '/module-icons/partner.png', tone: 'coral', fresh: false },
];

const initialForumPosts: ForumPost[] = [
  {
    id: 1,
    author: '庆砚',
    handle: '@yellowmeteor',
    date: '今天 18:47',
    location: '四川',
    avatar: avatarImages.qingyan,
    copy: '雨停以后，他还是站在旧车站没走。新世界《逆光来客》今晚更新，最后一幕我反复看了三遍。',
    images: ['/avatars/avatar-17.webp'],
    world: '逆光来客',
    likes: 138,
    liked: false,
    subscribed: false,
    comments: [
      { id: 11, author: '青苔月', copy: '这个光影太有电影感了！' },
      { id: 12, author: '小满', copy: '已经冲去体验，结尾真的会心软。' },
    ],
  },
  {
    id: 2,
    author: '刘昕晚',
    handle: '@岛屿赤潮',
    date: '今天 18:21',
    location: '山东',
    avatar: avatarImages.liuxinwan,
    copy: '各位老师看看我刚捏好的角色卡！冷脸学长×嘴硬青梅，台词测试比我想象得更带感。',
    images: ['/avatars/avatar-07.jpg', '/avatars/avatar-02.webp'],
    world: '青梅失格',
    likes: 286,
    liked: true,
    subscribed: true,
    comments: [
      { id: 21, author: '苏打气泡', copy: '第二张的眼神绝了，求开放共创！' },
      { id: 22, author: '白昼鸢尾', copy: '已收藏，人物关系好适合慢热长线。' },
      { id: 23, author: '折柳', copy: '名字也很好听，蹲后续。' },
    ],
  },
  {
    id: 3,
    author: '夜航星',
    handle: '@nightflight',
    date: '今天 17:56',
    location: '上海',
    avatar: avatarImages.yehangxing,
    copy: '“不要相信镜子里的自己，尤其当它先对你笑。”新副本的第一条规则已经写好，谁来帮我测一遍？',
    images: ['/avatars/avatar-03.jpg'],
    world: '黑塔守则',
    likes: 419,
    liked: false,
    subscribed: true,
    comments: [
      { id: 31, author: '纸上迷宫', copy: '报名！规则怪谈爱好者已就位。' },
      { id: 32, author: '不眠岛', copy: '第一句就把氛围拉满了。' },
    ],
  },
  {
    id: 4,
    author: '甜桃汽水',
    handle: '@peachsoda',
    date: '今天 16:40',
    location: '广东',
    avatar: avatarImages.tiantaoqishui,
    copy: '今天的校园线没有刀，只有晚自习后的一杯热奶茶，还有某人藏了整整两年的告白。',
    images: ['/avatars/avatar-16.webp'],
    world: '雨停之前',
    likes: 972,
    liked: false,
    subscribed: false,
    comments: [
      { id: 41, author: '椰子星球', copy: '“没有刀”这三个字我先保留怀疑。' },
      { id: 42, author: '橘子海', copy: '热奶茶和暗恋绝配！' },
    ],
  },
  {
    id: 5,
    author: '雾岛来客',
    handle: '@mistguest',
    date: '昨天 23:18',
    location: '浙江',
    avatar: avatarImages.wudao,
    copy: '玫瑰庄园的晚宴新增了三条隐藏线索。提醒：看到红色邀请函时，千万不要念出落款。',
    images: ['/avatars/avatar-05.webp', '/avatars/avatar-11.webp'],
    world: '玫瑰庄园',
    likes: 631,
    liked: false,
    subscribed: false,
    comments: [
      { id: 51, author: '长夜未央', copy: '我已经念了……现在重新开档还来得及吗？' },
    ],
  },
  {
    id: 6,
    author: '蓝色回声',
    handle: '@blueecho',
    date: '昨天 21:06',
    location: '北京',
    avatar: avatarImages.lansehuisheng,
    copy: '把没能发送的那段语音做成了世界彩蛋。希望每个错过告别的人，都还能等到一次重新开口的机会。',
    images: ['/avatars/avatar-10.webp'],
    world: '未发送的语音',
    likes: 1106,
    liked: true,
    subscribed: true,
    comments: [
      { id: 61, author: '暖光研究所', copy: '这段文案已经让我想哭了。' },
      { id: 62, author: '六月雪', copy: '谢谢你写出这样的故事。' },
    ],
  },
];

// Original modern retelling inspired by the misunderstanding-to-understanding
// romance structure of Jane Austen's public-domain novel Pride and Prejudice.
const rainDialogueRounds = [
  { userLine: '（站到伞下）我走过来了。这次，你别只说一半。', line: '（他握稳伞柄）好。从那场竞赛开始，你想问什么，我都回答。', narration: '车灯掠过积水，你没有上车。岚川向后退了半步，为你让出伞下干燥的位置。' },
  { userLine: '你为什么替我退赛，却一句也不告诉我？', line: '我以为把事情解决，你就不用难过。后来才知道，不让你知道，也是在替你做决定。对不起。', narration: '站台渐渐空了。他不再避开你的视线，第一次没有用沉默替自己辩解。' },
  { userLine: '我难过的不是比赛，是你突然不肯见我。', line: '（他低下头）我怕你看见我会想起那些流言。但我躲开的每一天，都让你更难过，是不是？', narration: '雨落在站牌上，敲出细碎的声响。那句迟来的道歉终于有了落点。' },
  { userLine: '是。所以一封信，不能把三年都补回来。', line: '我知道。你不用今晚就原谅我，也不用为了让我好受，说没关系。', narration: '你把信纸折好。他没有伸手来拿，只安静等你收进口袋。' },
  { userLine: '（指了指他的肩膀）伞拿正一点，你都淋湿了。', line: '（他把伞移回中间，笑得有些迟疑）那你靠近一点？不愿意也没关系，我还有外套。', narration: '风小了一些。你们终于并肩站着，而不是隔着一场旧事对望。' },
  { userLine: '先去买杯热的吧。这次我请，你别抢。', line: '好，我不抢。你还是热牛奶、少糖？如果口味变了，今天重新告诉我。', narration: '街角便利店还亮着灯，门上的风铃在你们推门时轻轻响了一声。' },
  { userLine: '你记得以前的我，那现在的我呢？', line: '现在的你，我还不够了解。所以我想从今天开始认识，不拿三年前的答案猜你的心事。', narration: '热气从纸杯口升起来，模糊了玻璃窗上的倒影。你捧着杯子，没有急着移开眼。' },
  { userLine: '那先记住一条：有事直接说，不许突然消失。', line: '记住了。忙的时候会告诉你，难过的时候也会说。如果我又躲起来，你可以提醒我，但改掉它是我的事。', narration: '他拿出手机，在备忘录里认真写下那句话，又把屏幕转向你。' },
  { userLine: '明天放学，陪我去旧书店吧。就当重新认识。', line: '（他终于笑开）好。五点，教学楼门口。要是下雨，我带两把伞，让你自己选要不要和我一起撑。', narration: '雨已经停了。店员翻过营业牌，你们捧着温热的纸杯走回街上。' },
  { userLine: '（到家门口回头）岚川，明天见。这次不是告别。', line: '明天见。（他停在台阶下，没有再追问答案）早点休息。那封信慢慢看，我们还有很多话，可以当面说。', narration: '楼道灯亮起来。你走进门前看了一眼，他还站在灯下，抬手向你挥了挥。雨夜的故事，终于有了一个明天。' },
];

const storyBeats = [
  {
    narration: '新学期的第三场雨落下来时，岚川已经在教学楼下等了四十七分钟。你本想从侧门离开，他却先一步撑开伞，挡住了迎面扑来的风。',
    line: '“你可以继续不理我，但今晚，让我送你回去。”',
  },
  {
    narration: '路口的灯由红转绿，他却没有迈步。大衣口袋里露出一角泛黄的信封，收件人是三年前的你，寄件人一栏仍然空白。',
    line: '“那封信不是恶作剧。我写了三遍，只是最后没有勇气署名。”',
  },
  {
    narration: '你一直以为，是他在竞赛评审前泄露了你的秘密。雨水沿着伞骨落下，他终于说起那天缺席的真正原因。',
    line: '“我没有把你的名字交出去。相反，我用自己的退赛，换他们留下了你。”',
  },
  {
    narration: '街角咖啡店即将打烊。岚川把那封旧信推到你面前，却按住了信口，像是把最后的选择仍旧留给你。',
    line: '“看完它，你可以决定原不原谅我。但别再替我决定，我从没喜欢过你。”',
  },
  {
    narration: '信纸只有半页。最后一行的墨迹被雨晕开，仍能认出一句迟到了三年的约定：如果你愿意，我会在旧车站等到末班车。',
    line: '“那天我等到了天亮。今天也是。只是这一次，我想亲耳听见你的答案。”',
  },
  {
    narration: '末班车进站的提示音从远处传来。你们之间只剩一步，而那封没有寄出的信，正安静地躺在你掌心。',
    line: '“别急着回答。车门关闭以前，朝我走一步就好。”',
  },
  ...rainDialogueRounds,
];

const quickInspirations = [
  '我接过那封信，却没有拆开，只问他：“如果我现在相信你，我们还能回到三年前吗？”',
  '我向岚川靠近一步，把伞柄推回他的掌心：“先送我回家，剩下的话路上慢慢说。”',
  '我低头看见信封背面还有一行小字，于是抬眼追问：“旧车站那天，你究竟等到了几点？”',
  '末班车的灯照亮他的侧脸，我忽然握住他的手腕，不让他再一次转身离开。',
  '苏眠突然发来一张三年前的照片，画面里岚川正独自站在暴雨中的站台上。',
  '我没有立刻原谅他，只把信收进口袋：“给你七天时间，重新让我认识真正的你。”',
  ...rainDialogueRounds.map(round => round.userLine),
];

const initialWorldMessages: WorldMessage[] = [
  {
    id: 1,
    name: '岚川',
    avatar: avatarImages.lanchuan,
    voice: '6″',
    text: '（把伞朝你这边倾了大半，自己的肩膀很快被雨打湿）我知道你不想见我。可今天这场雨，至少让我陪你走完。',
  },
  {
    id: 2,
    name: '苏眠',
    avatar: avatarImages.sumian,
    text: '（把你拉到一边，小声提醒）他从放学就在楼下等。还有，广播站清理旧物时，发现了一封写给你的信。',
  },
  {
    id: 3,
    name: '许昼寻',
    avatar: avatarImages.xuzhouxun,
    voice: '4″',
    text: '（递来一只边角泛黄的信封）日期是三年前。岚川说，如果今天还见不到你，就让我替他交给你。',
  },
];

const defaultHomeScripts = [
  { title: '雨夜来信', image: '/discover/material-12.png', name: '岚川', avatar: avatarImages.lanchuan, beats: storyBeats, messages: initialWorldMessages },
  ...[
    { title: '末班车的邻座', image: '/discover/material-01.webp', name: '沈弦安', avatar: avatarImages.shenxianan,
      scenes: [
        ['你在开往海边的末班车上醒来，肩头盖着一件陌生外套。邻座的人把车票夹进书里——那是你曾经送给初恋的那本书。', '别急着还给我。到终点还有两小时，这一次，我们好好说句话。'],
        ['列车钻进隧道，车窗映出他一直望着你的目光。他翻开书，里面夹着你毕业那天没有送出的合照。', '每次路过这座城，我都会买同一班车票。今天终于不是一个人了。'],
        ['海面在晨光里亮起来。广播报出终点站，他收起行李，却把那张旧车票放进你手心。', '要不要一起看日出？这次不谈告别。'],
      ] },
    { title: '借你一场月色', image: '/discover/material-02.png', name: '许昼寻', avatar: avatarImages.xuzhouxun,
      scenes: [
        ['你误闯了王府的夜宴。满庭灯火中，那位传闻冷漠的世子忽然握住你的手，替你挡住所有探询的目光。', '别怕，就说你是来找我的。今晚的月色，我只想与你同看。'],
        ['他带你走到廊下，解下披风。你发现披风内侧绣着一朵小花，正是幼时你随手画在他掌心的形状。', '你忘了也无妨。我记着，就不算失约。'],
        ['宴席散去，石阶上落满桂花。他没有问你的来处，只将一盏灯递到你面前。', '若明晚还想来看月亮，这扇门会为你留着。'],
      ] },
    { title: '限定心动合约', image: '/discover/material-05.jpg', name: '傅砚辞', avatar: avatarImages.fuyanci,
      scenes: [
        ['签约的最后一页写着“不许动心”。你刚落笔，对面的人却将你那杯冷咖啡换成热可可，连糖量都是你习惯的分寸。', '工作之外不必演戏。照顾你，是我自己愿意。'],
        ['晚宴结束，他替你摘下耳饰。镜子里的他避开你的视线，口袋里却掉出一张早已订好的双人电影票。', '不是合同要求。是我想约你，只有我们两个。'],
        ['合约到期的那天，他带来的不是续约文件，而是一束被雨淋湿的花。', '这次没有条款，也没有期限。你愿意真正认识我吗？'],
      ] },
    { title: '花店等风也等你', image: '/discover/material-09.jpg', name: '苏眠', avatar: avatarImages.sumian,
      scenes: [
        ['你接手了一间旧花店。每到周五，总有人订一束没有收件地址的白桔梗。今天，订花的人站在门外，衣角沾着细雨。', '以前我总说是送给朋友。其实每一束，都是想送给你。'],
        ['停电后的花店只有一盏小灯。他帮你修剪枝叶，认真得像是在照看一场不敢惊醒的梦。', '你说想让这间店一直开着，我就想做那个每天都来的人。'],
        ['天晴时，你将最后一束花递给他。他没有接，只轻轻握住了你的手。', '今天换我等你关店。我们一起走，好不好？'],
      ] },
  ].map(({ scenes, ...script }) => ({ ...script, beats: scenes.map(([narration, line]) => ({ narration, line })), messages: [{ id: 1, name: script.name, avatar: script.avatar, text: scenes[0][1], voice: '5″' }] as WorldMessage[] })),
];

type HomeScript = (typeof defaultHomeScripts)[number];
type ForumFocusRequest = { postId: number; sequence: number };

function discoverWorldScript(card: (typeof discoverCards)[number]): HomeScript {
  const role = defaultHomeScripts[discoverCards.indexOf(card) % defaultHomeScripts.length];
  const opening = { narration: card.excerpt, line: '你终于来了。这一次，我想听听你的选择。' };
  return {
    title: card.title, image: card.image, name: role.name, avatar: role.avatar,
    beats: [opening, { narration: `${card.excerpt} 你停在原地，等他把未说完的话继续说下去。`, line: '别急着离开。关于我们的故事，我还有话想告诉你。' }],
    messages: [{ id: 1, name: role.name, avatar: role.avatar, text: opening.line, voice: '5″' }],
  };
}

function sharedWorldScript(title: string): HomeScript | undefined {
  const home = defaultHomeScripts.find(item => item.title === title);
  if (home) return home;
  const card = discoverCards.find(item => item.title === title);
  if (card) return discoverWorldScript(card);
  const post = initialForumPosts.find(item => item.world === title);
  if (post) return { ...defaultHomeScripts[0], title, image: post.images[0] ?? defaultHomeScripts[0].image };
}

export default function Home() { return <AccountProvider><HomeBody /><E2EPanel /></AccountProvider>; }

function HomeBody() {
  const account = useAccount();
  const [homeScripts, setHomeScripts] = useState(defaultHomeScripts);
  const [detailScript, setDetailScript] = useState(defaultHomeScripts[0]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const script = homeScripts[scriptIndex];
  const storyBeats = script.beats;
  const feedRef = useRef<HTMLDivElement>(null);
  const savedScripts = useRef<Record<number, { beat: number; liked: boolean; messages: WorldMessage[]; draft: string }>>({});
  const [view, setView] = useState<View>('world');
  useEffect(()=>{if(view==='world')track('story_enter',{world:script.title});},[view,script.title]);
  const [previousView, setPreviousView] = useState<View>('world');
  const [beat, setBeat] = useState(0);
  const [liked, setLiked] = useState(false);
  const [sound, setSound] = useState(false);
  const musicRef = useRef<HTMLAudioElement>(null);
  const [notice, setNotice] = useState('');
  const [homePanel, setHomePanel] = useState<HomePanel>(null);
  const [homeMode, setHomeMode] = useState<'novel' | 'dialogue'>('novel');
  const [homeDraft, setHomeDraft] = useState('');
  const [inspirationCursor, setInspirationCursor] = useState(0);
  const [storyAction, setStoryAction] = useState<StoryAction>(null);
  const [rewriteVersion, setRewriteVersion] = useState(0);
  const [worldMessages, setWorldMessages] = useState<WorldMessage[]>(initialWorldMessages);
  const messagesState = useMessagesState();
  const worldTools = useWorldTools();
  const agentLibrary = useAgentLibrary();
  const { profile } = useLocalProfile();
  const [activeAgent, setActiveAgent] = useState<AgentProfile | null>(null);
  const [agentReturnView, setAgentReturnView] = useState<'agent' | 'profile'>('agent');
  const [mineRequest, setMineRequest] = useState(0);
  const [forumPosts, setForumPosts] = useState(initialForumPosts);
  const [forumFocus, setForumFocus] = useState<ForumFocusRequest | null>(null);
  const [personalSection, setPersonalSection] = useState<'智能体' | '故事' | '动态' | '记忆簿'>('智能体');
  const [commentsByWorld, setCommentsByWorld] = useState<Record<string, WorldComment[]>>({});
  const [savedStories, setSavedStories] = useState<HomeScript[]>([]);
  const [worldReplyError, setWorldReplyError] = useState('');
  const [worldReplyBusy, setWorldReplyBusy] = useState(false);
  const worldReplyLock = useRef(false);
  const worldReplyController = useRef<AbortController | null>(null);
  const worldTurn = useRef<{ requestId: string; action: string; prompt: string } | null>(null);
  const [worldLoading, setWorldLoading] = useState(false);
  const [worldStage, setWorldStage] = useState(0);
  const worldGeneration = useRef(0);
  const diamondControl = useDiamondWallet();
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has('welcome')) setView('agent');
  }, []);
  useEffect(() => {
    worldGeneration.current++;
    worldReplyController.current?.abort(); worldReplyController.current = null;
    worldReplyLock.current = false; setWorldReplyBusy(false); setStoryAction(null);
    worldTurn.current = null;
    if (!account.data?.authenticated) return;
    const controller = new AbortController(); setWorldLoading(true);
    const ids: Record<string, number> = { '许朝': 1, '岚川': 2, '沈羡安': 3, '傅甘': 4, '傅砚辞': 5, '苏眠': 6 };
    fetch(`/api/chat?characterId=${ids[script.name] ?? 2}&world=${encodeURIComponent(script.title)}`, { signal: controller.signal, headers:testHeaders() })
      .then(async response => { const data = await response.json() as { messages?: { role: string; content: string }[]; stage?: number; error?: string; unfinished?: { requestId: string; prompt: string; action: string; status: string } | null }; if (!response.ok) throw new Error(data.error || '剧情暂时无法读取'); return data; })
      .then(data => {
        if (controller.signal.aborted) return;
        const restored = data.messages?.length ? data.messages.map((message, index) => ({ id: index + 1, user: message.role === 'user', name: message.role === 'user' ? '你' : script.name, avatar: message.role === 'user' ? avatarImages.user : script.avatar, text: message.content })) : script.messages;
        if (data.unfinished) {
          const { requestId, prompt, action, status } = data.unfinished;
          worldTurn.current = { requestId, prompt, action };
          setWorldMessages([...restored, { id: Date.now(), user: true, name: '你', avatar: avatarImages.user, text: prompt }]);
          setWorldReplyError(status === 'pending' ? '上一条消息仍在处理中，请稍后重试获取结果。' : '上一条消息没有完成，已恢复，可以重试。');
        } else { setWorldMessages(restored); setWorldReplyError(''); }
        setBeat(0); setWorldStage(data.stage ?? 0);
      })
      .catch(e => { if (!controller.signal.aborted) setWorldReplyError(e instanceof Error ? e.message : '剧情读取失败'); })
      .finally(() => { if (!controller.signal.aborted) setWorldLoading(false); });
    return () => controller.abort();
  }, [script.title, script.name, script.avatar, account.data?.authenticated]);
  useEffect(() => {
    const title = new URL(window.location.href).searchParams.get('world');
    const shared = title ? sharedWorldScript(title) : undefined;
    if (shared) {
      // oxlint-disable-next-line react/react-compiler -- Resolve the public entry URL after hydration without exposing browser state to server rendering.
      setDetailScript(shared); setPreviousView('world'); setView('detail');
    }
  }, []);
  useEffect(() => () => worldReplyController.current?.abort(), []);
  useEffect(() => {
    if (view !== 'world') musicRef.current?.pause();
  }, [view]);

  async function toggleMusic() {
    const audio = musicRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    audio.volume = 0.5;
    try { await audio.play(); }
    catch { setSound(false); flash('音乐暂时无法播放，请再次点击声音按钮重试'); }
  }
  useEffect(() => {
    if (view === 'world' && feedRef.current) feedRef.current.scrollTop = scriptIndex * feedRef.current.clientHeight;
  }, [view]);

  function selectScript(index: number) {
    if (index === scriptIndex || storyAction || homePanel || worldReplyLock.current) return;
    savedScripts.current[scriptIndex] = { beat, liked, messages: worldMessages, draft: homeDraft };
    const saved = savedScripts.current[index];
    setScriptIndex(index);
    setBeat(saved?.beat ?? 0);
    setLiked(saved?.liked ?? false);
    setWorldMessages(saved?.messages ?? homeScripts[index].messages);
    setHomeDraft(saved?.draft ?? '');
    setRewriteVersion(0);
    setWorldReplyError('');
  }

  function openOverlay(next: View) {
    if (worldReplyLock.current) { flash('角色正在回复，收到后即可切换'); return; }
    if (next === 'detail') setDetailScript(script);
    if (next === 'forum') setForumFocus(null);
    setHomePanel(null);
    setPreviousView(view);
    setView(next);
  }

  function openDiscoverWorld(card: (typeof discoverCards)[number]) {
    const existing = homeScripts.find(item => item.title === card.title);
    setDetailScript(existing ?? discoverWorldScript(card));
    setHomePanel(null);
    setPreviousView('discover');
    setView('detail');
  }

  function enterDetailWorld() {
    const existingIndex = homeScripts.findIndex(item => item.title === detailScript.title);
    if (existingIndex >= 0) selectScript(existingIndex);
    else {
      setHomeScripts(current => current.map((item, index) => index === scriptIndex ? detailScript : item));
      delete savedScripts.current[scriptIndex];
      setBeat(0); setLiked(false); setWorldMessages(detailScript.messages); setHomeDraft(''); setRewriteVersion(0);
    }
    setView('world');
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  }

  function addWorldComment(copy: string) {
    const clean = copy.trim();
    if (!clean) return;
    setCommentsByWorld((current) => ({
      ...current,
      [script.title]: [
        ...(current[script.title] ?? initialWorldComments),
        { id: Date.now(), author: profile.name, copy: clean, likes: 0, liked: false, avatar: profile.avatar },
      ],
    }));
    flash('留言已发布到本次会话');
  }

  function toggleWorldCommentLike(commentId: number) {
    setCommentsByWorld((current) => ({
      ...current,
      [script.title]: (current[script.title] ?? initialWorldComments).map((comment) =>
        comment.id === commentId
          ? { ...comment, liked: !comment.liked, likes: comment.likes + (comment.liked ? -1 : 1) }
          : comment,
      ),
    }));
  }

  function resetCurrentWorldConversation() {
    setHomePanel(null);
    if (worldReplyLock.current) { flash('请等待当前回复完成。'); return; }
    setHomeDraft('我们从一个新的场景开始吧，保留彼此已经发生过的故事。');
    flash('新场景提示已填入输入框，发送后推进新剧情。');
  }

  function continueStory() {
    if (storyAction || worldReplyLock.current) return;
    const history = [...worldMessages, { id: Date.now(), name: '你', avatar: avatarImages.user, user: true, text: '请接着刚才的情节继续，让故事向前发展，留一个选择给我。' }];
    setWorldMessages(history); setStoryAction('continue');
    void requestWorldReply(history, 'continue');
  }

  function rewriteStory() {
    if (storyAction || worldReplyLock.current) return;
    const history = [...worldMessages, { id: Date.now(), name: '你', avatar: avatarImages.user, user: true, text: '请换一种表达重新回复刚才那一段，保持角色和已经发生的剧情。' }];
    setWorldMessages(history); setStoryAction('rewrite');
    void requestWorldReply(history, 'rewrite');
  }

  function insertInspiration() {
    setHomeDraft(script.title === defaultHomeScripts[0].title ? quickInspirations[inspirationCursor] : `我望向${script.name}，轻声问：“如果我愿意留下，你会怎么回答？”`);
    setHomeMode('novel');
    setInspirationCursor((current) => (current + 1) % quickInspirations.length);
    flash('已填入一条剧情灵感，可直接修改或发送');
  }

  async function shareWorld(mode: ShareTarget, note = '', style: ShareStyle = 'night', hideName = false) {
    const latestLine = worldMessages[worldMessages.length - 1]?.text ?? storyBeats[beat].line;
    const platformNames: Record<ShareTarget, string> = { wechat: '微信好友', moments: '朋友圈', qq: 'QQ', weibo: '微博', system: '更多应用', copy: '复制链接', save: '保存图片' };
    const shareData = {
      title: `kirakira · ${script.title}`,
      text: `${note ? `${note}\n` : ''}${storyBeats[beat].narration}\n${latestLine}`,
      url: worldShareUrl(window.location.href, script.title),
    };

    if (mode === 'save') {
      try {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('image load failed'));
          image.src = script.image;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1440;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas unavailable');
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
        const sourceWidth = canvas.width / scale;
        const sourceHeight = canvas.height / scale;
        context.drawImage(image, (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
        const washes: Record<ShareStyle, [string, string]> = {
          night: ['rgba(9,5,15,.12)', 'rgba(8,5,12,.95)'],
          paper: ['rgba(255,239,229,.10)', 'rgba(51,26,33,.92)'],
          film: ['rgba(30,12,13,.08)', 'rgba(20,7,11,.94)'],
        };
        const gradient = context.createLinearGradient(0, 80, 0, 1440);
        gradient.addColorStop(0, washes[style][0]);
        gradient.addColorStop(.5, 'rgba(8,5,11,.18)');
        gradient.addColorStop(1, washes[style][1]);
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const drawWrappedText = (text: string, y: number, font: string, color: string, lineHeight: number, maxLines: number, maxWidth = 920) => {
          context.font = font;
          context.fillStyle = color;
          const characters = [...text];
          const lines: string[] = [];
          let line = '';
          for (const character of characters) {
            const candidate = line + character;
            if (context.measureText(candidate).width > maxWidth && line) {
              lines.push(line);
              line = character;
              if (lines.length === maxLines) break;
            } else line = candidate;
          }
          if (lines.length < maxLines && line) lines.push(line);
          if (lines.join('').length < characters.length && lines.length) {
            let last = lines[lines.length - 1];
            while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
            lines[lines.length - 1] = `${last}…`;
          }
          lines.slice(0, maxLines).forEach((copy, row) => context.fillText(copy, 72, y + row * lineHeight));
        };

        drawWrappedText(`KIRAKIRA · ${script.title}`, 92, '700 30px sans-serif', '#ff83b2', 40, 2);
        drawWrappedText(script.title, 920, '700 60px sans-serif', '#ffffff', 70, 2);
        drawWrappedText(note || storyBeats[beat].narration, 1060, '34px sans-serif', 'rgba(255,255,255,.72)', 50, 2);
        drawWrappedText(latestLine, 1190, '700 36px sans-serif', '#ffffff', 52, 2);
        context.font = '28px sans-serif';
        context.fillStyle = 'rgba(255,255,255,.68)';
        context.fillText(hideName ? '来自一位世界旅人' : '@KK 的世界', 72, 1380);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('image export failed');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `kirakira-${script.title}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
        setHomePanel(null);
        flash('分享卡已保存到设备');
      } catch {
        flash('分享卡图片生成失败，请检查封面图片后重试');
      }
      return;
    }

    if (mode !== 'copy' && navigator.share) {
      try {
        await navigator.share(shareData);
        setHomePanel(null);
        flash(`已打开${platformNames[mode]}分享`);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    if (!await copyShareText(shareData.url)) { flash('链接没有复制成功，请检查浏览器剪贴板权限后重试'); return; }
    setHomePanel(null);
    flash(mode === 'copy' ? '世界链接已复制' : `当前浏览器无法直达${platformNames[mode]}，链接已复制`);
  }

  async function requestWorldReply(history: WorldMessage[], action = 'message') {
    if (worldReplyLock.current) return;
    if (!account.data?.authenticated) { setWorldReplyError('请先注册 / 登录，保存并继续你的故事。'); setStoryAction(null); return; }
    if (worldLoading) { setWorldReplyError('正在恢复剧情，请稍等。'); setStoryAction(null); return; }
    worldReplyLock.current = true;
    setWorldReplyBusy(true); setWorldReplyError('');
    const controller = new AbortController();
    const generation = worldGeneration.current;
    worldReplyController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    const characterIds: Record<string, number> = { '许朝': 1, '岚川': 2, '沈羡安': 3, '傅甘': 4, '傅砚辞': 5, '苏眠': 6 };
    const prompt = history.at(-1)?.text ?? '';
    if (!worldTurn.current || worldTurn.current.prompt !== prompt) worldTurn.current = { requestId: crypto.randomUUID(), action, prompt };
    track(action==='rewrite'?'regenerate':action==='continue'?'chat_continue':'chat_send',{world:script.title},{message_id:worldTurn.current.requestId,trace_id:`trace:${worldTurn.current.requestId}`});
    try {
      await flushEvents();
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...testHeaders() }, signal: controller.signal,
        body: JSON.stringify({ characterId: characterIds[script.name] ?? 2, world: script.title, context: script.beats[0].narration, ...worldTurn.current }),
      });
      const data = await response.json() as { reply?: string; error?: string; stage?: number;ids?:{message_id:string;trace_id:string};freeTokenUsed?:boolean;premiumFeatureUsed?:boolean };
      if (generation !== worldGeneration.current) return;
      if (!response.ok || !data.reply?.trim()) throw new Error(data.error || '没有收到回复，请重试');
      setWorldMessages([...history, { id: Date.now(), name: script.name, avatar: script.avatar, text: data.reply }].slice(-10));
      const ids=eventIds(data);requestAnimationFrame(()=>{track('ai_response_show',{world:script.title},ids);if(data.freeTokenUsed)track('free_token_use',{kind:'free_reply'},ids);if(data.premiumFeatureUsed)track('premium_feature_use',{feature:'member_chat_quota'},ids);});
      if (data.stage !== undefined) setWorldStage(data.stage);
      worldTurn.current = null; window.dispatchEvent(new Event('kk-account-updated'));
    } catch (error) {
      if (generation !== worldGeneration.current) return;
      if (controller.signal.aborted && worldReplyController.current !== controller) return;
      setWorldReplyError(controller.signal.aborted ? '回复等待超时，可以重试。' : error instanceof Error ? error.message : '连接中断，请重试。');
    } finally {
      window.clearTimeout(timeout);
      if (generation === worldGeneration.current) {
        if (worldReplyController.current === controller) worldReplyController.current = null;
        worldReplyLock.current = false;
        setWorldReplyBusy(false);
        setStoryAction(null);
      }
    }
  }

  function sendWorldMessage(event: FormEvent) {
    event.preventDefault();
    const clean = homeDraft.trim();
    if (!clean || worldReplyLock.current) return;
    const userMessage: WorldMessage = { id: Date.now(), name: '你', avatar: avatarImages.user, text: clean, user: true };
    const history = [...worldMessages, userMessage].slice(-10);
    setWorldMessages(history);
    setHomeDraft('');
    void requestWorldReply(history);
  }

  return (
    <main className="app-shell">
      <audio ref={musicRef} src="/sleepy-chill.m4a" loop preload="none" onPlay={() => setSound(true)} onPause={() => setSound(false)} onError={() => { setSound(false); flash('音乐加载失败，请稍后重试'); }} />
      <section className={`phone-stage view-${view} world-theme-${worldTools.theme} world-font-${worldTools.fontSize}`} aria-label="kirakira 可交互原型">
        {notice && <div className="toast" role="status"><Sparkles />{notice}</div>}
        {view === 'world' && (
          <div ref={feedRef} className="home-script-feed" style={{ overflowY: homePanel || storyAction || worldReplyBusy ? 'hidden' : 'auto' }} onScroll={(event) => {
            const feed = event.currentTarget;
            selectScript(Math.max(0, Math.min(4, Math.round(feed.scrollTop / feed.clientHeight))));
          }}>
          {homeScripts.map((item, index) => <section className="home-script-page" key={item.title} aria-label={`${index + 1} / 5 ${item.title}`}>
          {index === scriptIndex ? <>
          <WorldView
            stage={worldStage}
            script={script}
            beat={beat}
            liked={liked}
            sound={sound}
            likeCount={liked ? 530 : 529}
            messages={worldMessages}
            panel={homePanel}
            mode={homeMode}
            draft={homeDraft}
            storyAction={storyAction}
            onContinue={continueStory}
            onRewrite={rewriteStory}
            onLike={() => setLiked((value) => !value)}
            onSound={() => { void toggleMusic(); }}
            onOpen={openOverlay}
            onFlash={flash}
            onPanel={setHomePanel}
            onShare={shareWorld}
            onInspiration={insertInspiration}
            onMode={setHomeMode}
            onDraft={setHomeDraft}
            onSend={sendWorldMessage}
            replyBusy={worldReplyBusy || worldLoading}
            replyError={worldReplyError}
            onRetry={() => void requestWorldReply(worldMessages)}
            worldTools={worldTools}
            comments={commentsByWorld[script.title] ?? initialWorldComments}
            onAddComment={addWorldComment}
            onToggleCommentLike={toggleWorldCommentLike}
            onReset={resetCurrentWorldConversation}
          />
          </> : <img className="script-placeholder" src={item.image} alt={item.title} />}
          </section>)}
          </div>
        )}
        {view === 'discover' && <DiscoverView onSelect={openDiscoverWorld} onCreate={() => { setActiveAgent(null); setView('llm'); }} />}
        <div hidden={view !== 'agent' && view !== 'llm'}><AgentStudio library={agentLibrary} active={view === 'agent' || view === 'llm' ? activeAgent : null} mineRequest={mineRequest} backLabel={agentReturnView === 'profile' ? '返回我的' : '返回创作者中心'} onSelect={agent => { setActiveAgent(agent); setAgentReturnView('agent'); }} onBack={() => { setActiveAgent(null); if (agentReturnView === 'profile') setView('profile'); }} /></div>
        {view === 'community' && <MessagesView state={messagesState} />}
        <div hidden={view !== 'forum'}><ForumView active={view === 'forum'} posts={forumPosts} setPosts={setForumPosts} currentWorld={script} focusRequest={forumFocus} onBack={forumFocus ? () => { setForumFocus(null); setView('profile'); } : undefined} onOpen={openOverlay} onFlash={flash} onWorld={post => {
          if (post.worldSnapshot) { setDetailScript(post.worldSnapshot); setPreviousView('forum'); setView('detail'); return; }
          const card = discoverCards.find(card => card.title === post.world);
          if (card) { openDiscoverWorld(card); setPreviousView('forum'); }
          else { setDetailScript({ ...defaultHomeScripts[0], title: post.world ?? '雨夜来信', image: post.images[0] ?? defaultHomeScripts[0].image }); setPreviousView('forum'); setView('detail'); }
        }} /></div>
        {view === 'profile' && <PersonalView
          control={diamondControl}
          initialSection={personalSection}
          agents={agentLibrary.agents}
          agentsStatus={agentLibrary.status}
          agentsError={agentLibrary.error}
          onRetryAgents={() => void agentLibrary.refresh()}
          stories={savedStories.map(story => ({ title: story.title, image: story.image, summary: story.beats[0].narration }))}
          posts={forumPosts.filter(post => post.isMine).map(post => ({ id: post.id, copy: post.copy, images: post.images, date: post.date, likes: post.likes, commentsCount: post.comments.length }))}
          memories={worldTools.memories}
          followingCount={new Set(forumPosts.filter(post => post.subscribed && !post.isMine).map(post => post.handle)).size}
          onAgents={() => { setActiveAgent(null); setMineRequest(value => value + 1); setView('agent'); }}
          onOpenAgent={id => { const agent = agentLibrary.agents.find(item => item.id === id); if (agent) { setPersonalSection('智能体'); setActiveAgent(agent); setAgentReturnView('profile'); setView('agent'); } }}
          onOpenStory={title => { const story = savedStories.find(item => item.title === title); if (story) { setPersonalSection('故事'); setDetailScript(story); setPreviousView('profile'); setView('detail'); } }}
          onOpenPost={postId => { setPersonalSection('动态'); setForumFocus(current => ({ postId, sequence: (current?.sequence ?? 0) + 1 })); setView('forum'); }}
          onRemoveMemory={worldTools.removeMemory}
          onWallet={() => openOverlay('membership')}
          onWorld={() => setView('world')}
          onForum={() => { setForumFocus(null); setView('forum'); }}
        />}
        {view === 'membership' && <CommerceView onBack={() => setView(previousView)} onExplore={() => { setActiveAgent(null); setView('agent'); }} />}
        <div hidden={view !== 'phone'}><VirtualPhone onClose={() => setView(previousView)} /></div>
        {view === 'detail' && <DetailView
          script={detailScript}
          saved={savedStories.some(story => story.title === detailScript.title)}
          onBack={() => setView(previousView)}
          onEnter={enterDetailWorld}
          onToggleSaved={() => setSavedStories(current => current.some(story => story.title === detailScript.title) ? current.filter(story => story.title !== detailScript.title) : [...current, structuredClone(detailScript)])}
          onFlash={flash}
        />}

        {view === 'world' && <AccountEntry onOpen={() => setView('profile')} />}
        {!['phone', 'detail', 'membership'].includes(view) && <BottomNav view={view} unread={messagesState.unreadCount} onChange={next => { if (next === 'llm') setActiveAgent(null); setView(next); }} />}
      </section>
    </main>
  );
}

function WorldView({
  stage,
  script,
  beat,
  liked,
  sound,
  likeCount,
  messages,
  panel,
  mode,
  draft,
  storyAction,
  onContinue,
  onRewrite,
  onLike,
  onSound,
  onOpen,
  onFlash,
  onPanel,
  onShare,
  onInspiration,
  onMode,
  onDraft,
  onSend,
  replyBusy,
  replyError,
  onRetry,
  worldTools,
  comments,
  onAddComment,
  onToggleCommentLike,
  onReset,
}: {
  stage: number;
  script: (typeof defaultHomeScripts)[number];
  beat: number;
  liked: boolean;
  sound: boolean;
  likeCount: number;
  messages: WorldMessage[];
  panel: HomePanel;
  mode: 'novel' | 'dialogue';
  draft: string;
  storyAction: StoryAction;
  onContinue: () => void;
  onRewrite: () => void;
  onLike: () => void;
  onSound: () => void;
  onOpen: (view: View) => void;
  onFlash: (message: string) => void;
  onPanel: (panel: HomePanel) => void;
  onShare: (mode: ShareTarget, note?: string, style?: ShareStyle, hideName?: boolean) => void;
  onInspiration: () => void;
  onMode: (mode: 'novel' | 'dialogue') => void;
  onDraft: (value: string) => void;
  onSend: (event: FormEvent) => void;
  replyBusy: boolean;
  replyError: string;
  onRetry: () => void;
  worldTools: WorldToolsState;
  comments: WorldComment[];
  onAddComment: (copy: string) => void;
  onToggleCommentLike: (commentId: number) => void;
  onReset: () => void;
}) {
  const story = script.beats[beat];
  const messageListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const list = messageListRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, beat, script.title]);
  const shortcuts = [
    { label: '看 TA 手机', icon: Smartphone, action: () => onOpen('phone'), tone: 'coral' },
    { label: '论坛', icon: Users, action: () => onOpen('forum'), tone: 'blue' },
    { label: '朗读', icon: Volume2, action: () => onPanel('call'), tone: 'green' },
    { label: '钻石中心', icon: Gem, action: () => onOpen('membership'), tone: 'pink' },
    { label: '微聊', icon: MessageCircle, action: () => onOpen('phone'), tone: 'mint' },
    { label: '朋友', icon: Orbit, action: () => onPanel('friends'), tone: 'rainbow' },
    { label: '更多', icon: Grid2X2, action: () => onPanel('more'), tone: 'gray' },
  ];
  return (
    <div className={`screen immersive-screen world-theme-${worldTools.theme} world-font-${worldTools.fontSize}`}>
      <img
        className="scene-image"
        src={script.image}
        alt={script.title}
      />
      <div className="scene-wash" />
      <div className="rain" aria-hidden="true" />
      <span className="ai-disclaimer">AI 虚构角色 · {stage > 0 ? `已保存 ${stage} 轮剧情` : '开启你的故事'}</span>

      <header className="scene-header">
        <button className="world-chip" aria-label="打开世界详情" onClick={() => onOpen('detail')}>
          <img className="avatar" src={script.avatar} alt={`${script.name}头像`} />
          <span><b>{script.title}</b><small>2.0w 次共鸣</small></span>
          <ChevronRight />
        </button>
        <div className="header-actions">
          <button className={`metric-action ${liked ? 'is-liked' : ''}`} aria-label="共鸣" onClick={onLike}><Heart fill={liked ? 'currentColor' : 'none'} /><span>{likeCount}</span></button>
          <button className="metric-action" aria-label="打开评论" onClick={() => onPanel('comments')}><MessageCircle /><span>{comments.length}</span></button>
          <Button aria-label={sound ? '暂停背景音乐' : '播放背景音乐'} aria-pressed={sound} title="Sleepy Chill（裂空调）" variant="ghost" size="icon-lg" onClick={onSound}>{sound ? <Volume2 /> : <VolumeX />}</Button>
          <Button aria-label="打开设置" variant="ghost" size="icon-lg" onClick={() => onPanel('settings')}><Settings2 /></Button>
        </div>
      </header>

      <section className="world-story-stack" aria-live="polite">
        <p className="world-opening">{story.narration}</p>
        <div ref={messageListRef} className="role-message-list">
          {messages.map((message) => (
            <article className={`role-message ${message.user ? 'user-message' : ''}`} key={message.id}>
              <header>
                <img className="role-avatar" src={message.avatar} alt={`${message.name}头像`} />
                <b>{message.name}</b>
              </header>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="world-control-deck">
        <div className="world-actions">
          <button disabled={Boolean(storyAction) || replyBusy} onClick={onContinue} aria-busy={storyAction === 'continue'}>{storyAction === 'continue' ? <Sparkles className="action-spinner" /> : <span>▶▶</span>}{storyAction === 'continue' ? '生成中' : '继续'}</button>
          <button disabled={Boolean(storyAction) || replyBusy} onClick={onRewrite} aria-busy={storyAction === 'rewrite'}><RotateCcw className={storyAction === 'rewrite' ? 'action-spinner' : ''} />{storyAction === 'rewrite' ? '生成中' : '重说'}</button>
          <button onClick={() => onPanel('share')}><Share2 />分享</button>
          <button onClick={onInspiration}><Lightbulb />灵感</button>
          <MultimodalStudio compact initialPrompt={`${script.name}，${story.narration}，精致二次元插画`} />
          <span className="participant-pile">{script.messages.slice(0, 3).map(role => <i key={role.name}><img src={role.avatar} alt={role.name} /></i>)}<b>{script.messages.length}</b></span>
        </div>

        <div className="world-shortcut-row">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return <button key={shortcut.label} onClick={shortcut.action}><span className={`shortcut-icon ${shortcut.tone}`}><Icon /></span><small>{shortcut.label}</small></button>;
          })}
        </div>

        {replyBusy && <p className="world-reply-status" role="status">{script.name}正在回复…</p>}
        {replyError && <p className="world-reply-status" role="alert">{replyError}<button onClick={onRetry} disabled={replyBusy}>重试回复</button></p>}
        <form className="world-composer" onSubmit={onSend}>
          <button type="button" className="mode-toggle" onClick={() => onMode(mode === 'novel' ? 'dialogue' : 'novel')}>
            <b>{mode === 'novel' ? '小说' : '对话'}</b><small>{mode === 'novel' ? '对话' : '小说'}</small>
          </button>
          <input value={draft} maxLength={1000} onChange={(event) => onDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="自由输入…" aria-label="输入剧情内容" />
          <button type="button" className="composer-tool" aria-label="插入动作" onClick={() => onDraft(`${draft}（轻声）`)}>（）</button>
          <VoiceInput className="composer-tool" disabled={replyBusy} onText={text => onDraft(`${draft}${draft ? ' ' : ''}${text}`.slice(0, 1000))} />
          <button type="submit" className="composer-tool send-home" disabled={replyBusy || !draft.trim()} aria-label="发送"><Send /></button>
        </form>
      </section>

      {panel && <WorldSheet
        script={script}
        panel={panel}
        story={story}
        messages={messages}
        comments={comments}
        commentCount={comments.length}
        worldTools={worldTools}
        sound={sound}
        onSound={onSound}
        onClose={() => onPanel(null)}
        onOpen={onOpen}
        onAddComment={onAddComment}
        onToggleCommentLike={onToggleCommentLike}
        onReset={onReset}
        onShare={onShare}
      />}
    </div>
  );
}

function WorldSheet({ script, panel, story, messages, comments, commentCount, worldTools, sound, onSound, onClose, onOpen, onAddComment, onToggleCommentLike, onReset, onShare }: {
  script: (typeof defaultHomeScripts)[number];
  panel: Exclude<HomePanel, null>;
  story: (typeof storyBeats)[number];
  messages: WorldMessage[];
  comments: WorldComment[];
  commentCount: number;
  worldTools: WorldToolsState;
  sound: boolean;
  onSound: () => void;
  onClose: () => void;
  onOpen: (view: View) => void;
  onAddComment: (copy: string) => void;
  onToggleCommentLike: (commentId: number) => void;
  onReset: () => void;
  onShare: (mode: ShareTarget, note?: string, style?: ShareStyle, hideName?: boolean) => void;
}) {
  const [commentDraft, setCommentDraft] = useState('');
  const [shareStyle, setShareStyle] = useState<ShareStyle>('night');
  const [shareNote, setShareNote] = useState('雨停之前，我想把这段故事分享给你。');
  const [shareReady, setShareReady] = useState(false);
  const [hideShareName, setHideShareName] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titles = { comments: `共鸣留言 · ${commentCount}`, call: '台词朗读', friends: '世界朋友', more: '世界工具', share: '分享这一刻', settings: '世界设置' };
  const tools = {
    state: worldTools,
    world: { title: script.title, image: script.image, name: script.name, avatar: script.avatar },
    messages,
    sound,
    onSound,
    onPhone: () => onOpen('phone'),
    onWallet: () => onOpen('membership'),
    onAgents: () => onOpen('agent'),
    onForum: () => onOpen('forum'),
    onReset,
  };
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>('[data-sheet-close]')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  function handleSheetKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !sheetRef.current) return;
    const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) {
      event.preventDefault();
      sheetRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={`world-sheet-backdrop ${panel === 'settings' ? 'settings-backdrop' : ''}`} onClick={onClose}>
      <section ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="world-sheet-title" tabIndex={-1} className={`world-sheet panel-${panel}`} onKeyDown={handleSheetKeyDown} onClick={(event) => event.stopPropagation()}>
        <header><div><small>当前世界</small><h3 id="world-sheet-title">{titles[panel]}</h3></div><button type="button" data-sheet-close aria-label={`关闭${titles[panel]}`} onClick={onClose}><X /></button></header>
        {panel === 'comments' && <div className="sheet-comments">
          {comments.map((comment) => <article key={comment.id}><img src={comment.avatar} alt={`${comment.author}头像`} /><p><b>{comment.author}</b>{comment.copy}</p><button type="button" className={comment.liked ? 'is-liked' : ''} aria-pressed={comment.liked} onClick={() => onToggleCommentLike(comment.id)}><Heart fill={comment.liked ? 'currentColor' : 'none'} />{comment.likes}</button></article>)}
          <form onSubmit={(event) => { event.preventDefault(); const clean = commentDraft.trim(); if (!clean) return; onAddComment(clean); setCommentDraft(''); }}><input aria-label="留言内容" maxLength={160} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="写下你的共鸣…" /><button type="submit" disabled={!commentDraft.trim()} aria-label="发布留言"><Send /></button></form>
        </div>}
        {panel === 'call' && <><VoiceReader text={[...messages].reverse().find(message => !message.user)?.text ?? story.line} /><WorldTools {...tools} section="audio" /></>}
        {panel === 'friends' && <div className="sheet-friends">
          {[['岚川', '刚刚', '正在等你的回复', avatarImages.lanchuan], ['苏眠', '2 分钟前', '更新了一条日记', avatarImages.sumian], ['许昼寻', '8 分钟前', '在论坛回复了你', avatarImages.xuzhouxun]].map((friend) => <button key={friend[0]} onClick={() => { onClose(); onOpen('phone'); }}><img src={friend[3]} alt={`${friend[0]}头像`} /><p><b>{friend[0]}</b><small>{friend[2]}</small></p><em>{friend[1]}</em><ChevronRight /></button>)}
        </div>}
        {panel === 'share' && <div className={`sheet-share ${shareReady ? 'share-ready' : ''}`}>
          <div className={`share-poster share-theme-${shareStyle}`}>
            <img src={script.image} alt={`${script.title}分享卡背景`} />
            <span className="share-poster-shade" />
            <div className="share-poster-brand"><Sparkles /><span><b>kirakira</b><small>沉浸式角色世界</small></span></div>
            <div className="share-poster-copy">
              <small>{script.title} · 恋爱剧情</small>
              <h4>{script.title}</h4>
              <p>{story.narration}</p>
              <b>{messages[messages.length - 1]?.text ?? story.line}</b>
              {shareNote && <em>“{shareNote}”</em>}
            </div>
            <div className="share-poster-foot"><span>{hideShareName ? '来自一位世界旅人' : '@KK 的世界'}</span><span>打开 kirakira 进入剧情 <ChevronRight /></span></div>
          </div>

          {!shareReady ? <>
            <div className="share-style-picker" aria-label="分享卡样式">
              {([['night', '夜雨'], ['paper', '暖纸'], ['film', '胶片']] as const).map(([style, label]) => <button aria-pressed={shareStyle === style} className={shareStyle === style ? 'selected' : ''} key={style} onClick={() => setShareStyle(style)}><span className={`share-style-thumb ${style}`} /><small>{label}</small></button>)}
            </div>
            <label className="share-note-input"><span>分享捎话</span><textarea maxLength={60} value={shareNote} onChange={(event) => setShareNote(event.target.value)} placeholder="写一句想对朋友说的话…" /><small>{shareNote.length}/60</small></label>
            <button className="share-name-toggle" aria-pressed={hideShareName} onClick={() => setHideShareName((value) => !value)}><span><b>隐藏我的昵称</b><small>分享卡仅显示“世界旅人”</small></span><i className={`setting-switch ${hideShareName ? 'on' : ''}`} /></button>
            <button className="share-generate" onClick={() => setShareReady(true)}><Sparkles />生成分享卡</button>
          </> : <>
            <div className="share-target-title"><b>分享至</b><small>分享卡已生成</small></div>
            <div className="share-targets">
              <button onClick={() => onShare('wechat', shareNote, shareStyle, hideShareName)}><span className="share-target wechat">微</span><small>微信</small></button>
              <button onClick={() => onShare('moments', shareNote, shareStyle, hideShareName)}><span className="share-target moments">圈</span><small>朋友圈</small></button>
              <button onClick={() => onShare('qq', shareNote, shareStyle, hideShareName)}><span className="share-target qq">Q</span><small>QQ</small></button>
              <button onClick={() => onShare('weibo', shareNote, shareStyle, hideShareName)}><span className="share-target weibo">博</span><small>微博</small></button>
            </div>
            <div className="share-utilities">
              <button onClick={() => onShare('save', shareNote, shareStyle, hideShareName)}><Download /><span><b>保存图片</b><small>保存完整分享卡</small></span><ChevronRight /></button>
              <button onClick={() => onShare('copy', shareNote, shareStyle, hideShareName)}><Copy /><span><b>复制链接</b><small>复制当前世界地址</small></span><ChevronRight /></button>
              <button onClick={() => onShare('system', shareNote, shareStyle, hideShareName)}><Share2 /><span><b>更多应用</b><small>打开系统分享菜单</small></span><ChevronRight /></button>
            </div>
            <button className="share-edit" onClick={() => setShareReady(false)}>返回编辑分享卡</button>
          </>}
          <p className="share-privacy">链接打开对应世界的开场，不包含私人对话。分享卡包含上方展示的剧情与最新一句对话，发送前请检查内容。</p>
        </div>}
        {panel === 'settings' && <WorldTools {...tools} section="settings" />}
        {panel === 'more' && <WorldTools {...tools} section="menu" />}
      </section>
    </div>
  );
}

function DiscoverView({ onSelect, onCreate }: { onSelect: (card: (typeof discoverCards)[number]) => void; onCreate: () => void }) {
  const [moduleName, setModuleName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<'广场' | '精选'>('广场');
  const [category, setCategory] = useState('全部');
  const [tag, setTag] = useState('所有标签');
  const [sort, setSort] = useState('推荐');
  const categories = ['全部', '剧情', '恋爱', '女性向', '古风', '无限流', '治愈'];
  const tags = ['所有标签', '#现代', '#反差', '#温柔', '#甜宠', '#年上', '#偏执', '#群像', '#宿命'];

  const visibleCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = discoverCards.filter((card) => {
      const matchesQuery = !normalized || `${card.title}${card.excerpt}${card.author}${card.category}${card.tags.join('')}`.toLowerCase().includes(normalized);
      const matchesSection = section === '广场' || card.featured;
      const matchesCategory = category === '全部' || card.category === category;
      const matchesTag = tag === '所有标签' || card.tags.includes(tag);
      return matchesQuery && matchesSection && matchesCategory && matchesTag;
    });
    if (sort === '最新') return [...filtered].reverse();
    if (sort === '最热') return [...filtered].sort((a, b) => b.likes - a.likes);
    if (sort === '高共鸣') return [...filtered].sort((a, b) => b.replies - a.replies);
    return filtered;
  }, [category, query, section, sort, tag]);

  if (moduleName) return <DiscoveryPlay key={moduleName} name={moduleName} worlds={discoverCards} onBack={() => setModuleName(null)} onWorld={title => { const card = discoverCards.find(c => c.title === title); if (card) onSelect(card); }} />;
  return (
    <div className="screen scroll-screen discover-screen">
      <label className="discover-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索角色、世界或作者" />{query && <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}><X /></button>}</label>

      <section className="discover-module-grid" aria-label="发现玩法">
        {discoverModules.map((module) => <button key={module.name} onClick={() => module.name === '创作中心' ? onCreate() : setModuleName(module.name)}>
          <span className={`module-icon ${module.tone}`}><img src={module.icon} alt="" />{module.fresh && <i>NEW</i>}</span>
          <small>{module.name}</small>
        </button>)}
      </section>

      <div className="discover-sections" role="tablist" aria-label="内容频道">
        {(['广场', '精选'] as const).map((item) => <button role="tab" aria-selected={section === item} className={section === item ? 'selected' : ''} key={item} onClick={() => setSection(item)}>{item}</button>)}
      </div>

      <div className="discover-categories" aria-label="内容分类">
        {categories.map((item) => <button aria-pressed={category === item} className={category === item ? 'selected' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="discover-tags" aria-label="内容标签">
        {tags.map((item) => <button aria-pressed={tag === item} className={tag === item ? 'selected' : ''} key={item} onClick={() => setTag(item)}>{item}</button>)}
      </div>
      <div className="discover-sort" aria-label="内容排序">
        {['推荐', '最新', '最热', '高共鸣'].map((item) => <button aria-pressed={sort === item} className={sort === item ? 'selected' : ''} key={item} onClick={() => setSort(item)}>{item}</button>)}
      </div>

      {visibleCards.length ? <div className="masonry-feed">
        {visibleCards.map((card) => (
          <button className="masonry-card" key={card.title} onClick={() => onSelect(card)}>
            <span className="masonry-cover" style={{ height: card.height }}>
              <img src={card.image} alt={`${card.title}世界封面`} />
              <span className="masonry-shade" />
              <span className="masonry-category">{card.category}</span>
              <span className="masonry-copy"><b>{card.title}</b><small>{card.excerpt}</small></span>
            </span>
            <span className="masonry-meta"><span><Sparkles />{card.likes}</span><span>@{card.author}</span><span><MessageCircle />{card.replies}</span></span>
          </button>
        ))}
      </div> : <div className="discover-empty"><Search /><b>没有找到相关世界</b><p>试试切换分类、标签，或搜索其他关键词。</p><button onClick={() => { setQuery(''); setCategory('全部'); setTag('所有标签'); }}>清除筛选</button></div>}
      <div className="feed-ending"><Sparkles /><span>更多世界正在生长</span></div>
    </div>
  );
}

function DetailView({ script, saved, onBack, onEnter, onToggleSaved, onFlash }: {
  script: (typeof defaultHomeScripts)[number];
  saved: boolean;
  onBack: () => void;
  onEnter: () => void;
  onToggleSaved: () => void;
  onFlash: (message: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const morePopup = useRef<HTMLDivElement>(null);

  async function shareDetail() {
    const shareData = { title: `kirakira · ${script.title}`, text: script.beats[0].narration, url: worldShareUrl(window.location.href, script.title) };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setMoreOpen(false);
        onFlash('已打开系统分享');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    if (!await copyShareText(shareData.url)) { onFlash('链接没有复制成功，请检查浏览器剪贴板权限后重试'); return; }
    setMoreOpen(false);
    onFlash('世界链接已复制');
  }

  return (
    <div className="screen detail-screen">
      <img className="detail-cover" src={script.image} alt={`${script.title}世界封面`} />
      <div className="detail-shade" />
      <header className="overlay-header"><button onClick={onBack} aria-label="返回"><ArrowLeft /></button><b>{script.title}</b><button ref={moreTrigger} aria-label="更多" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}><MoreHorizontal /></button></header>
      <div className="detail-content">
        <div className="detail-kicker"><Star fill="currentColor" />9.6 · 12.8 万人探索</div>
        <h2>{script.title}</h2>
        <p>{script.beats[0].narration}</p>
        <section>
          <h3><Users />角色信息</h3>
          <div className="character-row">
            {script.messages.map(({ name, avatar }) => <div className="character-card" key={name}><img src={avatar} alt={`${name}头像`} /><b>{name}</b><small>故事角色</small></div>)}
          </div>
        </section>
        <section className="opening-card"><h3><BookOpen />开场白</h3><p>{script.beats[0].line}</p></section>
      </div>
      <button className="fixed-cta" onClick={onEnter}>进入世界</button>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}><DialogPrimitive.Portal><DialogPrimitive.Backdrop className="kk-modal-backdrop" /><DialogPrimitive.Viewport className="kk-modal-viewport">
        <DialogPrimitive.Popup ref={morePopup} initialFocus={morePopup} finalFocus={moreTrigger} className="world-sheet kk-modal-sheet">
          <header><div><small>世界详情</small><DialogTitle render={<h3 />}>更多操作</DialogTitle></div><button onClick={() => setMoreOpen(false)} aria-label="关闭更多操作"><X /></button></header>
          <div className="sheet-more">
            <button onClick={() => { onToggleSaved(); setMoreOpen(false); onFlash(saved ? '已取消收藏' : '已收藏到本次访问'); }}><Heart fill={saved ? 'currentColor' : 'none'} /><span>{saved ? '取消收藏' : '收藏世界'}</span></button>
            <button onClick={() => void shareDetail()}><Share2 /><span>分享世界</span></button>
          </div>
          <DialogDescription className="share-privacy">收藏仅保留在本次访问中。分享链接打开对应世界的开场，不包含私人对话。世界与角色均为虚构内容。</DialogDescription>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport></DialogPrimitive.Portal></Dialog>
    </div>
  );
}

function ForumView({ active, posts, setPosts, currentWorld, focusRequest, onBack, onOpen, onFlash, onWorld }: {
  active: boolean;
  posts: ForumPost[];
  setPosts: Dispatch<SetStateAction<ForumPost[]>>;
  currentWorld: HomeScript;
  focusRequest: ForumFocusRequest | null;
  onBack?: () => void;
  onOpen: (view: View) => void;
  onFlash: (message: string) => void;
  onWorld: (post: ForumPost) => void;
}) {
  const { profile } = useLocalProfile();
  const postNodes = useRef(new Map<number, HTMLElement>());
  const composerTrigger = useRef<HTMLButtonElement | null>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'dynamic' | 'following' | 'worlds'>('dynamic');
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imagePicker, setImagePicker] = useState(false);
  const [attachWorld, setAttachWorld] = useState(true);
  function openComposer(trigger: HTMLButtonElement) {
    composerTrigger.current = trigger;
    setComposerOpen(true);
  }

  const [seenFocusRequest, setSeenFocusRequest] = useState(focusRequest);
  if (seenFocusRequest !== focusRequest) {
    setSeenFocusRequest(focusRequest);
    if (focusRequest) {
      setActiveTab('dynamic'); setQuery(''); setSearchOpen(false); setComposerOpen(false);
      setExpandedPost(focusRequest.postId);
    }
  }
  useEffect(() => {
    if (!active || !focusRequest || expandedPost !== focusRequest.postId) return;
    const frame = requestAnimationFrame(() => {
      const post = postNodes.current.get(focusRequest.postId);
      post?.scrollIntoView({ block: 'start' });
      post?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, focusRequest, expandedPost]);

  async function sharePost(post: ForumPost) {
    const text = `${post.author}：${post.copy}\n${worldShareUrl(window.location.href, post.world)}`;
    try {
      if (navigator.share) await navigator.share({ title: 'kirakira 世界动态', text });
      else { if (!await copyShareText(text)) throw new Error('复制失败'); onFlash('动态内容和链接已复制'); }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) onFlash('分享未完成，请重试'); }
  }

  const visiblePosts = posts.map(post => post.isMine ? { ...post, author: profile.name, avatar: profile.avatar } : post).filter((post) => {
    if (activeTab === 'following' && (!post.subscribed || post.isMine)) return false;
    if (activeTab === 'worlds' && !post.world) return false;
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return true;
    return `${post.author}${post.handle}${post.copy}${post.world ?? ''}`.toLowerCase().includes(cleanQuery);
  });

  function toggleLike(id: number) {
    setPosts((current) => current.map((post) => post.id === id
      ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
      : post));
  }

  function toggleSubscribe(id: number) {
    const author = posts.find(post => post.id === id);
    if (!author || author.isMine) return;
    setPosts(current => current.map(post => post.handle === author.handle ? { ...post, subscribed: !author.subscribed } : post));
  }

  function submitComment(event: FormEvent, id: number) {
    event.preventDefault();
    const clean = (commentDrafts[id] ?? '').trim();
    if (!clean) return;
    setPosts((current) => current.map((post) => post.id === id
      ? { ...post, comments: [...post.comments, { id: Date.now(), author: profile.name, copy: clean }] }
      : post));
    setCommentDrafts((current) => ({ ...current, [id]: '' }));
    onFlash('评论已发布');
  }

  function publishPost(event: FormEvent) {
    event.preventDefault();
    const clean = postDraft.trim();
    if (!clean) return;
    setPosts((current) => [{
      id: Date.now(),
      author: profile.name,
      handle: '@traveler_0618',
      date: '刚刚',
      location: '当前世界',
      avatar: profile.avatar,
      copy: clean,
      images,
      world: attachWorld ? currentWorld.title : undefined,
      worldSnapshot: attachWorld ? structuredClone(currentWorld) : undefined,
      isMine: true,
      likes: 0,
      liked: false,
      subscribed: false,
      comments: [],
    }, ...current]);
    setPostDraft('');
    setImages([]); setImagePicker(false);
    setComposerOpen(false);
    setActiveTab('dynamic'); setQuery(''); setSearchOpen(false);
    onFlash('已添加到本次演示动态');
  }

  return (
    <div className="screen forum-screen">
      <header className="forum-header">
        {searchOpen ? (
          <div className="forum-search"><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索动态、用户或世界" /><button onClick={() => { setSearchOpen(false); setQuery(''); }}>取消</button></div>
        ) : (
          <>
            <nav aria-label="论坛内容分类">
              <button onClick={() => onOpen('community')}>消息</button>
              <button className={activeTab === 'dynamic' ? 'active' : ''} onClick={() => setActiveTab('dynamic')}>动态</button>
              <button className={activeTab === 'following' ? 'active' : ''} onClick={() => setActiveTab('following')}>关注</button>
              <button className={activeTab === 'worlds' ? 'active' : ''} onClick={() => setActiveTab('worlds')}>世界圈</button>
            </nav>
            <div className="forum-header-actions"><button aria-label="发布图片动态" aria-haspopup="dialog" onClick={event => openComposer(event.currentTarget)}><Camera /></button><button aria-label="搜索论坛" onClick={() => setSearchOpen(true)}><Search /></button></div>
          </>
        )}
      </header>

      <main className="forum-feed">
        {onBack && <button className="forum-profile-back" onClick={onBack}><ArrowLeft />返回我的动态</button>}
        <p className="forum-demo-note"><i />世界动态 · 演示互动仅保留在本次访问</p>
        {visiblePosts.map((post) => (
          <article className="forum-post" key={post.id} tabIndex={-1} ref={node => { if (node) postNodes.current.set(post.id, node); else postNodes.current.delete(post.id); }}>
            <header>
              <img src={post.avatar} alt={`${post.author}头像`} />
              <span><b>{post.author}</b><small>{post.date} · {post.location}</small></span>
              {!post.isMine && <button className={post.subscribed ? 'subscribed' : ''} onClick={() => toggleSubscribe(post.id)}>{post.subscribed ? '已订阅' : '订阅'}</button>}
            </header>
            <p className="forum-post-copy">{post.copy}</p>
            {post.images.length > 0 && <div className={`forum-media media-${post.images.length}`}>
              {post.images.map((image, index) => <img key={image} src={image} alt={`${post.author}发布的动态图片 ${index + 1}`} />)}
            </div>}
            {post.world && <button className="forum-world-card" onClick={() => onWorld(post)}><Sparkles /><span><small>来自 Ta 的世界</small><b>{post.world}</b></span><ChevronRight /></button>}
            <footer>
              <span>{post.handle}</span>
              <div>
                <button className={post.liked ? 'liked' : ''} onClick={() => toggleLike(post.id)} aria-label={post.liked ? '取消点赞' : '点赞'}><Heart fill={post.liked ? 'currentColor' : 'none'} />{post.likes}</button>
                <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} aria-label="查看评论"><MessageCircle />{post.comments.length}</button>
                <button onClick={() => void sharePost(post)} aria-label="分享动态"><Share2 /></button>
              </div>
            </footer>
            {expandedPost === post.id && <section className="forum-comments">
              {post.comments.map((comment) => <p key={comment.id}><b>{comment.author}</b><span>{comment.copy}</span><button onClick={() => setCommentDrafts(current => ({ ...current, [post.id]: `回复 ${comment.author}：` }))}>回复</button></p>)}
              {post.comments.length === 0 && <small>还没有评论，来留下第一句话吧。</small>}
              <form onSubmit={(event) => submitComment(event, post.id)}><input value={commentDrafts[post.id] ?? ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="说点什么…" /><button aria-label="发布评论"><Send /></button></form>
            </section>}
          </article>
        ))}
        {visiblePosts.length === 0 && <div className="forum-empty"><Users /><b>暂时没有匹配的动态</b><small>换个关键词，或者先去订阅几位创作者。</small><button onClick={() => { setQuery(''); setActiveTab('dynamic'); }}>查看全部动态</button></div>}
        <div className="forum-feed-end"><Sparkles />已经看到最新动态</div>
      </main>

      <button className="forum-compose-button" onClick={event => openComposer(event.currentTarget)} aria-label="发布新动态" aria-haspopup="dialog"><PenLine /></button>

      <Dialog open={active && composerOpen} onOpenChange={setComposerOpen}><DialogPrimitive.Portal><DialogPrimitive.Backdrop className="kk-modal-backdrop" /><DialogPrimitive.Viewport className="kk-modal-viewport">
        <DialogPrimitive.Popup render={<form onSubmit={publishPost} />} initialFocus={composerInput} finalFocus={composerTrigger} className="forum-composer-card kk-modal-sheet">
          <header><button type="button" onClick={() => setComposerOpen(false)}>取消</button><DialogTitle className="kk-composer-title">发布动态</DialogTitle><button type="submit" disabled={!postDraft.trim()}>发布</button></header>
          <div className="forum-composer-user"><img src={profile.avatar} alt={`${profile.name}的头像`} /><span><b>{profile.name}</b><DialogDescription className="kk-composer-description">本次演示可见 · 不会向真实社区发布</DialogDescription></span></div>
          <textarea ref={composerInput} aria-label="动态内容" value={postDraft} maxLength={220} onChange={(event) => setPostDraft(event.target.value)} placeholder="分享此刻的心情、剧情或角色灵感…" />
          {images.length > 0 && <div className="forum-selected-images">{images.map(image => <button type="button" key={image} aria-label="移除图片" onClick={() => setImages(current => current.filter(value => value !== image))}><img src={image} alt="已选素材" /><X /></button>)}</div>}
          {imagePicker && <><p className="forum-compose-help">从已有素材中选图，最多 3 张</p><div className="forum-image-picker">{discoverCards.slice(0, 8).map(card => <button type="button" key={card.image} aria-label={`选择${card.title}图片`} aria-pressed={images.includes(card.image)} onClick={() => setImages(current => current.includes(card.image) ? current.filter(image => image !== card.image) : current.length < 3 ? [...current, card.image] : current)}><img src={card.image} alt={card.title} /></button>)}</div></>}
          <footer><button type="button" aria-expanded={imagePicker} onClick={() => setImagePicker(value => !value)}><ImageIcon />图片</button><button type="button" className="forum-attach-world" title={currentWorld.title} aria-pressed={attachWorld} onClick={() => setAttachWorld(value => !value)}><Sparkles /><span>{attachWorld ? `已关联${currentWorld.title}` : '关联世界'}</span></button><small>{postDraft.length}/220</small></footer>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport></DialogPrimitive.Portal></Dialog>
    </div>
  );
}



function BottomNav({ view, unread, onChange }: { view: View; unread: number; onChange: (view: View) => void }) {
  const items: { id: View; label: string; icon: typeof Sparkles; badge?: number }[] = [
    { id: 'world', label: '世界', icon: Sparkles },
    { id: 'discover', label: '发现', icon: Orbit },
    { id: 'llm', label: '', icon: Plus },
    { id: 'community', label: '消息', icon: MessageCircle, badge: unread },
    { id: 'profile', label: '我的', icon: CircleUserRound },
  ];
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {items.map((item) => {
        const Icon = item.icon;
        const active = view === item.id || (view === 'forum' && item.id === 'community');
        return <button key={item.id} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} aria-label={item.id === 'llm' ? '创作者中心' : item.id === 'discover' ? '发现' : item.label} onClick={() => onChange(item.id)}><Icon />{Boolean(item.badge) && <i className="nav-badge">{item.badge}</i>}{item.label && <span>{item.label}</span>}</button>;
      })}
    </nav>
  );
}
