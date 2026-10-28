import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '../api.js';
import { fadeUp, staggerContainer } from '../motion.js';

function parseInlineMarkdown(str) {
  if (!str) return null;
  const tokens = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="cyber-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: 'var(--accent-cyan)' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function FormattedText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="formatted-markdown">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: 4 }} />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="md-h4 flex-align gap-2">
              {parseInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="md-h3">
              {parseInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="md-h2">
              {parseInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
            </h2>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="md-bullet-item">
              <span className="md-bullet-dot">•</span>
              <div>{parseInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="md-p">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function SecurityCopilot() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, chat, siem, lab, blacklist, report
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // SIEM Events
  const [events, setEvents] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Copilot Chat
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'copilot',
      text: `### 🛡️ VoteForge AI Security Copilot Online\n\nI am your LLM-powered security assistant. I continuously monitor security event streams, detect voting system anomalies, assess threat risk levels, and provide administrative defensive recommendations.\n\n*How can I assist you with system defense today?*`,
      suggestedActions: [
        { label: 'Run Security Diagnostic', command: 'Analyze system telemetry now' },
        { label: 'Check IP Blacklist', command: 'Show active IP blocklist' },
        { label: 'Verify Election Integrity', command: 'Verify election voting integrity' },
        { label: 'Check Health Overview', command: 'Show system health and security risk score' }
      ]
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Attack Simulation State
  const [simulating, setSimulating] = useState(false);

  // Config Drawer Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [copilotConfig, setCopilotConfig] = useState({
    provider: 'builtin',
    apiKey: '',
    model: 'gpt-4o'
  });

  // Report State
  const [reportMarkdown, setReportMarkdown] = useState('');

  // Socket setup
  const socketRef = useRef(null);

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/admin/security/dashboard');
      setMetrics(res.data);
      setCopilotConfig(prev => ({
        ...prev,
        provider: res.data.copilotConfig?.provider || 'builtin',
        model: res.data.copilotConfig?.model || 'gpt-4o'
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const params = {};
      if (severityFilter) params.severity = severityFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/admin/security/events', { params });
      setEvents(res.data.events);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchEvents();

    // Socket.IO for real-time SIEM stream
    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on('security:event', (newEvent) => {
      setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
    });

    socket.on('security:metrics', (newMetrics) => {
      setMetrics(newMetrics);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'siem') {
      fetchEvents();
    } else if (activeTab === 'report' && !reportMarkdown) {
      fetchReport();
    }
  }, [activeTab, severityFilter, searchQuery]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const fetchReport = async () => {
    try {
      const res = await api.get('/admin/security/report');
      setReportMarkdown(res.data.report);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSendMessage = async (msgText) => {
    const textToSend = msgText || chatInput;
    if (!textToSend.trim()) return;

    const userMsg = { sender: 'user', text: textToSend };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.post('/admin/security/chat', { message: textToSend });
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'copilot',
          text: res.data.reply,
          suggestedActions: res.data.suggestedActions || []
        }
      ]);
      if (res.data.metrics) {
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'copilot', text: `❌ **Error**: ${errorMessage(err)}` }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExecuteAction = async (action) => {
    try {
      const res = await api.post('/admin/security/mitigate', {
        actionType: action.actionType || action.type,
        target: action.target,
        reason: action.reason || 'Executed via AI Copilot Chat'
      });
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 4000);

      // Append confirmation in chat
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'copilot',
          text: `✅ **Defensive Action Executed**: ${res.data.message}`
        }
      ]);
      fetchMetrics();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleSimulateAttack = async (attackType) => {
    setSimulating(true);
    try {
      const res = await api.post('/admin/security/simulate-attack', { attackType });
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 4000);

      fetchMetrics();
      fetchEvents();

      // Automatically inform Copilot in chat if active
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'user',
          text: `System Alert: Simulated ${attackType} launched.`
        },
        {
          sender: 'copilot',
          text: `🚨 **Attack Telemetry Received!**\n\nI have detected an incoming \`${attackType}\` simulation. Check the Threat Radar and SIEM stream for live event vectors.`
        }
      ]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSimulating(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/security/config', copilotConfig);
      setSuccessMsg('AI Copilot Configuration Updated!');
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowConfigModal(false);
      fetchMetrics();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleUnblockIp = async (ip) => {
    try {
      const res = await api.post('/admin/security/mitigate', { actionType: 'unblock_ip', target: ip });
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMetrics();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Initializing VoteForge AI Security Copilot Engine...</p>
      </div>
    );
  }

  const riskScore = metrics?.riskScore || 0;
  const riskLevel = metrics?.riskLevel || 'LOW';
  const badgeColor = metrics?.badgeColor || '#10b981';

  return (
    <div className="container security-copilot-container" style={{ paddingBottom: 60 }}>
      {/* Header Bar */}
      <header className="security-header flex-between align-center">
        <div>
          <div className="flex-align gap-2">
            <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="cyber-shield-icon">🛡️</span> VoteForge AI Security Copilot
            </h1>
            <span className="live-siem-pulse">
              <span className="pulse-dot" /> LIVE SIEM STREAM
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
            LLM-powered threat detection, voting anomaly analysis & defensive playbook automation.
          </p>
        </div>

        <div className="flex-align gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setShowConfigModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ⚙️ Provider: <strong style={{ textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>{metrics?.copilotConfig?.provider}</strong>
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setActiveTab('report')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📄 Audit Report
          </button>
        </div>
      </header>

      {/* Error & Success Toasts */}
      {error && (
        <div className="alert alert-danger flex-between" style={{ marginTop: 16 }}>
          <span>⚠️ {error}</span>
          <button className="icon-btn" onClick={() => setError('')}>✕</button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success flex-between" style={{ marginTop: 16 }}>
          <span>✅ {successMsg}</span>
          <button className="icon-btn" onClick={() => setSuccessMsg('')}>✕</button>
        </div>
      )}

      {/* Top Threat Status Banner */}
      <div className="cyber-status-banner card" style={{ marginTop: 20, borderColor: badgeColor }}>
        <div className="banner-grid flex-between align-center wrap gap-4">
          <div className="flex-align gap-4">
            <div className="radar-score-circle" style={{ '--score-color': badgeColor }}>
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${riskScore}, 100`}
                  stroke={badgeColor}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="percentage" fill={badgeColor}>{riskScore}</text>
              </svg>
            </div>
            <div>
              <div className="flex-align gap-2">
                <span className="text-muted" style={{ fontSize: 13, letterSpacing: '0.05em' }}>SYSTEM THREAT RISK</span>
                <span className="badge" style={{ backgroundColor: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}` }}>
                  {riskLevel} RISK
                </span>
              </div>
              <h3 style={{ margin: '4px 0 0 0', fontSize: 18 }}>
                {riskScore < 25 ? 'System Integrity Secure' : riskScore < 50 ? 'Moderate Anomaly Activity Detected' : 'Elevated Threat Vectors Detected'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {metrics?.totalEvents24h || 0} security events evaluated in last 24 hours.
              </p>
            </div>
          </div>

          <div className="quick-metrics-row flex-align gap-4">
            <div className="quick-metric-item text-center">
              <span className="metric-val" style={{ color: metrics?.criticalEvents > 0 ? 'var(--danger)' : 'var(--text)' }}>{metrics?.criticalEvents || 0}</span>
              <span className="metric-lbl">Critical</span>
            </div>
            <div className="quick-metric-item text-center">
              <span className="metric-val" style={{ color: metrics?.highEvents > 0 ? 'var(--warning)' : 'var(--text)' }}>{metrics?.highEvents || 0}</span>
              <span className="metric-lbl">High</span>
            </div>
            <div className="quick-metric-item text-center">
              <span className="metric-val" style={{ color: '#06b6d4' }}>{metrics?.activeIpBlocks || 0}</span>
              <span className="metric-lbl">IP Blocks</span>
            </div>
            <div className="quick-metric-item text-center">
              <span className="metric-val" style={{ color: '#a855f7' }}>{metrics?.tokenReplays || 0}</span>
              <span className="metric-lbl">Token Replays</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation — Professional SOC-style underline tabs */}
      <div className="copilot-tab-bar">
        {[
          { id: 'overview', label: 'Overview', icon: '🛡️' },
          { id: 'chat', label: 'AI Copilot', icon: '🤖' },
          { id: 'siem', label: 'SIEM Events', icon: '📡' },
          { id: 'lab', label: 'Attack Lab', icon: '🧪' },
          { id: 'blacklist', label: 'IP Blacklist', icon: '🚫' },
          { id: 'report', label: 'Audit Report', icon: '📄' },
        ].map((t) => (
          <button
            key={t.id}
            className={`copilot-tab ${activeTab === t.id ? 'copilot-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="copilot-tab-icon">{t.icon}</span>
            <span className="copilot-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="cyber-tab-content" style={{ marginTop: 24 }}>
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-2 gap-4">
            <motion.div variants={fadeUp} className="card">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🎯</span> Active Security Telemetry
              </h3>
              <div className="space-y-3" style={{ marginTop: 16 }}>
                <div className="telemetry-bar-row">
                  <div className="flex-between text-sm" style={{ marginBottom: 4 }}>
                    <span>Failed Login Attempts</span>
                    <strong>{metrics?.failedLogins || 0} events</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (metrics?.failedLogins || 0) * 5)}%`, backgroundColor: '#f59e0b' }} />
                  </div>
                </div>

                <div className="telemetry-bar-row">
                  <div className="flex-between text-sm" style={{ marginBottom: 4 }}>
                    <span>JWT Refresh Token Replays</span>
                    <strong>{metrics?.tokenReplays || 0} alerts</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (metrics?.tokenReplays || 0) * 33)}%`, backgroundColor: 'var(--danger)' }} />
                  </div>
                </div>

                <div className="telemetry-bar-row">
                  <div className="flex-between text-sm" style={{ marginBottom: 4 }}>
                    <span>Vote Velocity Anomalies</span>
                    <strong>{metrics?.voteAnomalies || 0} alerts</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (metrics?.voteAnomalies || 0) * 20)}%`, backgroundColor: '#a855f7' }} />
                  </div>
                </div>

                <div className="telemetry-bar-row">
                  <div className="flex-between text-sm" style={{ marginBottom: 4 }}>
                    <span>Total Audit Records (24h)</span>
                    <strong>{metrics?.totalAuditLogs || 0} entries</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (metrics?.totalAuditLogs || 0) / 5)}%`, backgroundColor: '#06b6d4' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setActiveTab('chat');
                    handleSendMessage('Analyze system telemetry now');
                  }}
                >
                  🔍 Run Full AI Security Diagnostic Scan
                </button>
              </div>
            </motion.div>

            {/* Recent Threats Card */}
            <motion.div variants={fadeUp} className="card">
              <div className="flex-between align-center">
                <h3 className="card-title" style={{ margin: 0 }}>🚨 Live Security Alerts Stream</h3>
                <button className="btn btn-xs btn-ghost" onClick={() => setActiveTab('siem')}>View All ➔</button>
              </div>

              <div className="space-y-3" style={{ marginTop: 16 }}>
                {metrics?.recentEvents && metrics.recentEvents.length > 0 ? (
                  metrics.recentEvents.slice(0, 5).map((evt) => (
                    <div key={evt.id} className="security-event-item p-3 rounded" style={{ backgroundColor: 'var(--surface-2)', borderLeft: `4px solid ${evt.severity === 'CRITICAL' ? 'var(--danger)' : evt.severity === 'HIGH' ? 'var(--warning)' : 'var(--info)'}` }}>
                      <div className="flex-between align-center">
                        <span className="badge badge-sm" style={{ textTransform: 'uppercase', backgroundColor: evt.severity === 'CRITICAL' ? 'var(--danger)' : evt.severity === 'HIGH' ? 'var(--warning)' : 'var(--primary)', color: '#fff' }}>
                          {evt.severity}
                        </span>
                        <span className="text-muted" style={{ fontSize: 12 }}>{evt.createdAt}</span>
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 600, fontSize: 14 }}>
                        {evt.eventType}
                      </div>
                      <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                        Source IP: <code className="cyber-code">{evt.ip || 'N/A'}</code> {evt.studentId ? `| Student: ${evt.studentId}` : ''}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted" style={{ padding: '20px 0', textAlign: 'center' }}>No recent security events logged.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* TAB 2: AI COPILOT CHAT */}
        {activeTab === 'chat' && (
          <div className="cyber-chat-card" style={{ height: 620, display: 'flex', flexDirection: 'column' }}>
            <div className="chat-header flex-between align-center">
              <div className="flex-align gap-3">
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  🤖
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>VoteForge Security AI Copilot</h4>
                  <div className="flex-align gap-2" style={{ marginTop: 2 }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      Engine: <code className="cyber-code">{copilotConfig.model}</code> ({copilotConfig.provider})
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="btn btn-xs btn-ghost text-muted"
                onClick={() => setChatMessages([chatMessages[0]])}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                🗑️ Clear Chat
              </button>
            </div>

            <div className="chat-messages-scroll" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-bubble-wrapper ${msg.sender === 'user' ? 'user-msg' : 'copilot-msg'}`}
                  style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
                >
                  <div
                    className={msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-copilot'}
                    style={{ padding: '16px 20px' }}
                  >
                    <FormattedText text={msg.text} />

                    {/* Action Execution Chips */}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="chat-actions-row flex-align wrap gap-2" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        {msg.suggestedActions.map((act, idx) => (
                          <button
                            key={idx}
                            className="cyber-chip-btn"
                            onClick={() => {
                              if (act.command) handleSendMessage(act.command);
                              else handleExecuteAction(act);
                            }}
                          >
                            ⚡ {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="chat-bubble-wrapper copilot-msg" style={{ alignSelf: 'flex-start' }}>
                  <div className="chat-bubble-copilot" style={{ padding: '14px 20px' }}>
                    <div className="flex-align gap-2 text-muted" style={{ fontSize: 13 }}>
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                      AI Copilot is analyzing telemetry & generating response...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="chat-input-bar" style={{ padding: 18, borderTop: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.95)' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex-align gap-3"
              >
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ask AI Security Copilot (e.g., 'Analyze active threats', 'Show IP blocklist')..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  style={{ flex: 1, height: 46, padding: '0 18px', borderRadius: 10, background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: 14 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={chatLoading || !chatInput.trim()}
                  style={{ height: 46, padding: '0 24px', borderRadius: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Send ➔
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: SIEM EVENT STREAM */}
        {activeTab === 'siem' && (
          <div className="card">
            <div className="flex-between align-center wrap gap-3" style={{ marginBottom: 16 }}>
              <h3 className="card-title" style={{ margin: 0 }}>📡 SIEM Security Event Telemetry</h3>
              
              <div className="flex-align gap-2">
                <input
                  type="text"
                  className="input-field input-sm"
                  placeholder="Search IP, event type, details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: 220 }}
                />
                <select
                  className="input-field input-sm"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="INFO">Info</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Severity</th>
                    <th>Event Type</th>
                    <th>Source IP</th>
                    <th>User Context</th>
                    <th>Raw Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? (
                    events.map((e) => (
                      <tr key={e.id}>
                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{e.createdAt}</td>
                        <td>
                          <span
                            className="badge badge-sm"
                            style={{
                              backgroundColor:
                                e.severity === 'CRITICAL' ? 'var(--danger)' :
                                e.severity === 'HIGH' ? 'var(--warning)' :
                                e.severity === 'MEDIUM' ? 'var(--info)' : 'var(--primary)',
                              color: '#fff'
                            }}
                          >
                            {e.severity}
                          </span>
                        </td>
                        <td><code className="cyber-code">{e.eventType}</code></td>
                        <td><code className="cyber-code">{e.ip || 'N/A'}</code></td>
                        <td>{e.studentId ? `${e.studentId} (${e.name || ''})` : 'Anonymous'}</td>
                        <td style={{ fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.details ? JSON.stringify(e.details) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 30 }} className="text-muted">
                        No security events found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ATTACK SIMULATOR LAB */}
        {activeTab === 'lab' && (
          <div className="card">
            <h3 className="card-title">🧪 VoteForge Attack Simulator & Red Team Lab</h3>
            <p className="text-muted" style={{ marginBottom: 24 }}>
              Simulate high-impact security attack vectors against VoteForge in a controlled environment to verify real-time SIEM event logging, risk scoring, and AI Copilot automated defense responses.
            </p>

            <div className="grid grid-2 gap-4">
              <div className="attack-card p-4 rounded" style={{ border: '1px solid var(--danger-soft)', backgroundColor: 'var(--surface-2)' }}>
                <div className="flex-between align-center">
                  <span className="badge" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>AUTHENTICATION VECTOR</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>MITRE T1110</span>
                </div>
                <h4 style={{ marginTop: 10, fontSize: 16 }}>Password Brute Force / Credential Stuffing</h4>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Generates 8 rapid failed authentication attempts from a single external IP address to simulate dictionary password spray.
                </p>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ marginTop: 12 }}
                  disabled={simulating}
                  onClick={() => handleSimulateAttack('credential_stuffing')}
                >
                  Launch Credential Attack
                </button>
              </div>

              <div className="attack-card p-4 rounded" style={{ border: '1px solid var(--danger-soft)', backgroundColor: 'var(--surface-2)' }}>
                <div className="flex-between align-center">
                  <span className="badge" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>SESSION VECTOR</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>MITRE T1539</span>
                </div>
                <h4 style={{ marginTop: 10, fontSize: 16 }}>Refresh Token Replay / Hijack Attack</h4>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Simulates reuse of a previously rotated JWT refresh token, triggering automatic session chain revocation and security alert.
                </p>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ marginTop: 12 }}
                  disabled={simulating}
                  onClick={() => handleSimulateAttack('token_hijack')}
                >
                  Launch Token Replay Attack
                </button>
              </div>

              <div className="attack-card p-4 rounded" style={{ border: '1px solid var(--warning-soft)', backgroundColor: 'var(--surface-2)' }}>
                <div className="flex-between align-center">
                  <span className="badge" style={{ backgroundColor: 'var(--warning)', color: '#fff' }}>BALLOT VECTOR</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>MITRE T1499</span>
                </div>
                <h4 style={{ marginTop: 10, fontSize: 16 }}>Sybil Voting Rapid Velocity Anomaly</h4>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Simulates a bot network submitting rapid vote bursts to trigger velocity filters and prompt emergency election pause.
                </p>
                <button
                  className="btn btn-sm"
                  style={{ marginTop: 12, background: 'var(--warning)', color: '#fff', border: 'none' }}
                  disabled={simulating}
                  onClick={() => handleSimulateAttack('sybil_voting_anomaly')}
                >
                  Launch Sybil Voting Anomaly
                </button>
              </div>

              <div className="attack-card p-4 rounded" style={{ border: '1px solid var(--info-soft)', backgroundColor: 'var(--surface-2)' }}>
                <div className="flex-between align-center">
                  <span className="badge" style={{ backgroundColor: 'var(--info)', color: '#fff' }}>PRIVILEGE VECTOR</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>MITRE T1068</span>
                </div>
                <h4 style={{ marginTop: 10, fontSize: 16 }}>Admin Endpoint Escalation Attempt</h4>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Simulates an unauthenticated or student account attempting unauthorized REST API calls to `/api/admin/users`.
                </p>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ marginTop: 12 }}
                  disabled={simulating}
                  onClick={() => handleSimulateAttack('admin_escalation')}
                >
                  Launch Escalation Attempt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BLACKLIST & MITIGATIONS */}
        {activeTab === 'blacklist' && (
          <div className="grid grid-2 gap-4">
            <div className="card">
              <h3 className="card-title">🚫 Active IP Address Blacklist</h3>
              <div className="table-responsive" style={{ marginTop: 16 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Blocked IP</th>
                      <th>Reason</th>
                      <th>Added By</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics?.ipBlockList && metrics.ipBlockList.length > 0 ? (
                      metrics.ipBlockList.map((b) => (
                        <tr key={b.id}>
                          <td><code className="cyber-code">{b.ip}</code></td>
                          <td style={{ fontSize: 13 }}>{b.reason}</td>
                          <td style={{ fontSize: 12 }}>{b.createdBy}</td>
                          <td>
                            <button
                              className="btn btn-xs btn-ghost text-danger"
                              onClick={() => handleUnblockIp(b.ip)}
                            >
                              Unblock
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 20 }} className="text-muted">
                          No IP addresses are currently blocked.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">⚡ Defensive Execution Controls</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const targetIp = e.target.ip.value;
                  const reason = e.target.reason.value;
                  if (targetIp) {
                    handleExecuteAction({ type: 'block_ip', target: targetIp, reason });
                    e.target.reset();
                  }
                }}
                className="space-y-3"
                style={{ marginTop: 16 }}
              >
                <h4>Manual IP Blacklist Enforcer</h4>
                <div className="form-group">
                  <label className="form-label">IP Address</label>
                  <input type="text" name="ip" className="input-field" placeholder="e.g. 198.51.100.45" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <input type="text" name="reason" className="input-field" placeholder="Administrative restriction" required />
                </div>
                <button type="submit" className="btn btn-danger btn-sm">Enforce Block IP</button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT REPORT */}
        {activeTab === 'report' && (
          <div className="card">
            <div className="flex-between align-center" style={{ marginBottom: 16 }}>
              <h3 className="card-title" style={{ margin: 0 }}>📄 Formal Security Audit Report</h3>
              <div className="flex-align gap-2">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(reportMarkdown);
                    setSuccessMsg('Report Markdown copied to clipboard!');
                    setTimeout(() => setSuccessMsg(''), 3000);
                  }}
                >
                  📋 Copy Markdown
                </button>
              </div>
            </div>

            <div
              className="report-preview-box p-4 rounded"
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                maxHeight: 500,
                overflowY: 'auto'
              }}
            >
              {reportMarkdown || 'Generating security compliance audit report...'}
            </div>
          </div>
        )}
      </div>

      {/* CONFIG MODAL */}
      {showConfigModal && (
        <div className="modal-backdrop flex-center">
          <div className="card modal-card" style={{ maxWidth: 480, width: '100%' }}>
            <div className="flex-between align-center" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>⚙️ AI Security Engine Provider</h3>
              <button className="icon-btn" onClick={() => setShowConfigModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3">
              <div className="form-group">
                <label className="form-label">AI Engine Provider</label>
                <select
                  className="input-field"
                  value={copilotConfig.provider}
                  onChange={(e) => setCopilotConfig({ ...copilotConfig, provider: e.target.value })}
                >
                  <option value="builtin">Built-in Expert Threat Reasoning Engine (Zero Setup)</option>
                  <option value="openai">OpenAI (GPT-4o / o3-mini)</option>
                  <option value="gemini">Google Gemini API</option>
                  <option value="ollama">Ollama (Local LLM)</option>
                </select>
              </div>

              {copilotConfig.provider !== 'builtin' && (
                <>
                  <div className="form-group">
                    <label className="form-label">API Key</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="sk-..."
                      value={copilotConfig.apiKey}
                      onChange={(e) => setCopilotConfig({ ...copilotConfig, apiKey: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Model Name</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="gpt-4o"
                      value={copilotConfig.model}
                      onChange={(e) => setCopilotConfig({ ...copilotConfig, model: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="flex-between" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowConfigModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Engine Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
