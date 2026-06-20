import { config } from "./config.js";
import { matchJob } from "./filters/matchJob.js";
import { dedupeJobs, isRecent } from "./filters/normalize.js";
import { renderHtmlDigest, renderTextDigest } from "./services/digest.js";
import { sendEmail } from "./services/email.js";
import { keepUnseenJobs, markJobsAsSeen } from "./services/state.js";
import { fetchArbeitnowJobs } from "./sources/arbeitnow.js";
import { fetchGetOnBoardJobs } from "./sources/getonboard.js";
import { fetchJobicyJobs } from "./sources/jobicy.js";
import { fetchRemoteOkJobs } from "./sources/remoteok.js";
import { fetchRemotiveJobs } from "./sources/remotive.js";
import { fetchRssJobs } from "./sources/rss.js";
import type { JobPosting, MatchedJob } from "./types.js";

type SourceResult = {
  jobs: JobPosting[];
  stats: string[];
};

const fetchAllJobs = async (): Promise<SourceResult> => {
  const rssFeeds = [...config.defaultRssFeeds, ...config.extraRssFeeds];
  const sourceCalls = [
    { name: "Remotive", run: fetchRemotiveJobs },
    { name: "RemoteOK", run: fetchRemoteOkJobs },
    { name: "Jobicy", run: fetchJobicyJobs },
    { name: "Get on Board", run: fetchGetOnBoardJobs },
    { name: "Arbeitnow", run: fetchArbeitnowJobs },
    ...(rssFeeds.length > 0 ? [{ name: "RSS feeds", run: () => fetchRssJobs(rssFeeds) }] : [])
  ];

  const results = await Promise.allSettled(sourceCalls.map((source) => source.run()));
  const stats: string[] = [];

  const jobs = results.flatMap((result, index) => {
    const sourceName = sourceCalls[index]?.name ?? "Fuente desconocida";

    if (result.status === "fulfilled") {
      stats.push(`${sourceName}: ${result.value.length} ofertas recibidas`);
      return result.value;
    }

    stats.push(`${sourceName}: fallo (${result.reason})`);
    console.warn(`Fuente fallida: ${sourceName}. ${result.reason}`);
    return [];
  });

  return { jobs, stats };
};

const rankJobs = (jobs: MatchedJob[]): MatchedJob[] =>
  [...jobs].sort((a, b) => {
    const dateA = a.publishedAt?.getTime() ?? 0;
    const dateB = b.publishedAt?.getTime() ?? 0;

    return b.score - a.score || dateB - dateA;
  });

const main = async (): Promise<void> => {
  const { jobs: allJobs, stats } = await fetchAllJobs();
  const recentJobs = allJobs.filter((job) => isRecent(job.publishedAt, config.lookbackDays));
  const matchedJobs = dedupeJobs(recentJobs)
    .map(matchJob)
    .filter((job): job is MatchedJob => Boolean(job));
  const unseenJobs = await keepUnseenJobs(rankJobs(matchedJobs));
  const digestJobs = unseenJobs.slice(0, config.maxJobsPerEmail);

  console.log("Resumen de busqueda:");
  for (const stat of stats) {
    console.log(`- ${stat}`);
  }
  console.log(`- Total recibido: ${allJobs.length}`);
  console.log(`- Recientes (${config.lookbackDays} dias): ${recentJobs.length}`);
  console.log(`- Pasaron filtros: ${matchedJobs.length}`);
  console.log(`- Nuevas no enviadas antes: ${unseenJobs.length}`);

  if (digestJobs.length === 0 && !config.sendEmptyDigest) {
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
    await markJobsAsSeen(digestJobs);
  }

  console.log(`Proceso finalizado. Ofertas enviadas: ${digestJobs.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
