// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Question } from '../../src/content/schema';
import { Pitch2D } from '../../src/pitch2d/Pitch2D';

const q = Question.parse({
  id: 'K-99',
  category: 'matchStart',
  title: 'コイン',
  kind: '2d',
  scene: {
    actors: [{ id: 'REF', role: 'referee' }],
    timeline: [
      { t: 0, positions: { REF: [34, 25] }, events: [{ type: 'coin', result: 'tails' }] },
      { t: 5, positions: {} },
    ],
    pauseAt: 0,
  },
  steps: [{ type: 'choice', question: '?', choices: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }], answer: 'a' }],
  explain: { summary: 's' },
  refs: [{ src: 'laws', article: '第8条' }],
});

describe('コイントスの表示', () => {
  it('投げた人を省略すると主審になり、表示は3秒', () => {
    const ev = q.kind === '2d' ? q.scene.timeline[0]!.events![0]! : null;
    expect(ev).toMatchObject({ type: 'coin', by: 'REF', dur: 3, result: 'tails' });
  });
  it('はじめはコインが回り、そのあと結果を出し、時間が過ぎたら消える', () => {
    if (q.kind !== '2d') throw new Error('2d');
    const box = document.createElement('div');
    const p = new Pitch2D(box, q.scene);
    p.render(0.5);
    expect(box.querySelectorAll('.coin ellipse')).toHaveLength(1);
    expect(box.querySelector('.bub-coin')).toBeNull();
    p.render(2);
    expect(box.querySelector('.coin')).toBeNull();
    expect(box.querySelector('.bub-coin .bub-text')?.textContent).toBe('裏');
    p.render(3.5);
    expect(box.querySelector('.bub-coin')).toBeNull();
  });
});
