# Job Alert Bot

Agente en Node.js + TypeScript que busca ofertas de empleo para perfiles SSR/SR de React, React Native o Frontend, compara cada oferta contra el CV virtual con IA y envia un resumen por correo.

El objetivo es recibir actualizaciones automáticas cada 1 hora con ofertas relevantes para LATAM, Europa, posiciones remotas, freelance o contractor.

## Que Hace

Cada ejecución del bot hace este flujo:

```txt
1. El orquestador consulta fuentes de empleo publicas.
2. Normaliza todas las ofertas a un formato comun.
3. Hace una preseleccion amplia por senales tecnicas para no gastar IA en basura.
4. Descarta ofertas ya enviadas anteriormente.
5. El agente de IA compara cada oferta contra el CV virtual, experiencia, tecnologias y preferencias.
6. La IA decide aplicar, revisar o descartar.
7. Genera un resumen en texto y HTML con explicacion de compatibilidad.
8. Envia el resumen por email usando SMTP.
```

El bot puede ejecutarse de dos formas:

- Manualmente desde tu Mac.
- Automaticamente cada 1 hora con GitHub Actions.

## Criterios Del Agente

El agente busca ofertas que tengan senales de:

- Tecnologia: React, React Native, React.js, ReactJS, Frontend o Front-end.
- Seniority objetivo: SSR, Semi Senior, Senior o SR.
- Perfil principal: mas frontend/mobile que backend.
- Fullstack solo si el foco real sigue siendo frontend con React, React Native o Next.js.
- Modalidad: full remote, sin exigir vivir en un pais especifico. Puede ser mundial o por region amplia.
- Idioma: oferta en espanol o con senal clara de equipo/mercado hispanohablante.

La IA verifica el ingles requerido:

- Si no pide ingles, puede pasar.
- Si pide ingles B1, B2 o intermedio, puede pasar.
- Si pide ingles C1, C2, advanced, fluent o native, se descarta.

El preselector descarta antes de la IA ofertas Junior, Trainee, Intern, Internship, Practicas o Becario.

## Evaluacion Con IA

El bot puede usar IA para leer cada oferta y compararla contra el CV virtual:

```txt
https://oswaldo-virtual-cv.vercel.app/es
```

Esta etapa sirve para evitar falsos positivos como ofertas Fullstack que mencionan React pero en realidad son mas backend que frontend.

Cuando `ENABLE_AI_MATCHING=true`, cada oferta preseleccionada se evalua con estos criterios:

- Compatibilidad general de 0 a 100.
- Recomendacion: aplicar, revisar o descartar.
- Resumen de la oferta en espanol.
- Motivos concretos por los que matchea.
- Dudas o riesgos.
- Fit Frontend: alto, medio o bajo.
- Peso Backend: alto, medio o bajo.
- Nivel de ingles detectado.
- Rango salarial, si aparece en la oferta.
- Compatibilidad con remoto, LATAM o Europa.

La IA descarta del email las ofertas que no sean recomendacion `aplicar`, tengan score menor a `AI_MIN_COMPATIBILITY_SCORE`, no tengan fit frontend alto, tengan backend alto, pidan ingles mayor a B2, exijan vivir en un pais especifico o no tengan senal de espanol.

Esto no es RAG con vector database. El CV virtual es pequeno y publico, asi que el agente lo lee completo en cada ejecucion y lo mete como contexto directo del modelo. Si luego agregas varios CVs, portfolio largo, cartas, historial de postulaciones o preferencias extensas, ahi si tendria sentido convertirlo en RAG.

## Fuentes Incluidas

Fuentes que el bot consulta automaticamente:

- Remotive API.
- RemoteOK API.
- Jobicy API.
- Get on Board API.
- Arbeitnow API.
- Google Jobs via SerpApi, opcional, para traer resultados de LinkedIn, Indeed y job boards de empresas.
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

Por eso el agente usa fuentes publicas, APIs/RSS disponibles y, opcionalmente, SerpApi Google Jobs. Google Jobs suele agregar ofertas desde LinkedIn, Indeed, portales de empleo y job boards propios de empresas.

- Usar `SERPAPI_API_KEY` para activar busquedas en Google Jobs.
- Usar la API oficial de LinkedIn solo si tienes acceso aprobado.
- Usar un proveedor externo como Apify, TheirStack o Coresignal si necesitas LinkedIn directo.
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
    agent/
      jobAgent.ts
      preselectJobs.ts
      sourceRunner.ts
    sources/
      arbeitnow.ts
      getonboard.ts
      jobicy.ts
      remoteok.ts
      remotive.ts
      rss.ts
      serpapi.ts
    filters/
      normalize.ts
    services/
      aiMatcher.ts
      cv.ts
      digest.ts
      email.ts
      state.ts
  tests/
    jobAgent.test.ts
  .env.example
  .gitignore
  package.json
  tsconfig.json
