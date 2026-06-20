# Job Alert Bot

Bot en Node.js + TypeScript para buscar ofertas laborales, compararlas con perfiles definidos en el proyecto usando IA y enviar resúmenes por correo.

El objetivo es recibir oportunidades relevantes para varios perfiles sin revisar manualmente portales de empleo todos los días.

## Stack

- Node.js
- TypeScript
- OpenAI API para evaluar compatibilidad con cada perfil
- SerpApi para Google Jobs / LinkedIn / Indeed / job boards indexados por Google
- RSS feeds configurables
- SMTP Gmail para envío de correos
- GitHub Actions para ejecución automática

## Perfiles

El proyecto contiene tres perfiles:

- `React Frontend Profile`: React, React Native, Next.js, frontend/mobile, remoto, LATAM/Europa, español o mercado hispanohablante.
- `Nursing Caracas Profile`: enfermería, cuidado de pacientes, enfermería domiciliaria y roles asistenciales en Caracas.
- `Bakery Caracas Profile`: panadería, pastelería, repostería, bombonería, decoración de tortas y roles afines en Caracas.

Cada perfil tiene sus propios filtros, búsqueda, email destino y criterios de IA.

## Cómo Funciona

1. Busca ofertas en fuentes públicas, RSS y SerpApi.
2. Filtra por palabras clave del perfil.
3. Evita reenviar ofertas ya enviadas.
4. Usa IA para resumir y evaluar compatibilidad.
5. Envía un correo con las ofertas seleccionadas.

Los correos incluyen resumen, compatibilidad, por qué matchea, dudas/riesgos, salario si aparece y link de aplicación.

## Instalación Local

```bash
npm install
cp .env.example .env
```

Configura `.env` con tus credenciales de correo, OpenAI, SerpApi y emails destino.

Ejecutar en local:

```bash
npm run dev
```

Ejecutar forzando búsqueda SerpApi para los tres perfiles:

```bash
SERPAPI_RUN_EVERY_HOURS=0 NURSING_SERPAPI_RUN_EVERY_HOURS=0 BAKERY_SERPAPI_RUN_EVERY_HOURS=0 npm run dev
```

Reenviar desde cero en local:

```bash
rm -f data/seen-jobs-react-frontend.json data/seen-jobs-nursing-caracas.json data/seen-jobs-bakery-caracas.json
SERPAPI_RUN_EVERY_HOURS=0 NURSING_SERPAPI_RUN_EVERY_HOURS=0 BAKERY_SERPAPI_RUN_EVERY_HOURS=0 npm run dev
```

## GitHub Actions

El workflow está en:

```txt
.github/workflows/daily-jobs.yml
```

Corre cada 12 horas:

```txt
8:00 AM Venezuela
8:00 PM Venezuela
```

También puede ejecutarse manualmente desde:

```txt
Actions -> Job alert every 12 hours -> Run workflow
```

## Secrets Principales

Configurar en:

```txt
Settings -> Secrets and variables -> Actions -> Secrets
```

Secrets:

```txt
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
EMAIL_FROM
EMAIL_TO
OPENAI_API_KEY
SERPAPI_API_KEY
NURSING_EMAIL_TO
NURSING_CV_TEXT
BAKERY_EMAIL_TO
BAKERY_CV_TEXT
```

## Variables Principales

Configurar en:

```txt
Settings -> Secrets and variables -> Actions -> Variables
```

Variables habituales:

```txt
ENABLE_AI_MATCHING=true
OPENAI_MODEL=gpt-5-mini
ENABLE_SERPAPI=true
SERPAPI_RUN_EVERY_HOURS=12
SERPAPI_MAX_QUERIES_PER_RUN=1
SERPAPI_MONTHLY_LIMIT=220
LOOKBACK_DAYS=60
MAX_JOBS_PER_EMAIL=20
SEND_EMPTY_DIGEST=true
ENABLE_NURSING_PROFILE=true
ENABLE_BAKERY_PROFILE=true
EXTRA_RSS_FEEDS=
```

El resto de variables específicas por perfil están documentadas en `.env.example`.

## Scripts

```bash
npm run dev      # Ejecuta en TypeScript
npm run build    # Compila
npm start        # Ejecuta compilado
npm run check    # Valida TypeScript
npm test         # Tests
```

## Estado Local

El bot guarda estado en `data/` para no reenviar ofertas repetidas:

```txt
data/seen-jobs-react-frontend.json
data/seen-jobs-nursing-caracas.json
data/seen-jobs-bakery-caracas.json
data/serpapi-usage.json
```

Estos archivos no deben contener secretos.

## Seguridad

- No subir `.env` a GitHub.
- No compartir `SMTP_PASSWORD`, `OPENAI_API_KEY` ni `SERPAPI_API_KEY`.
- Para Gmail, usar App Password, no la contraseña normal.
