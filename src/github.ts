// ── GitHub API helpers ────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ghFetch<T>(url: string, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: headers() });

    if (res.status === 429 || res.status === 403) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60_000;
      if (attempt < retries) {
        console.warn(`[github] Rate limited (${res.status}), waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
    }

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${url} — ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }
  throw new Error(`GitHub API: exhausted retries for ${url}`);
}

// ── Types ────────────────────────────────────────────────

interface ContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
  size: number;
}

interface SearchResult {
  total_count: number;
  items: Array<{
    full_name: string;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    updated_at: string;
    owner: { login: string };
    topics: string[];
  }>;
}

// ── List directory contents ─────────────────────────────

export async function listContents(repo: string, dirPath = ""): Promise<ContentItem[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${dirPath}`;
  try {
    return await ghFetch<ContentItem[]>(url);
  } catch (e) {
    console.error(`[github] Failed to list ${repo}/${dirPath}:`, e);
    return [];
  }
}

// ── Get file content (raw text) ─────────────────────────

export async function getFileContent(repo: string, filePath: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${repo}/main/${filePath}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // Try HEAD/master branch
      const res2 = await fetch(url.replace("/main/", "/master/"));
      if (!res2.ok) return null;
      return res2.text();
    }
    return res.text();
  } catch {
    return null;
  }
}

// ── Search repos by topic ───────────────────────────────

export async function searchByTopic(topic: string, maxRepos: number): Promise<SearchResult["items"]> {
  const perPage = Math.min(maxRepos, 100);
  const url = `https://api.github.com/search/repositories?q=topic:${topic}&sort=stars&order=desc&per_page=${perPage}`;
  try {
    const result = await ghFetch<SearchResult>(url);
    console.log(`[github] Topic "${topic}": ${result.total_count} total, fetched ${result.items.length}`);
    return result.items;
  } catch (e) {
    console.error(`[github] Topic search failed:`, e);
    return [];
  }
}

// ── Get repo info ───────────────────────────────────────

interface RepoInfo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: { login: string };
  license: { spdx_id: string } | null;
}

export async function getRepoInfo(repo: string): Promise<RepoInfo | null> {
  try {
    return await ghFetch<RepoInfo>(`https://api.github.com/repos/${repo}`);
  } catch {
    return null;
  }
}
