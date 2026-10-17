/** ホームから結果まで、ふつうに使う流れ（すべての画面サイズで行う） */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { QUESTIONS, STAGES, actionButton, answerQuestion, collectErrors, qById } from './helpers';

test('ホーム → ステージを選ぶ → 全問 → 結果 → 間違えた問題をもう一度', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.locator('.home .meta')).toContainText(`${STAGES.length}ステージ・${QUESTIONS.length}問`);
  await expect(page.locator('.stage-card')).toHaveCount(STAGES.length);

  // 1番目ではないステージも、最初から選べる
  const st = STAGES[1]!;
  const card = page.locator(`.stage-card[data-stage="${st.id}"]`);
  await expect(card).toContainText(`${st.questions.length}問`);
  await card.click();

  const qs = st.questions.map(qById);
  for (let i = 0; i < qs.length; i++) {
    await expect(page.locator('.qbar .count')).toHaveText(`${i + 1} / ${qs.length}`);
    // 1問目だけわざと間違える
    await answerQuestion(page, qs[i]!, i !== 0);
    await actionButton(page).click();
  }
  await expect(page.locator('.screen.result')).toBeVisible();
  await expect(page.locator('.qbar .count')).toContainText(st.title);
  await expect(page.locator('.score-num strong')).toHaveText(String(qs.length - 1));
  await expect(page.locator('.res-list li.ng')).toHaveCount(1);

  // 間違えた問題をもう一度
  await page.locator('.res-actions .btn.primary').click();
  await answerQuestion(page, qs[0]!, true);
  await actionButton(page).click();
  await expect(page.locator('.score-num strong')).toHaveText('1');

  // ホームのカードに、ステージ全体の正解数が出る
  await page.locator('.res-actions .btn', { hasText: 'ホームへ' }).click();
  await expect(card).toContainText(`前回 ${qs.length}/${qs.length}`);
  expect(errors).toEqual([]);
});

test('途中でやめても、ホームから続きを再開できる。別のステージを選ぶと確かめる', async ({ page }) => {
  const st = STAGES[0]!;
  await page.goto('./');
  await page.locator(`.stage-card[data-stage="${st.id}"]`).click();
  await answerQuestion(page, qById(st.questions[0]!), true);
  await actionButton(page).click();
  await page.locator('.qbar .icon-btn').first().click();
  await page.locator('.modal .btn.primary').click();
  const card = page.locator(`.stage-card[data-stage="${st.id}"]`);
  await expect(card).toContainText(`続きから 2/${st.questions.length}`);
  await page.reload();
  await card.click();
  await expect(page.locator('.qbar .count')).toHaveText(/^2 \//);

  // ほかのステージを選ぶと、途中であることを確かめる
  await page.locator('.qbar .icon-btn').first().click();
  await page.locator('.modal .btn.primary').click();
  await page.locator(`.stage-card[data-stage="${STAGES[1]!.id}"]`).click();
  await expect(page.locator('.modal')).toContainText(st.title);
  await page.locator('.modal .btn.primary').click();
  await expect(page.locator('.qbar .count')).toHaveText(`1 / ${STAGES[1]!.questions.length}`);
});

test('以前の形式の直接リンク（#q=...&lv=...）でも問題が開く', async ({ page }) => {
  await page.goto('./#q=D-01&lv=grade4');
  await expect(page.locator('.screen.quiz .qtitle')).toHaveText(QUESTIONS.find((q) => q.id === 'D-01')!.title);
});

test('用語をタップすると説明が出る', async ({ page }) => {
  await page.goto('./#/q/B-01');
  await page.locator('.stage-play').click();
  await page.locator('.choices .choice[data-id="go"]').click();
  await actionButton(page).click();
  await page.locator('.explain .term').first().click();
  await expect(page.locator('.gloss')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.gloss')).toHaveCount(0);
});

test('アクセシビリティ（ホーム・問題・解説）に重大な問題がない', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  const check = async () => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['color-contrast']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  };
  await page.goto('./');
  await check();
  const q = QUESTIONS.find((x) => x.id === 'A-02')!;
  await page.goto('./#/q/A-02');
  await check();
  await answerQuestion(page, q, true);
  await check();
});
