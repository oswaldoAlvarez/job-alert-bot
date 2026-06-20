# Job Alert Bot

Bot en Node.js + TypeScript que busca ofertas de empleo para perfiles SSR/SR de React, React Native o Frontend, filtra las que mejor encajan con el criterio definido y envía un resumen por correo.

El objetivo es recibir actualizaciones automáticas cada 2 horas con ofertas relevantes para LATAM, Europa, posiciones remotas, freelance o contractor.

## Que Hace

Cada ejecución del bot hace este flujo:

```txt
1. Consulta fuentes de empleo publicas.
2. Normaliza todas las ofertas a un formato comun.
3. Filtra por tecnologia, seniority, region, modalidad e idioma.
4. Descarta ofertas ya enviadas anteriormente.
5. Genera un resumen en texto y HTML.
6. Envia el resumen por email usando SMTP.
```

El bot puede ejecutarse de dos formas:

- Manualmente desde tu Mac.
- Automaticamente cada 2 horas con GitHub Actions.

## Criterios De Busqueda

El bot busca ofertas que cumplan con estas condiciones:

- Tecnologia: React, React Native, React.js, ReactJS, Frontend o Front-end.
- Seniority: SSR, Semi Senior, Senior o SR.
- Region: LATAM, Europa, Espana o paises hispanohablantes/europeos.
- Modalidad: remoto, full remote, freelance, contractor, B2B o contrato.
- Idioma: prioridad a ofertas en espanol.

Para Europa aplica una regla especial:

- Si pide ingles B1, B2 o intermedio, la oferta puede pasar.
- Si pide ingles C1, C2, advanced, fluent o native, se descarta.

Tambien descarta ofertas Junior, Trainee, Intern, Internship, Practicas o Becario.

## Fuentes Incluidas

Fuentes que el bot consulta automaticamente:

- Remotive API.
- RemoteOK API.
- Jobicy API.
- Get on Board API.
- Arbeitnow API.
- We Work Remotely RSS.
- Himalayas Atom feed.
- Real Work From Anywhere RSS.

Tambien permite agregar fuentes RSS extra con:

```env
EXTRA_RSS_FEEDS=
```

Esto sirve para agregar RSS de busquedas concretas de portales como InfoJobs, Tecnoempleo u otros que permitan alertas/RSS.

## Sobre LinkedIn, Indeed, Upwork Y Otros Portales

LinkedIn Jobs, Indeed, Upwork, Bumeran y portales similares no siempre ofrecen una API publica simple para buscar ofertas como candidato. Muchos bloquean automatizaciones con captcha, rate limits o requieren acceso de partner.

Por eso este bot usa fuentes publicas y APIs/RSS disponibles. Para integrar esos portales de forma mas robusta hay tres caminos:

- Usar su API oficial si tienes acceso aprobado.
- Usar un proveedor externo como Apify, SerpApi, TheirStack o Coresignal.
- Crear alertas/RSS cuando el portal lo permita y agregarlas en `EXTRA_RSS_FEEDS`.

## Estructura Del Proyecto

```txt
job-alert-bot/
  .github/workflows/daily-jobs.yml
  data/.gitkeep
  src/
    index.ts
    config.ts
    types.ts
    sources/
      arbeitnow.ts
      getonboard.ts
      jobicy.ts
      remoteok.ts
      remotive.ts
      rss.ts
    filters/
      matchJob.ts
      normalize.ts
    services/
      digest.ts
      email.ts
      state.ts
  tests/
    matchJob.test.ts
  .env.example
  .gitignore
  package.json
  tsconfig.json
```

## Archivos Principales

`src/index.ts`

Orquesta todo el proceso: consulta fuentes, filtra ofertas, genera el digest y envia el email.

`src/config.ts`

Contiene configuracion, filtros, palabras clave y variables de entorno.

`src/sources/`

Contiene los conectores a cada fuente de empleo.

`src/filters/matchJob.ts`

Decide si una oferta pasa o no los filtros.

`src/services/email.ts`

Envia el email usando SMTP.

`src/services/digest.ts`

Genera el resumen del correo en texto y HTML.

`src/services/state.ts`

Guarda ofertas ya enviadas en `data/seen-jobs.json` para no repetirlas.

