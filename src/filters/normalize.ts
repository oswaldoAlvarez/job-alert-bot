import type { JobPosting } from "../types.js";

export const stripHtml = (value = ""): string =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeText = (value = ""): string =>
  stripHtml(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const parseDate = (value?: string | number | Date): Date | undefined => {
  if (!value) return undefined;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const isRecent = (date: Date | undefined, lookbackDays: number): boolean => {
  if (!date) return true;

  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
};

export const dedupeJobs = (jobs: JobPosting[]): JobPosting[] => {
  const seen = new Set<string>();

  return jobs.filter((job) => {
    const key = normalizeText(job.url || `${job.source}-${job.title}-${job.company}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
