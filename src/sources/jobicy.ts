import { stripHtml, parseDate } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";

type JobicyJob = {
  id?: number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobDescription?: string;
  jobExcerpt?: string;
  jobIndustry?: string[];
  pubDate?: string;
  annualSalaryMin?: string;
  annualSalaryMax?: string;
};

type JobicyResponse = {
  jobs?: JobicyJob[];
};

export const fetchJobicyJobs = async (): Promise<JobPosting[]> => {
  const response = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&industry=dev");

  if (!response.ok) {
    throw new Error(`Jobicy returned ${response.status}`);
  }

  const data = (await response.json()) as JobicyResponse;

  return (data.jobs ?? []).map((job) => ({
    id: `jobicy-${job.id ?? job.url}`,
    source: "Jobicy",
    title: job.jobTitle ?? "Untitled role",
    company: job.companyName ?? "Unknown company",
    location: job.jobGeo,
    url: job.url ?? "https://jobicy.com",
    description: stripHtml(job.jobDescription ?? job.jobExcerpt),
    tags: job.jobIndustry ?? [],
    salary:
      job.annualSalaryMin || job.annualSalaryMax
        ? `${job.annualSalaryMin ?? "?"} - ${job.annualSalaryMax ?? "?"}`
        : undefined,
    publishedAt: parseDate(job.pubDate)
  }));
};
