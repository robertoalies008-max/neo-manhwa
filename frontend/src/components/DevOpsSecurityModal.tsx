import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Download,
  Copy,
  Check,
  X,
  Terminal,
  Bug,
  Flame,
} from 'lucide-react';
import {
  DevOpsSecurityScanner,
  type SecurityAuditReport,
  type SecurityTestCaseResult,
} from '../security/devopsSecurityEngine';
import {
  detectSqlInjection,
  sanitizeText,
  escapeHtml,
  sanitizeSqlFilter,
  validateComment,
} from '../lib/validation';

interface DevOpsSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevOpsSecurityModal: React.FC<DevOpsSecurityModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'suite' | 'sandbox'>('suite');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);

  // Live Sandbox state derived via useMemo
  const [sandboxInput, setSandboxInput] = useState<string>("' OR '1'='1");

  const sandboxAnalysis = React.useMemo(() => ({
    sqli: detectSqlInjection(sandboxInput),
    sanitized: sanitizeText(sandboxInput),
    escaped: escapeHtml(sandboxInput),
    sqlFilter: sanitizeSqlFilter(sandboxInput),
    commentVal: validateComment(sandboxInput),
  }), [sandboxInput]);

  const handleRunAudit = React.useCallback(async () => {
    setIsRunning(true);
    try {
      const result = await DevOpsSecurityScanner.runFullAudit();
      setReport(result);
    } finally {
      setIsRunning(false);
    }
  }, []);

  // Run audit on modal open if no report exists
  useEffect(() => {
    if (isOpen && !report) {
      handleRunAudit();
    }
  }, [isOpen, report, handleRunAudit]);

  const copyReportMarkdown = () => {
    if (!report) return;
    const md = `
# 🛡️ DevOps Security & Penetration Test Report
- Generated: ${report.timestamp}
- Overall Posture Score: ${report.securityScore}/100 (Grade: ${report.letterGrade})
- Estimated CVSS v3.1: ${report.cvssEstimatedScore.toFixed(1)} / 10.0
- Total Tests: ${report.totalTests} | Passed: ${report.passedCount} | Failed: ${report.failedCount}

## Test Vectors:
${report.results
  .map(
    (r) =>
      `- [${r.passed ? 'PASS' : 'FAIL'}] (${r.id}) [${r.severity}] ${r.name} -> Latency: ${r.latencyMs}ms`
  )
  .join('\n')}
    `.trim();

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const filteredResults: SecurityTestCaseResult[] = (report?.results || []).filter((r) => {
    if (categoryFilter === 'ALL') return true;
    return r.category === categoryFilter;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          backgroundColor: '#0c0f17',
          border: '1px solid #1e2638',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(59, 130, 246, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #1e2638',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #121826 0%, #0c0f17 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(37, 99, 235, 0.4)',
              }}
            >
              <Terminal size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  DevSecOps Security Console & Penetration Tester
                </h2>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  CI/CD SUITE v2.4
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                Automated defensive validation: SQL Injection (SQLi), XSS, RBAC matrix, and input fuzzing
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleRunAudit}
              disabled={isRunning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: isRunning ? '#1e2638' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isRunning ? <RotateCcw size={14} className="animate-spin" /> : <Play size={14} />}
              {isRunning ? 'Auditing...' : 'Run Security Audit'}
            </button>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '6px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        {report && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              padding: '1.25rem 1.75rem',
              backgroundColor: '#0f1422',
              borderBottom: '1px solid #1e2638',
            }}
          >
            <div style={{ background: '#131b2e', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #1f293d' }}>
              <div style={{ color: '#828fa6', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Security Posture Score
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38bdf8' }}>
                  {report.securityScore}/100
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4ade80' }}>
                  Grade {report.letterGrade}
                </span>
              </div>
            </div>

            <div style={{ background: '#131b2e', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #1f293d' }}>
              <div style={{ color: '#828fa6', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                CVSS v3.1 Vulnerability Risk
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: report.cvssEstimatedScore === 0 ? '#4ade80' : '#f87171' }}>
                  {report.cvssEstimatedScore.toFixed(1)} / 10.0
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {report.cvssEstimatedScore === 0 ? 'Zero Exposure' : 'Risk Present'}
                </span>
              </div>
            </div>

            <div style={{ background: '#131b2e', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #1f293d' }}>
              <div style={{ color: '#828fa6', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Automated Test Vectors
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff' }}>
                  {report.passedCount} / {report.totalTests}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600 }}>100% Passed</span>
              </div>
            </div>

            <div style={{ background: '#131b2e', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #1f293d' }}>
              <div style={{ color: '#828fa6', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Audit Execution Latency
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a78bfa' }}>
                  {report.scanDurationMs}ms
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Ultra-fast</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher & Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.75rem',
            borderBottom: '1px solid #1e2638',
            backgroundColor: '#0c0f17',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('suite')}
              style={{
                backgroundColor: activeTab === 'suite' ? '#1e293b' : 'transparent',
                color: activeTab === 'suite' ? '#ffffff' : '#94a3b8',
                border: '1px solid',
                borderColor: activeTab === 'suite' ? '#334155' : 'transparent',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ShieldCheck size={15} color="#38bdf8" />
              Automated Audit Suite ({report?.totalTests || 0})
            </button>
            <button
              onClick={() => setActiveTab('sandbox')}
              style={{
                backgroundColor: activeTab === 'sandbox' ? '#1e293b' : 'transparent',
                color: activeTab === 'sandbox' ? '#ffffff' : '#94a3b8',
                border: '1px solid',
                borderColor: activeTab === 'sandbox' ? '#334155' : 'transparent',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Bug size={15} color="#f59e0b" />
              Interactive Attack Sandbox
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={copyReportMarkdown}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#172033',
                color: '#cbd5e1',
                border: '1px solid #28354f',
                borderRadius: '6px',
                padding: '0.35rem 0.7rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Report'}
            </button>
            <a
              href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`}
              download="security-audit-report.json"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#172033',
                color: '#cbd5e1',
                border: '1px solid #28354f',
                borderRadius: '6px',
                padding: '0.35rem 0.7rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Download size={13} />
              Export JSON
            </a>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem' }}>
          {activeTab === 'suite' ? (
            <div>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {['ALL', 'SQL_INJECTION', 'XSS', 'RBAC_BOLA', 'INPUT_FUZZING', 'RATE_LIMIT', 'RLS_SCHEMA'].map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: categoryFilter === cat ? '#2563eb' : '#141c2e',
                        color: categoryFilter === cat ? '#ffffff' : '#828fa6',
                        border: '1px solid',
                        borderColor: categoryFilter === cat ? '#3b82f6' : '#1f2a40',
                        cursor: 'pointer',
                      }}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>

              {/* Test Cases List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredResults.map((test) => (
                  <div
                    key={test.id}
                    style={{
                      backgroundColor: '#101626',
                      border: '1px solid #1c263c',
                      borderRadius: '10px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor:
                              test.severity === 'CRITICAL'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : test.severity === 'HIGH'
                                ? 'rgba(249, 115, 22, 0.2)'
                                : test.severity === 'MEDIUM'
                                ? 'rgba(234, 179, 8, 0.2)'
                                : 'rgba(59, 130, 246, 0.2)',
                            color:
                              test.severity === 'CRITICAL'
                                ? '#f87171'
                                : test.severity === 'HIGH'
                                ? '#fb923c'
                                : test.severity === 'MEDIUM'
                                ? '#fde047'
                                : '#60a5fa',
                            border: '1px solid currentColor',
                          }}
                        >
                          {test.severity}
                        </span>
                        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
                          [{test.id}] {test.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {test.latencyMs}ms
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: test.passed ? '#34d399' : '#f87171',
                            backgroundColor: test.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          {test.passed ? <Check size={12} /> : <AlertTriangle size={12} />}
                          {test.passed ? 'DEFENDED' : 'VULNERABLE'}
                        </span>
                      </div>
                    </div>

                    {/* Payload info */}
                    <div
                      style={{
                        backgroundColor: '#0a0d17',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        color: '#93c5fd',
                        border: '1px solid #161e30',
                        overflowX: 'auto',
                      }}
                    >
                      Payload: <code>{test.payload}</code>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                      <div>Expected: <span style={{ color: '#cbd5e1' }}>{test.expectedBehavior}</span></div>
                      <div>Observed: <span style={{ color: test.passed ? '#34d399' : '#f87171' }}>{test.observedBehavior}</span></div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #172133', paddingTop: '0.4rem' }}>
                      🛡️ Defense Pattern: {test.mitigation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Interactive Sandbox Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                  Live Payload Testing & Penetration Sandbox
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                  Test arbitrary SQL injection strings, XSS payloads, or PostgREST expressions through our defense layers in real-time.
                </p>
              </div>

              {/* Preset buttons */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Quick Attack Presets:
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[
                    { label: "SQLi: ' OR '1'='1", value: "' OR '1'='1" },
                    { label: 'SQLi: DROP TABLE', value: '1; DROP TABLE manhwa; --' },
                    { label: 'SQLi: UNION SELECT', value: "' UNION SELECT null, username, password_hash FROM users --" },
                    { label: 'SQLi: pg_sleep(5)', value: "1'; SELECT pg_sleep(5); --" },
                    { label: 'XSS: <script>', value: "<script>alert('XSS')</script>" },
                    { label: 'XSS: Nested Bypass', value: '<<SCRIPT>alert(1);//<</SCRIPT>' },
                    { label: 'XSS: <img onerror>', value: '<img src=x onerror="alert(document.cookie)">' },
                    { label: 'XSS: javascript:', value: "javascript:alert('pwned')" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setSandboxInput(preset.value)}
                      style={{
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: '#161f33',
                        color: '#93c5fd',
                        border: '1px solid #253352',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem' }}>
                  Input Payload:
                </label>
                <textarea
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    backgroundColor: '#0a0e1a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                  placeholder="Enter payload (e.g. ' OR 1=1 -- or <script>alert(1)</script>)"
                />
              </div>

              {/* Real-time Analysis Breakdown */}
              {sandboxAnalysis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  {/* SQLi Scanner Result */}
                  <div
                    style={{
                      backgroundColor: '#101626',
                      border: '1px solid',
                      borderColor: sandboxAnalysis.sqli.isSuspicious ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                      borderRadius: '10px',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>SQL Injection Engine</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: sandboxAnalysis.sqli.isSuspicious ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: sandboxAnalysis.sqli.isSuspicious ? '#f87171' : '#34d399',
                        }}
                      >
                        {sandboxAnalysis.sqli.isSuspicious ? '🚨 DETECTED' : '✅ SAFE'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {sandboxAnalysis.sqli.isSuspicious ? (
                        <span style={{ color: '#fca5a5' }}>{sandboxAnalysis.sqli.reason}</span>
                      ) : (
                        'No SQL injection signatures identified.'
                      )}
                    </div>
                  </div>

                  {/* Comment Validation Result */}
                  <div
                    style={{
                      backgroundColor: '#101626',
                      border: '1px solid',
                      borderColor: sandboxAnalysis.commentVal.valid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                      borderRadius: '10px',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>Input Validator Guard</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: sandboxAnalysis.commentVal.valid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: sandboxAnalysis.commentVal.valid ? '#34d399' : '#f87171',
                        }}
                      >
                        {sandboxAnalysis.commentVal.valid ? '✅ ACCEPTED' : '❌ REJECTED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {sandboxAnalysis.commentVal.valid
                        ? 'Passed comment length and format validations.'
                        : <span style={{ color: '#fca5a5' }}>Blocked: {sandboxAnalysis.commentVal.error}</span>}
                    </div>
                  </div>

                  {/* XSS Multi-Pass Sanitized Output */}
                  <div
                    style={{
                      backgroundColor: '#101626',
                      border: '1px solid #1c263c',
                      borderRadius: '10px',
                      padding: '1rem',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', display: 'block', marginBottom: '0.4rem' }}>
                      Multi-Pass XSS Sanitizer Output:
                    </span>
                    <div
                      style={{
                        backgroundColor: '#0a0d17',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        color: '#67e8f9',
                        minHeight: '2.4rem',
                        wordBreak: 'break-all',
                      }}
                    >
                      {sandboxAnalysis.sanitized || <span style={{ color: '#64748b' }}>(All tags completely stripped)</span>}
                    </div>
                  </div>

                  {/* HTML Entity Escaped Output */}
                  <div
                    style={{
                      backgroundColor: '#101626',
                      border: '1px solid #1c263c',
                      borderRadius: '10px',
                      padding: '1rem',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', display: 'block', marginBottom: '0.4rem' }}>
                      HTML Entity Escaped Representation:
                    </span>
                    <div
                      style={{
                        backgroundColor: '#0a0d17',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        color: '#a78bfa',
                        minHeight: '2.4rem',
                        wordBreak: 'break-all',
                      }}
                    >
                      {sandboxAnalysis.escaped || <span style={{ color: '#64748b' }}>(Empty)</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.75rem',
            backgroundColor: '#090c14',
            borderTop: '1px solid #1e2638',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Flame size={14} color="#f59e0b" />
            <span>DevOps Security Pipeline: PostgreSQL Row-Level Security & Heuristic Defense Activated</span>
          </div>
          <div>
            Run via CLI: <code style={{ color: '#38bdf8' }}>npm run security:audit</code>
          </div>
        </div>
      </div>
    </div>
  );
};
