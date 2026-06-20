export type JobPosting = {
  id: string;
  source: string;
  title: string;
  company: string;
  location?: string;
  url: string;
  description?: string;
  tags: string[];
  salary?: string;
  publishedAt?: Date;
};

export type MatchedJob = JobPosting & {
  score: number;
  reasons: string[];
};

export type JobSource = {
  name: string;
  fetchJobs: () => Promise<JobPosting[]>;
};
