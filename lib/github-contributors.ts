export const GITHUB_ORG = "pinchbench";
const GITHUB_API = "https://api.github.com";
const REVALIDATE_SECONDS = 60 * 60;
const PAGE_SIZE = 100;

export interface GithubRepo {
  name: string;
  htmlUrl: string;
  description: string | null;
}

export interface GithubContributor {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  contributions: number;
  repos: string[];
}

interface GithubRepoApi {
  name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  private?: boolean;
}

interface GithubContributorApi {
  login?: string;
  avatar_url?: string;
  html_url?: string;
  contributions?: number;
  type?: string;
}

export function isBotAccount(login: string, type?: string): boolean {
  if (type === "Bot") return true;
  const lower = login.toLowerCase();
  return (
    lower.endsWith("[bot]") ||
    lower.endsWith("-bot") ||
    lower.includes("[bot]") ||
    lower === "dependabot" ||
    lower === "renovate" ||
    lower === "github-actions" ||
    lower.startsWith("dependabot")
  );
}

export function isProductRepo(repo: GithubRepoApi): boolean {
  if (repo.fork || repo.archived || repo.private) return false;
  return !repo.name.startsWith(".");
}

export function mergeContributors(
  perRepo: Array<{ repo: string; contributors: GithubContributorApi[] }>,
): GithubContributor[] {
  const byLogin = new Map<string, GithubContributor>();

  for (const { repo, contributors } of perRepo) {
    for (const person of contributors) {
      if (!person.login || isBotAccount(person.login, person.type)) continue;
      const existing = byLogin.get(person.login);
      const additions = person.contributions ?? 0;
      if (existing) {
        existing.contributions += additions;
        if (!existing.repos.includes(repo)) existing.repos.push(repo);
        continue;
      }
      byLogin.set(person.login, {
        login: person.login,
        avatarUrl: person.avatar_url ?? `https://github.com/${person.login}.png`,
        htmlUrl: person.html_url ?? `https://github.com/${person.login}`,
        contributions: additions,
        repos: [repo],
      });
    }
  }

  return [...byLogin.values()].sort((a, b) => {
    if (b.contributions !== a.contributions) return b.contributions - a.contributions;
    if (b.repos.length !== a.repos.length) return b.repos.length - a.repos.length;
    return a.login.localeCompare(b.login);
  });
}

async function githubFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "pinchbench-leaderboard",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${GITHUB_API}${path}`, {
    headers,
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${path} failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function githubFetchPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await githubFetch<T[]>(`${path}${separator}per_page=${PAGE_SIZE}&page=${page}`);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

export async function fetchOrgProductRepos(org = GITHUB_ORG): Promise<GithubRepo[]> {
  const repos = await githubFetchPages<GithubRepoApi>(`/orgs/${org}/repos?type=public&sort=full_name`);
  return repos.filter(isProductRepo).map((repo) => ({
    name: repo.name,
    htmlUrl: repo.html_url,
    description: repo.description,
  }));
}

export async function fetchRepoContributors(org: string, repo: string): Promise<GithubContributorApi[]> {
  return githubFetchPages<GithubContributorApi>(
    `/repos/${org}/${repo}/contributors?anon=false`,
  );
}

export async function fetchGithubOrgContributors(
  org = GITHUB_ORG,
): Promise<{ repos: GithubRepo[]; contributors: GithubContributor[] }> {
  const repos = await fetchOrgProductRepos(org);
  const perRepo = await Promise.all(
    repos.map(async (repo) => {
      try {
        const contributors = await fetchRepoContributors(org, repo.name);
        return { repo: repo.name, contributors };
      } catch {
        return { repo: repo.name, contributors: [] };
      }
    }),
  );

  return {
    repos,
    contributors: mergeContributors(perRepo),
  };
}
