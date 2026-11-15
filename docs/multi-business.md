# Activación de Stravly 2.0

## Desarrollo y Preview

Usa un proyecto Supabase separado de producción con datos ficticios. Las migraciones crean el modelo independiente de negocios y una función para importar Estudio Norte. Aplicarlas no importa el negocio ni cambia la aplicación publicada.

1. Aplica la [migración inicial](../supabase/migrations/20261114000100_stravly.sql) en una base nueva. Aplica después [el modelo multiempresa](../supabase/migrations/20261115000100_multi_business.sql) y [la función de activación](../supabase/migrations/20261115000200_legacy_cutover.sql). Si la migración inicial ya se aplicó, comprueba el historial antes de ejecutar archivos adicionales.
2. Mantén habilitada la confirmación de correo de Supabase Auth y activa el registro por correo. Usa la [plantilla de confirmación con código](../tests/supabase/confirmation.html). Para cuentas externas, configura SMTP propio y comprueba que el código llega a una dirección que no pertenezca al equipo. El SMTP predeterminado de Supabase está limitado al equipo. [Configuración oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
3. Configura las tres variables `SUPABASE_*` del proyecto de pruebas y `STRAVLY_MULTI_BUSINESS=1` en el archivo local o en las variables de Preview para `feature/multi-business`. Guarda la clave secreta solo del lado servidor. Comprueba la URL de Supabase del despliegue de Preview antes de usar formularios.
4. Para ensayar Estudio Norte, registra y verifica una cuenta de prueba en la base aislada. Invoca la función de importación con el UUID de esa cuenta y verifica que `/reservar` redirige a `/b/estudio-norte`. `/admin` se conserva como enlace al panel nuevo.
5. Prueba el alta de dos negocios, la confirmación de correo, el aislamiento de sus agendas, la aceptación de una invitación y la cancelación de citas.

GitHub Actions ejecuta el flujo de correo con Mailpit y los servicios oficiales de Supabase iniciados por la CLI. El entorno se crea desde `tests/supabase` en un directorio desechable y solo usa datos sintéticos. Ese ensayo es independiente del Preview alojado en Vercel.

## Migración de Estudio Norte

Las filas originales quedan en sus tablas de la versión 1. La función copia los servicios, horarios, bloqueos, accesos y reservas conservando los identificadores y el código de cada cita. Las reservas antiguas se asocian al profesional «Agenda original», con el horario existente y los servicios migrados. El dueño debe identificarse explícitamente. Los demás usuarios de `administrators` quedan como administradores del negocio.

Con el dueño confirmado y Preview validado, guarda un respaldo de producción y ensaya su restauración en una base aislada antes de activar 2.0. Para una copia lógica, incluye los esquemas `public`, `auth` y `stravly_private` y guarda el archivo cifrado fuera del repositorio. Usa la guía de Supabase para conservar los datos de Auth y verificar su restauración. [Respaldos y restauración](https://supabase.com/docs/guides/platform/backups)

1. Registra los recuentos y compara los registros de reservas, servicios, usuarios autorizados, horarios y bloqueos en la copia recuperada. Ensaya la importación y compara ID, código, cliente, estado, fechas y servicio de cada reserva.
2. Prepara el despliegue de producción con las variables del proyecto correcto y `STRAVLY_MULTI_BUSINESS=1` sin asignarle el dominio público. Mantén deshabilitado el registro público hasta el corte.
3. En una ventana de mantenimiento corta, aplica las migraciones pendientes y ejecuta la función privada con el **UUID verificado y confirmado**. Necesita el SQL Editor o un rol de base privilegiado. Conserva la salida en privado.

```sql
select stravly_private.import_estudio_norte('<uuid-del-propietario-confirmado>'::uuid);
```

4. Si otra transacción mantiene la agenda ocupada, la función aborta la operación completa. Espera a que termine y vuelve a comprobar los recuentos antes de reintentar. La importación bloquea las escrituras de las rutas antiguas dentro de la misma transacción que copia los registros.
5. Asigna el dominio de producción al despliegue ya verificado. Activa el registro con confirmación y SMTP configurado. Comprueba que Estudio Norte conserva sus reservas, que sus enlaces antiguos redirigen y que una cuenta nueva puede apartarse de Estudio Norte y crear su propio negocio.

Antes de ejecutar la función se puede volver a desplegar la aplicación anterior porque las tablas existentes siguen operativas. Después del corte, cualquier recuperación debe preservar las escrituras de 2.0. Si hay tráfico nuevo, conserva ambas bases o snapshots y restaura primero en un entorno aislado para conciliar transacciones antes de tocar producción.

## Alcance de roles

El propietario configura el perfil y el horario general, invita administradores y retira accesos. Los administradores gestionan la agenda, sus bloqueos, servicios y trabajadores. Las invitaciones no cambian el rol del propietario. Son de un uso y su token solo se guarda como hash. La comprobación del correo verificado depende de que Supabase mantenga habilitada la confirmación.
