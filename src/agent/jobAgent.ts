import { config, momNursingProfile, oswaldoProfile, sisterBakeryProfile } from "../config.js";
import { dedupeJobs, isRecent } from "../filters/normalize.js";
import { evaluateJobsWithAi, getAiRejectionReasons, shouldSendAiMatchedJob } from "../services/aiMatcher.js";
import { fetchCvText } from "../services/cv.js";
import { renderHtmlDigest, renderTextDigest } from "../services/digest.js";
import { sendEmail } from "../services/email.js";
import { filterFreshJobsByLandingPage } from "../services/freshness.js";
import { enrichJobsWithLandingPage } from "../services/jobDetails.js";
import { filterNursingCriticalExclusions } from "../services/nursingFilters.js";
import { keepUnseenJobs, markJobsAsSeen } from "../services/state.js";
import type { JobProfile, MatchedJob } from "../types.js";
import { preselectJobCandidates } from "./preselectJobs.js";
import { fetchAllJobs } from "./sourceRunner.js";

const rankJobs = (jobs: MatchedJob[]): MatchedJob[] =>
  [...jobs].sort((a, b) => {
    const dateA = a.publishedAt?.getTime() ?? 0;
    const dateB = b.publishedAt?.getTime() ?? 0;

    return b.score - a.score || dateB - dateA;
  });

const resolveCvText = async (profile: JobProfile): Promise<string> => {
  if (profile.cvText) return profile.cvText.slice(0, 12000);
  if (profile.cvUrl) return fetchCvText(profile.cvUrl);

  throw new Error(`El perfil ${profile.name} requiere cvText o cvUrl para usar IA`);
};

const isMomNursingProfile = (profile: JobProfile): boolean => profile.id === "mom-nursing-caracas";
const shouldReadLandingPage = (profile: JobProfile): boolean =>
  profile.id === "mom-nursing-caracas" || profile.id === "sister-bakery-caracas";
const shouldVerifyFreshness = (profile: JobProfile): boolean => profile.sourceMode === "tech";

const runProfileJobAgent = async (profile: JobProfile): Promise<void> => {
  const { jobs: allJobs, stats } = await fetchAllJobs(profile);
  const jobsWithDetails = shouldReadLandingPage(profile) ? await enrichJobsWithLandingPage(dedupeJobs(allJobs)) : allJobs;
  const recentJobs = shouldReadLandingPage(profile)
    ? jobsWithDetails
    : jobsWithDetails.filter((job) => isRecent(job.publishedAt, profile.lookbackDays));
  const candidateJobs = preselectJobCandidates(dedupeJobs(recentJobs), profile);
  const { jobs: freshCandidateJobs, staleCount } = shouldVerifyFreshness(profile)
    ? await filterFreshJobsByLandingPage(candidateJobs, profile)
    : { jobs: candidateJobs, staleCount: 0 };
  const { jobs: criticalFilteredJobs, rejectedCount: criticalRejectedCount } = isMomNursingProfile(profile)
    ? filterNursingCriticalExclusions(freshCandidateJobs)
    : { jobs: freshCandidateJobs, rejectedCount: 0 };
  const unseenJobs = await keepUnseenJobs(rankJobs(criticalFilteredJobs), profile.id);
  const jobsToEvaluate = config.enableAiMatching
    ? unseenJobs.slice(0, profile.aiMaxCandidates)
    : unseenJobs.slice(0, profile.maxJobsPerEmail);

  const evaluatedJobs = config.enableAiMatching
    ? await evaluateJobsWithAi(jobsToEvaluate, await resolveCvText(profile), profile)
    : jobsToEvaluate;
  const digestJobs = rankJobs(evaluatedJobs.filter((job) => shouldSendAiMatchedJob(job, profile))).slice(
    0,
    profile.maxJobsPerEmail
  );
  const rejectedByAiJobs = config.enableAiMatching
    ? evaluatedJobs.filter((job) => !shouldSendAiMatchedJob(job, profile))
    : [];

  console.log(`Resumen de busqueda (${profile.name}):`);
  for (const stat of stats) {
    console.log(`- ${stat}`);
  }
  console.log(`- Total recibido: ${allJobs.length}`);
  console.log(`- Recientes (${profile.lookbackDays} dias): ${recentJobs.length}`);
  console.log(`- Candidatas para IA: ${candidateJobs.length}`);
  console.log(`- Descartadas por fecha real antigua: ${staleCount}`);
  console.log(`- Descartadas por filtro critico: ${criticalRejectedCount}`);
  console.log(`- Nuevas no enviadas antes: ${unseenJobs.length}`);
  console.log(`- Evaluadas por IA: ${config.enableAiMatching ? evaluatedJobs.length : 0}`);
  console.log(`- Seleccionadas para email: ${digestJobs.length}`);
  for (const job of rejectedByAiJobs) {
    const evaluation = job.aiEvaluation;
    if (!evaluation) continue;
    const rejectionReasons = getAiRejectionReasons(job, profile);
    console.log(
      `Oferta evaluada no enviada (${profile.name}): ${job.title} ` +
        `(recomendacion=${evaluation.recommendation}, score=${evaluation.compatibilityScore}, ` +
        `rol=${evaluation.roleFocus}, fit=${evaluation.frontendFit}, ` +
        `motivo=${rejectionReasons.join(" | ") || "no indicado"})`
    );
    if (evaluation.concerns.length > 0) {
      console.log(`  Dudas/Riesgos IA: ${evaluation.concerns.join(" | ")}`);
    }
  }

  if (digestJobs.length === 0 && !config.sendEmptyDigest) {
    if (config.enableAiMatching && !config.dryRun) {
      await markJobsAsSeen(evaluatedJobs, profile.id);
    }

    console.log(`No hay ofertas nuevas para enviar (${profile.name}).`);
    return;
  }

  const date = new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date());

  await sendEmail({
    subject: `${profile.subjectPrefix} - ${date}`,
    text: renderTextDigest(digestJobs, profile),
    html: renderHtmlDigest(digestJobs, profile),
    to: profile.emailTo
  });

  if (!config.dryRun) {
    await markJobsAsSeen(config.enableAiMatching ? evaluatedJobs : digestJobs, profile.id);
  }

  console.log(`Proceso finalizado (${profile.name}). Ofertas enviadas: ${digestJobs.length}`);
};

export const runJobAgent = async (): Promise<void> => {
  const profiles = [
    oswaldoProfile,
    ...(config.mom.enabled ? [momNursingProfile] : []),
    ...(config.sister.enabled ? [sisterBakeryProfile] : [])
  ];

  for (const profile of profiles) {
    await runProfileJobAgent(profile);
  }
};
