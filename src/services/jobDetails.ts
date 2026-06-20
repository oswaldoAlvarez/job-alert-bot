import { stripHtml } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";

const shouldFetchDetails = (job: JobPosting): boolean =>
  job.source.includes("Google Jobs") || job.source.includes("LinkedIn via Google Jobs");

const fetchPageText = async (url: string): Promise<string | undefined> => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "job-alert-bot/0.1"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) return undefined;

  return stripHtml(await response.text()).slice(0, 9000);
};

export const enrichJobsWithLandingPage = async (jobs: JobPosting[]): Promise<JobPosting[]> => {
  const enriched: JobPosting[] = [];

  for (const job of jobs) {
    if (!shouldFetchDetails(job)) {
      enriched.push(job);
      continue;
    }

    try {
      const pageText = await fetchPageText(job.url);
      enriched.push(
        pageText
          ? {
              ...job,
              description: [job.description, "DETALLE DE LA PUBLICACION:", pageText].filter(Boolean).join("\n\n")
            }
          : job
      );
    } catch (error) {
      console.warn(`No se pudo leer detalle de "${job.title}": ${error}`);
      enriched.push(job);
    }
  }

  return enriched;
};
