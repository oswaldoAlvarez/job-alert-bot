import { stripHtml, parseDate } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  description?: string;
  salary?: string;
  tags?: string[];
  publication_date?: string;
};

type RemotiveResponse = {
  jobs?: RemotiveJob[];
};

export const fetchRemotiveJobs = async (): Promise<JobPosting[]> => {
  const response = await fetch("https://remotive.com/api/remote-jobs?category=software-dev");

  if (!response.ok) {
    throw new Error(`Remotive returned ${response.status}`);
  }

  const data = (await response.json()) as RemotiveResponse;

  return (data.jobs ?? []).map((job) => ({
    id: `remotive-${job.id}`,
    source: "Remotive",
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location,
    url: job.url,
    description: stripHtml(job.description),
    tags: job.tags ?? [],
    salary: job.salary,
    publishedAt: parseDate(job.publication_date)
  }));
};
