import { parseDate, stripHtml } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

type ArbeitnowResponse = {
  data?: ArbeitnowJob[];
};

export const fetchArbeitnowJobs = async (): Promise<JobPosting[]> => {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api?page=1");

  if (!response.ok) {
    throw new Error(`Arbeitnow returned ${response.status}`);
  }

  const data = (await response.json()) as ArbeitnowResponse;

  return (data.data ?? []).map((job) => ({
    id: `arbeitnow-${job.slug}`,
    source: "Arbeitnow",
    title: job.title,
    company: job.company_name,
    location: [job.remote ? "Remote Europe" : undefined, job.location].filter(Boolean).join(" - "),
    url: job.url,
    description: stripHtml(job.description),
    tags: [...(job.tags ?? []), ...(job.job_types ?? [])],
    publishedAt: job.created_at ? parseDate(job.created_at * 1000) : undefined
  }));
};
