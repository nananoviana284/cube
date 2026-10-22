import { describe, expect, it } from 'vitest';
import { sayMove } from '../src/ui/dom';

const say = (l: string, s = '') => sayMove(l, s).replace(/\s+/g, ' ').trim();

describe('指令怎么念', () => {
  it('大写不强调', () => {
    expect(say('U')).toBe('u');
    expect(say('R', "'")).toBe('r 撇');
    expect(say('F', '2')).toBe('f 两下');
  });
  it('小写念"小"', () => {
    expect(say('r')).toBe('小 r');
    expect(say('f', "'")).toBe('小 f 撇');
  });
  it('整体转动 x y z 不加"小"', () => {
    expect(say('y')).toBe('y');
  });
});
