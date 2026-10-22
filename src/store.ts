// 训练记录保存在本机浏览器里（localStorage）
import type { Color } from './cube/model';

export interface Solve {
  at: number;
  ms: number;
  /** 例如 "F2L 卡住了" */
  note?: string;
}

export interface Data {
  kidName: string;
  startedAt: number;
  /** 每课拿到的星星（0-3） */
  stars: Record<string, number>;
  /** 小游戏最好成绩 */
  best: Record<string, number>;
  solves: Solve[];
  /** 已经会的顶层公式 id */
  knownLL: string[];
  /** 每天练习分钟（家长打卡） */
  practice: Record<string, number>;
  voice: boolean;
  speed: number;
  /** 朝前的颜色（白底黄顶） */
  front: Color;
  /** 公式本打分：0 不会、1 还不熟、2 会了 */
  skills: Record<string, 0 | 1 | 2>;
  /** 家里给公式起的名字 */
  nick: Record<string, string>;
  /** 每天练习分钟数 */
  dailyMinutes: number;
  /** 是否显示家长说明 */
  parentView: boolean;
  /** "跟着做"每步停顿（毫秒） */
  followPause: number;
  /** 上次打开的课 */
  lastLesson?: string;
  /** 每天做过的事（首页"今天"三件事打勾用），例如 {"2026-10-22": ["lesson", "game"]} */
  activity: Record<string, string[]>;
}

const KEY = 'cube-coach-v1';

function defaults(): Data {
  return {
    kidName: '小魔方',
    startedAt: Date.now(),
    stars: {},
    best: {},
    solves: [],
    knownLL: [],
    practice: {},
    voice: true,
    speed: 420,
    front: 'G',
    skills: {},
    nick: {},
    dailyMinutes: 60,
    parentView: false,
    followPause: 2500,
    activity: {},
  };
}

let cache: Data | null = null;

export function load(): Data {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    cache = defaults();
  }
  return cache!;
}

export function save(mut?: (d: Data) => void): Data {
  const d = load();
  mut?.(d);
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // 隐私模式下存不了，就只在本次打开有效
  }
  return d;
}

export function totalStars(): number {
  return Object.values(load().stars).reduce((a, b) => a + b, 0);
}

export function giveStars(id: string, n: number): void {
  save((d) => {
    d.stars[id] = Math.max(d.stars[id] ?? 0, n);
  });
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 从开始训练算起是第几周（1 起） */
export function weekNumber(): number {
  return Math.floor((Date.now() - load().startedAt) / (7 * 86400000)) + 1;
}

/** 记一笔"今天做过这件事" */
export function logToday(what: 'lesson' | 'game'): void {
  const t = today();
  if (load().activity[t]?.includes(what)) return;
  save((d) => {
    d.activity[t] = [...(d.activity[t] ?? []), what];
  });
}

export function didToday(what: 'lesson' | 'game'): boolean {
  return load().activity[today()]?.includes(what) ?? false;
}

/** 今天计时了几次 */
export function solvesToday(): number {
  const t = today();
  return load().solves.filter((s) => {
    const d = new Date(s.at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === t;
  }).length;
}
