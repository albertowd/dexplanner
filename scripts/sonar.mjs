#!/usr/bin/env node
// Runs a full local SonarQube analysis: starts the server (docker compose profile "sonar"),
// configures it on first use, runs the tests with coverage, scans, and prints the issues.
// Usage: node scripts/sonar.mjs [--skip-tests] [--strict]
//   --strict  exit with code 1 when the quality gate fails or open issues remain
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.SONAR_URL ?? 'http://localhost:9000';
const projectKey = 'dexplanner';
const stateFile = path.join(root, '.cache', 'sonar.json');
const reportFile = path.join(root, '.cache', 'sonar-report.json');
const args = new Set(process.argv.slice(2));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, env = {}) {
  const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${command}`);
}

function loadState() {
  return existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
}

function saveState(state) {
  mkdirSync(path.dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/** SonarQube briefly drops connections while it processes an analysis; retry network errors. */
async function fetchWithRetry(url, init, attempts = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (i >= attempts) throw error;
      await sleep(3000);
    }
  }
}

async function api(pathAndQuery, { auth, method = 'GET', form } = {}) {
  const headers = {};
  if (auth) {
    const credentials = Buffer.from(`${auth.user}:${auth.password}`).toString('base64');
    headers.authorization = `Basic ${credentials}`;
  }
  const res = await fetchWithRetry(`${host}${pathAndQuery}`, {
    method,
    headers,
    body: form ? new URLSearchParams(form) : undefined,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} → ${res.status}: ${text}`);
  return body;
}

async function waitForServer() {
  process.stdout.write('Waiting for SonarQube');
  for (let i = 0; i < 120; i++) {
    try {
      const { status } = await api('/api/system/status');
      if (status === 'UP') {
        console.log(' ready.');
        return;
      }
    } catch {
      // still starting
    }
    process.stdout.write('.');
    await sleep(5000);
  }
  throw new Error('SonarQube did not start within 10 minutes. Check "docker logs dexplanner-sonarqube".');
}

async function isValid(auth) {
  const { valid } = await api('/api/authentication/validate', { auth });
  return valid;
}

/** Replaces the default admin/admin password with a random one kept in .cache/sonar.json. */
async function adminAuth(state) {
  if (state.adminPassword && (await isValid({ user: 'admin', password: state.adminPassword }))) {
    return { user: 'admin', password: state.adminPassword };
  }
  const initial = { user: 'admin', password: 'admin' };
  if (!(await isValid(initial))) {
    throw new Error(`Cannot log in to SonarQube as admin. Delete the volumes (docker compose --profile sonar down -v) or fix ${stateFile}.`);
  }
  const password = `Pp-${randomBytes(18).toString('base64url')}9!`;
  await api('/api/users/change_password', {
    auth: initial,
    method: 'POST',
    form: { login: 'admin', previousPassword: 'admin', password },
  });
  state.adminPassword = password;
  saveState(state);
  console.log(`Set a random SonarQube admin password (stored in ${path.relative(root, stateFile)}).`);
  return { user: 'admin', password };
}

async function ensureProject(auth) {
  const { components } = await api(`/api/projects/search?projects=${projectKey}`, { auth });
  if (components.length === 0) {
    await api('/api/projects/create', { auth, method: 'POST', form: { project: projectKey, name: 'DexPlanner', mainBranch: 'main' } });
    console.log(`Created SonarQube project "${projectKey}".`);
  }
}

async function analysisToken(auth, state) {
  if (state.token) {
    const valid = await api('/api/authentication/validate', { auth: { user: state.token, password: '' } });
    if (valid.valid) return state.token;
  }
  const name = 'dexplanner-local';
  await api('/api/user_tokens/revoke', { auth, method: 'POST', form: { name } }).catch(() => {});
  const { token } = await api('/api/user_tokens/generate', {
    auth,
    method: 'POST',
    form: { name, type: 'PROJECT_ANALYSIS_TOKEN', projectKey },
  });
  state.token = token;
  saveState(state);
  return token;
}

