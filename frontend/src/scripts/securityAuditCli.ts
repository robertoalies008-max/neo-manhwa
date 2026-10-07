#!/usr/bin/env tsx
/**
 * Professional DevOps Security & Penetration Testing CLI Runner.
 * Executable from CI/CD pipelines (GitHub Actions, GitLab CI, Vercel Build checks)
 * to prevent security regressions (SQLi, XSS, BOLA, DoS).
 */

import { DevOpsSecurityScanner } from '../security/devopsSecurityEngine';
import * as fs from 'fs';
import * as path from 'path';

async function runDevOpsSecurityPipeline() {
  console.log('\n' + '='.repeat(70));
  console.log('   🛡️  NEOMANHWA DEVSECOPS SECURITY & PENETRATION TEST RUNNER  🛡️   ');
  console.log('='.repeat(70));
  console.log(' Target System: NeoManhwa Platform (Vite + React 19 + Supabase)');
  console.log(` Audit Time:   ${new Date().toISOString()}`);
  console.log(' Standards:    OWASP Top 10 | CWE-89 (SQLi) | CWE-79 (XSS) | CWE-284 (BOLA)');
  console.log('='.repeat(70) + '\n');

  console.log('⚡ Initializing security test suites...\n');

  const report = await DevOpsSecurityScanner.runFullAudit();

  console.log('┌' + '─'.repeat(68) + '┐');
  console.log(`│ %-66s │`, '  TEST EXECUTION RESULTS BY VECTOR:');
  console.log('├' + '─'.repeat(68) + '┤');

  for (const result of report.results) {
    const statusIcon = result.passed ? '✅ [PASS]' : '❌ [FAIL]';
    const severityBadge = `[${result.severity}]`.padEnd(10);
    const id = result.id.padEnd(9);
    console.log(`│ ${statusIcon} ${id} ${severityBadge} ${result.name.slice(0, 34).padEnd(34)} │`);
    if (!result.passed) {
      console.log(`│    └─ Observed: ${result.observedBehavior.slice(0, 50)} │`);
    }
  }

  console.log('└' + '─'.repeat(68) + '┘\n');

  // Print Summaries by Category
  console.log('📊 CATEGORY BREAKDOWN:');
  for (const [category, summary] of Object.entries(report.suiteSummaries)) {
    const pct = Math.round((summary.passed / summary.total) * 100);
    console.log(`  • ${category.padEnd(16)}: ${summary.passed}/${summary.total} Passed (${pct}%)`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`  🎯 SECURITY POSTURE SCORE:  ${report.securityScore}/100`);
  console.log(`  🏆 COMPLIANCE GRADE:        ${report.letterGrade}`);
  console.log(`  📉 CVSS v3.1 BASE SCORE:    ${report.cvssEstimatedScore.toFixed(1)} / 10.0 (Target: 0.0)`);
  console.log(`  ⏱️  TOTAL AUDIT LATENCY:    ${report.scanDurationMs}ms`);
  console.log('─'.repeat(70) + '\n');

  // Save report to disk
  try {
    const reportPath = path.resolve(process.cwd(), 'security-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`💾 Machine-readable report saved to: ${reportPath}`);
  } catch (err: any) {
    console.warn('Notice: Could not write json artifact to disk:', err.message);
  }

  if (report.failedCount > 0) {
    console.error(`\n🚨 PIPELINE FAILED: ${report.failedCount} security vulnerabilities detected!`);
    process.exit(1);
  } else {
    console.log('\n✨ ALL SECURITY GATES PASSED! Zero vulnerabilities identified.');
    process.exit(0);
  }
}

runDevOpsSecurityPipeline().catch((err) => {
  console.error('Fatal scanner error:', err);
  process.exit(1);
});
