// 单键操作：孩子手里拿着魔方，只需要按一个键。
// 每个页面/场景用 setKeys 注册当前可用的键，换场景时整体替换。

export type KeyMap = Partial<Record<'space' | 'left' | 'right' | 'back' | 'esc' | 'voice' | 'hint' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9', () => void>>;

let current: KeyMap = {};

export function setKeys(map: KeyMap): void {
  current = map;
}

export function clearKeys(): void {
  current = {};
}

function nameOf(e: KeyboardEvent): keyof KeyMap | null {
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (digit) return digit[1] as keyof KeyMap;
  switch (e.code) {
    case 'Space':
    case 'Enter':
    case 'NumpadEnter':
      return 'space';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'Backspace':
      return 'back';
    case 'Escape':
      return 'esc';
    case 'KeyV':
      return 'voice';
    case 'KeyH':
      return 'hint';
  }
  return null;
}

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const k = nameOf(e);
  const fn = k && current[k];
  if (!fn) return;
  e.preventDefault();
  // 按钮获得焦点后空格会再"点"一次，先移开焦点
  (document.activeElement as HTMLElement | null)?.blur?.();
  fn();
});
