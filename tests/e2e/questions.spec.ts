/** すべての問題を最後まで解けることを確かめる（URL で問題を直接開く） */
import { expect, test } from '@playwright/test';
import { QUESTIONS, actionButton, answerQuestion, collectErrors } from './helpers';

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
      const other = page.locator('.cam-tabs .cam:not(.on)').last();
      const id = await other.getAttribute('data-id');
      await other.click();
      await expect(page.locator(`.cam-tabs .cam[data-id="${id}"]`)).toHaveClass(/\bon\b/);
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

test('立ち位置の問題：選んだ位置から見え方が出る。ほかの候補とも見比べられる', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  const errors = collectErrors(page);
  await page.goto('./#/q/H-04');
  await expect(page.locator('.stage-play')).toBeVisible({ timeout: 30_000 });
  // 解答前は、全体の視点だけ
  await expect(page.locator('.cam-tabs .cam')).toHaveCount(1);
  await page.locator('.stage-play').click();
  // 一覧で選ぶと、フィールドの丸も選ばれる
  await page.locator('.choices .choice[data-id="B"]').click();
  await expect(page.locator('.s3-cand[data-id="B"]')).toHaveClass(/\bsel\b/);
  await actionButton(page).click();
  // B（プレーの真後ろ）からは、押した手が隠れる
  await expect(page.locator('.s3-check')).toContainText('B の位置から', { timeout: 15_000 });
  await expect(page.locator('.s3-check')).toContainText('押した手が隠れて見えない');
  await expect(page.locator('.choice.is-wrong + .choice-fb')).toContainText('背中に隠れて');
  // C に切り替えると、3つとも ○
  await page.locator('.cam-tabs .cam[data-id="C"]').click();
  await expect(page.locator('.s3-check')).toContainText('C の位置から');
  await expect(page.locator('.s3-check li.ng')).toHaveCount(0);
  await expect(page.locator('.s3-check li.ok')).toHaveCount(3);
  // 全体の視点では、候補の丸が正解・不正解で色分けされる
  await page.locator('.cam-tabs .cam[data-id="overview"]').click();
  await expect(page.locator('.s3-cand[data-id="C"]')).toHaveClass(/\bok\b/);
  await expect(page.locator('.s3-cand[data-id="B"]')).toHaveClass(/\bng\b/);
  await expect(page.locator('.s3-check')).toBeHidden();
  expect(errors).toEqual([]);
});

test('合図の問題：問いの絵と、絵の選択肢が出る', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  const errors = collectErrors(page);
  await page.goto('./#/q/I-01');
  await expect(page.locator('.sig-stage .sig-svg')).toBeVisible();
  await page.goto('./#/q/I-02');
  await expect(page.locator('.choices.fig-grid .choice.has-fig')).toHaveCount(4);
  await expect(page.locator('.choice[data-id="adv"] .sig-svg')).toBeVisible();
  // 誤答すると、絵の選択肢の下にも「なぜ違うか」が出る
  await page.locator('.choice[data-id="ifk"]').click();
  await actionButton(page).click();
  await expect(page.locator('.choice.is-wrong + .choice-fb')).toContainText('間接フリーキック');
  expect(errors).toEqual([]);
});
