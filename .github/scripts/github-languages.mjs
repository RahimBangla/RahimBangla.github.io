// Sums language bytes across RahimBangla's own (non-fork) public repos and writes data/github-languages.json.
// Run by .github/workflows/github-languages.yml; the portfolio page reads the JSON to draw its language bar.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const user = 'RahimBangla';
const out = 'data/github-languages.json';
const headers = {
  'User-Agent': `${user}-portfolio`,
  Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
};
const get = async url => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const repos = [];
for (let page = 1; ; page++) {
  const batch = await get(`https://api.github.com/users/${user}/repos?per_page=100&type=owner&page=${page}`);
  repos.push(...batch.filter(r => !r.fork));
  if (batch.length < 100) break;
}

const totals = {};
for (const repo of repos) {
  try {
    for (const [lang, bytes] of Object.entries(await get(repo.languages_url))) totals[lang] = (totals[lang] || 0) + bytes;
  } catch (e) {
    console.warn(`skipped ${repo.name}: ${e.message}`); // e.g. repos GitHub has blocked
  }
}

const languages = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([name, bytes]) => ({ name, bytes }));
if (!languages.length) throw new Error('no language data returned; keeping the existing file');

// Only rewrite when the numbers changed, so the daily run doesn't commit a new date every day.
let previous = null;
try { previous = JSON.parse(readFileSync(out, 'utf8')); } catch {}
if (previous && JSON.stringify(previous.languages) === JSON.stringify(languages)) {
  console.log('language totals unchanged');
} else {
  mkdirSync('data', { recursive: true });
  writeFileSync(out, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), repos: repos.length, languages }, null, 2) + '\n');
  console.log(`wrote ${out}: ${languages.length} languages across ${repos.length} repos`);
}
