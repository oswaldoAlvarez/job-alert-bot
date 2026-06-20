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

export type JobProfile = {
  id: string;
  name: string;
  subjectPrefix: string;
  emailTo?: string;
  cvText?: string;
  cvUrl?: string;
  lookbackDays: number;
  maxJobsPerEmail: number;
  aiMaxCandidates: number;
  aiMinCompatibilityScore: number;
  sourceMode: "tech" | "serpapi_only";
  serpApiQueries: string[];
  serpApiLocation?: string;
  serpApiRunEveryHours: number;
  serpApiMaxQueriesPerRun: number;
  requiredTerms: string[];
  optionalTerms: string[];
  exclusionTerms: string[];
  blockedTerms: string[];
  positiveSignals: string[];
  promptPreferences: string[];
  sendGuardrails: {
    acceptedRoles: RoleFocus[];
    acceptedRemoteScopes: RemoteScope[];
    acceptedEnglishRequirements: EnglishRequirement[];
    acceptedSpanishFits: SpanishFit[];
    allowMediumFrontendForFullstack: boolean;
    rejectHighBackend: boolean;
    requireSpanishSignal: boolean;
  };
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
