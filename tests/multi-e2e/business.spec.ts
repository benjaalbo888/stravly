import { devices, expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addDays, santiagoDate } from "../../src/lib/schedule";

const password = "LocalDemo!Stravly2026";
const mail = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const suffix = randomUUID().slice(0,8);
const captures = process.env.STRAVLY_CAPTURE_MULTI === "1";
const slugA = `central-${suffix}`;
const slugB = `norte-${suffix}`;
const tomorrow = addDays(santiagoDate(),4);

async function register(page: Page, email: string) {
  await page.goto("/registro");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button",{name:"Crea tu cuenta"}).click();
  await expect(page).toHaveURL(/\/confirmar$/);
  let code = "";
  await expect.poll(async () => {
    const list = await (await fetch(`${mail}/api/v1/messages`)).json();
    const match = list.messages?.find((item: {To: {Address:string}[]}) => item.To.some((to) => to.Address === email));
    if (!match) return "";
    const message = await (await fetch(`${mail}/api/v1/message/${match.ID}`)).json();
    code = String(message.HTML ?? "").match(/<strong>(\d{6})<\/strong>/)?.[1] ?? "";
    return code;
  }).toMatch(/^\d{6}$/);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Código").fill(code);
  await page.getByRole("button",{name:"Confirma tu correo"}).click();
  await expect(page.getByRole("heading",{name:"Mis negocios"})).toBeVisible();
}

