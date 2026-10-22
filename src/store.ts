// 训练记录保存在本机浏览器里（localStorage）

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
