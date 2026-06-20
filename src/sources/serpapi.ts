import { config } from "../config.js";
import { parseDate, stripHtml } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type SerpApiJob = {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  share_link?: string;
  description?: string;
  extensions?: string[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
  };
  job_highlights?: Array<{
    title?: string;
    items?: string[];
  }>;
  apply_options?: Array<{
    title?: string;
    link?: string;
  }>;
};

type SerpApiResponse = {
  jobs_results?: SerpApiJob[];
  error?: string;
};

type SerpApiUsageState = {
  month: string;
  usedSearches: number;
  lastRunAt?: string;
  lastRunAtByProfile?: Record<string, string>;
};

type SerpApiFetchOptions = {
  profileId?: string;
  queries?: string[];
  location?: string;
  runEveryHours?: number;
  maxQueriesPerRun?: number;
};

const usageStateFile = new URL("../../data/serpapi-usage.json", import.meta.url);

const defaultQueries = [
  "Senior React Native developer remote LATAM contractor",
  "Senior React frontend developer remote LATAM contractor",
  "React Native developer remoto LATAM freelance",
  "Senior React developer remoto Espana B2",
  "React Native remote Europe B2 contractor"
];

const parsePostedAt = (value?: string): Date | undefined => {
  if (!value) return undefined;

  const lower = value.toLowerCase();
  const amount = Number(lower.match(/\d+/)?.[0] ?? "1");
  const now = Date.now();

  if (lower.includes("hour") || lower.includes("hora")) return new Date(now - amount * 60 * 60 * 1000);
  if (lower.includes("day") || lower.includes("dia") || lower.includes("día")) {
    return new Date(now - amount * 24 * 60 * 60 * 1000);
  }
  if (lower.includes("week") || lower.includes("semana")) return new Date(now - amount * 7 * 24 * 60 * 60 * 1000);
  if (lower.includes("month") || lower.includes("mes")) return new Date(now - amount * 30 * 24 * 60 * 60 * 1000);

  return parseDate(value);
};

const preferredApplyLink = (job: SerpApiJob): string | undefined => {
  const options = job.apply_options ?? [];
  const linkedin = options.find((option) => option.title?.toLowerCase().includes("linkedin"));
  const companyBoard = options.find((option) =>
    ["greenhouse", "lever", "workday", "ashby", "bamboohr", "smartrecruiters", "personio"].some((board) =>
      option.title?.toLowerCase().includes(board)
    )
  );

  return linkedin?.link ?? companyBoard?.link ?? options[0]?.link ?? job.share_link;
};

const sourceName = (job: SerpApiJob): string => {
  const applyTitles = (job.apply_options ?? []).map((option) => option.title).filter(Boolean).join(", ");
  const via = job.via ?? "Google Jobs";

  if (`${via} ${applyTitles}`.toLowerCase().includes("linkedin")) return "LinkedIn via Google Jobs";
  return `Google Jobs / ${via}`;
};

const serializeHighlights = (job: SerpApiJob): string =>
  (job.job_highlights ?? [])
    .map((highlight) => [highlight.title, ...(highlight.items ?? [])].filter(Boolean).join(": "))
    .join("\n");

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

const readUsageState = async (): Promise<SerpApiUsageState> => {
  try {
    const parsed = JSON.parse(await readFile(usageStateFile, "utf8")) as Partial<SerpApiUsageState>;
    if (parsed.month === currentMonth() && typeof parsed.usedSearches === "number") {
      return {
        month: parsed.month,
        usedSearches: parsed.usedSearches,
        lastRunAt: parsed.lastRunAt,
        lastRunAtByProfile: parsed.lastRunAtByProfile
      };
    }
  } catch {
    // Missing state is expected on first run.
  }

  return {
    month: currentMonth(),
    usedSearches: 0
  };
};

const writeUsageState = async (state: SerpApiUsageState): Promise<void> => {
  await mkdir(dirname(usageStateFile.pathname), { recursive: true });
  await writeFile(usageStateFile, JSON.stringify(state, null, 2));
};

