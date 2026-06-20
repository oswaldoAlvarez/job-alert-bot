import { parseDate, stripHtml } from "../filters/normalize.js";
import type { JobPosting } from "../types.js";

type GetOnBoardCompany = {
  data?: {
    attributes?: {
      name?: string;
    };
  };
};

type GetOnBoardJob = {
  id: string;
  attributes: {
    title: string;
    description?: string;
    projects?: string;
    functions?: string;
    benefits?: string;
    desirable?: string;
    remote?: boolean;
    remote_modality?: string;
    remote_zone?: string | null;
    countries?: string[];
    lang?: string;
    category_name?: string;
    perks?: string[];
    min_salary?: number | null;
    max_salary?: number | null;
    published_at?: number;
    company?: GetOnBoardCompany;
  };
  links: {
    public_url: string;
  };
};

type GetOnBoardResponse = {
  data?: GetOnBoardJob[];
};

const searchTerms = ["react", "react native", "frontend"];

export const fetchGetOnBoardJobs = async (): Promise<JobPosting[]> => {
  const responses = await Promise.all(
    searchTerms.map(async (query) => {
      const url = new URL("https://www.getonbrd.com/api/v0/search/jobs");
      url.searchParams.set("query", query);
      url.searchParams.set("remote", "true");
      url.searchParams.set("lang", "es");
      url.searchParams.set("per_page", "50");
      url.searchParams.append("expand[]", "company");

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Get on Board returned ${response.status}`);
      }

      return (await response.json()) as GetOnBoardResponse;
    })
  );

  return responses.flatMap((response) =>
    (response.data ?? []).map((job) => {
      const attributes = job.attributes;
      const company = attributes.company?.data?.attributes?.name ?? "Get on Board";
      const salary =
        attributes.min_salary || attributes.max_salary
          ? `${attributes.min_salary ?? "?"} - ${attributes.max_salary ?? "?"} USD`
          : undefined;

      return {
        id: `getonboard-${job.id}`,
        source: "Get on Board",
        title: attributes.title,
        company,
        location: [attributes.remote ? "Remoto" : undefined, attributes.remote_zone, ...(attributes.countries ?? [])]
          .filter(Boolean)
          .join(" - "),
        url: job.links.public_url,
        description: stripHtml(
          [
            attributes.description,
            attributes.projects,
            attributes.functions,
            attributes.benefits,
            attributes.desirable,
            attributes.lang
          ].join(" ")
        ),
        tags: [attributes.category_name, attributes.remote_modality, ...(attributes.perks ?? [])].filter(
          (tag): tag is string => Boolean(tag)
        ),
        salary,
        publishedAt: attributes.published_at ? parseDate(attributes.published_at * 1000) : undefined
      };
    })
  );
};