```

## Archivos Principales

`src/index.ts`

Arranca el agente.

`src/agent/jobAgent.ts`

Orquestador principal: consulta fuentes, deduplica, preselecciona candidatos, llama a la IA, genera el digest y envia el email.

`src/agent/sourceRunner.ts`

Ejecuta todas las fuentes de empleo y captura estadisticas o fallos por fuente.

`src/agent/preselectJobs.ts`

Preselector barato y amplio. No decide compatibilidad final; solo evita gastar IA en ofertas claramente fuera del area.

`src/config.ts`

Contiene configuracion, filtros, palabras clave y variables de entorno.

`src/sources/`

Contiene los conectores a cada fuente de empleo.

`src/services/email.ts`

Envia el email usando SMTP.

`src/services/digest.ts`

Genera el resumen del correo en texto y HTML.

`src/services/aiMatcher.ts`

Evalua cada oferta con IA contra el CV y decide si conviene aplicarla, revisarla o descartarla.

`src/services/cv.ts`

Lee el CV virtual publico para usarlo como contexto de matching.

`src/services/state.ts`

Guarda ofertas ya enviadas en `data/seen-jobs.json` para no repetirlas.

`.github/workflows/daily-jobs.yml`

Workflow de GitHub Actions que ejecuta el bot cada 1 hora.

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
OPENAI_API_KEY=
SERPAPI_API_KEY=

ENABLE_AI_MATCHING=true
OPENAI_MODEL=gpt-5-mini
CV_URL=https://oswaldo-virtual-cv.vercel.app/es
AI_MAX_CANDIDATES=30
AI_MIN_COMPATIBILITY_SCORE=90
ENABLE_SERPAPI=false
SERPAPI_LOCATION=Miami, Florida, United States
SERPAPI_GL=us
SERPAPI_HL=es
SERPAPI_MONTHLY_LIMIT=220
SERPAPI_RUN_EVERY_HOURS=12
SERPAPI_MAX_QUERIES_PER_RUN=3
SERPAPI_QUERIES=
LOOKBACK_DAYS=7
MAX_JOBS_PER_EMAIL=20
SEND_EMPTY_DIGEST=false
EXTRA_RSS_FEEDS=
```

`SMTP_PASSWORD` debe ser una App Password de Gmail, no la contrasena normal de la cuenta.

`OPENAI_API_KEY` es necesaria solo si activas `ENABLE_AI_MATCHING=true`.

`SERPAPI_API_KEY` es necesaria solo si activas `ENABLE_SERPAPI=true`.

Para cuidar el plan gratis de SerpApi, el agente tiene un limite interno:

```txt
SERPAPI_MONTHLY_LIMIT=220
SERPAPI_RUN_EVERY_HOURS=12
SERPAPI_MAX_QUERIES_PER_RUN=3
```

Con esos valores, aunque GitHub Actions corra cada 1 hora, SerpApi solo se consulta cada 12 horas y ejecuta hasta 3 busquedas por vez. Eso consume aproximadamente 180-186 busquedas al mes y deja margen por debajo de 220.

`SERPAPI_QUERIES` permite definir busquedas separadas por `|`. Ejemplo:

```txt
Senior React Native remote LATAM contractor|Senior React frontend remote Europe B2|React Native remoto Espana freelance
```

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
- Google Jobs / LinkedIn / Job boards: X ofertas recibidas
- Total recibido: X
- Recientes: X
- Candidatas para IA: X
- Nuevas no enviadas antes: X
- Evaluadas por IA: X
- Seleccionadas para email: X
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

El workflow corre cada 1 hora usando este cron:

```txt
17 * * * *
```

GitHub Actions usa UTC. El bot se ejecuta cada 1 hora durante todo el dia, en el minuto 17 de cada hora.

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
OPENAI_API_KEY
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
OPENAI_API_KEY = sk-...
```

Secret opcional para buscar tambien en Google Jobs, LinkedIn, Indeed y job boards de empresas via SerpApi:

```txt
SERPAPI_API_KEY
```

Variables opcionales en GitHub Actions:

```txt
LOOKBACK_DAYS
MAX_JOBS_PER_EMAIL
ENABLE_AI_MATCHING
OPENAI_MODEL
CV_URL
AI_MAX_CANDIDATES
AI_MIN_COMPATIBILITY_SCORE
ENABLE_SERPAPI
SERPAPI_LOCATION
SERPAPI_GL
SERPAPI_HL
SERPAPI_MONTHLY_LIMIT
SERPAPI_RUN_EVERY_HOURS
SERPAPI_MAX_QUERIES_PER_RUN
SERPAPI_QUERIES
SEND_EMPTY_DIGEST
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
Actions -> Job alert hourly -> Run workflow
```

Si el workflow corre bien, despues queda automatico cada 1 hora.

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
