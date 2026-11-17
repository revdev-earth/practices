# Practices

App para organizar prácticas en grupo sobre cualquier tema. Una persona publica una práctica con fecha, duración y tamaño de grupo. Otras se apuntan. Con el mínimo, la práctica queda confirmada. Con el máximo lleno, quien llega entra a la lista de espera y sube cuando alguien sale.

Cada persona ve las horas en su propia zona horaria.

## Qué incluye

- Registro con código de confirmación de 6 dígitos por email, login, logout y recuperación de contraseña. Todo ocurre en una ventana sobre la portada.
- Calendario mensual donde aterriza quien inicia sesión, con cada práctica en su día.
- Lista de prácticas con vistas: próximas, por completar, confirmadas, mías y pasadas.
- Detalle con hoja de inscripción, lista de espera, unirse, salir, copiar resumen y edición en el mismo lugar con el lápiz.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7 con libSQL, Better Auth, Zod 4, Resend y pnpm. Sin Redux.

## Puesta en marcha

```bash
cp .env.example .env   # completa BETTER_AUTH_SECRET y SEED_PASSWORD
pnpm install
pnpm db:push && pnpm db:seed
pnpm dev               # http://localhost:3000
```

Los usuarios demo comparten la contraseña de `SEED_PASSWORD`, por ejemplo `dana@practices.test`. En desarrollo la ventana de login ofrece un botón para rellenarlos con un clic.

Sin `RESEND_API_KEY`, en desarrollo el código de confirmación y el enlace de recuperación se imprimen en la terminal del servidor.

## Scripts

| Comando | Qué hace |
|---------|----------|
| `pnpm dev` | Servidor de desarrollo con la base local |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Sincroniza el esquema con la base local |
| `pnpm db:seed` | Borra la base local y carga usuarios y prácticas de demo |
| `pnpm db:studio` | Prisma Studio |
| `pnpm dev:staging` y `pnpm dev:prod` | Servidor apuntando a Turso de staging o producción |
| `pnpm db:staging:push` y `pnpm db:prod:push` | Crean las tablas y columnas que falten en Turso. Solo añaden |
| `pnpm db:staging:seed` | Carga datos de demo en staging. Producción nunca se siembra |

`pnpm dev:prod` escribe en la base de producción. Con una base remota recién creada hace falta correr antes el `push` correspondiente, o las consultas fallan con `no such table`.

## Despliegue

Vercel ejecuta `scripts/vercel-build.mjs`: genera el cliente, sincroniza el esquema en Turso y compila. Variables necesarias por entorno:

`DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` y `FROM_EMAIL`.

Sin las dos últimas nadie puede terminar un registro, porque el código nunca llega.

## Documentación

Está en [docs/](docs/README.md). Para retomar el trabajo, empieza por [docs/status.md](docs/status.md).

El proyecto de referencia es `properties`, en `/Users/rev/dev/properties`.
