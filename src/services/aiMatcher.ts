import { config } from "../config.js";
import { stripHtml } from "../filters/normalize.js";
import type { AiJobEvaluation, JobProfile, MatchedJob } from "../types.js";

class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

const isFatalAiError = (error: unknown): boolean =>
  error instanceof AiProviderError &&
  (error.code === "insufficient_quota" ||
    error.code === "invalid_api_key" ||
    error.status === 401 ||
    error.status === 403);

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
    englishRequirement: normalizeLevel(
      data.englishRequirement,
      ["none", "not_specified", "b1", "b2", "c1", "c2", "advanced", "fluent", "native", "unknown"],
      "unknown"
    ),
    salaryRange: typeof data.salaryRange === "string" ? data.salaryRange.trim().slice(0, 160) : "No indicado",
    remoteFit: typeof data.remoteFit === "string" ? data.remoteFit.trim().slice(0, 160) : "No indicado",
    remoteScope: normalizeLevel(
      data.remoteScope,
      ["worldwide", "region_restricted", "country_restricted", "hybrid", "onsite", "unknown"],
      "unknown"
    ),
    roleFocus: normalizeLevel(
      data.roleFocus,
      ["frontend", "mobile", "fullstack_frontend", "fullstack_backend", "backend", "other"],
      "other"
    ),
    spanishFit: normalizeLevel(
      data.spanishFit,
      ["spanish_offer", "spanish_speaking_team", "not_specified", "no"],
      "not_specified"
    )
  };
};

const describeResponseOutput = (payload: Record<string, unknown>): string => {
  const status = typeof payload.status === "string" ? payload.status : "sin status";
  const incompleteDetails =
    typeof payload.incomplete_details === "object" && payload.incomplete_details !== null
      ? JSON.stringify(payload.incomplete_details)
      : "sin incomplete_details";
  const output = Array.isArray(payload.output) ? payload.output : [];
  const outputTypes = output
    .map((item) =>
      typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).type === "string"
        ? (item as Record<string, unknown>).type
        : "unknown"
    )
    .join(", ");

  return `status=${status}; incomplete=${incompleteDetails}; outputTypes=${outputTypes || "sin output"}`;
};

const readResponseText = (payload: Record<string, unknown>): string => {
  const chunks: string[] = [];
  if (typeof payload.output_text === "string") chunks.push(payload.output_text);

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;

    const itemText = (item as Record<string, unknown>).text;
    if (typeof itemText === "string") chunks.push(itemText);

    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];

    for (const contentItem of content) {
      if (typeof contentItem !== "object" || contentItem === null) continue;
      const text = (contentItem as Record<string, unknown>).text;
      const refusal = (contentItem as Record<string, unknown>).refusal;
      if (typeof text === "string") chunks.push(text);
      if (typeof refusal === "string") chunks.push(refusal);
    }
  }

  return chunks.join("\n").trim();
};

const extractJson = (value: string): unknown => {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("La IA no devolvio JSON valido");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
};

const buildPrompt = (job: MatchedJob, cvText: string, profile: JobProfile): string => {
  const description = stripHtml(job.description ?? "").slice(0, 6000);

  return [
    "PREFERENCIAS DE BUSQUEDA:",
    [
      ...profile.promptPreferences.map((preference) => `- ${preference}`),
      `- Solo recomendar aplicar si la compatibilidad real es ${profile.aiMinCompatibilityScore} o mas y puedes explicar por que es buen fit para postular.`
    ].join("\n"),
    "",
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

const responseFormat = {
  type: "json_schema",
  name: "job_match_evaluation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      compatibilityScore: { type: "number" },
      recommendation: { type: "string", enum: ["aplicar", "revisar", "descartar"] },
      summary: { type: "string" },
      matchReasons: {
        type: "array",
        items: { type: "string" }
      },
      concerns: {
        type: "array",
        items: { type: "string" }
      },
      frontendFit: { type: "string", enum: ["alto", "medio", "bajo"] },
      backendWeight: { type: "string", enum: ["alto", "medio", "bajo"] },
      englishLevel: { type: "string" },
      englishRequirement: {
        type: "string",
        enum: ["none", "not_specified", "b1", "b2", "c1", "c2", "advanced", "fluent", "native", "unknown"]
      },
      salaryRange: { type: "string" },
      remoteFit: { type: "string" },
      remoteScope: {
        type: "string",
        enum: ["worldwide", "region_restricted", "country_restricted", "hybrid", "onsite", "unknown"]
      },
      roleFocus: {
        type: "string",
        enum: ["frontend", "mobile", "fullstack_frontend", "fullstack_backend", "backend", "other"]
      },
      spanishFit: {
        type: "string",
        enum: ["spanish_offer", "spanish_speaking_team", "not_specified", "no"]
      }
    },
    required: [
      "compatibilityScore",
      "recommendation",
      "summary",
      "matchReasons",
      "concerns",
      "frontendFit",
      "backendWeight",
      "englishLevel",
      "englishRequirement",
      "salaryRange",
      "remoteFit",
      "remoteScope",
      "roleFocus",
      "spanishFit"
    ]
  }
};

