import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { QualityGateReport } from './types'

export function writeReport(report: QualityGateReport, outputDir: string) {
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(join(outputDir, 'report.md'), renderMarkdownReport(report))
}

export function renderMarkdownReport(report: QualityGateReport) {
  const lines = [
    `# Quality Gate Report`,
    '',
    `- Run: ${report.runId}`,
    `- Mode: ${report.mode}`,
    `- Dry run: ${report.dryRun ? 'yes' : 'no'}`,
    `- Live checks allowed: ${report.allowLive ? 'yes' : 'no'}`,
    `- Git SHA: ${report.git.sha ?? 'unknown'}`,
    `- Dirty worktree: ${report.git.dirty ? 'yes' : 'no'}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    '',
    `## Summary`,
    '',
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Skipped: ${report.summary.skipped}`,
    '',
    `## Lanes`,
    '',
  ]

  for (const result of report.results) {
    lines.push(`### ${result.title}`)
    lines.push('')
    lines.push(`- ID: ${result.id}`)
    lines.push(`- Status: ${result.status}`)
    lines.push(`- Duration: ${result.durationMs}ms`)
    if (result.command) {
      lines.push(`- Command: \`${result.command.join(' ')}\``)
    }
    if (result.exitCode !== undefined) {
      lines.push(`- Exit code: ${result.exitCode}`)
    }
    if (result.skipReason) {
      lines.push(`- Skip reason: ${result.skipReason}`)
    }
    if (result.error) {
      lines.push(`- Error: ${result.error}`)
    }
    if (result.artifactDir) {
      lines.push(`- Artifacts: ${result.artifactDir}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
