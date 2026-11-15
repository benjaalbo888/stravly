# Desplegar Stravly en Vercel

## Preparación

1. Crea un proyecto nuevo dedicado a Stravly en [Supabase](https://supabase.com/dashboard). Completa la migración, desactiva el registro público y prepara el primer administrador siguiendo el [README](../README.md).
2. Inicia sesión oficialmente en [Vercel](https://vercel.com/login), o en PowerShell ejecuta `npx --yes vercel login --github`.
3. En la cuenta correcta, comprueba que el nombre `stravly` esté libre. Crea un proyecto **nuevo** con `npx --yes vercel project add stravly` y vincula esta carpeta con `npx --yes vercel link --project stravly`. Si el nombre ya existe, revisa su origen antes de usarlo.
4. En **Settings → Environment Variables** del proyecto, configura `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` en **Preview** y **Production**. Marca la clave secreta como sensible. Si tienes un segundo proyecto de Supabase para pruebas, usa sus valores en **Preview**. Configura `STRAVLY_GITHUB_URL` con la URL pública real del repositorio. Conserva las variables de sistema de Vercel habilitadas para el límite por IP; localmente, el límite se comparte entre las solicitudes de prueba.

## Verificación antes de producción

1. Ejecuta `npx --yes vercel deploy` para obtener una URL de Preview.
2. En la vista previa, reserva con datos ficticios. Guarda el código y comprueba que el intervalo ya no aparece libre. Si estás probando en dos ventanas, prepara dos reservas para la misma hora antes de enviarlas: debe quedar confirmada solo una.
3. En una ventana sin sesión, comprueba que `/admin` redirige a `/admin/login`. Inicia sesión con la cuenta autorizada y comprueba el código en la agenda. Cancela la cita y verifica que el horario vuelve a quedar libre.
4. Crea un servicio de prueba, edítalo y desactívalo. Modifica el horario de un día y crea y quita un bloqueo. Comprueba el efecto en `/reservar` y restaura los ajustes de la demostración. Cierra sesión y comprueba que `/admin` vuelve a quedar protegido.
5. Cuando funcionen las reservas y el acceso privado, ejecuta `npx --yes vercel deploy --prod`. Confirma en la URL final la portada, una reserva con datos ficticios y el acceso autorizado. Si pruebas contra la base de producción, cancela las citas de prueba para dejar libre la agenda.
6. Vincula el proyecto con el repositorio de GitHub en **Settings → Git** o con `npx --yes vercel git connect` para activar despliegues desde Git en el proyecto verificado. Añade al README y a la descripción de GitHub únicamente la URL comprobada.

[Guía oficial de despliegue por CLI](https://vercel.com/docs/projects/deploy-from-cli) · [Variables de entorno en Vercel](https://vercel.com/docs/environment-variables)
