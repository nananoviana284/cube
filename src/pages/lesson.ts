import { parseAlg } from '../cube/alg';
import { faceName } from '../cube/model';
import { ISLANDS, LESSONS, lessonById, lessonsOf, resolveSetup, type Scene } from '../content/lessons';
import { giveStars, load, logToday, save } from '../store';
import { beep, celebrate, h, speak, stopSpeak } from '../ui/dom';
import { clearKeys, setKeys, type KeyMap } from '../ui/keys';
import { withNicks } from './book';
import { actionBar, activityHeader, algView, coach, kbd, playWithArrows, progressBar, stage, starRow, wait, type Action } from '../ui/components';
import { followAlong, runDrill } from '../ui/drill';

/** 跟着做时最多带孩子转多少步（太长的打乱不适合跟着做） */
const FOLLOW_MAX = 14;

export function lessonPage(root: HTMLElement, id: string): () => void {
  const lesson = lessonById(id);
  if (!lesson) {
    location.hash = '#/learn';
    return () => {};
  }
  save((d) => (d.lastLesson = lesson.id));
  // 最后一幕：把这一课的原理直接讲给孩子听
  const scenes: Scene[] = [...lesson.scenes, { kind: 'talk', say: `今天的秘诀：${lesson.secret}`, secret: true }];
  let idx = 0;
  let mistakes = 0;
  let alive = true;
  /** 每换一个场景加 1，旧场景里还在跑的动画/朗读看到不一致就停下 */
  let gen = 0;
  const st = stage('front');
  const { view } = st;
  const prog = progressBar(scenes.length);
  const side = h('div', { class: 'side' });
  const bar = actionBar();
  const island = ISLANDS.find((i) => i.id === lesson.island)!;
  const no = lessonsOf(lesson.island).findIndex((l) => l.id === lesson.id) + 1;
  const toMap = () => (location.hash = '#/learn');
  root.append(
    activityHeader({ title: lesson.title, sub: `${island.name} · 第 ${no} 课`, exitHref: '#/learn', below: prog.el }),
    h('div', { class: 'player' }, st.el, side),
    bar.el,
  );

  const goto = (i: number) => {
    if (!alive) return;
    idx = Math.max(0, i);
    if (idx >= scenes.length) finish();
    else show();
  };
  const next = () => goto(idx + 1);
  const back = () => (idx > 0 ? goto(idx - 1) : undefined);

  function prep(scene: Exclude<Scene, { kind: 'real' } | { kind: 'drill' }>): string {
    const setup = resolveSetup(scene.setup);
    view.setAlg(setup);
    view.highlight(scene.highlight ?? null);
    view.glow([]);
    view.showArrow(null);
    view.onPick(null);
    view.setPreset('view' in scene && scene.view ? scene.view : 'front');
    return setup;
  }

  /** 注册当前场景的键（每个场景都有：V 再听、← 上一步、Esc 回地图），同时摆好底部按钮 */
  function keys(say: string, extra: KeyMap, items: Action[]): void {
    setKeys({
      voice: () => speak(say, true),
      left: idx > 0 ? back : undefined,
      esc: toMap,
      ...extra,
    });
    bar.set({ back: idx > 0 ? back : undefined, items });
  }

  /** 跟着做（见 ui/drill.ts），场景切换后自动停 */
  const follow = (alg: string, start: string, box: HTMLElement, my: number) =>
    followAlong(st, alg, start, box, () => alive && my === gen, { esc: toMap }, bar);

  function show(): void {
    const my = ++gen;
    stopSpeak();
    prog.set(idx);
    side.replaceChildren();
    st.cover(false);
    const scene = scenes[idx];
    const say = withNicks(scene.say);
    const talk = coach(say, { secret: scene.kind === 'talk' && scene.secret });
    side.append(talk.el);
    const spoken = speak(say);
    if (scene.kind !== 'real' && scene.kind !== 'drill') prep(scene);
    const parentBox = h('div', { class: 'parent-note' }, h('b', null, '家长说明：'), h('div', { html: lesson!.parent }));

    if (scene.kind === 'talk') {
      keys(say, { space: next, right: next }, [{ label: '懂了', key: '空格', kind: 'green', icon: 'right', onclick: next }]);
    }

    if (scene.kind === 'watch') {
      const steps = scene.steps;
      const all = steps.map((s) => s.moves).join(' ');
      const av = algView(all);
      const stepBox = h('div', { class: 'step-say' }, '看好了……');
      const setup = resolveSetup(scene.setup);
      const canFollow = parseAlg(all).length <= FOLLOW_MAX && parseAlg(setup).length <= FOLLOW_MAX;
      side.append(stepBox, h('div', { class: 'card' }, h('div', { class: 'card-label' }, '这一段的公式'), av.el));

      const offsets: number[] = [];
      let acc = 0;
      for (const s of scene.steps) {
        offsets.push(acc);
        acc += parseAlg(s.moves).length;
      }

      const done = () => {
        stepBox.textContent = canFollow ? '拿起你的魔方，跟着做一遍！' : '看懂了吗？';
        if (canFollow) speak('拿起你的魔方，按 2，跟着做一遍！');
        keys(say, { space: next, right: next, back: playAll, '1': playAll, '2': canFollow ? followAll : undefined }, [
          { label: '再看一遍', key: '1', kind: 'ghost', icon: 'replay', onclick: playAll },
          ...(canFollow ? [{ label: '拿魔方跟着做', key: '2', kind: 'blue' as const, icon: 'cube' as const, onclick: followAll }] : []),
          { label: '懂了', key: '空格', kind: 'green', icon: 'right', onclick: next },
        ]);
      };

      async function playAll(): Promise<void> {
        const mine = ++gen;
        keys(say, { space: next, right: next }, [{ label: '跳过', key: '空格', kind: 'green', icon: 'right', onclick: next }]);
        view.setAlg(setup);
        av.at(-1);
        for (let i = 0; i < steps.length; i++) {
          if (!alive || mine !== gen) return;
          const s = steps[i];
          stepBox.textContent = withNicks(s.say);
          await speak(stepBox.textContent);
          if (!alive || mine !== gen) return;
          const n = parseAlg(s.moves).length;
          // 一段做完时先不要把下一段标成"正在做"，最后一段做完才全部标完成
          await playWithArrows(view, s.moves, (j) => (j < n || i === steps.length - 1) && av.at(offsets[i] + j));
          await wait(500);
        }
        if (alive && mine === gen) done();
      }

      async function followAll(): Promise<void> {
        const mine = ++gen;
        av.at(-1);
        if (setup) {
          stepBox.textContent = `拿起魔方，白色朝下、${faceName('F')}色朝前。先跟我摆出这个样子！`;
          await speak(stepBox.textContent);
          if (!(await follow(setup, '', stepBox, mine))) return;
          stepBox.textContent = '摆好了！现在跟我把它变回去。';
          await speak(stepBox.textContent);
        }
        if (!(await follow(all, setup, stepBox, mine))) return;
        beep('good');
        stepBox.textContent = '你跟着做完了！';
        await speak('你跟着做完了！');
        if (alive && mine === gen) done();
      }

      keys(say, { space: next, right: next }, [{ label: '跳过', key: '空格', kind: 'green', icon: 'right', onclick: next }]);
      spoken.then(() => {
        if (alive && my === gen) playAll();
      });
      if (setup) parentBox.append(h('p', null, '这个情况的摆法：从复原的魔方做 ', h('span', { class: 'alg' }, setup), '。'));
    }

    if (scene.kind === 'drill') {
      const box = h('div', { class: 'side' });
      side.append(box);
      const base: KeyMap = { voice: () => speak(say, true), esc: toMap, left: idx > 0 ? back : undefined, right: next };
      setKeys(base);
      bar.set({ back: idx > 0 ? back : undefined });
      spoken.then(() => {
        if (!alive || my !== gen) return;
        runDrill({ st, box, bar, next: scene.cases, reps: scene.reps, highlight: scene.highlight, alive: () => alive && my === gen, baseKeys: base }).then((r) => {
          if (!alive || my !== gen) return;
          mistakes += r.fails;
          next();
        });
      });
      parentBox.append(h('p', null, '这一步完全在真魔方上做：屏幕出题、计时，孩子自己按空格说"成功了"或按 1 说"没成功"。没成功会先演示一遍再重来。'));
    }

    if (scene.kind === 'pick') {
      const rounds = scene.rounds ?? 1;
      let round = 0;
      const status = h('div', { class: 'step-say' }, rounds > 1 ? `第 1 / ${rounds} 题：点魔方上的方块` : '点魔方上的方块');
      const hint = () => {
        mistakes++;
        view.glow(scene.answer(view.state));
        setTimeout(() => my === gen && view.glow([]), 1200);
      };
      const setRound = () => {
        if (round > 0) prep(scene);
        view.onPick((pid) => {
          if (!alive || my !== gen) return;
          if (scene.answer(view.state).includes(pid)) {
            beep('good');
            view.highlight([...(scene.highlight ?? []), pid]);
            round++;
            if (round >= rounds) {
              view.onPick(null);
              talk.set('找到啦！', 'good');
              celebrate('找到啦！');
              setTimeout(() => alive && my === gen && next(), 1100);
            } else {
              status.textContent = `对！第 ${round + 1} / ${rounds} 题`;
              setTimeout(() => alive && my === gen && setRound(), 700);
            }
          } else {
            mistakes++;
            beep('bad');
            talk.set('再找找～ 可以转一转魔方看背面哦', 'retry');
            speak('再找找');
          }
        });
      };
      setRound();
      side.append(status);
      keys(say, { hint, right: next }, [
        { label: '闪一下答案', key: 'H', kind: 'ghost', icon: 'bulb', onclick: hint },
        { label: '跳过', key: '→', kind: 'ghost', onclick: next },
      ]);
    }

    if (scene.kind === 'quiz') {
      const rounds = scene.rounds ?? 1;
      let round = 0;
      const box = h('div', { class: 'options', role: 'group', 'aria-label': '选答案' });
      const status = h('div', { class: 'step-say' }, rounds > 1 ? `第 1 / ${rounds} 题` : '选一个答案');
      const ask = (first: boolean) => {
        let opts: { label: string; ok: boolean }[];
        if (typeof scene.options === 'function') {
          const g = scene.options();
          view.setAlg(g.setup);
          view.highlight(g.highlight ?? scene.highlight ?? null);
          view.resetView();
          opts = g.options;
        } else opts = scene.options;
        let locked = false;
        const okIndex = opts.findIndex((o) => o.ok);
        const choose = (i: number) => {
          const o = opts[i];
          const b = box.children[i] as HTMLElement | undefined;
          if (!o || !b || locked) return;
          if (o.ok) {
            locked = true;
            b.classList.add('ok');
            beep('good');
            round++;
            talk.set('答对啦！', 'good');
            if (round >= rounds) {
              celebrate('答对啦！');
              setTimeout(() => alive && my === gen && next(), 1100);
            } else {
              status.textContent = `对！第 ${round + 1} / ${rounds} 题`;
              setTimeout(() => {
                if (!alive || my !== gen) return;
                talk.set(say);
                ask(false);
              }, 700);
            }
          } else {
            mistakes++;
            beep('bad');
            talk.set('再想想～', 'retry');
            b.classList.remove('no');
            void b.offsetWidth;
            b.classList.add('no');
          }
        };
        const hint = () => {
          const b = box.children[okIndex] as HTMLElement | undefined;
          if (!b || locked) return;
          b.classList.add('flash');
          setTimeout(() => b.classList.remove('flash'), 1200);
        };
        box.replaceChildren(
          ...opts.map((o, i) => {
            const b = h('button', { class: 'option', type: 'button' }, kbd(String(i + 1)), h('span', null, withNicks(o.label)));
            b.querySelector('kbd')!.classList.add('num');
            b.onclick = () => choose(i);
            return b;
          }),
        );
        // 不认字也能答：把选项读出来
        const readOpts = opts.map((o, i) => `${i + 1}，${withNicks(o.label)}`).join('。');
        if (first)
          spoken.then(() => {
            if (alive && my === gen) speak(readOpts);
          });
        else speak(readOpts);
        keys(
          say,
          { '1': () => choose(0), '2': () => choose(1), '3': () => choose(2), '4': () => choose(3), voice: () => speak(`${say}。${readOpts}`, true), hint, right: next },
          [
            { label: '闪一下答案', key: 'H', kind: 'ghost', icon: 'bulb', onclick: hint },
            { label: '跳过', key: '→', kind: 'ghost', onclick: next },
          ],
        );
      };
      side.append(status, box);
      ask(true);
    }

    if (scene.kind === 'real') {
      const ps = resolveSetup(scene.parentSetup) || undefined;
      view.setAlg(ps ?? '');
      view.highlight(null);
      view.showArrow(null);
      st.cover(true);
      const followBox = h('div', { class: 'step-say' }, '拿起你的魔方！');
      const hintBox = h('ol', { class: 'hint-list' });
      const hints = scene.hints ?? [];
      const reveal = scene.reveal;
      let shown = 0;
      const doneItem: Action = { label: '我做到了', key: '空格', kind: 'green', icon: 'check', onclick: next };
      // 挑战：提示一条一条给，全部听完才能看答案；用了提示不扣星，看答案才算一次"没做出来"
      const nextHint = () => {
        if (shown >= hints.length) return;
        const t = hints[shown++];
        hintBox.append(h('li', null, t));
        speak(`提示：${t}`);
        setButtons();
      };
      const showReveal = async () => {
        if (!reveal) return;
        const mine = ++gen;
        mistakes++;
        st.cover(false);
        view.setAlg(ps ?? '');
        for (const step of reveal) {
          if (!alive || mine !== gen) return;
          followBox.textContent = step.say;
          await speak(step.say);
          if (!alive || mine !== gen) return;
          await playWithArrows(view, step.moves);
          await wait(400);
        }
        if (alive && mine === gen) {
          followBox.textContent = '看懂了吗？用你的魔方再做一次，做到了按空格。';
          speak(followBox.textContent);
          setButtons();
        }
      };
      const followSetup = ps
        ? async () => {
            const mine = ++gen;
            followBox.textContent = `白色朝下、${faceName('F')}色朝前，跟我摆！`;
            await speak(followBox.textContent);
            if (!(await follow(ps, '', followBox, mine))) return;
            st.cover(true);
            followBox.textContent = hints.length ? '摆好了！现在自己想办法。卡住了按 H 听提示。做到了按空格。' : '摆好了！现在自己让好朋友回家吧！做到了就按空格。';
            speak(followBox.textContent);
            setButtons();
          }
        : undefined;
      function setButtons(): void {
        const canReveal = !!reveal && shown >= hints.length;
        keys(say, { space: next, '2': followSetup, hint: hints.length ? nextHint : undefined, '3': canReveal ? showReveal : undefined }, [
          ...(ps ? [{ label: '跟我摆', key: '2', kind: 'blue' as const, icon: 'cube' as const, onclick: followSetup! }] : []),
          ...(shown < hints.length ? [{ label: '听提示', key: 'H', kind: 'ghost' as const, icon: 'bulb' as const, onclick: nextHint }] : []),
          ...(canReveal ? [{ label: '看答案', key: '3', kind: 'ghost' as const, icon: 'play' as const, onclick: showReveal }] : []),
          doneItem,
        ]);
      }
      if (ps) speak(`${say}。按 2，我带你摆出来。`);
      side.append(followBox, hintBox);
      setButtons();
      const items = scene.checklist ?? [];
      if (items.length) parentBox.append(h('p', null, h('b', null, '看孩子能不能：')), h('ul', null, ...items.map((t) => h('li', null, t))));
      if (hints.length) parentBox.append(h('p', null, '这是"先试后讲"的挑战：请忍住不要直接告诉答案。孩子卡住时按 H 一条条给提示，最后才看答案。孩子弄坏了也没关系，问他"哪一步弄坏的？怎么让它回来？"'));
      if (ps) parentBox.append(h('p', null, '摆法：从复原的魔方（白色朝下、', faceName('F'), '色朝前）做 ', h('span', { class: 'alg' }, ps), '，或者让孩子按 2 跟着屏幕一步步摆。'));
    }

    side.append(parentBox);
  }

  function finish(): void {
    gen++;
    view.onPick(null);
    view.showArrow(null);
    view.highlight(null);
    st.cover(false);
    const stars = mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1;
    giveStars(lesson!.id, stars);
    logToday('lesson');
    prog.set(scenes.length);
    celebrate('学完啦！');
    const i = LESSONS.findIndex((l) => l.id === lesson!.id);
    const nextLesson = LESSONS[i + 1];
    speak(`学完啦！你得到了 ${stars} 颗星星。按空格，${nextLesson ? '去下一课' : '回到原理'}。`);
    const again = () => {
      mistakes = 0;
      goto(0);
    };
    const toNext = () => (location.hash = nextLesson ? `#/lesson/${nextLesson.id}` : '#/learn');
    side.replaceChildren(
      h(
        'div',
        { class: 'finish' },
        starRow(stars, 3, 96),
        h('h2', null, '学完啦！'),
        h('p', { class: 'muted' }, `${load().kidName}，今天学会了：${lesson!.goal}`),
        coach(lesson!.secret, { secret: true }).el,
      ),
    );
    setKeys({ space: toNext, right: toNext, back: again, esc: toMap, voice: () => speak(`今天的秘诀：${lesson!.secret}`, true) });
    bar.set({
      items: [
        { label: '再玩一次', key: '⌫', kind: 'ghost', icon: 'replay', onclick: again },
        { label: '回原理', key: 'Esc', kind: 'ghost', icon: 'map', onclick: toMap },
        { label: nextLesson ? `下一课：${nextLesson.title}` : '回到原理', key: '空格', kind: 'green', icon: 'right', onclick: toNext },
      ],
    });
    view.setAlg('');
    view.play('y y y y', 500, true);
  }

  show();
  return () => {
    alive = false;
    gen++;
    clearKeys();
    stopSpeak();
    view.dispose();
  };
}