export const evaluateJobWithAi = async (job: MatchedJob, cvText: string, profile: JobProfile): Promise<MatchedJob> => {
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
      text: {
        format: responseFormat
      },
      input: [
        {
          role: "system",
          content: [
            "Eres un agente de matching laboral especializado.",
            `Estas evaluando ofertas para el perfil: ${profile.name}.`,
            "Tu tarea es leer la oferta, compararla contra su CV/perfil y preferencias, y decidir si vale la pena enviarla.",
            ...profile.promptPreferences,
            "Extrae salaryRange si la oferta muestra salario, rango, hourly rate o moneda. Si no aparece, usa No indicado.",
            "Si no puedes verificar un requisito critico, no marques aplicar.",
            `Se criterioso: recommendation aplicar solo si compatibilityScore >= ${profile.aiMinCompatibilityScore} y realmente conviene postular.`
          ].join(" ")
        },
        {
          role: "user",
          content: buildPrompt(job, cvText, profile)
        }
      ],
      reasoning: {
        effort: "minimal"
      },
      max_output_tokens: 2000
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const errorData =
      typeof payload.error === "object" && payload.error !== null ? (payload.error as Record<string, unknown>) : {};
    const code = typeof errorData.code === "string" ? errorData.code : undefined;
    const message = typeof errorData.message === "string" ? errorData.message : JSON.stringify(payload);

    throw new AiProviderError(`OpenAI fallo (${response.status}): ${message}`, response.status, code);
  }

  if (payload.status === "incomplete") {
    throw new Error(`OpenAI devolvio una respuesta incompleta (${describeResponseOutput(payload)})`);
  }

  const responseText = readResponseText(payload);
  if (!responseText) {
    throw new Error(`OpenAI no devolvio texto evaluable (${describeResponseOutput(payload)})`);
  }

  const aiEvaluation = parseAiEvaluation(extractJson(responseText));

  return {
    ...job,
    aiEvaluation,
    score: aiEvaluation.compatibilityScore
  };
};

export const shouldSendAiMatchedJob = (job: MatchedJob, profile?: JobProfile): boolean => {
  const evaluation = job.aiEvaluation;
  if (!evaluation) return true;

  const guardrails = profile?.sendGuardrails;
  const minScore = profile?.aiMinCompatibilityScore ?? config.aiMinCompatibilityScore;
  const acceptedEnglish = (guardrails?.acceptedEnglishRequirements ?? ["none", "not_specified", "b1", "b2"]).includes(
    evaluation.englishRequirement
  );
  const acceptedRemote = (guardrails?.acceptedRemoteScopes ?? ["worldwide", "region_restricted"]).includes(
    evaluation.remoteScope
  );
  const acceptedRole = (guardrails?.acceptedRoles ?? ["frontend", "mobile", "fullstack_frontend"]).includes(
    evaluation.roleFocus
  );
  const acceptedSpanish = guardrails?.requireSpanishSignal === false
    ? true
    : (guardrails?.acceptedSpanishFits ?? ["spanish_offer", "spanish_speaking_team"]).includes(evaluation.spanishFit);
  const acceptedFrontendFit = evaluation.frontendFit === "alto" || evaluation.roleFocus === "fullstack_frontend";
  const acceptedFit =
    profile?.sourceMode === "serpapi_only"
      ? true
      : guardrails?.allowMediumFrontendForFullstack === false
        ? evaluation.frontendFit === "alto"
        : acceptedFrontendFit;
  const acceptedBackend = guardrails?.rejectHighBackend === false ? true : evaluation.backendWeight !== "alto";

  const acceptedRecommendation =
    profile?.id === "mom-nursing-caracas"
      ? ["aplicar", "revisar"].includes(evaluation.recommendation)
      : evaluation.recommendation === "aplicar";

  return (
    acceptedRecommendation &&
    evaluation.compatibilityScore >= minScore &&
    acceptedFit &&
    acceptedBackend &&
    acceptedEnglish &&
    acceptedRemote &&
    acceptedRole &&
    acceptedSpanish
  );
};

export const evaluateJobsWithAi = async (
  jobs: MatchedJob[],
  cvText: string,
  profile: JobProfile
): Promise<MatchedJob[]> => {
  if (!config.openAiApiKey) {
    throw new Error("ENABLE_AI_MATCHING=true requiere configurar OPENAI_API_KEY");
  }

  const evaluated: MatchedJob[] = [];

  for (const job of jobs) {
    try {
      evaluated.push(await evaluateJobWithAi(job, cvText, profile));
    } catch (error) {
      if (isFatalAiError(error)) {
        throw error;
      }

      console.warn(`IA fallida para ${job.title}: ${error}`);
      evaluated.push({
        ...job,
        aiEvaluation: {
          compatibilityScore: profile.aiMinCompatibilityScore,
          recommendation: "revisar",
          summary: "No se pudo evaluar con IA. Se mantiene como revisar para no perder una posible oportunidad.",
          matchReasons: [],
          concerns: ["Evaluacion IA no disponible"],
          frontendFit: "medio",
          backendWeight: "medio",
          englishLevel: "No evaluado",
          englishRequirement: "unknown",
          salaryRange: "No indicado",
          remoteFit: "No evaluado",
          remoteScope: "unknown",
          roleFocus: "other",
          spanishFit: "not_specified"
        }
      });
    }
  }

  return evaluated;
};
