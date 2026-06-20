import { stripHtml, parseDate } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";

type RemoteOkJob = {
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  location?: string;
  description?: string;
  tags?: string[];
  date?: string;
  url?: string;
  apply_url?: string;
};

export const fetchRemoteOkJobs = async (): Promise<JobPosting[]> => {
  const response = await fetch("https://remoteok.com/api", {
    headers: {
      "User-Agent": "job-alert-bot/0.1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`RemoteOK returned ${response.status}`);
  }

  const data = (await response.json()) as RemoteOkJob[];

  return data
    .filter((job) => job.position && job.company)
    .map((job) => ({
      id: `remoteok-${job.id ?? job.slug ?? `${job.company}-${job.position}`}`,
      source: "RemoteOK",
      title: job.position ?? "Untitled role",
      company: job.company ?? "Unknown company",
      location: job.location,
      url: job.url ?? job.apply_url ?? "https://remoteok.com",
      description: stripHtml(job.description),
      tags: job.tags ?? [],
      publishedAt: parseDate(job.date)
    }));
};
