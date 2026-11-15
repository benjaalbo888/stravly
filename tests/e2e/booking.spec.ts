import { test, expect } from "@playwright/test";
import { addDays, santiagoDate } from "../../src/lib/schedule";

test("portada adaptable, foco visible y navegación pública", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tus reservas, sin complicaciones.");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Stravly, inicio" }).first()).toBeFocused();
  await expect(page.locator(":focus-visible")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  if (process.env.STRAVLY_SCREENSHOTS === "1") {
    await page.locator("body").click({ position: { x: 1, y: 180 } });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/capturas/inicio-${info.project.name}.png`, fullPage: info.project.name === "escritorio", scale: "css", animations: "disabled" });
  }
  await page.getByRole("link", { name: "Reservar una cita", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reserva tu próxima cita.");
});

test("confirma una reserva real en el fixture y ya no muestra el horario ocupado", async ({ page }, info) => {
  await page.goto("/reservar");
  await page.getByRole("radio", { name: /Corte clásico/ }).check();
  const offset = info.project.name === "movil" ? 14 : 7;
  let date = addDays(santiagoDate(), offset);
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) date = addDays(date, 1);
  await page.getByLabel("Fecha", { exact: true }).fill(date);
  const group = page.getByRole("radiogroup", { name: "Horarios disponibles" });
  await expect(group).toBeVisible();
  await group.getByRole("radio", { name: "10:00", exact: true }).check();
  await expect(page.getByRole("complementary")).toContainText("30 min");
  if (process.env.STRAVLY_SCREENSHOTS === "1" && info.project.name === "escritorio") {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: "docs/capturas/reserva-escritorio.png", fullPage: true, animations: "disabled" });
  }
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente Demo");
  await page.getByLabel("Correo electrónico").fill("reserva@example.test");
  await page.getByLabel("Teléfono").fill("+56 9 0000 0000");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByRole("heading", { name: "¡Cita confirmada!" })).toBeVisible();
  await expect(page.getByText(/^ST-[0-9A-F]{16}$/)).toBeVisible();
  await page.getByRole("button", { name: "Hacer otra reserva" }).click();
  await page.getByRole("radio", { name: /Corte clásico/ }).check();
  await page.getByLabel("Fecha", { exact: true }).fill(date);
  await expect(group.getByRole("radio", { name: "10:30", exact: true })).toBeVisible();
  await expect(group.getByRole("radio", { name: "10:00", exact: true })).toHaveCount(0);
  await expect(group.getByRole("radio", { name: "10:15", exact: true })).toHaveCount(0);
});

test("protege el panel y no almacena la respuesta de acceso en caché", async ({ page, request }) => {
  await page.goto("/admin?seccion=servicios");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Acceso administrador" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Panel de administración" })).toHaveCount(0);
  const response = await request.get("/admin/login");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});
