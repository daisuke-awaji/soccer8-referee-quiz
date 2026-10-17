import { expect, type Page } from '@playwright/test';
import { loadContent } from '../../plugins/content';
import type { Level, Question } from '../../src/content/schema';
import { hasAnimation, stepsFor } from '../../src/engine/levels';

export const CONTENT = loadContent().bundle;
export const QUESTIONS = CONTENT.questions;
export const LEVELS: Level[] = ['beginner', 'grade4'];

/** コンソールのエラーを集める（テストの最後に空であることを確かめる） */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

/** フィールド座標 (x, y) の位置を、ピッチの SVG 上でタップする */
async function tapField(page: Page, x: number, y: number) {
  const pt = await page.locator('.pitch-svg').evaluate((svg: SVGSVGElement, [fx, fy]) => {
    const p = svg.createSVGPoint();
    p.x = fy;
    p.y = 68 - fx;
    const m = svg.getScreenCTM()!;
    const s = p.matrixTransform(m);
    return { x: s.x, y: s.y };
  }, [x, y] as const);
  await page.mouse.click(pt.x, pt.y);
}

export const actionButton = (page: Page) => page.locator('.screen.quiz .actionbar button');

/**
 * 問題画面で、プレーを見て正解（correct=false なら最初の誤答）を選び、解説まで進める。
 * 戻り値は「すべて正解したか」。
 */
export async function answerQuestion(page: Page, q: Question, level: Level, correct = true): Promise<boolean> {
  await expect(page.locator('.screen.quiz .qtitle')).toHaveText(q.title);
  if (hasAnimation(q)) {
    const play = page.locator('.stage-play');
    await expect(play).toBeVisible({ timeout: 30_000 }); // 3D は読み込みを待つ
    await play.click();
  }
  const steps = stepsFor(q, level);
  let allOk = true;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    if (s.type === 'choice') {
      const pick = correct ? s.answer : s.choices.find((c) => c.id !== s.answer)!.id;
      if (pick !== s.answer) allOk = false;
      const btn = page.locator(`.choices .choice[data-id="${pick}"]`);
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
    } else {
      await expect(page.locator('.place-help')).toBeVisible({ timeout: 20_000 });
      const [x, y] = correct ? s.placement.target : [s.placement.target[0] - (s.placement.tolerance + 3), s.placement.target[1]];
      if (!correct) allOk = false;
      await tapField(page, x, y);
    }
    await expect(actionButton(page)).toHaveText('判定する');
    await actionButton(page).click();
    if (i < steps.length - 1) {
      await expect(actionButton(page)).toHaveText('次の質問へ →');
      await actionButton(page).click();
    }
  }
  await expect(page.locator('.explain .verdict')).toBeVisible();
  await expect(page.locator('.explain .verdict')).toHaveClass(allOk ? /\bok\b/ : /\b(ng|part)\b/);
  return allOk;
}
