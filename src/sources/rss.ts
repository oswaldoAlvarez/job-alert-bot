import { XMLParser } from "fast-xml-parser";
import { parseDate, stripHtml } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";

type RssItem = {
  title?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  pubDate?: string;
  description?: string;
  "content:encoded"?: string;
};

type AtomEntry = {
  title?: string;
  link?: string | { "@_href"?: string } | Array<{ "@_href"?: string }>;
  id?: string;
  updated?: string;
  published?: string;
  summary?: string;
  content?: string;
};

const parser = new XMLParser({
  ignoreAttributes: false
});

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const guidToString = (guid?: RssItem["guid"]): string | undefined => {
  if (!guid) return undefined;
  return typeof guid === "string" ? guid : guid["#text"];
};

const atomLinkToString = (link?: AtomEntry["link"]): string | undefined => {
  if (!link) return undefined;
  if (typeof link === "string") return link;

  const linkObject = Array.isArray(link) ? link[0] : link;
  return linkObject?.["@_href"];
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const fetchRssJobs = async (feedUrls: string[]): Promise<JobPosting[]> => {
  const jobs = await Promise.all(
    feedUrls.map(async (feedUrl) => {
      if (!isValidHttpUrl(feedUrl)) {
        console.warn(`RSS ignorado por URL invalida: ${feedUrl}`);
        return [];
      }

      try {
        const response = await fetch(feedUrl);

        if (!response.ok) {
          throw new Error(`${feedUrl} returned ${response.status}`);
        }

        const xml = await response.text();
        const parsed = parser.parse(xml) as {
          rss?: { channel?: { item?: RssItem | RssItem[]; title?: string } };
          feed?: { entry?: AtomEntry | AtomEntry[]; title?: string };
        };

        const source = parsed.rss?.channel?.title ?? parsed.feed?.title ?? new URL(feedUrl).hostname;
        const rssItems = asArray(parsed.rss?.channel?.item).map((item) => ({
          id: `rss-${guidToString(item.guid) ?? item.link ?? item.title}`,
          source,
          title: item.title ?? "Untitled role",
          company: source,
          url: item.link ?? feedUrl,
          description: stripHtml(item["content:encoded"] ?? item.description),
          tags: [],
          publishedAt: parseDate(item.pubDate)
        }));

        const atomItems = asArray(parsed.feed?.entry).map((item) => {
          const url = atomLinkToString(item.link) ?? feedUrl;

          return {
            id: `atom-${item.id ?? url ?? item.title}`,
            source,
            title: item.title ?? "Untitled role",
            company: source,
            url,
            description: stripHtml(item.content ?? item.summary),
            tags: [],
            publishedAt: parseDate(item.published ?? item.updated)
          };
        });

        return [...rssItems, ...atomItems];
      } catch (error) {
        console.warn(`RSS fallido: ${feedUrl}. ${error}`);
        return [];
      }
    })
  );

  return jobs.flat();
};
