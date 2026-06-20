import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MatchedJob } from "../types.js";

const legacyStateFile = new URL("../../data/seen-jobs.json", import.meta.url);

const stateFileForProfile = (profileId = "default"): URL =>
  new URL(`../../data/seen-jobs-${profileId}.json`, import.meta.url);

const readSeenIds = async (profileId?: string): Promise<Set<string>> => {
  try {
    const raw = await readFile(stateFileForProfile(profileId), "utf8");
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    if (!profileId || profileId === "default" || profileId === "oswaldo-react") {
      try {
        const raw = await readFile(legacyStateFile, "utf8");
        const parsed = JSON.parse(raw) as string[];
        return new Set(parsed);
      } catch {
        return new Set();
      }
    }

    return new Set();
  }
};

export const keepUnseenJobs = async (jobs: MatchedJob[], profileId?: string): Promise<MatchedJob[]> => {
  const seenIds = await readSeenIds(profileId);
  return jobs.filter((job) => !seenIds.has(job.id));
};

export const markJobsAsSeen = async (jobs: MatchedJob[], profileId?: string): Promise<void> => {
  const stateFile = stateFileForProfile(profileId);
  const seenIds = await readSeenIds(profileId);

  for (const job of jobs) {
    seenIds.add(job.id);
  }

  await mkdir(dirname(stateFile.pathname), { recursive: true });
  await writeFile(stateFile, JSON.stringify([...seenIds].slice(-1000), null, 2));
};
