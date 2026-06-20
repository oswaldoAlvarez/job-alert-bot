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
  aiEvaluation?: AiJobEvaluation;
};

export type JobSource = {
  name: string;
  fetchJobs: () => Promise<JobPosting[]>;
};

export type AiRecommendation = "aplicar" | "revisar" | "descartar";

export type AiJobEvaluation = {
  compatibilityScore: number;
  recommendation: AiRecommendation;
  summary: string;
  matchReasons: string[];
  concerns: string[];
  frontendFit: "alto" | "medio" | "bajo";
  backendWeight: "alto" | "medio" | "bajo";
  englishLevel: string;
  remoteFit: string;
};
