import { config } from "../config.js";
import { fetchArbeitnowJobs } from "../sources/arbeitnow.js";
import { fetchGetOnBoardJobs } from "../sources/getonboard.js";
import { fetchJobicyJobs } from "../sources/jobicy.js";
import { fetchRemoteOkJobs } from "../sources/remoteok.js";
import { fetchRemotiveJobs } from "../sources/remotive.js";
import { fetchRssJobs } from "../sources/rss.js";
import { fetchSerpApiJobs } from "../sources/serpapi.js";
import type { JobPosting, JobProfile } from "../types.js";

export type SourceResult = {
  jobs: JobPosting[];
  stats: string[];
};

export const fetchAllJobs = async (profile?: JobProfile): Promise<SourceResult> => {
  if (profile?.sourceMode === "serpapi_only") {
    if (!config.enableSerpApi) {
      return { jobs: [], stats: ["Google Jobs / LinkedIn / Job boards: omitido porque ENABLE_SERPAPI=false"] };
    }

    try {
      const jobs = await fetchSerpApiJobs({
        profileId: profile.id,
        queries: profile.serpApiQueries,
        location: profile.serpApiLocation,
        runEveryHours: profile.serpApiRunEveryHours,
        maxQueriesPerRun: profile.serpApiMaxQueriesPerRun
      });

      return { jobs, stats: [`Google Jobs / LinkedIn / Job boards: ${jobs.length} ofertas recibidas`] };
    } catch (error) {
      console.warn(`Fuente fallida: Google Jobs / LinkedIn / Job boards. ${error}`);
      return { jobs: [], stats: [`Google Jobs / LinkedIn / Job boards: fallo (${error})`] };
    }
  }

  const rssFeeds = [...config.defaultRssFeeds, ...config.extraRssFeeds];
  const sourceCalls = [
    { name: "Remotive", run: fetchRemotiveJobs },
    { name: "RemoteOK", run: fetchRemoteOkJobs },
    { name: "Jobicy", run: fetchJobicyJobs },
    { name: "Get on Board", run: fetchGetOnBoardJobs },
    { name: "Arbeitnow", run: fetchArbeitnowJobs },
    ...(rssFeeds.length > 0 ? [{ name: "RSS feeds", run: () => fetchRssJobs(rssFeeds) }] : []),
    ...(config.enableSerpApi ? [{ name: "Google Jobs / LinkedIn / Job boards", run: fetchSerpApiJobs }] : [])
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
