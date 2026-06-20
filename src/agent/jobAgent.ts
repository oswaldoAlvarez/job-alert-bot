import { config } from "../config.js";
import { dedupeJobs, isRecent } from "../filters/normalize.js";
import { evaluateJobsWithAi, shouldSendAiMatchedJob } from "../services/aiMatcher.js";
import { fetchCvText } from "../services/cv.js";
import { renderHtmlDigest, renderTextDigest } from "../services/digest.js";
import { sendEmail } from "../services/email.js";
import { keepUnseenJobs, markJobsAsSeen } from "../services/state.js";
import type { MatchedJob } from "../types.js";
import { preselectJobCandidates } from "./preselectJobs.js";
import { fetchAllJobs } from "./sourceRunner.js";

const rankJobs = (jobs: MatchedJob[]): MatchedJob[] =>
  [...jobs].sort((a, b) => {
    const dateA = a.publishedAt?.getTime() ?? 0;
    const dateB = b.publishedAt?.getTime() ?? 0;

    return b.score - a.score || dateB - dateA;
  });

export const runJobAgent = async (): Promise<void> => {
  const { jobs: allJobs, stats } = await fetchAllJobs();
  const recentJobs = allJobs.filter((job) => isRecent(job.publishedAt, config.lookbackDays));
  const candidateJobs = preselectJobCandidates(dedupeJobs(recentJobs));
  const unseenJobs = await keepUnseenJobs(rankJobs(candidateJobs));
  const jobsToEvaluate = config.enableAiMatching
    ? unseenJobs.slice(0, config.aiMaxCandidates)
    : unseenJobs.slice(0, config.maxJobsPerEmail);

  const evaluatedJobs = config.enableAiMatching
    ? await evaluateJobsWithAi(jobsToEvaluate, await fetchCvText(config.cvUrl))
    : jobsToEvaluate;
  const digestJobs = rankJobs(evaluatedJobs.filter(shouldSendAiMatchedJob)).slice(0, config.maxJobsPerEmail);

  console.log("Resumen de busqueda:");
  for (const stat of stats) {
    console.log(`- ${stat}`);
  }
  console.log(`- Total recibido: ${allJobs.length}`);
  console.log(`- Recientes (${config.lookbackDays} dias): ${recentJobs.length}`);
  console.log(`- Candidatas para IA: ${candidateJobs.length}`);
  console.log(`- Nuevas no enviadas antes: ${unseenJobs.length}`);
  console.log(`- Evaluadas por IA: ${config.enableAiMatching ? evaluatedJobs.length : 0}`);
  console.log(`- Seleccionadas para email: ${digestJobs.length}`);

  if (digestJobs.length === 0 && !config.sendEmptyDigest) {
    if (config.enableAiMatching && !config.dryRun) {
      await markJobsAsSeen(evaluatedJobs);
    }

    console.log("No hay ofertas nuevas para enviar.");
    return;
  }

  const date = new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date());

  await sendEmail({
    subject: `Ofertas React/React Native SSR-SR - ${date}`,
    text: renderTextDigest(digestJobs),
    html: renderHtmlDigest(digestJobs)
  });

  if (!config.dryRun) {
    await markJobsAsSeen(config.enableAiMatching ? evaluatedJobs : digestJobs);
  }

  console.log(`Proceso finalizado. Ofertas enviadas: ${digestJobs.length}`);
};
