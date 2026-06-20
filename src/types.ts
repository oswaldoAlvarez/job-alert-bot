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
export type EnglishRequirement =
  | "none"
  | "not_specified"
  | "b1"
  | "b2"
  | "c1"
  | "c2"
  | "advanced"
  | "fluent"
  | "native"
  | "unknown";
export type RemoteScope = "worldwide" | "region_restricted" | "country_restricted" | "hybrid" | "onsite" | "unknown";
export type RoleFocus = "frontend" | "mobile" | "fullstack_frontend" | "fullstack_backend" | "backend" | "other";
export type SpanishFit = "spanish_offer" | "spanish_speaking_team" | "not_specified" | "no";

export type AiJobEvaluation = {
  compatibilityScore: number;
  recommendation: AiRecommendation;
  summary: string;
  matchReasons: string[];
  concerns: string[];
  frontendFit: "alto" | "medio" | "bajo";
  backendWeight: "alto" | "medio" | "bajo";
  englishLevel: string;
  englishRequirement: EnglishRequirement;
  salaryRange: string;
  remoteFit: string;
  remoteScope: RemoteScope;
  roleFocus: RoleFocus;
  spanishFit: SpanishFit;
};
