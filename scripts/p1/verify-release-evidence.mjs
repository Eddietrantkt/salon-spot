import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const reports = [
  process.env.P1_RUNTIME_ARTIFACT_DIR ?? 'artifacts/p1-runtime-smoke',
  process.env.P1_BROWSER_ARTIFACT_DIR ?? 'artifacts/p1-browser',
  process.env.P1_ARTIFACT_DIR ?? 'artifacts/p1-backup-restore'
].map((directory) => resolve(directory, 'report.json'));

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
