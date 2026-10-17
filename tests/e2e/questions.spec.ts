/** すべての問題を最後まで解けることを確かめる（URL で問題を直接開く） */
import { expect, test } from '@playwright/test';
import { QUESTIONS, answerQuestion, collectErrors } from './helpers';

for (const q of QUESTIONS) {
  test(`${q.id} ${q.title}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', '全問の通しは標準サイズの画面だけで行う');
    const errors = collectErrors(page);
    await page.goto(`./#/q/${q.id}`);
    await answerQuestion(page, q, true);
    // 解説：出典のリンクがある
    await expect(page.locator('.refs .ref').first()).toBeVisible();
    if (q.kind === '3d') {
      // 解答後は、ほかの視点に切り替えられる
      await page.locator('.cam-tabs .cam[data-id="assistant"]').click();
      await expect(page.locator('.cam-tabs .cam[data-id="assistant"]')).toHaveClass(/\bon\b/);
      await expect(page.locator('canvas.scene3d-canvas')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test('誤答すると、その選択肢の下に「なぜ違うか」が出る', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  const q = QUESTIONS.find((x) => x.id === 'A-02')!;
  await page.goto(`./#/q/${q.id}`);
  await answerQuestion(page, q, false);
  await expect(page.locator('.choice.is-wrong + .choice-fb')).toBeVisible();
  await expect(page.locator('.choice.is-correct')).toContainText('正解');
});

test('配置問題で外すと、正解の位置とずれが表示される', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  const q = QUESTIONS.find((x) => x.id === 'A-01')!;
  await page.goto(`./#/q/${q.id}`);
  await answerQuestion(page, q, false);
  await expect(page.locator('.place-fb.ng .desc')).toContainText('ゴールラインから約');
  await expect(page.locator('.place-result')).toHaveCount(1);
});
