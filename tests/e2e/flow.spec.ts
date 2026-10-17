/** ホームから結果まで、ふつうに使う流れ（すべての画面サイズで行う） */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { stepsFor } from '../../src/engine/levels';
import { QUESTIONS, actionButton, answerQuestion, collectErrors } from './helpers';

for (const level of ['beginner', 'grade4'] as const) {
  test(`ホーム → 全問 → 結果 → 間違えた問題をもう一度（${level}）`, async ({ page }) => {
    test.setTimeout(420_000);
    const errors = collectErrors(page);
    await page.goto('./');
    await expect(page.locator('.level-card[data-k="beginner"]')).toHaveAttribute('aria-checked', 'true');
    await page.locator(`.level-card[data-k="${level}"]`).click();
    await page.locator('.screen.home .actionbar button').click();

    const qs = QUESTIONS.filter((q) => q.levels.includes(level));
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i]!;
      await expect(page.locator('.qbar .count')).toHaveText(`${i + 1} / ${qs.length}`);
      // 1問目だけわざと間違える
      await answerQuestion(page, q, level, i !== 0);
      await actionButton(page).click();
    }
    await expect(page.locator('.screen.result')).toBeVisible();
    await expect(page.locator('.score-num strong')).toHaveText(String(qs.length - 1));
    await expect(page.locator('.res-list li.ng')).toHaveCount(1);

    // 間違えた問題をもう一度
    await page.locator('.res-actions .btn.primary').click();
    await answerQuestion(page, qs[0]!, level, true);
    await actionButton(page).click();
    await expect(page.locator('.screen.result')).toBeVisible();
    await expect(page.locator('.score-num strong')).toHaveText('1');
    expect(stepsFor(qs[0]!, level).length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('途中でやめても、ホームから続きを再開できる', async ({ page }) => {
  await page.goto('./');
  await page.locator('.screen.home .actionbar button').click();
  const q = QUESTIONS.filter((x) => x.levels.includes('beginner'))[0]!;
  await answerQuestion(page, q, 'beginner', true);
  await actionButton(page).click();
  await page.locator('.qbar .icon-btn').first().click();
  await page.locator('.modal .btn.primary').click();
  await expect(page.locator('.card.resume')).toContainText('2 / ');
  await page.reload();
  await page.locator('.card.resume .btn.primary').click();
  await expect(page.locator('.qbar .count')).toHaveText(/^2 \//);
});

test('試作版と同じ形式の直接リンク（#q=...）でも問題が開く', async ({ page }) => {
  await page.goto('./#q=D-01&lv=grade4');
  await expect(page.locator('.screen.quiz .qtitle')).toHaveText(QUESTIONS.find((q) => q.id === 'D-01')!.title);
  await expect(page.locator('.chip-lv')).toHaveText('4級');
});

test('用語をタップすると説明が出る', async ({ page }) => {
  await page.goto('./#/q/B-01?lv=beginner');
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
  await page.goto('./#/q/A-02?lv=beginner');
  await check();
  await answerQuestion(page, q, 'beginner', true);
  await check();
});
