import type { Page } from "@playwright/test";

export async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await document.fonts.ready;
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true, animations: "disabled" });
}
