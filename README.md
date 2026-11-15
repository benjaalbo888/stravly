# Stravly

**Tu tiempo, mejor organizado.** Stravly es una aplicación de reservas online para una barbería de demostración. Los clientes pueden reservar sin crear una cuenta. El negocio mantiene una sola agenda desde un panel privado.

[Abrir la demo de Stravly](https://stravly.vercel.app/)

## Qué puedes hacer

- **Reservar:** elige un servicio, consulta su duración y precio en pesos chilenos, selecciona un horario libre y recibe un código de confirmación.
- **Administrar:** consulta las citas de hoy y las próximas, filtra por fecha, cancela reservas, edita servicios y configura horarios y bloqueos.
- **Mantener una agenda consistente:** los intervalos ocupados dejan de aparecer. PostgreSQL decide qué solicitud se confirma si dos clientes intentan reservar intervalos que se superponen.

La agenda usa la zona horaria `America/Santiago`. Cada servicio consume un intervalo de tiempo completo y las reservas se pueden hacer con hasta 60 días de anticipación. Para probar el proyecto, usa datos ficticios.

## Tecnologías

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, Supabase Auth y PostgreSQL. La demo se ejecuta en Vercel. Las pruebas usan Node.js, PGlite, PostgreSQL y Playwright.

## Capturas

![Portada de Stravly con acceso a la reserva y una vista del calendario](docs/capturas/inicio-escritorio.png)

[Portada en móvil](docs/capturas/inicio-movil.png) · [Formulario de reserva con horarios libres](docs/capturas/reserva-escritorio.png) · [Agenda con una cita ficticia](docs/capturas/agenda-escritorio.png)

## Ejecutar en local

Requisitos: Node.js 24, npm y un proyecto Supabase dedicado a Stravly.

```bash
npm ci
```

Copia `.env.example` a `.env.local` (`Copy-Item .env.example .env.local` en PowerShell) y rellena:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto, disponible en **Connect**. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave `sb_publishable_…` de **Project Settings → API Keys**. |
| `SUPABASE_SECRET_KEY` | Clave `sb_secret_…` del mismo proyecto. Solo servidor. |
| `STRAVLY_GITHUB_URL` | Opcional. Sustituye el enlace al repositorio oficial si alojas una copia pública llamada `stravly`. |

La clave secreta da acceso privilegiado al proyecto. Guárdala en `.env.local` o en las variables sensibles de Vercel. Evita el prefijo `NEXT_PUBLIC_` y no subas este archivo.

1. En el **SQL Editor** del proyecto nuevo, ejecuta una vez la [migración inicial](supabase/migrations/20261114000100_stravly.sql). Incluye tres servicios ficticios, horarios y políticas de acceso.
2. En **Authentication → Settings**, desactiva **Allow new users to sign up**. En **Authentication → Users**, crea manualmente una cuenta con correo y contraseña fuerte y confirma el correo desde el panel de Supabase. Copia el UUID de ese usuario.
3. En **SQL Editor**, añade ese UUID a la lista de administradores. La contraseña se gestiona exclusivamente en Supabase:

```sql
insert into public.administrators (user_id)
values ('REEMPLAZA_POR_EL_UUID_DEL_USUARIO'::uuid);
```

4. Ejecuta `npm run dev` y abre `http://localhost:3000`. Prueba `/reservar` e inicia sesión en `/admin/login`.

[Claves API de Supabase](https://supabase.com/docs/guides/api/api-keys) · [Configuración de Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration)

## Arquitectura

| Capa | Qué hace |
| --- | --- |
| `src/app/` | Portada, formulario público, API de disponibilidad y panel privado. |
| `src/lib/` | Validación, formatos de fecha y precio, clientes Supabase para servidor. |
| `supabase/migrations/` | Tablas, políticas RLS, agenda inicial y funciones de disponibilidad y confirmación. |
| `tests/` | Pruebas de validación, base de datos, concurrencia y navegador. |

El navegador recibe el catálogo y los horarios libres. Al confirmar, la acción de servidor valida los campos y llama a una función SQL reservada a la clave secreta. La función verifica el horario, registra la reserva dentro de la transacción y devuelve el código. La base de datos aplica una restricción de exclusión a los intervalos de citas confirmadas.

El panel usa cookies de sesión de Supabase Auth, comprueba la pertenencia a la lista de administradores y aplica RLS a cada operación. Una cuenta normal no puede consultar las reservas. Los resultados del panel no se almacenan en caché compartida.

## Pruebas

```bash
npm run lint
npm test
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

- `npm test` ejecuta validaciones y aplica la migración en PostgreSQL embebido. Comprueba permisos, reservas, horarios ocupados, cancelaciones, servicios, bloqueos y el límite de intentos.
- `npm run test:e2e` usa la compilación de producción en escritorio y móvil. Una API local de pruebas conecta la app con la base migrada. Cubre la reserva pública y la redirección de usuarios anónimos; el inicio de sesión con Supabase Auth se verifica en un proyecto Supabase.
- `npm run test:concurrency` requiere `STRAVLY_TEST_DATABASE_URL`, apuntando a una base local vacía llamada `stravly_test` en un clúster PostgreSQL descartable, sin roles de Supabase. Usa dos conexiones reales para comprobar reservas simultáneas y cambios de disponibilidad. GitHub Actions provee este clúster en cada ejecución.

## Estado y próximas mejoras

MVP para un solo negocio. La confirmación se muestra en pantalla. Un siguiente paso sería añadir recordatorios, permitir reprogramar una cita con un enlace privado y definir un plazo de conservación de datos antes de usar Stravly con clientes reales.

El flujo público y el acceso al panel se verificaron contra Supabase en Vercel. Las pruebas incluyen dos clientes que reservan la misma hora, la cancelación desde el panel y la recuperación del horario. [Guía de despliegue y verificación](docs/despliegue.md).
