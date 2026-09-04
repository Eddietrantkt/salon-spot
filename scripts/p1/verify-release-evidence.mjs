import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function resolveReportPath(directory, variableName) {
  const root = resolve(directory);
  const direct = resolve(root, 'report.json');
  try {
    await stat(direct);
    return direct;
  } catch (error) {
    if (!(error && error.code === 'ENOENT')) throw error;
  }

  const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  });
  const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const reportPath = join(root, entry.name, 'report.json');
    try {
      return { reportPath, modifiedAt: (await stat(reportPath)).mtimeMs };
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw error;
    }
  }));
  const latest = candidates.filter(Boolean).sort((a, b) => b.modifiedAt - a.modifiedAt)[0];
  if (!latest) {
    throw new Error(`No release report exists under ${root}. Set ${variableName} to the exact artifact directory.`);
  }
  return latest.reportPath;
}

const reports = await Promise.all([
  resolveReportPath(process.env.P1_RUNTIME_ARTIFACT_DIR ?? 'artifacts/p1-runtime-smoke', 'P1_RUNTIME_ARTIFACT_DIR'),
  resolveReportPath(process.env.P1_BROWSER_ARTIFACT_DIR ?? 'artifacts/p1-browser', 'P1_BROWSER_ARTIFACT_DIR'),
  resolveReportPath(process.env.P1_ARTIFACT_DIR ?? 'artifacts/p1-backup-restore', 'P1_ARTIFACT_DIR')
]);

const manifest = [];
for (const reportPath of reports) {
  const contents = await readFile(reportPath, 'utf8');
  const report = JSON.parse(contents);
  if (report.status !== 'passed') {
    throw new Error(`${report.gate ?? reportPath} is not passed.`);
  }
  manifest.push({
    gate: report.gate,
    path: reportPath,
    sha256: createHash('sha256').update(contents).digest('hex')
  });
}

const candidatePath = resolve('artifacts/ci/candidate.json');
const candidateContents = await readFile(candidatePath, 'utf8');
manifest.unshift({
  gate: 'CANDIDATE_IDENTITY',
  path: candidatePath,
  sha256: createHash('sha256').update(candidateContents).digest('hex')
});

await mkdir(resolve('artifacts/ci'), { recursive: true });
await writeFile(resolve('artifacts/ci/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Verified ${reports.length} passing release reports.`);
