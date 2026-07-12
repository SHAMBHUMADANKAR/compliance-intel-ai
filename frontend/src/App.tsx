import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Database,
  FileText,
  MessageSquare,
  FileCheck,
  BookOpen,
  GitBranch,
  Settings,
  Bell,
  Upload,
  RefreshCw,
  Trash2,
  ExternalLink,
  Search,
  Cpu,
  Sparkles,
  ArrowRight,
  Download,
  Plus
} from 'lucide-react';
import './App.css';

// Type definitions for mockup data
interface MockDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  uploader: string;
  status: 'ready' | 'parsing' | 'embedding' | 'queued' | 'failed';
  hash: string;
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  citations?: { docName: string; page: number; text: string }[];
  phaseLog?: string[];
}

interface Finding {
  id: string;
  ref: string;
  title: string;
  verdict: 'compliant' | 'non-compliant' | 'needs-review';
  doc: string;
  page: number;
  excerpt: string;
  notes: string;
}

interface Standard {
  id: string;
  name: string;
  version: string;
  controlsCount: number;
  description: string;
}

interface McpServer {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected';
  tools: string[];
}

function App() {
  // Force dark mode class on HTML body/root
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Navigation state
  const [currentView, setCurrentView] = useState<string>('dashboard');

  // Documents state
  const [documents, setDocuments] = useState<MockDocument[]>([
    { id: '1', name: 'acme-password-policy-2026.pdf', type: 'PDF', size: '1.2 MB', date: '2026-07-10', uploader: 'Shambhuling', status: 'ready', hash: 'sha256_ab45c3' },
    { id: '2', name: 'aws-infrastructure-spec.json', type: 'JSON', size: '420 KB', date: '2026-07-11', uploader: 'Shambhuling', status: 'ready', hash: 'sha256_993fe2' },
    { id: '3', name: 'soc2-type2-gap-analysis.xlsx', type: 'XLSX', size: '2.4 MB', date: '2026-07-12', uploader: 'Shambhuling', status: 'ready', hash: 'sha256_ff1a8c' },
    { id: '4', name: 'vendor-contract-customer-data.docx', type: 'DOCX', size: '890 KB', date: '2026-07-12', uploader: 'Shambhuling', status: 'embedding', hash: 'sha256_5c6d3a' },
    { id: '5', name: 'obsolete-identity-claims.pdf', type: 'PDF', size: '3.1 MB', date: '2026-07-09', uploader: 'Shambhuling', status: 'failed', hash: 'sha256_e44d32' }
  ]);

  // Selected Document for detail view
  const [selectedDocId, setSelectedDocId] = useState<string>('1');

  // Chat/Audit Workspace state
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: 'Hello! I am your air-gapped Compliance Agent. I reason locally over your vault documents. Select a standard or ask me a compliance audit question to get started.'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [agentPhase, setAgentPhase] = useState<'Planning' | 'Retrieving' | 'Reasoning' | 'Validating' | 'Answering' | 'Idle'>('Idle');
  const [selectedStandard, setSelectedStandard] = useState('soc2');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAgentThinking, agentPhase]);

  // Audit findings / Report state
  const [findings] = useState<Finding[]>([
    {
      id: 'f1',
      ref: 'SOC2 CC6.1',
      title: 'Logical Access Controls / Password Rotation',
      verdict: 'compliant',
      doc: 'acme-password-policy-2026.pdf',
      page: 3,
      excerpt: '...All administrative accounts must rotate credential hashes every 90 days using the vault rotater utility...',
      notes: 'Fully documented in the 2026 password policy update. Verified automatically.'
    },
    {
      id: 'f2',
      ref: 'SOC2 CC6.3',
      title: 'Infrastructure Integrity / Unauthorized Changes',
      verdict: 'needs-review',
      doc: 'aws-infrastructure-spec.json',
      page: 1,
      excerpt: '...Root account lacks multi-factor authentication check bypass protection flags...',
      notes: 'JSON config indicates root account bypass checks are configured but MFA enforce state could not be fully parsed.'
    },
    {
      id: 'f3',
      ref: 'ISO 27001 A.12.6.1',
      title: 'Management of Technical Vulnerabilities',
      verdict: 'non-compliant',
      doc: 'soc2-type2-gap-analysis.xlsx',
      page: 2,
      excerpt: '...Production servers package "libssl1.1" reported unpatched CVE-2026-9912 vulnerability...',
      notes: 'Package version is outdated. Needs immediate system package upgrade to prevent potential vector vectors.'
    }
  ]);

  // Standards state
  const [standards, setStandards] = useState<Standard[]>([
    { id: 'soc2', name: 'SOC 2 Trust Services Criteria', version: '2022', controlsCount: 33, description: 'Security, Availability, Processing Integrity, Confidentiality, and Privacy controls.' },
    { id: 'iso27001', name: 'ISO/IEC 27001 Information Security', version: '2022', controlsCount: 93, description: 'International standard for Information Security Management Systems (ISMS).' },
    { id: 'hipaa', name: 'HIPAA Security Rule', version: '45 CFR Part 160/164', controlsCount: 18, description: 'Security standards for the protection of Electronic Protected Health Information (ePHI).' }
  ]);

  // MCP servers state
  const [mcpServers, setMcpServers] = useState<McpServer[]>([
    { id: 'pg-reader', name: 'PostgreSQL DB Catalog Client', description: 'Read-only schema and inventory query utility', status: 'connected', tools: ['list_tables', 'describe_table', 'run_read_query'] },
    { id: 'git-audit', name: 'Git Commit Auditor', description: 'Inspects active repositories commit metadata', status: 'connected', tools: ['get_commit_history', 'diff_commits'] },
    { id: 'k8s-inspector', name: 'K8s Cluster Inspector', description: 'Reads active cluster configs and ingress limits', status: 'disconnected', tools: ['list_pods', 'get_service_spec'] }
  ]);

  // Ingestion Queue tasks log
  const [tasks, setTasks] = useState([
    { id: 't-105', name: 'Vectorize document: vendor-contract-customer-data.docx', type: 'Ingestion', status: 'running', progress: 45, error: null },
    { id: 't-104', name: 'Parse document: soc2-type2-gap-analysis.xlsx', type: 'Ingestion', status: 'completed', progress: 100, error: null },
    { id: 't-103', name: 'Parse document: obsolete-identity-claims.pdf', type: 'Ingestion', status: 'failed', progress: 12, error: 'ExtractionError: PDF contains damaged compression tables' }
  ]);

  // Admin select settings
  const [selectedModel, setSelectedModel] = useState('llama3-8b-instruct');
  const [retentionDays, setRetentionDays] = useState(180);

  // File upload state simulator
  const [isDragging, setIsDragging] = useState(false);

  // Handle fake query submission to demonstrate streaming / agent phases
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAgentThinking) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: chatInput
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAgentThinking(true);

    // Simulate Agent execution flow
    const phases: ('Planning' | 'Retrieving' | 'Reasoning' | 'Validating' | 'Answering')[] = [
      'Planning',
      'Retrieving',
      'Reasoning',
      'Validating',
      'Answering'
    ];

    let currentPhaseIndex = 0;
    setAgentPhase(phases[0]);

    const interval = setInterval(() => {
      currentPhaseIndex++;
      if (currentPhaseIndex < phases.length) {
        setAgentPhase(phases[currentPhaseIndex]);
      } else {
        clearInterval(interval);
        setAgentPhase('Idle');
        setIsAgentThinking(false);

        // Add Response
        const agentResponse: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `Based on the active compliance documents in your Document Vault, I have analyzed your query regarding logical control structures. Here is the finding:

1. **Password Rotations (SOC2 CC6.1)**: We conform to password requirements as documented in your password policy.
2. **Access Revocations**: A review of recent AWS configs reveals root account compliance warnings.

I recommend scheduling a policy validation audit on your AWS infrastructure configurations.`,
          citations: [
            { docName: 'acme-password-policy-2026.pdf', page: 3, text: '...All administrative accounts must rotate credential hashes every 90 days...' },
            { docName: 'aws-infrastructure-spec.json', page: 1, text: '...Root account lacks multi-factor authentication check bypass protection flags...' }
          ]
        };
        setChatMessages(prev => [...prev, agentResponse]);
      }
    }, 1500);
  };

  // Re-process doc simulator
  const handleReprocess = (id: string) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, status: 'queued' } : doc));
    setTimeout(() => {
      setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, status: 'parsing' } : doc));
      setTimeout(() => {
        setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, status: 'ready' } : doc));
      }, 2000);
    }, 1500);
  };

  // Delete doc
  const handleDeleteDoc = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  // Custom standard form simulator
  const [newStdName, setNewStdName] = useState('');
  const [newStdDesc, setNewStdDesc] = useState('');
  const handleAddStandard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStdName) return;
    const nStd: Standard = {
      id: Date.now().toString(),
      name: newStdName,
      version: '2026',
      controlsCount: 12,
      description: newStdDesc || 'Custom organization framework.'
    };
    setStandards(prev => [...prev, nStd]);
    setNewStdName('');
    setNewStdDesc('');
  };

  // Toggle MCP tool
  const handleToggleMcp = (id: string) => {
    setMcpServers(prev => prev.map(srv => srv.id === id ? {
      ...srv,
      status: srv.status === 'connected' ? 'disconnected' : 'connected'
    } : srv));
  };

  // Render stats
  const totalDocsCount = documents.length;
  const readyDocsCount = documents.filter(d => d.status === 'ready').length;
  const compliantCount = findings.filter(f => f.verdict === 'compliant').length;
  const reviewCount = findings.filter(f => f.verdict === 'needs-review').length;
  const nonCompliantCount = findings.filter(f => f.verdict === 'non-compliant').length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0f14] text-[#e6ebf1]">
      
      {/* SIDEBAR */}
      <aside className="w-[240px] flex-shrink-0 bg-[#11161d] border-r border-[#232b36] flex flex-col justify-between p-4">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-3 pb-6 border-b border-[#232b36] mb-4">
            <div className="w-[28px] height-[28px] rounded-lg bg-gradient-to-br from-[#4f8cff] to-[#7c5cff] flex items-center justify-center font-bold text-white text-xs">CI</div>
            <div>
              <div className="font-bold text-sm tracking-wide">ComplianceIntel</div>
              <div className="text-[10px] text-[#5b6673] font-medium">self-hosted • air-gapped</div>
            </div>
          </div>

          {/* Navigation Workspace */}
          <nav className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-[#5b6673] px-2 py-1 font-semibold">Workspace</div>
            
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'dashboard'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <LayoutDashboard size={15} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentView('vault')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'vault'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <Database size={15} />
              <span>Document Vault</span>
              {documents.some(d => d.status === 'embedding' || d.status === 'parsing') && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#4f8cff] animate-ping" />
              )}
            </button>

            <button
              onClick={() => setCurrentView('docdetail')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'docdetail'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <FileText size={15} />
              <span>Document Detail</span>
            </button>

            <button
              onClick={() => setCurrentView('chat')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'chat'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <MessageSquare size={15} />
              <span>Audit Workspace</span>
              {isAgentThinking && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#3fbf7f] animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setCurrentView('report')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'report'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <FileCheck size={15} />
              <span>Audit Report</span>
            </button>

            <div className="pt-4 text-[10px] uppercase tracking-wider text-[#5b6673] px-2 py-1 font-semibold">Configuration</div>

            <button
              onClick={() => setCurrentView('standards')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'standards'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <BookOpen size={15} />
              <span>Standards Library</span>
            </button>

            <button
              onClick={() => setCurrentView('integrations')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'integrations'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <GitBranch size={15} />
              <span>Integrations (MCP)</span>
            </button>

            <button
              onClick={() => setCurrentView('admin')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'admin'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <Settings size={15} />
              <span>Admin Settings</span>
            </button>

            <div className="pt-4 text-[10px] uppercase tracking-wider text-[#5b6673] px-2 py-1 font-semibold">System</div>

            <button
              onClick={() => setCurrentView('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'notifications'
                  ? 'bg-[#1c2a44] text-[#bcd3ff] border border-[#2a3f66]'
                  : 'text-[#8a96a3] hover:bg-[#161d26] hover:text-[#e6ebf1] border border-transparent'
              }`}
            >
              <Bell size={15} />
              <span>Notifications</span>
              {tasks.some(t => t.status === 'running') && (
                <span className="ml-auto bg-[#4f8cff] text-[#e6ebf1] text-[9px] px-1.5 py-0.5 rounded-full font-bold">1</span>
              )}
            </button>
          </nav>
        </div>

        {/* Footer User Avatar */}
        <div className="pt-3 border-t border-[#232b36] flex items-center gap-3">
          <div className="w-[30px] h-[30px] rounded-full bg-[#2b3644] text-xs font-semibold flex items-center justify-center text-[#e6ebf1]">
            SM
          </div>
          <div>
            <div className="text-[11px] font-bold">Shambhuling</div>
            <div className="text-[9px] text-[#5b6673]">Compliance Officer</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER TOP BAR */}
        <header className="h-[56px] border-b border-[#232b36] bg-[#11161d] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold capitalize">
              {currentView === 'docdetail' ? 'Document Detail' : currentView === 'integrations' ? 'MCP Integrations' : `${currentView} workspace`}
            </h1>
            <span className="text-xs text-[#5b6673]">•</span>
            <span className="text-[11px] text-[#8a96a3]">Acme Financial Corp</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-[#161d26] border border-[#232b36] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fbf7f] animate-pulse" />
              <span className="text-[10px] font-medium text-[#3fbf7f] tracking-wide">All inference local — 0 external queries</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#161d26] border border-[#232b36] px-2 py-1 rounded-md text-xs text-[#8a96a3]">
              <Cpu size={12} className="text-[#4f8cff]" />
              <span className="text-[10px] font-semibold">{selectedModel === 'llama3-8b-instruct' ? 'Llama-3 (8B)' : 'Qwen-2.5 (14B)'}</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE VIEW PORT */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0b0f14]">
          
          {/* ============ DASHBOARD VIEW ============ */}
          {currentView === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Banner Message */}
              <div className="p-4 bg-[#1c2a44] border border-[#2a3f66] rounded-xl flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-[#bcd3ff] mb-1">Local Compliance Agent Active</h2>
                  <p className="text-[11px] text-[#8a96a3]">Your models are running locally. You have uploaded {totalDocsCount} documents across multiple namespaces. Ready to execute local self-correcting audits.</p>
                </div>
                <button onClick={() => setCurrentView('chat')} className="flex items-center gap-1 text-[11px] bg-[#4f8cff] hover:bg-[#3d7bef] text-white px-3 py-1.5 rounded-lg font-bold transition-all flex-shrink-0">
                  <span>Start Audit</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#11161d] border border-[#232b36] p-4 rounded-xl">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#5b6673] mb-1">Vault Documents</div>
                  <div className="text-2xl font-bold">{totalDocsCount}</div>
                  <div className="text-[10px] text-[#3fbf7f] mt-1">● {readyDocsCount} fully vectorized</div>
                </div>

                <div className="bg-[#11161d] border border-[#232b36] p-4 rounded-xl">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#5b6673] mb-1">Compliant Clauses</div>
                  <div className="text-2xl font-bold text-[#3fbf7f]">{compliantCount}</div>
                  <div className="text-[10px] text-[#5b6673] mt-1">Auto-verified by local LLM</div>
                </div>

                <div className="bg-[#11161d] border border-[#232b36] p-4 rounded-xl">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#5b6673] mb-1">Action Items (Review)</div>
                  <div className="text-2xl font-bold text-[#e0a940]">{reviewCount}</div>
                  <div className="text-[10px] text-[#5b6673] mt-1">Manual overrides or verification needed</div>
                </div>

                <div className="bg-[#11161d] border border-[#232b36] p-4 rounded-xl">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#5b6673] mb-1">Non-Compliant Findings</div>
                  <div className="text-2xl font-bold text-[#e0575c]">{nonCompliantCount}</div>
                  <div className="text-[10px] text-[#5b6673] mt-1">Requires immediate remediation</div>
                </div>
              </div>

              {/* Layout Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent reports list */}
                <div className="lg:col-span-2 bg-[#11161d] border border-[#232b36] rounded-xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a96a3]">Active Findings & Citations</h3>
                    <button onClick={() => setCurrentView('report')} className="text-[10px] text-[#4f8cff] font-semibold hover:underline">View Full Audit Report</button>
                  </div>
                  
                  <div className="space-y-3">
                    {findings.map(finding => (
                      <div key={finding.id} className="p-3 bg-[#161d26] border border-[#232b36] rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold text-[#e6ebf1]">{finding.ref} — {finding.title}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            finding.verdict === 'compliant' ? 'bg-[#123324] text-[#3fbf7f]' :
                            finding.verdict === 'needs-review' ? 'bg-[#3a2f14] text-[#e0a940]' :
                            'bg-[#3a1c1e] text-[#e0575c]'
                          }`}>{finding.verdict.toUpperCase().replace('-', ' ')}</span>
                        </div>
                        <p className="text-[11px] text-[#8a96a3] italic mb-1 bg-[#0b0f14] p-2 rounded border border-[#232b36]/30">
                          {finding.excerpt}
                        </p>
                        <div className="text-[10px] text-[#5b6673] flex justify-between">
                          <span>Source: {finding.doc} (Page {finding.page})</span>
                          <span className="text-[#8a96a3] font-medium">{finding.notes}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Queue status and quick control */}
                <div className="bg-[#11161d] border border-[#232b36] rounded-xl p-4 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a96a3]">Celery Task Ingest Queue</h3>
                  
                  <div className="space-y-3">
                    {tasks.map(task => (
                      <div key={task.id} className="p-3 bg-[#161d26] border border-[#232b36] rounded-lg space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-semibold text-[#8a96a3] truncate max-w-[140px]">{task.name}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[8px] ${
                            task.status === 'completed' ? 'bg-[#123324] text-[#3fbf7f]' :
                            task.status === 'running' ? 'bg-[#1c2a44] text-[#4f8cff] animate-pulse' :
                            'bg-[#3a1c1e] text-[#e0575c]'
                          }`}>{task.status}</span>
                        </div>
                        {task.status === 'running' && (
                          <div className="w-full bg-[#0b0f14] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#4f8cff] h-full transition-all duration-300" style={{ width: `${task.progress}%` }} />
                          </div>
                        )}
                        {task.error && (
                          <p className="text-[9px] text-[#e0575c] bg-[#3a1c1e]/30 p-1.5 rounded border border-[#e0575c]/20 break-words">{task.error}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[#232b36] pt-3 text-center">
                    <button onClick={() => setCurrentView('notifications')} className="text-[10px] text-[#4f8cff] font-semibold hover:underline">Monitor Background Queues</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============ DOCUMENT VAULT VIEW ============ */}
          {currentView === 'vault' && (
            <div className="space-y-6">
              {/* Drag Drop Area simulator */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
                className={`upload-zone cursor-pointer select-none transition-all ${isDragging ? 'border-[#4f8cff] bg-[#1c2a44]/20' : 'border-[#232b36] bg-[#11161d]'}`}
              >
                <Upload size={32} className="mx-auto text-[#5b6673] mb-2" />
                <p className="text-xs mb-1">Drag and drop documents here, or <span className="text-[#4f8cff] hover:underline font-bold">browse local files</span></p>
                <p className="text-[10px] text-[#5b6673]">Supports PDF, XLSX, DOCX, and JSON up to 50MB. Exact content duplicates will be automatically rejected.</p>
              </div>

              {/* Document Registry Table */}
              <div className="bg-[#11161d] border border-[#232b36] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-[#232b36] flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a96a3]">Document Vault Registry</h3>
                  <div className="flex items-center gap-2 bg-[#0b0f14] border border-[#232b36] px-2.5 py-1 rounded-lg">
                    <Search size={12} className="text-[#5b6673]" />
                    <input type="text" placeholder="Search files..." className="bg-transparent border-none text-[11px] focus:outline-none text-[#e6ebf1] w-[140px]" />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#161d26]/40 text-[#5b6673] border-b border-[#232b36]">
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Document Name</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Type</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Size</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Indexed On</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Status</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232b36]/60">
                      {documents.map(doc => (
                        <tr key={doc.id} className="hover:bg-[#161d26]/30 text-xs">
                          <td className="p-3 font-semibold text-[#e6ebf1] max-w-[240px] truncate">{doc.name}</td>
                          <td className="p-3 text-[#8a96a3]">{doc.type}</td>
                          <td className="p-3 text-[#8a96a3]">{doc.size}</td>
                          <td className="p-3 text-[#5b6673]">{doc.date}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              doc.status === 'ready' ? 'bg-[#123324] text-[#3fbf7f]' :
                              doc.status === 'failed' ? 'bg-[#3a1c1e] text-[#e0575c]' :
                              'bg-[#3a2f14] text-[#e0a940] animate-pulse'
                            }`}>
                              {doc.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => { setSelectedDocId(doc.id); setCurrentView('docdetail'); }}
                                className="p-1 hover:text-[#4f8cff] text-[#8a96a3] transition-all"
                                title="View Chunk Detail"
                              >
                                <ExternalLink size={12} />
                              </button>
                              {doc.status === 'failed' && (
                                <button
                                  onClick={() => handleReprocess(doc.id)}
                                  className="p-1 hover:text-[#3fbf7f] text-[#8a96a3] transition-all"
                                  title="Reprocess Document"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="p-1 hover:text-[#e0575c] text-[#8a96a3] transition-all"
                                title="Delete Document"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============ DOCUMENT DETAIL VIEW ============ */}
          {currentView === 'docdetail' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-160px)]">
              {/* Document list sidebar inside detail */}
              <div className="bg-[#11161d] border border-[#232b36] rounded-xl p-4 flex flex-col min-h-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a96a3] mb-3">Select Document</h3>
                <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                  {documents.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                        selectedDocId === doc.id
                          ? 'bg-[#1c2a44] border-[#2a3f66] text-[#bcd3ff]'
                          : 'bg-[#161d26] border-transparent text-[#8a96a3] hover:border-[#232b36] hover:text-[#e6ebf1]'
                      }`}
                    >
                      <div className="font-semibold truncate mb-1">{doc.name}</div>
                      <div className="flex justify-between text-[9px] text-[#5b6673]">
                        <span>Hash: {doc.hash.slice(0, 12)}</span>
                        <span>{doc.size}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ingestion Chunk detail view */}
              <div className="lg:col-span-2 bg-[#11161d] border border-[#232b36] rounded-xl flex flex-col min-h-0 p-4">
                <div className="flex justify-between items-center border-b border-[#232b36] pb-3 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-[#e6ebf1]">
                      {documents.find(d => d.id === selectedDocId)?.name || 'Select Document'}
                    </h3>
                    <p className="text-[10px] text-[#5b6673]">Chunking specification: 500 characters, overlap 50 characters</p>
                  </div>
                  <span className="text-[10px] text-[#8a96a3] bg-[#161d26] px-2 py-0.5 rounded border border-[#232b36]">
                    Ready for Vector Query
                  </span>
                </div>

                {/* Simulated extracted chunks */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  <div className="p-3 bg-[#161d26] border border-[#232b36] rounded-lg space-y-2">
                    <div className="flex justify-between text-[9px] text-[#5b6673]">
                      <span>Chunk #1 (Page 1)</span>
                      <span>Vector ID: qd_uuid_883a12</span>
                    </div>
                    <p className="text-xs text-[#8a96a3] leading-relaxed">
                      ACME CORPORATION COMPLIANCE AND INFORMATION SECURITY DIRECTIVE. This document specifies the access control matrix mechanisms, administrative checks, password rotations, and authorization structures active in the enterprise cluster database nodes.
                    </p>
                  </div>

                  <div className="p-3 bg-[#161d26] border border-[#232b36] rounded-lg space-y-2">
                    <div className="flex justify-between text-[9px] text-[#5b6673]">
                      <span>Chunk #2 (Page 2)</span>
                      <span>Vector ID: qd_uuid_99bba5</span>
                    </div>
                    <p className="text-xs text-[#8a96a3] leading-relaxed">
                      Logical credential structures. Password policy settings require a length parameter minimum of 16 characters including numerical and control characters. Expiration flags enforce a maximum lifetime index duration of 90 days.
                    </p>
                  </div>

                  <div className="p-3 bg-[#161d26] border border-[#232b36] rounded-lg space-y-2">
                    <div className="flex justify-between text-[9px] text-[#5b6673]">
                      <span>Chunk #3 (Page 3)</span>
                      <span>Vector ID: qd_uuid_ff2a03</span>
                    </div>
                    <p className="text-xs text-[#8a96a3] leading-relaxed">
                      Emergency credential override keys. Under disaster containment policies, manual overrides bypass logic rotation checks if authorized by the Compliance Officer. Audit logs record all bypass triggers immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============ AUDIT WORKSPACE (CHAT) ============ */}
          {currentView === 'chat' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-160px)]">
              {/* Agent Settings Pane */}
              <div className="bg-[#11161d] border border-[#232b36] rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a96a3]">Audit Scope Parameters</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-[#5b6673] font-bold block mb-1">Target Compliance Standard</label>
                    <select
                      value={selectedStandard}
                      onChange={(e) => setSelectedStandard(e.target.value)}
                      className="w-full bg-[#161d26] border border-[#232b36] text-xs p-2 rounded-lg focus:outline-none"
                    >
                      <option value="soc2">SOC 2 Criteria (Security)</option>
                      <option value="iso27001">ISO/IEC 27001 ISMS</option>
                      <option value="hipaa">HIPAA Security Policy</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#5b6673] font-bold block mb-1">Connected Vault Namespaces</label>
                    <div className="space-y-1.5 p-2 bg-[#161d26] rounded-lg border border-[#232b36] text-[10px]">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="accent-[#4f8cff]" />
                        <span className="text-[#8a96a3]">Policies & Directives</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="accent-[#4f8cff]" />
                        <span className="text-[#8a96a3]">Infrastructure Configs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="accent-[#4f8cff]" />
                        <span className="text-[#8a96a3]">Audit Evidence Logs</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#161d26]/40 rounded-lg border border-[#232b36]/60 text-[10px] space-y-1 text-[#8a96a3]">
                  <div className="font-semibold text-[#bcd3ff] flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>LangGraph Agent Core</span>
                  </div>
                  <p>Performs hierarchical self-correction: analyzes search metrics, reasons locally, executes code checks, validates output structure.</p>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="lg:col-span-3 bg-[#11161d] border border-[#232b36] rounded-xl flex flex-col min-h-0">
                {/* Agent status bar */}
                <div className="flex bg-[#161d26] border-b border-[#232b36] text-[10px] font-bold text-[#8a96a3]">
                  {(['Planning', 'Retrieving', 'Reasoning', 'Validating', 'Answering'] as const).map(phase => (
                    <div
                      key={phase}
                      className={`flex-1 text-center py-2 border-b-2 transition-all ${
                        agentPhase === phase
                          ? 'border-[#4f8cff] text-[#e6ebf1] bg-[#1c2a44]/30'
                          : isAgentThinking && phasesAfter(agentPhase, phase)
                          ? 'border-[#3fbf7f] text-[#3fbf7f]'
                          : 'border-transparent text-[#5b6673]'
                      }`}
                    >
                      {phase}
                    </div>
                  ))}
                </div>

                {/* Messages scroll box */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] rounded-xl p-3 border text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'ml-auto bg-[#1c2a44] border-[#2a3f66] text-[#bcd3ff]'
                          : 'mr-auto bg-[#161d26] border-[#232b36] text-[#e6ebf1]'
                      }`}
                    >
                      <span className="font-bold text-[9px] uppercase tracking-wider mb-1 text-[#5b6673]">
                        {msg.sender === 'user' ? 'User' : 'Compliance Agent'}
                      </span>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      
                      {msg.citations && (
                        <div className="mt-3 pt-2 border-t border-[#232b36] space-y-2">
                          <div className="text-[9px] font-bold uppercase text-[#5b6673]">Source Citations:</div>
                          {msg.citations.map((cite, i) => (
                            <div key={i} className="text-[10px] text-[#8a96a3] bg-[#0b0f14] p-2 rounded border border-[#232b36]/60">
                              <span className="font-semibold text-[#4f8cff]">{cite.docName} (Page {cite.page})</span>
                              <p className="italic mt-1 text-[9px] text-[#5b6673]">{cite.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {isAgentThinking && (
                    <div className="mr-auto bg-[#161d26] border border-[#232b36] rounded-xl p-3 text-xs text-[#8a96a3] animate-pulse flex items-center gap-2">
                      <RefreshCw size={12} className="animate-spin text-[#4f8cff]" />
                      <span>Agent working in background ({agentPhase} state)...</span>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSendChat} className="p-4 border-t border-[#232b36] bg-[#161d26]/40 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isAgentThinking}
                    placeholder="Ask a compliance question (e.g., 'Are AWS user access limits audited?')"
                    className="flex-1 bg-[#0b0f14] border border-[#232b36] rounded-lg px-3 py-2 text-xs text-[#e6ebf1] focus:outline-none focus:border-[#4f8cff] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isAgentThinking || !chatInput.trim()}
                    className="bg-[#4f8cff] hover:bg-[#3d7bef] disabled:bg-[#1c2a44] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ============ AUDIT REPORT / FINDINGS VIEW ============ */}
          {currentView === 'report' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold">Audit Report Findings List</h3>
                  <p className="text-[10px] text-[#5b6673]">Persistent citable violations identified across active standards</p>
                </div>
                <button className="flex items-center gap-1.5 bg-[#161d26] hover:bg-[#232b36] text-[#e6ebf1] border border-[#232b36] px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                  <Download size={13} />
                  <span>Export Report (PDF)</span>
                </button>
              </div>

              <div className="space-y-4">
                {findings.map(finding => (
                  <div key={finding.id} className="finding">
                    <div className="finding-head">
                      <div className="flex items-center gap-2">
                        <span className="finding-ref">{finding.ref}</span>
                        <span className="text-[#5b6673]">•</span>
                        <span className="text-xs font-bold text-[#e6ebf1]">{finding.title}</span>
                      </div>
                      <span className={`pill ${
                        finding.verdict === 'compliant' ? 'pill-green' :
                        finding.verdict === 'needs-review' ? 'pill-amber' : 'pill-red'
                      }`}>
                        <span className="dot" />
                        {finding.verdict.toUpperCase().replace('-', ' ')}
                      </span>
                    </div>

                    <div className="finding-body text-xs space-y-2">
                      <p className="text-[#8a96a3]">
                        An audit check run by the local LangGraph agent evaluated evidence documents in organization tenant namespaces.
                      </p>
                      
                      <div className="finding-excerpt">
                        <span className="font-semibold text-[#4f8cff] block mb-1">Citation Excerpt ({finding.doc}, Page {finding.page}):</span>
                        {finding.excerpt}
                      </div>

                      <div className="bg-[#161d26] border border-[#232b36] p-2.5 rounded-lg text-[11px] text-[#8a96a3]">
                        <span className="font-bold text-[#e6ebf1] block mb-1">Auditor Notes & Status Logs:</span>
                        {finding.notes}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============ STANDARDS LIBRARY VIEW ============ */}
          {currentView === 'standards' && (
            <div className="space-y-6">
              {/* Add Custom Standard */}
              <div className="bg-[#11161d] border border-[#232b36] p-4 rounded-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a96a3] mb-3">Upload Custom Compliance Standard</h3>
                <form onSubmit={handleAddStandard} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#5b6673] font-semibold block">Framework Name</label>
                    <input
                      type="text"
                      placeholder="e.g. NIST SP 800-53"
                      value={newStdName}
                      onChange={(e) => setNewStdName(e.target.value)}
                      className="w-full bg-[#0b0f14] border border-[#232b36] p-2 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#5b6673] font-semibold block">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Federal Security Controls Framework"
                      value={newStdDesc}
                      onChange={(e) => setNewStdDesc(e.target.value)}
                      className="w-full bg-[#0b0f14] border border-[#232b36] p-2 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                  <button type="submit" className="bg-[#4f8cff] hover:bg-[#3d7bef] text-white py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1">
                    <Plus size={13} />
                    <span>Register Standard</span>
                  </button>
                </form>
              </div>

              {/* Standard Registry Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {standards.map(std => (
                  <div key={std.id} className="bg-[#11161d] border border-[#232b36] p-4 rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-xs font-bold text-[#e6ebf1]">{std.name}</h4>
                        <span className="bg-[#1c2a44] text-[#bcd3ff] text-[8px] font-bold px-1.5 py-0.5 rounded border border-[#2a3f66]">
                          {std.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8a96a3] line-clamp-3 leading-relaxed">{std.description}</p>
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] border-t border-[#232b36] pt-2">
                      <span className="text-[#5b6673] font-medium">{std.controlsCount} controls registered</span>
                      <button className="text-[#4f8cff] font-semibold hover:underline">View Controls</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============ INTEGRATIONS (MCP) VIEW ============ */}
          {currentView === 'integrations' && (
            <div className="space-y-6">
              <div className="p-4 bg-[#1c2a44]/30 border border-[#2a3f66]/60 rounded-xl">
                <h3 className="text-xs font-bold text-[#bcd3ff] mb-1">Model Context Protocol (MCP) Tool Servers</h3>
                <p className="text-[11px] text-[#8a96a3]">Enables context injection into LangGraph agent loops directly from your local developer infrastructure database or codebase. Destructive actions are rejected by default.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mcpServers.map(srv => (
                  <div key={srv.id} className="bg-[#11161d] border border-[#232b36] p-4 rounded-xl flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#e6ebf1]">{srv.name}</span>
                        <div
                          onClick={() => handleToggleMcp(srv.id)}
                          className={`toggle ${srv.status === 'connected' ? 'on' : ''}`}
                        >
                          <div className="toggle-knob" />
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8a96a3]">{srv.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[9px] uppercase tracking-wider text-[#5b6673] font-bold">Exposed Tools:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {srv.tools.map((t, idx) => (
                          <span key={idx} className="bg-[#161d26] text-[#8a96a3] text-[9px] px-2 py-0.5 rounded border border-[#232b36] font-mono">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============ ADMIN SETTINGS VIEW ============ */}
          {currentView === 'admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#11161d] border border-[#232b36] rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a96a3]">Organization & Tenant Setup</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#5b6673] font-bold block">Active Local LLM Model Provider</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full bg-[#161d26] border border-[#232b36] text-xs p-2 rounded-lg focus:outline-none"
                    >
                      <option value="llama3-8b-instruct">Llama-3 (8B Instruct) - Fast</option>
                      <option value="qwen-2.5-14b">Qwen 2.5 (14B Instruct) - Precise</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#5b6673] font-bold block">Data Retention Ingestion (Days)</label>
                    <input
                      type="number"
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(Number(e.target.value))}
                      className="w-full bg-[#161d26] border border-[#232b36] text-xs p-2 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-[#232b36] pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-[#e6ebf1]">Active Org Membership</h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2.5 bg-[#161d26] rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-[24px] h-[24px] rounded-full bg-[#2a3f66] flex items-center justify-center font-bold text-[10px] text-[#bcd3ff]">SM</div>
                        <span className="font-semibold text-[#e6ebf1]">Shambhuling Madankar</span>
                      </div>
                      <span className="text-[10px] text-[#5b6673]">Owner / Compliance Officer</span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-[#161d26] rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-[24px] h-[24px] rounded-full bg-[#22332c] flex items-center justify-center font-bold text-[10px] text-[#3fbf7f]">JD</div>
                        <span className="font-semibold text-[#e6ebf1]">Jane Doe</span>
                      </div>
                      <span className="text-[10px] text-[#5b6673]">Auditor (Read-Only)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#11161d] border border-[#232b36] rounded-xl p-4 space-y-3 text-xs text-[#8a96a3]">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#8a96a3] border-b border-[#232b36] pb-2">Air-Gap Enforcement</h3>
                <p>This deployment is configured in <b>air-gapped sandbox mode</b>. All embeddings are generated locally in-process via python <code>sentence-transformers</code> libraries.</p>
                <div className="p-3 bg-[#123324]/40 text-[#3fbf7f] rounded-lg border border-[#3fbf7f]/20 font-medium">
                  ComplianceIntel is isolated from external network interfaces. No data leaks to OpenAI or third-party vector vaults.
                </div>
              </div>
            </div>
          )}

          {/* ============ NOTIFICATIONS / SYSTEM LOG VIEW ============ */}
          {currentView === 'notifications' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold">Celery Task Queue Monitoring</h3>
                  <p className="text-[10px] text-[#5b6673]">System background tasks log history and failures</p>
                </div>
                <button
                  onClick={() => setTasks(prev => prev.map(t => t.status === 'failed' ? { ...t, status: 'running', error: null, progress: 0 } : t))}
                  className="bg-[#161d26] hover:bg-[#232b36] text-[#e6ebf1] border border-[#232b36] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  <span>Retry All Failed Tasks</span>
                </button>
              </div>

              <div className="bg-[#11161d] border border-[#232b36] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#161d26]/40 text-[#5b6673] border-b border-[#232b36]">
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Task ID</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Task Description</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Queue Type</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Execution Progress</th>
                        <th className="p-3 text-[10px] uppercase font-bold tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232b36]/60">
                      {tasks.map(t => (
                        <tr key={t.id} className="hover:bg-[#161d26]/30 text-xs">
                          <td className="p-3 font-mono text-[#5b6673]">{t.id}</td>
                          <td className="p-3 font-semibold text-[#e6ebf1]">{t.name}</td>
                          <td className="p-3 text-[#8a96a3]">{t.type}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-[100px] bg-[#0b0f14] h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all ${
                                  t.status === 'failed' ? 'bg-[#e0575c]' : 'bg-[#4f8cff]'
                                }`} style={{ width: `${t.progress}%` }} />
                              </div>
                              <span className="text-[10px] text-[#8a96a3] font-bold">{t.progress}%</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              t.status === 'completed' ? 'bg-[#123324] text-[#3fbf7f]' :
                              t.status === 'failed' ? 'bg-[#3a1c1e] text-[#e0575c]' :
                              'bg-[#3a2f14] text-[#e0a940] animate-pulse'
                            }`}>
                              {t.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// Simple helper to check phase status
function phasesAfter(currentPhase: string, phase: string): boolean {
  const list = ['Planning', 'Retrieving', 'Reasoning', 'Validating', 'Answering'];
  const curIdx = list.indexOf(currentPhase);
  const targetIdx = list.indexOf(phase);
  return targetIdx < curIdx;
}

export default App;
