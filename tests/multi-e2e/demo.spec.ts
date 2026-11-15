import { expect, test } from "@playwright/test";

const captures = process.env.STRAVLY_CAPTURE_MULTI === "1";

test("the public demo shows availability and simulates a booking without contact data", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Probar demo" })).toHaveAttribute("href", "/demo");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Tab");
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole("link", { name: "Probar demo" })).toBeInViewport();
    if (captures) await page.screenshot({ path: width === 1440 ? "test-results/multi-portada.png" : `test-results/multi-portada-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Probar demo" }).click();
  await expect(page.getByRole("heading", { name: "Barbería Demo" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
  await expect(page.getByLabel("Teléfono")).toHaveCount(0);

  const service = page.getByRole("radio", { name: /Corte y barba/ });
  await service.check();
  const serviceId = await service.getAttribute("value");
  const date = await page.getByLabel("Fecha", { exact: true }).inputValue();
  await expect(page.getByRole("radio", { name: /Camila Ríos/ })).toBeVisible();
  await page.getByRole("radio", { name: /Martín Vega/ }).check();
  const availability = page.getByRole("radiogroup", { name: "Horarios disponibles" });
  await availability.getByRole("radio", { name: "11:00", exact: true }).check();
  await expect(availability.getByRole("radio", { name: "10:00", exact: true })).toHaveCount(0);
  await expect(availability.getByRole("radio", { name: "18:30", exact: true })).toHaveCount(0);
  if (captures) await page.screenshot({ path: "test-results/multi-demo-reserva.png", fullPage: true, animations: "disabled" });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (captures) await page.screenshot({ path: "test-results/multi-demo-movil.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Confirmar reserva de prueba" }).click();
  const confirmation = page.getByRole("heading", { name: "¡Reserva de prueba confirmada!" });
  await expect(confirmation).toBeFocused();
  await expect(page.getByText(/^DEMO-[0-9A-F]{8}$/)).toBeVisible();
  await expect(page.getByText("Profesional asignado: Martín Vega.")).toBeVisible();
  await expect(page.getByText(/No se guardó una cita/)).toBeVisible();

  const unknownWorker = await request.get(`/api/horarios?demo=1&servicio=${serviceId}&fecha=${date}&profesional=99`);
  expect(await unknownWorker.json()).toEqual({ slots: [] });
  const crossedMode = await request.get(`/api/horarios?demo=1&servicio=${serviceId}&fecha=${date}&negocio=barberia-inexistente`);
  expect(crossedMode.status()).toBe(400);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