`.github/workflows/daily-jobs.yml`

Workflow de GitHub Actions que ejecuta el bot cada 2 horas.

## Configuracion Local

Instala dependencias:

```bash
npm install
```

Crea tu archivo `.env` a partir del ejemplo:

```bash
cp .env.example .env
```

Configura el `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=app-password-de-gmail
EMAIL_FROM=tu-email@gmail.com
EMAIL_TO=destino@gmail.com

LOOKBACK_DAYS=3
MAX_JOBS_PER_EMAIL=20
SEND_EMPTY_DIGEST=false
REQUIRE_SPANISH_SIGNAL=true
REQUIRE_REGION_SIGNAL=true
REQUIRE_REMOTE_OR_CONTRACT_SIGNAL=true
REQUIRE_EUROPE_SPANISH_OR_B2_ENGLISH=true
EXTRA_RSS_FEEDS=
```

`SMTP_PASSWORD` debe ser una App Password de Gmail, no la contrasena normal de la cuenta.

## Ejecucion Manual

Para probar sin enviar correo:

```bash
DRY_RUN=true SEND_EMPTY_DIGEST=true npm run dev
```

Esto muestra en consola:

```txt
Resumen de busqueda:
- Remotive: X ofertas recibidas
- RemoteOK: X ofertas recibidas
- Jobicy: X ofertas recibidas
- Get on Board: X ofertas recibidas
- Arbeitnow: X ofertas recibidas
- RSS feeds: X ofertas recibidas
- Total recibido: X
- Recientes: X
- Pasaron filtros: X
- Nuevas no enviadas antes: X
```

Para ejecutar enviando correo real:

```bash
npm run dev
```

Para compilar:

```bash
npm run build
```

Para ejecutar compilado:

```bash
npm start
```

## Automatizacion Con GitHub Actions

El workflow corre cada 2 horas usando este cron:

```txt
0 */2 * * *
```

GitHub Actions usa UTC. El bot se ejecuta cada 2 horas durante todo el dia.

## Secrets Necesarios En GitHub

En GitHub debes crear estos repository secrets:

```txt
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
EMAIL_FROM
EMAIL_TO
```

Valores tipicos para Gmail:

```txt
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 465
SMTP_SECURE = true
SMTP_USER = tu-email@gmail.com
SMTP_PASSWORD = app-password-de-gmail
EMAIL_FROM = tu-email@gmail.com
EMAIL_TO = destino@gmail.com
```

Variables opcionales en GitHub Actions:

```txt
LOOKBACK_DAYS
MAX_JOBS_PER_EMAIL
SEND_EMPTY_DIGEST
REQUIRE_SPANISH_SIGNAL
REQUIRE_REGION_SIGNAL
REQUIRE_REMOTE_OR_CONTRACT_SIGNAL
REQUIRE_EUROPE_SPANISH_OR_B2_ENGLISH
EXTRA_RSS_FEEDS
```

Si no configuras estas variables opcionales, el workflow usa valores por defecto.

## Como Configurar Secrets En GitHub

Entra al repo:

```txt
https://github.com/oswaldoAlvarez/job-alert-bot
```

Luego ve a:

```txt
Settings -> Secrets and variables -> Actions -> Secrets -> New repository secret
```

Crea cada secret de la lista anterior, uno por uno.

## Como Ejecutar En GitHub Manualmente

Despues de subir el proyecto:

```txt
Actions -> Job alert every 2 hours -> Run workflow
```

Si el workflow corre bien, despues queda automatico cada 2 horas.

## Tests Y Validacion

Ejecutar tests:

```bash
npm test
```

Validar TypeScript:

```bash
npm run check
```

Compilar:

```bash
npm run build
```

## Notas De Seguridad

- No subas `.env` a GitHub.
- No compartas `SMTP_PASSWORD`.
- Usa App Password de Gmail.
- Si usas un correo principal, el bot tendra permiso para enviar correos desde esa cuenta.
- Una opcion mas segura es usar un Gmail dedicado solo para el bot.

## Estado Persistente

El bot guarda ofertas enviadas en:

```txt
data/seen-jobs.json
```

Ese archivo evita reenviar las mismas ofertas. En GitHub Actions se conserva usando cache.
