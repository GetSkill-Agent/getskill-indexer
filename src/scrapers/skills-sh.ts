import * as cheerio from "cheerio";
import type { SkillRaw } from "../types.ts";
import { toSlug } from "../dedup.ts";

const USER_AGENT = "getskill-indexer/1.0 (https://github.com/GetSkill-Agent/getskill-indexer)";

/**
 * Scrape skills.sh directory for skill listings.
 * skills.sh has 87K+ skills with trending/all-time rankings.
 * No API available — DOM scraping via cheerio.
 */
export async function scanSkillsSh(): Promise<SkillRaw[]> {
  console.log("[scan] Scraping skills.sh...");
  const now = new Date().toISOString();
  const skills: SkillRaw[] = [];

  for (const page of ["", "/trending"]) {
    try {
      const url = `https://skills.sh${page}`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.warn(`[skills.sh] ${url}: HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Try common listing patterns
      // skills.sh typically renders skill cards with name, description, install count
      $("a[href*='/skills/'], a[href*='/skill/'], .skill-card, [data-skill]").each((_i, el) => {
        const $el = $(el);
        const name = $el.find("h3, h4, .skill-name, .name").first().text().trim()
          || $el.text().trim().split("\n")[0]?.trim();
        const desc = $el.find("p, .description, .skill-desc").first().text().trim();
        const href = $el.attr("href") || "";

        if (!name || name.length < 2 || name.length > 100) return;

        const sourceUrl = href.startsWith("http") ? href : `https://skills.sh${href}`;

        skills.push({
          name,
          slug: toSlug(name),
          description: desc || "",
          source: "skills-sh",
          sourceUrl,
          hasScripts: false,
          fileCount: 0,
          updatedAt: now,
          scannedAt: now,
        });
      });

      // Fallback: try table rows or list items
      if (skills.length === 0) {
        $("tr, li").each((_i, el) => {
          const $el = $(el);
          const link = $el.find("a").first();
          const name = link.text().trim();
          const href = link.attr("href") || "";
          const desc = $el.find("td:nth-child(2), .desc").text().trim()
            || $el.text().replace(name, "").trim().slice(0, 200);

          if (!name || name.length < 2 || name.length > 100) return;
          if (href.includes("#") || href.includes("shields.io")) return;

          const sourceUrl = href.startsWith("http") ? href : `https://skills.sh${href}`;

          skills.push({
            name,
            slug: toSlug(name),
            description: desc,
            source: "skills-sh",
            sourceUrl,
            hasScripts: false,
            fileCount: 0,
            updatedAt: now,
            scannedAt: now,
          });
        });
      }
    } catch (e) {
      console.warn(`[skills.sh] Scrape failed (page="${page}"):`, e instanceof Error ? e.message : e);
    }
  }

  // Deduplicate within this source
  const seen = new Set<string>();
  const unique = skills.filter((s) => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  });

  console.log(`[scan] skills.sh: found ${unique.length} skills`);
  return unique;
}