async function onboard(page: Page, slug: string, name: string) {
  await page.getByRole("link",{name:"Crear mi negocio",exact:true}).click();
  await page.getByLabel("Nombre comercial").fill(name);
  await page.getByLabel("Teléfono de contacto").fill("+56900000000");
  await page.getByLabel("Correo de contacto").fill("contacto@example.test");
  await page.getByLabel("Enlace público").fill(slug);
  await page.getByLabel("Primer profesional").fill("Profesional Uno");
  await page.getByLabel("Domingo").check();
  await page.getByRole("button",{name:"Crear negocio",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard\/[a-f0-9-]+\?tab=servicios$/);
  await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
  return new URL(page.url()).pathname;
}

async function service(page: Page, name: string) {
  await page.getByLabel("Servicio",{exact:true}).fill(name);
  await page.getByLabel("Precio (CLP)").fill("4500");
  await page.getByRole("button",{name:"Crear servicio"}).click();
  await expect(page.getByText(/Servicio guardado/)).toBeVisible();
}

async function setupWorker(page: Page, worker: string, name: string, setHours = false) {
  const card = page.locator("details").filter({has: page.locator("summary").filter({hasText:new RegExp(`^${worker}$`)})}).first();
  await card.locator("summary").first().click();
  await card.getByLabel(name,{exact:true}).check();
  await card.getByRole("button",{name:"Guardar servicios",exact:true}).click();
  await expect(card.getByText("Servicios asignados.")).toBeVisible();
  if (setHours) {
    await card.locator("summary").filter({hasText:"Horario individual"}).click();
    for (const checkbox of await card.getByRole("checkbox",{name:"Disponible",exact:true}).all()) await checkbox.check();
    await card.getByRole("button",{name:"Guardar horario",exact:true}).click();
    await expect(card.getByText("Horario guardado.")).toBeVisible();
  }
}

async function prepare(page: Page, slug: string, name: string, worker: string) {
  await page.goto(`/b/${slug}`);
  await page.getByRole("radio",{name:new RegExp(name)}).check();
  await page.getByRole("radio",{name:worker,exact:true}).check();
  await page.getByLabel("Fecha",{exact:true}).fill(tomorrow);
  await page.getByRole("radio",{name:"10:00",exact:true}).check();
  await page.getByLabel("Nombre",{exact:true}).fill("Cliente Demo");
  await page.getByLabel("Correo electrónico",{exact:true}).fill("cliente@example.test");
  await page.getByLabel("Teléfono",{exact:true}).fill("+56900000000");
}

test("registro real, dos negocios, equipo, permisos y reservas desde Chrome",async ({ browser }) => {
  const owner = await browser.newPage();
  const other = await browser.newPage();
  const client = await browser.newPage(devices["Pixel 7"]);
  const contender = await browser.newPage();
  await client.goto("/dashboard");
  await expect(client).toHaveURL(/\/login$/);
  await register(owner,`central-${suffix}@example.test`);
  await register(other,`norte-${suffix}@example.test`);
  const first = await onboard(owner,slugA,"Barbería Central");
  await service(owner,"Corte Central");
  await owner.getByRole("link",{name:"Trabajadores",exact:true}).click();
  await owner.getByLabel("Nombre del profesional",{exact:true}).fill("Profesional Dos");
  await owner.getByRole("button",{name:"Añadir profesional",exact:true}).click();
  await expect(owner.getByText(/Profesional guardado/)).toBeVisible();
  await setupWorker(owner,"Profesional Uno","Corte Central");
  await setupWorker(owner,"Profesional Dos","Corte Central",true);
  if (captures) await owner.screenshot({path:"test-results/multi-trabajadores.png", fullPage:true});
  const second = await onboard(other,slugB,"Barbería Norte");
  await service(other,"Corte Norte");
  await other.getByRole("link",{name:"Trabajadores",exact:true}).click();
  await setupWorker(other,"Profesional Uno","Corte Norte");
  const denied = await other.goto(first);
  expect(denied?.status()).toBe(404);
  expect((await owner.goto(second))?.status()).toBe(404);

  await prepare(client,slugA,"Corte Central","Profesional Uno");
  expect(await client.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(client.viewportSize()!.width);
  if (captures) await client.screenshot({path:"test-results/multi-reserva-movil.png", fullPage:true});
  await prepare(contender,slugA,"Corte Central","Profesional Uno");
  await Promise.all([client,contender].map(page => page.getByRole("button",{name:"Confirmar reserva"}).click()));
  const outcomes = await Promise.all([client,contender].map(async page => {
    await expect(page.getByText(/Cita confirmada|Ese horario dejó de estar disponible/)).toBeVisible();
    return page.getByRole("heading",{name:"¡Cita confirmada!"}).isVisible();
  }));
  expect(outcomes.filter(Boolean)).toHaveLength(1);
  await prepare(client,slugA,"Corte Central","Cualquier profesional disponible");
  await client.getByRole("button",{name:"Confirmar reserva"}).click();
  await expect(client.getByText(/Te atenderá Profesional Dos/)).toBeVisible();
  await prepare(contender,slugB,"Corte Norte","Profesional Uno");
  await contender.getByRole("button",{name:"Confirmar reserva"}).click();
  await expect(contender.getByRole("heading",{name:"¡Cita confirmada!"})).toBeVisible();
  await owner.goto(`${first}?fecha=${tomorrow}&vista=semana`);
  await expect(owner.getByRole("row").filter({hasText:"Corte Central"})).toHaveCount(2);
  await expect(owner.getByText("Corte Norte",{exact:true})).toHaveCount(0);
  if (captures) await owner.screenshot({path:"test-results/multi-agenda.png", fullPage:true});

  await owner.goto(`${first}?tab=administradores`);
  await owner.getByLabel("Correo de la persona invitada").fill(`norte-${suffix}@example.test`);
  await owner.getByRole("button",{name:"Generar invitación"}).click();
  await expect(owner.getByRole("button",{name:"Copiar enlace de invitación"})).toBeVisible();
  await owner.context().grantPermissions(["clipboard-read","clipboard-write"]);
  await owner.getByRole("button",{name:"Copiar enlace de invitación"}).click();
  const invite = await owner.evaluate(() => navigator.clipboard.readText());
  expect(new URL(invite).pathname).toBe("/invitacion");
  await other.goto(invite);
  await other.getByRole("button",{name:"Aceptar invitación"}).click();
  await expect(other).toHaveURL(new RegExp(`${first}$`));
  await expect(other.getByRole("link",{name:"Administradores",exact:true})).toHaveCount(0);
});
