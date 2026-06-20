import { config } from "../config.js";
import { stripHtml } from "../filters/normalize.js";
import type { AiJobEvaluation, MatchedJob } from "../types.js";

const trimArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
};

const clampScore = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;

  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const normalizeLevel = <T extends string>(value: unknown, allowed: T[], fallback: T): T => {
  if (typeof value !== "string") return fallback;
  return allowed.includes(value as T) ? (value as T) : fallback;
};

const parseAiEvaluation = (value: unknown): AiJobEvaluation => {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    compatibilityScore: clampScore(data.compatibilityScore),
    recommendation: normalizeLevel(data.recommendation, ["aplicar", "revisar", "descartar"], "revisar"),
    summary: typeof data.summary === "string" ? data.summary.trim().slice(0, 700) : "",
    matchReasons: trimArray(data.matchReasons),
    concerns: trimArray(data.concerns),
    frontendFit: normalizeLevel(data.frontendFit, ["alto", "medio", "bajo"], "medio"),
    backendWeight: normalizeLevel(data.backendWeight, ["alto", "medio", "bajo"], "medio"),
    englishLevel: typeof data.englishLevel === "string" ? data.englishLevel.trim().slice(0, 120) : "No indicado",
    remoteFit: typeof data.remoteFit === "string" ? data.remoteFit.trim().slice(0, 160) : "No indicado"
  };
};

const readResponseText = (payload: Record<string, unknown>): string => {
  if (typeof payload.output_text === "string") return payload.output_text;

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];

    for (const contentItem of content) {
      if (typeof contentItem !== "object" || contentItem === null) continue;
      const text = (contentItem as Record<string, unknown>).text;
      if (typeof text === "string") return text;
    }
  }

  return "";
};

const extractJson = (value: string): unknown => {
  const trimmed = value.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("La IA no devolvio JSON valido");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
};

const buildPrompt = (job: MatchedJob, cvText: string): string => {
  const description = stripHtml(job.description ?? "").slice(0, 6000);

  return [
    "CV DEL CANDIDATO:",
    cvText,
    "",
    "OFERTA:",
    JSON.stringify(
      {
        title: job.title,
        company: job.company,
        source: job.source,
        location: job.location,
        tags: job.tags,
        salary: job.salary,
        url: job.url,
        description
      },
      null,
      2
    )
  ].join("\n");
};

export const evaluateJobWithAi = async (job: MatchedJob, cvText: string): Promise<MatchedJob> => {
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY no esta configurada");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.openAiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: [
        {
          role: "system",
          content: [
            "Eres un career matching agent para Oswaldo Alvarez.",
            "Evalua ofertas contra su CV y preferencias reales.",
            "Perfil fuerte: Frontend/Mobile con React, React Native, TypeScript, fintech, crypto, healthcare y ownership de producto.",
            "Penaliza fuerte ofertas fullstack cuando el trabajo real sea principalmente backend, APIs, Java, Python, Node backend, DevOps o arquitectura backend.",
            "Prioriza React Native, React, frontend, mobile, web, design systems, producto y trabajo remoto.",
            "Prioriza ofertas en espanol, LATAM o Europa. Para Europa acepta ingles B1/B2/intermedio y descarta C1/C2/advanced/fluent/native si es requisito.",
            "Si no hay suficiente informacion, se honesto y marca dudas.",
            "Devuelve solo JSON valido, sin markdown.",
            'Formato exacto: {"compatibilityScore":0,"recommendation":"aplicar|revisar|descartar","summary":"...","matchReasons":["..."],"concerns":["..."],"frontendFit":"alto|medio|bajo","backendWeight":"alto|medio|bajo","englishLevel":"...","remoteFit":"..."}'
          ].join(" ")
        },
        {
          role: "user",
          content: buildPrompt(job, cvText)
        }
      ],
      max_output_tokens: 900
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`OpenAI fallo (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
  }

  const aiEvaluation = parseAiEvaluation(extractJson(readResponseText(payload)));

  return {
    ...job,
    aiEvaluation,
    score: aiEvaluation.compatibilityScore
  };
};

export const shouldSendAiMatchedJob = (job: MatchedJob): boolean => {
  const evaluation = job.aiEvaluation;
  if (!evaluation) return true;

  return (
    evaluation.recommendation !== "descartar" &&
    evaluation.compatibilityScore >= config.aiMinCompatibilityScore &&
    !(evaluation.frontendFit === "bajo" && evaluation.backendWeight === "alto")
  );
};

export const evaluateJobsWithAi = async (jobs: MatchedJob[], cvText: string): Promise<MatchedJob[]> => {
  if (!config.openAiApiKey) {
    throw new Error("ENABLE_AI_MATCHING=true requiere configurar OPENAI_API_KEY");
  }

  const evaluated: MatchedJob[] = [];

  for (const job of jobs) {
    try {
      evaluated.push(await evaluateJobWithAi(job, cvText));
    } catch (error) {
      console.warn(`IA fallida para ${job.title}: ${error}`);
      evaluated.push({
        ...job,
        aiEvaluation: {
          compatibilityScore: config.aiMinCompatibilityScore,
          recommendation: "revisar",
          summary: "No se pudo evaluar con IA. Se mantiene como revisar para no perder una posible oportunidad.",
          matchReasons: [],
          concerns: ["Evaluacion IA no disponible"],
          frontendFit: "medio",
          backendWeight: "medio",
          englishLevel: "No evaluado",
          remoteFit: "No evaluado"
        }
      });
    }
  }

  return evaluated;
};
