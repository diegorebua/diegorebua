import { mkdir, writeFile } from 'node:fs/promises';

const user = process.env.GITHUB_USER || 'diegorebua';
const token = process.env.GITHUB_TOKEN;
const output = process.env.OUTPUT_DIR || 'dist';
if (!token) throw new Error('GITHUB_TOKEN is required');
const C = { bg: '#040711', panel: '#080e1d', line: '#1b3653', cyan: '#38bdf8', blue: '#2563eb', white: '#f0f6ff', muted: '#94a3b8' };
const mono = "'JetBrains Mono',Consolas,monospace";
const sans = "'Arial Narrow',Impact,'Arial Black',sans-serif";
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const fmt = value => new Intl.NumberFormat('pt-BR').format(value);

async function github(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'diego-profile-readme',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

const query = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false) { totalCount }
    contributionsCollection {
      contributionCalendar { totalContributions }
      totalCommitContributions
      totalPullRequestContributions
    }
  }
}`;
const [result, events] = await Promise.all([
  github('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: user } }),
  }),
  github(`https://api.github.com/users/${encodeURIComponent(user)}/events?per_page=100`),
]);
if (result.errors?.length || !result.data?.user) throw new Error(JSON.stringify(result.errors || 'User missing'));
const u = result.data.user;
const cc = u.contributionsCollection;
const stats = [
  ['CONTRIBUIÇÕES / ANO', cc.contributionCalendar.totalContributions],
  ['COMMITS / ANO', cc.totalCommitContributions],
  ['PULL REQUESTS / ANO', cc.totalPullRequestContributions],
  ['REPOSITÓRIOS', u.repositories.totalCount],
  ['SEGUIDORES', u.followers.totalCount],
];

function frame(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${xml(title)}"><title>${xml(title)}</title><defs><linearGradient id="bar"><stop stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient><pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${C.cyan}" opacity=".18"/></pattern></defs><rect width="${w}" height="${h}" rx="24" fill="${C.bg}"/><rect width="${w}" height="${h}" rx="24" fill="url(#dots)"/><rect x="1" y="1" width="${w-2}" height="${h-2}" rx="23" fill="none" stroke="${C.line}" stroke-width="2"/>${body}</svg>`;
}
let numberBody = `<text x="32" y="48" font-family="${mono}" font-size="13" letter-spacing="3" fill="${C.cyan}">03 / GITHUB EM NÚMEROS</text><path d="M32 69h1136" stroke="${C.line}"/>`;
stats.forEach(([label, value], index) => {
  const x = 32 + index * 232;
  numberBody += `<rect x="${x}" y="89" width="214" height="104" rx="13" fill="${C.panel}" stroke="${C.line}"/><text x="${x+17}" y="145" font-family="${mono}" font-size="35" font-weight="700" fill="${index % 2 ? C.white : C.cyan}">${fmt(value)}</text><text x="${x+17}" y="172" font-family="${mono}" font-size="10" letter-spacing=".6" fill="${C.muted}">${label}</text>`;
});
numberBody += `<text x="32" y="220" font-family="${mono}" font-size="11" fill="${C.muted}">Dados do GitHub · atualização automática a cada 24 horas</text>`;

const hours = Array(24).fill(0);
for (const event of events) {
  if (event.type !== 'PushEvent') continue;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date(event.created_at)));
  if (Number.isInteger(hour) && hour >= 0 && hour < 24) hours[hour] += event.payload?.commits?.length ?? event.payload?.size ?? 1;
}
const peak = Math.max(...hours, 1);
const total = hours.reduce((sum, n) => sum + n, 0);
let hoursBody = `<text x="32" y="48" font-family="${mono}" font-size="13" letter-spacing="3" fill="${C.cyan}">02 / QUANDO O CÓDIGO ACONTECE</text><path d="M32 69h1136" stroke="${C.line}"/>`;
hours.forEach((value, hour) => {
  const x = 44 + hour * 47;
  const h = value ? Math.max(8, Math.round(value / peak * 122)) : 4;
  hoursBody += `<rect x="${x}" y="${224-h}" width="30" height="${h}" rx="4" fill="${value ? 'url(#bar)' : C.line}"/><text x="${x+15}" y="247" text-anchor="middle" font-family="${mono}" font-size="10" fill="${C.muted}">${String(hour).padStart(2,'0')}</text>`;
});
hoursBody += `<text x="32" y="278" font-family="${mono}" font-size="11" fill="${C.muted}">${total ? `Horário de São Paulo · ${fmt(total)} commits nos eventos públicos recentes` : 'Sem pushes públicos nos eventos recentes'}</text>`;

await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(`${output}/numeros.svg`, frame(1200, 244, `Números do GitHub de ${user}`, numberBody)),
  writeFile(`${output}/horas.svg`, frame(1200, 300, `Horários dos commits públicos recentes de ${user}`, hoursBody)),
]);
console.log(`SVGs de ${user} escritos em ${output}`);