/** Vitest writes Windows separators on Windows; the scanner runs in a Linux container. */
function normalizeLcov() {
  const lcov = path.join(root, 'coverage', 'lcov.info');
  if (!existsSync(lcov)) throw new Error('coverage/lcov.info not found. Run "npm run test:coverage" first.');
  const fixed = readFileSync(lcov, 'utf8').replaceAll(/^SF:(.*)$/gm, (_, p) => `SF:${p.replaceAll('\\', '/')}`);
  writeFileSync(lcov, fixed);
}

async function waitForAnalysis(auth) {
  const report = readFileSync(path.join(root, '.scannerwork', 'report-task.txt'), 'utf8');
  const taskId = /^ceTaskId=(.+)$/m.exec(report)?.[1];
  for (let i = 0; i < 120; i++) {
    const { task } = await api(`/api/ce/task?id=${taskId}`, { auth });
    if (task.status === 'SUCCESS') return;
    if (task.status === 'FAILED' || task.status === 'CANCELED') throw new Error(`Analysis ${task.status}: ${task.errorMessage ?? ''}`);
    await sleep(2000);
  }
  throw new Error('Timed out waiting for the analysis to be processed.');
}

async function fetchAll(endpoint, key, auth) {
  const items = [];
  for (let page = 1; ; page++) {
    const body = await api(`${endpoint}&ps=500&p=${page}`, { auth });
    items.push(...body[key]);
    if (items.length >= (body.paging?.total ?? body.total ?? 0) || body[key].length === 0) return items;
  }
}

async function report(auth) {
  const gate = await api(`/api/qualitygates/project_status?projectKey=${projectKey}`, { auth });
  const issues = await fetchAll(`/api/issues/search?components=${projectKey}&issueStatuses=OPEN,CONFIRMED`, 'issues', auth);
  const hotspots = await fetchAll(`/api/hotspots/search?project=${projectKey}&status=TO_REVIEW`, 'hotspots', auth);
  const measures = await api(
    `/api/measures/component?component=${projectKey}&metricKeys=coverage,duplicated_lines_density,ncloc,bugs,vulnerabilities,code_smells`,
    { auth },
  );
  writeFileSync(reportFile, JSON.stringify({ gate, issues, hotspots, measures }, null, 2));

  const file = (component) => component.replace(`${projectKey}:`, '');
  console.log(`\nQuality gate: ${gate.projectStatus.status}`);
  console.log(measures.component.measures.map((m) => `${m.metric}=${m.value}`).join('  '));
  console.log(`\nOpen issues: ${issues.length}`);
  for (const i of issues) {
    console.log(`  [${i.severity ?? i.impacts?.[0]?.severity}] ${file(i.component)}:${i.line ?? '-'}  ${i.message}  (${i.rule})`);
  }
  console.log(`\nSecurity hotspots to review: ${hotspots.length}`);
  for (const h of hotspots) console.log(`  ${file(h.component)}:${h.line ?? '-'}  ${h.message}  (${h.ruleKey})`);
  console.log(`\nDashboard: ${host}/dashboard?id=${projectKey}  (full report: ${path.relative(root, reportFile)})`);
  return gate.projectStatus.status === 'OK' && issues.length === 0 && hotspots.length === 0;
}

async function main() {
  run('docker compose --profile sonar up -d sonarqube');
  await waitForServer();
  const state = loadState();
  const auth = await adminAuth(state);
  await ensureProject(auth);
  const token = await analysisToken(auth, state);

  if (!args.has('--skip-tests')) run('npm run test:coverage');
  normalizeLcov();
  run('docker compose --profile sonar-scan run --rm sonar-scanner', { SONAR_TOKEN: token });
  await waitForAnalysis(auth);
  const clean = await report(auth);
  if (args.has('--strict') && !clean) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