const isRunDue = (state: SerpApiUsageState, profileId: string, runEveryHours: number): boolean => {
  const lastRun = profileId === "default"
    ? state.lastRunAtByProfile?.[profileId] ?? state.lastRunAt
    : state.lastRunAtByProfile?.[profileId];
  if (!lastRun) return true;

  const lastRunAt = new Date(lastRun).getTime();
  if (Number.isNaN(lastRunAt)) return true;

  const elapsedHours = (Date.now() - lastRunAt) / (60 * 60 * 1000);
  return elapsedHours >= runEveryHours;
};

const fetchQuery = async (query: string, location?: string): Promise<JobPosting[]> => {
  if (!config.serpApiKey) {
    throw new Error("SERPAPI_API_KEY no esta configurada");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", config.serpApiKey);
  url.searchParams.set("hl", config.serpApiLanguage);
  url.searchParams.set("gl", config.serpApiCountry);
  if (location) {
    url.searchParams.set("location", location);
  }

  const response = await fetch(url);
  const payload = (await response.json()) as SerpApiResponse;

  if (!response.ok || payload.error) {
    const message = payload.error ?? `SerpApi returned ${response.status}`;
    if (location && message.toLowerCase().includes("unsupported") && message.toLowerCase().includes("location")) {
      console.warn(`SerpApi no soporta location "${location}" para "${query}". Reintentando sin location.`);
      return fetchQuery(query);
    }

    throw new Error(message);
  }

  return (payload.jobs_results ?? []).map((job) => {
    const applyOptions = (job.apply_options ?? [])
      .map((option) => `${option.title}: ${option.link}`)
      .join("\n");
    const extensions = (job.extensions ?? []).join(", ");

    return {
      id: `serpapi-${job.job_id ?? job.share_link ?? `${job.title}-${job.company_name}`}`,
      source: sourceName(job),
      title: job.title ?? "Untitled role",
      company: job.company_name ?? "Empresa no indicada",
      location: job.location,
      url: preferredApplyLink(job) ?? job.share_link ?? "https://www.google.com/search?udm=8&q=jobs",
      description: stripHtml(
        [
          job.description,
          serializeHighlights(job),
          extensions ? `Extensiones: ${extensions}` : undefined,
          applyOptions ? `Opciones de aplicacion:\n${applyOptions}` : undefined
        ]
          .filter(Boolean)
          .join("\n\n")
      ),
      tags: [job.via, job.detected_extensions?.schedule_type, ...(job.extensions ?? [])].filter(
        (tag): tag is string => Boolean(tag)
      ),
      publishedAt: parsePostedAt(job.detected_extensions?.posted_at)
    };
  });
};

export const fetchSerpApiJobs = async (options: SerpApiFetchOptions = {}): Promise<JobPosting[]> => {
  const profileId = options.profileId ?? "default";
  const queries = options.queries && options.queries.length > 0
    ? options.queries
    : config.serpApiQueries.length > 0
      ? config.serpApiQueries
      : defaultQueries;
  const location = options.location ?? config.serpApiLocation;
  const runEveryHours = options.runEveryHours ?? config.serpApiRunEveryHours;
  const maxQueriesPerRun = options.maxQueriesPerRun ?? config.serpApiMaxQueriesPerRun;
  const state = await readUsageState();

  if (!isRunDue(state, profileId, runEveryHours)) {
    console.log(`SerpApi omitido para ${profileId}: ultima busqueda hace menos de ${runEveryHours} horas.`);
    return [];
  }

  const remainingSearches = Math.max(0, config.serpApiMonthlyLimit - state.usedSearches);
  if (remainingSearches === 0) {
    console.log(`SerpApi omitido: limite mensual interno alcanzado (${config.serpApiMonthlyLimit}).`);
    return [];
  }

  const queriesToRun = queries.slice(0, Math.min(maxQueriesPerRun, remainingSearches));
  if (queriesToRun.length === 0) return [];

  const attemptedSearches = queriesToRun.length;
  const results = await Promise.allSettled(queriesToRun.map((query) => fetchQuery(query, location)));
  const now = new Date().toISOString();

  await writeUsageState({
    month: currentMonth(),
    usedSearches: state.usedSearches + attemptedSearches,
    lastRunAt: now,
    lastRunAtByProfile: {
      ...(state.lastRunAtByProfile ?? {}),
      [profileId]: now
    }
  });

  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;

    console.warn(`SerpApi fallo para query "${queriesToRun[index]}": ${result.reason}`);
    return [];
  });
};
