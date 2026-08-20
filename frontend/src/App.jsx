import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { 
  Send, 
  Database, 
  AlertTriangle, 
  FileText, 
  CheckCircle, 
  RefreshCw, 
  Play, 
  Gauge, 
  X, 
  ShieldCheck, 
  Globe, 
  Upload, 
  Copy, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  Sliders, 
  BookOpen, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'Hello! I am the AI Compliance & Risk Advisor (AICRA). Ask me any questions regarding the indexed regulations, uploaded guidelines, or scraped web pages in your active database.',
      citations: [],
      metrics: null,
      guardrails: { safe: true, reason: null }
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // RAG Diagnostics Settings
  const [selectedModel, setSelectedModel] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [reindexing, setReindexing] = useState(false);
  
  // Feedback states
  const [feedback, setFeedback] = useState({}); // { msgIdx: 'up' | 'down' }
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Ingestion Accordion footnotes expanded
  const [expandedFootnotes, setExpandedFootnotes] = useState({});

  const [systemStatus, setSystemStatus] = useState({
    vector_db_initialized: false,
    indexed_documents: [],
    doc_count: 0,
    api_key_configured: false,
    groq_api_key_configured: false,
    gemini_api_key_configured: false,
    active_llm_model: 'No Active Model',
    available_models: []
  });
  
  const [evalDashboard, setEvalDashboard] = useState({
    total_queries: 0,
    avg_faithfulness: 0.0,
    avg_relevance: 0.0,
    avg_precision: 0.0
  });

  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'dashboard'
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'app'
  const [landingTab, setLandingTab] = useState('overview'); // 'overview' | 'how-it-works' | 'features'
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    fetchEvalDashboard();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (currentView === 'landing') {
      gsap.fromTo('.landing-anim',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out', delay: 0.1 }
      );
    } else if (currentView === 'app') {
      gsap.fromTo('.app-container',
        { opacity: 0, scale: 0.98 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'power1.out' }
      );
    }
  }, [currentView]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setSystemStatus(data);
      // Auto select first model if none is set
      if (!selectedModel && data.available_models.length > 0) {
        setSelectedModel(data.available_models[0]);
      }
    } catch (e) {
      console.error("Failed to fetch system status:", e);
    }
  };

  const fetchEvalDashboard = async () => {
    try {
      const res = await fetch('/api/evaluation/dashboard');
      const data = await res.json();
      setEvalDashboard(data);
    } catch (e) {
      console.error("Failed to fetch evaluation metrics:", e);
    }
  };

  const exportLogsToFile = () => {
    if (!evalDashboard.logs || evalDashboard.logs.length === 0) return;
    let content = "=== AICRA COMPLIANCE AUDIT LOGS ===\n\n";
    evalDashboard.logs.forEach((log, index) => {
      content += `Audit Run #${index + 1} | Model: ${log.model_name || "Unknown Model"}\n`;
      content += `--------------------------------------\n`;
      content += `Query: ${log.query}\n\n`;
      content += `Answer:\n${log.answer}\n\n`;
      content += `Metrics:\n`;
      content += `- Faithfulness: ${log.metrics.faithfulness ? Math.round(log.metrics.faithfulness.score * 100) : 0}%\n`;
      content += `- Answer Relevance: ${log.metrics.answer_relevance ? Math.round(log.metrics.answer_relevance.score * 100) : 0}%\n`;
      content += `- Context Precision: ${log.metrics.context_precision ? Math.round(log.metrics.context_precision.score * 100) : 0}%\n`;
      content += `- Audit Reasoning: ${log.metrics.faithfulness?.reasoning || "None"}\n`;
      content += `======================================\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aicra_compliance_audit_logs.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Simulated Ingestion Progress Bar
  const runSimulatedProgress = (setLoadState) => {
    setLoadState(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 400);
    return interval;
  };

  const handleInitialize = async () => {
    const progressInterval = runSimulatedProgress(setReindexing);
    try {
      const res = await fetch('/api/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk_size: chunkSize, chunk_overlap: chunkOverlap })
      });
      const data = await res.json();
      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
      
      if (res.ok) {
        await fetchStatus();
        alert("Base compliance corpus built successfully!");
      } else {
        alert("Error: " + data.detail);
      }
    } catch (e) {
      clearInterval(progressInterval);
      alert("Failed: " + e.message);
    } finally {
      setReindexing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const progressInterval = runSimulatedProgress(setUploading);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    formData.append("chunk_size", chunkSize);
    formData.append("chunk_overlap", chunkOverlap);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);

      if (res.ok) {
        await fetchStatus();
        alert("Files uploaded and vectorized successfully!");
      } else {
        alert("Upload error: " + data.detail);
      }
    } catch (err) {
      clearInterval(progressInterval);
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleScrapeUrl = async (e) => {
    e.preventDefault();
    if (!scrapingUrl.trim()) return;

    const progressInterval = runSimulatedProgress(setScraping);
    const targetUrl = scrapingUrl;
    setScrapingUrl('');

    try {
      const res = await fetch('/api/documents/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap
        })
      });
      const data = await res.json();
      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);

      if (res.ok) {
        await fetchStatus();
        alert(`URL scraped and indexed as ${data.filename}!`);
      } else {
        alert("Scraping error: " + data.detail);
      }
    } catch (err) {
      clearInterval(progressInterval);
      alert("Scraping failed: " + err.message);
    } finally {
      setScraping(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userText = inputMessage;
    setInputMessage('');
    
    // Add user message to history
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    // Initial placeholder AI response for streaming
    let aiMessage = {
      role: 'ai',
      text: '',
      citations: [],
      metrics: null,
      guardrails: { safe: true, reason: null }
    };
    
    setMessages(prev => [...prev, aiMessage]);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          model_name: selectedModel,
          temperature: parseFloat(temperature)
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to query server.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep partial line in buffer

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith('data: ')) continue;
          
          const jsonStr = cleanLine.substring(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'guardrail' && !data.safe) {
              aiMessage.guardrails = { safe: false, reason: data.reason };
              setMessages(prev => [...prev.slice(0, -1), { ...aiMessage }]);
            } else if (data.type === 'citations') {
              aiMessage.citations = data.citations;
              aiMessage.raw_context = data.raw_context;
              setMessages(prev => [...prev.slice(0, -1), { ...aiMessage }]);
            } else if (data.type === 'token') {
              aiMessage.text += data.text;
              setMessages(prev => [...prev.slice(0, -1), { ...aiMessage }]);
            }
          } catch (e) {
            console.error("SSE JSON parsing error:", e);
          }
        }
      }
      
      // SSE finished, run quality scores evaluation in background
      if (aiMessage.text && aiMessage.raw_context) {
        try {
          const evalRes = await fetch('/api/chat/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userText,
              context: aiMessage.raw_context,
              answer: aiMessage.text,
              model_name: selectedModel
            })
          });
          if (evalRes.ok) {
            const evalData = await evalRes.json();
            if (evalData.safe_state_override) {
              aiMessage.text = evalData.safe_state_override;
            }
            aiMessage.metrics = evalData;
            setMessages(prev => [...prev.slice(0, -1), { ...aiMessage }]);
            await fetchEvalDashboard();
          }
        } catch (evalErr) {
          console.error("Failed to run evaluation:", evalErr);
        }
      }

    } catch (err) {
      aiMessage.text = `Advisor connection error: ${err.message}`;
      setMessages(prev => [...prev.slice(0, -1), { ...aiMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarking(true);
    setBenchmarkResults(null);
    try {
      const res = await fetch('/api/evaluation/run-benchmark', { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Benchmark run failed.");
      }
      const data = await res.json();
      setBenchmarkResults(data);
    } catch (e) {
      alert("Failed to run benchmark suite: " + e.message);
    } finally {
      setBenchmarking(false);
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleFootnote = (msgIdx, citId) => {
    const key = `${msgIdx}_${citId}`;
    setExpandedFootnotes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getMetricColor = (score) => {
    if (score >= 0.8) return '#10b981'; // Green
    if (score >= 0.5) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };
  const renderMessageText = (text, citations, msgIdx) => {
    if (!text) return '';
    
    // Parse thinking blocks if present
    let thinkContent = '';
    let mainContent = text;
    
    // Pattern 1: Native <think> blocks (used by native reasoning models like Qwen)
    const thinkMatch = text.match(/<think>([\s\S]*?)(<\/think>|$)/);
    if (thinkMatch) {
      thinkContent = thinkMatch[1].trim();
      mainContent = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
    } 
    // Pattern 2: Markdown headers: ### Reasoning Process: ... ### Final Answer: (used by standard models)
    else if (text.includes('### Reasoning Process:')) {
      const parts = text.split('### Final Answer:');
      const reasoningPart = parts[0].replace('### Reasoning Process:', '').trim();
      const answerPart = parts[1] ? parts[1].trim() : '';
      
      thinkContent = reasoningPart;
      mainContent = answerPart;
    }
    
    if (!mainContent && !thinkContent) return '';
    
    const renderThinkBlock = () => {
      if (!thinkContent) return null;
      return (
        <details style={{ 
          marginBottom: '0.75rem', 
          fontSize: '0.8rem', 
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.5rem 0.75rem',
          background: '#f8fafc'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500, userSelect: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>💡 View LLM Thinking Process</span>
          </summary>
          <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', fontStyle: 'italic', lineHeight: 1.4 }}>
            {thinkContent}
          </div>
        </details>
      );
    };

    // Split final answer into blocks/paragraphs for block-fade animations
    const paragraphs = mainContent.split(/\n+/).filter(Boolean);
    
    const renderParagraph = (pText, pIdx) => {
      if (!citations || citations.length === 0) {
        return (
          <p key={pIdx} className="message-paragraph-block" style={{ margin: '0.5rem 0' }}>
            {pText}
          </p>
        );
      }
      
      const parts = pText.split(/(\[\d+\])/g);
      const formattedParts = parts.map((part, idx) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const citationId = parseInt(match[1]);
          const citation = citations.find(c => c.id === citationId);
          if (citation) {
            return (
              <span 
                key={idx} 
                className="citation-mark source-verified-badge"
                onClick={() => toggleFootnote(msgIdx, citationId)}
                title={`${citation.source} - Pg ${citation.page}`}
              >
                {citationId}
              </span>
            );
          }
        }
        return part;
      });

      return (
        <p key={pIdx} className="message-paragraph-block" style={{ margin: '0.5rem 0' }}>
          {formattedParts}
        </p>
      );
    };

    return (
      <>
        {renderThinkBlock()}
        {paragraphs.length > 0 ? (
          paragraphs.map((p, pIdx) => renderParagraph(p, pIdx))
        ) : (
          loading && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Generating response...</span>
        )}
      </>
    );
  };

  // Get active stats of last AI message
  const lastAiMessage = [...messages].reverse().find(m => m.role === 'ai');

  if (currentView === 'landing') {
    return (
      <div className="landing-page" style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 2rem',
        color: 'var(--text-main)',
        overflowX: 'hidden'
      }}>
        {/* Landing Navigation Header */}
        <header className="landing-anim" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          padding: '1.25rem 0',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div 
            onClick={() => setLandingTab('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          >
            <img 
              src="/logo_aicra.jpg" 
              alt="AICRA.ai Logo" 
              style={{ height: '40px', width: '40px' }} 
            />
            <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>AICRA.ai</span>
          </div>

          {/* Navigation Sub-Tabs */}
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <button 
              onClick={() => setLandingTab('overview')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: landingTab === 'overview' ? '600' : '500',
                color: landingTab === 'overview' ? 'var(--primary-accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderBottom: landingTab === 'overview' ? '2px solid var(--primary-accent)' : '2px solid transparent',
                transition: 'var(--transition-smooth)'
              }}
            >
              Overview
            </button>
            <button 
              onClick={() => setLandingTab('how-it-works')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: landingTab === 'how-it-works' ? '600' : '500',
                color: landingTab === 'how-it-works' ? 'var(--primary-accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderBottom: landingTab === 'how-it-works' ? '2px solid var(--primary-accent)' : '2px solid transparent',
                transition: 'var(--transition-smooth)'
              }}
            >
              How It Works
            </button>
            <button 
              onClick={() => setLandingTab('features')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: landingTab === 'features' ? '600' : '500',
                color: landingTab === 'features' ? 'var(--primary-accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderBottom: landingTab === 'features' ? '2px solid var(--primary-accent)' : '2px solid transparent',
                transition: 'var(--transition-smooth)'
              }}
            >
              Key Features
            </button>
          </nav>

          <button 
            onClick={() => setCurrentView('app')}
            className="btn-primary"
            style={{ 
              fontSize: '0.75rem', 
              padding: '0.4rem 0.9rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem',
              borderRadius: 'var(--radius-sm)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              width: 'auto',
              height: 'auto'
            }}
          >
            <span>Launch Advisor Portal</span>
            <ShieldCheck size={12} />
          </button>
        </header>

        {/* Tab 1: Overview (Home) */}
        {landingTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '1200px' }}>
            {/* Hero Section */}
            {/* Hero Section with Split 2-Column layout and Moving Digital Avatar */}
            <main style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '1000px',
              margin: '4rem 0 3rem 0',
              gap: '3rem',
              flexWrap: 'wrap'
            }}>
              {/* Left Column: Text & CTA */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                flex: '1',
                minWidth: '320px',
                gap: '1.25rem'
              }}>
                <div className="landing-anim badge" style={{ background: 'var(--success-bg)', color: 'var(--success-color)', fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: '600' }}>
                  <span className="pulse-source" style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success-color)' }}></span>
                  <span>Active Guardrails: Semantic Firewall, PII Scanner, Audit Telemetry</span>
                </div>
                
                <h1 className="landing-anim" style={{
                  fontSize: '2.75rem',
                  fontWeight: '900',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.15,
                  color: 'var(--text-primary)',
                  margin: 0
                }}>
                  Navigate AI Compliance & <br />
                  <span style={{ background: 'linear-gradient(135deg, var(--primary-accent) 0%, #6d28d9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Risk with Absolute Certainty</span>
                </h1>
                
                <p className="landing-anim" style={{
                  fontSize: '1.05rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: 0,
                  maxWidth: '580px'
                }}>
                  Your local AI compliance assistant. Upload policy guidelines or scrape online frameworks to get instant, cited answers to your regulation queries—verified in real-time by automated safety checks and quality audits.
                </p>

                <div className="landing-anim" style={{ marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => setCurrentView('app')}
                    style={{
                      fontSize: '0.9rem',
                      background: 'linear-gradient(135deg, var(--primary-accent) 0%, #6d28d9 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.75rem 1.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    <span>Launch Advisor Portal</span>
                    <ShieldCheck size={16} />
                  </button>
                </div>
              </div>
              {/* Right Column: Immersed digital AI Advisor Avatar (No Boundary) */}
              <div className="landing-anim" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                margin: '0 auto',
                position: 'relative'
              }}>
                <div className="avatar-wrapper" style={{
                  position: 'relative',
                  width: '320px',
                  height: '380px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'floatAvatar 6s infinite ease-in-out'
                }}>
                  {/* Ambient pulsing glow rings in the background */}
                  <div style={{
                    position: 'absolute',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
                    animation: 'pulseRing 4s infinite ease-in-out',
                    zIndex: 1
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    width: '240px',
                    height: '240px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
                    animation: 'pulseRing 3s infinite ease-in-out',
                    animationDelay: '1.5s',
                    zIndex: 1
                  }}></div>
                  
                  {/* Immersed GIF image (No borders, no cropping) */}
                   <img 
                    src="/avatar_aicra.gif" 
                    alt="AI Compliance Advisor Avatar" 
                    style={{ 
                      height: '360px', 
                      width: 'auto',
                      objectFit: 'contain',
                      zIndex: 2,
                      mixBlendMode: 'multiply',
                      filter: 'drop-shadow(0 15px 25px rgba(99, 102, 241, 0.15))'
                    }} 
                  />

                  {/* Floating Online Badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '10px',
                    background: '#ffffff',
                    border: '1px solid var(--border-light)',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    zIndex: 3
                  }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success-color)', animation: 'pulseSource 1.5s infinite' }}></span>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-primary)' }}>Advisor Online</span>
                  </div>
                </div>
              </div>
            </main>

            {/* Regulatory Scope & Ingestion Policies cards */}
            <section className="landing-anim" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.25rem',
              width: '100%',
              maxWidth: '960px',
              margin: '1rem 0 5rem 0'
            }}>
              <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#ffffff', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Globe size={18} style={{ color: 'var(--primary-accent)' }} />
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Regulatory Laws & Frameworks</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Upload official guidelines like the EU AI Act, NIST AI Risk Management Framework, or OECD AI principles to run compliance audits.
                </p>
              </div>

              <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#ffffff', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <FileText size={18} style={{ color: '#0284c7' }} />
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Internal Company Guidelines</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Index your company's private code of conduct, database guidelines, or proprietary security manuals to find gaps.
                </p>
              </div>

              <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#ffffff', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Sliders size={18} style={{ color: '#7c3aed' }} />
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Custom Corporate Standards</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Load custom templates and verify compliance reasoning weights under your corporate regulatory safety firewall.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: How It Works */}
        {landingTab === 'how-it-works' && (
          <div style={{ width: '100%', maxWidth: '900px', margin: '4rem 0 5rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Compliance RAG Ingestion & Audit Flow</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>A secure, five-step loop processing regulatory checks on-device.</p>
            </div>

            {/* Visual Animated RAG Pipeline & Real-Time Terminal Audit */}
            <div className="landing-anim card" style={{
              width: '100%',
              padding: '2rem',
              background: '#ffffff',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              boxShadow: 'var(--shadow-soft)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.015em' }}>
                  Real-Time Guardrail Inspection Pipeline
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trace how a user prompt is processed and validated under zero-trust guidelines.</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.25rem',
                marginTop: '0.5rem',
                width: '100%',
                background: '#f8fafc',
                padding: '1.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)'
              }}>
                {/* Node 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '120px', textAlign: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-accent)', border: '1px solid #c7d2fe', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.1)' }}>
                    <Upload size={18} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>1. Ingest & Redact</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--success-color)', background: 'var(--success-bg)', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: '700' }}>PII SCRUBBED</span>
                </div>

                <div className="flow-line"></div>

                {/* Node 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '120px', textAlign: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1', border: '1px solid #bae6fd', boxShadow: '0 4px 6px -1px rgba(3, 105, 161, 0.1)' }}>
                    <Database size={18} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>2. Vector Map</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--primary-accent)', background: '#f5f3ff', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: '700' }}>CHROMA DB</span>
                </div>

                <div className="flow-line"></div>

                {/* Node 3 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '120px', textAlign: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger-color)', border: '1px solid #fecaca', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>3. Firewall Check</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--success-color)', background: 'var(--success-bg)', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: '700' }}>PASSED</span>
                </div>

                <div className="flow-line"></div>

                {/* Node 4 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '120px', textAlign: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', border: '1px solid #ddd6fe', boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.1)' }}>
                    <RefreshCw size={18} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>4. Self-Correction</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--success-color)', background: 'var(--success-bg)', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: '700' }}>0 ERRORS</span>
                </div>

                <div className="flow-line"></div>

                {/* Node 5 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '120px', textAlign: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success-color)', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.1)' }}>
                    <Gauge size={18} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>5. Audit Telemetry</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--success-color)', background: 'var(--success-bg)', padding: '0.1rem 0.35rem', borderRadius: '10px', fontWeight: '700' }}>LOGGED</span>
                </div>
              </div>

              {/* Simulation Trace Logs terminal */}
              <div style={{
                width: '100%',
                background: '#0f172a',
                borderRadius: '6px',
                padding: '1rem',
                fontFamily: "'Roboto Mono', 'Courier New', monospace",
                fontSize: '0.75rem',
                color: '#94a3b8',
                border: '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                textAlign: 'left',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#38bdf8', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)', display: 'inline-block' }}></span>
                    compliance_evaluator_daemon.log
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>SECURED CONNECTION</span>
                </div>
                <div><span style={{ color: '#64748b' }}>[11:21:01.105]</span> <span style={{ color: '#38bdf8' }}>STEP 1 [INGESTION]</span> Scraped regulatory URLs and redacted confidential PII.</div>
                <div><span style={{ color: '#64748b' }}>[11:21:02.342]</span> <span style={{ color: '#38bdf8' }}>STEP 2 [EMBEDDING]</span> Chunked document text & mapped to local SQLite Chroma DB.</div>
                <div><span style={{ color: '#64748b' }}>[11:21:03.018]</span> <span style={{ color: '#f43f5e' }}>STEP 3 [FIREWALL]</span> Adversarial similarity: 0.12 &lt; 0.82 safety threshold.</div>
                <div><span style={{ color: '#64748b' }}>[11:21:03.955]</span> <span style={{ color: '#a855f7' }}>STEP 4 [EVALUATOR]</span> Faithfulness: 96% | Self-Correction: 0 adjustments required.</div>
                <div><span style={{ color: '#64748b' }}>[11:21:04.108]</span> <span style={{ color: 'var(--success-color)' }}>STEP 5 [TELEMETRY]</span> Logged query metrics to local LLM-as-a-Judge Audit database.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Key Features */}
        {landingTab === 'features' && (
          <div style={{ width: '100%', maxWidth: '1000px', margin: '4rem 0 5rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Architectural Safety Features</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enterprise security components built into AICRA's core RAG routing.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              
              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--primary-accent)', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Semantic Similarity Firewall</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Uses local embeddings to filter incoming attacks, jailbreaks, and out-of-scope compliance questions instantly before hitting generative LLMs.
                </p>
              </div>

              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: '#0284c7', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Local PII Redactor</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Scrubs personal emails, phone numbers, and keys locally. Ensures that raw document uploads are sanitized before indexing or cloud processing.
                </p>
              </div>

              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={18} style={{ color: '#7c3aed', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Self-Correction Loops</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Catches ungrounded LLM outputs and initiates a background recovery loop, prompting the model to re-evaluate its logic based strictly on citations.
                </p>
              </div>

              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Safe State Fallback</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Suppresses responses that do not meet quality scores (faithfulness &lt; 50%) and presents a hardcoded compliance disclaimer message.
                </p>
              </div>

              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Gauge size={18} style={{ color: '#059669', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>LLM-as-a-Judge Dashboard</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  A visual performance tab calculating RAG metrics in real-time, detailing reasoning, and offering structured audit log text exports.
                </p>
              </div>

              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={18} style={{ color: '#db2777', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Multi-Model Sandbox</strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  Toggles between native reasoning models (Qwen) and standard models (GPT-OSS, Allam), dynamically tailoring reasoning prompts to prevent parser errors.
                </p>
              </div>

            </div>
          </div>
        )}
        
        {/* Landing Footer */}
        <footer style={{
          marginTop: 'auto',
          padding: '2rem 0',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          © {new Date().getFullYear()} AICRA.ai. Secured, Local Regulatory RAG Intelligence.
        </footer>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {/* 1. Ingestion sidebar panel (Left) */}
      <aside className="sidebar">
        <div className="brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setCurrentView('landing')}>
          <img src="/logo_aicra.jpg" alt="AICRA logo" style={{ height: '40px', width: '40px' }} />
          <h1 className="brand-title">AICRA.ai</h1>
        </div>
        <button 
          onClick={() => setCurrentView('landing')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            padding: '0.25rem 0.5rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginBottom: '0.75rem',
            fontWeight: '500'
          }}
        >
          <span>← Back to Home</span>
        </button>

        {/* Diagnostic Status */}
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          <h2 className="section-title">Status Summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="status-pill">
              <span className={`status-dot ${systemStatus.vector_db_initialized ? 'active' : 'inactive'}`}></span>
              <span style={{ fontSize: '0.75rem' }}>
                {systemStatus.vector_db_initialized ? `Database Active (${systemStatus.doc_count} Docs)` : "Database Empty"}
              </span>
            </div>
            <div className="status-pill">
              <span className={`status-dot ${systemStatus.api_key_configured ? 'active' : 'inactive'}`}></span>
              <span style={{ fontSize: '0.75rem' }}>
                {systemStatus.api_key_configured 
                  ? `Active LLM: ${selectedModel || systemStatus.active_llm_model}` 
                  : "API Keys Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Ingestion Dashboard (File upload + Url scraping) */}
        <div className="card">
          <h2 className="section-title">Ingestion Dashboard</h2>
          
          {/* Drag and Drop Zone */}
          <div 
            className={`drag-drop-zone ${(uploading || reindexing) ? 'active' : ''}`}
            onClick={() => fileInputRef.current.click()}
          >
            <Upload size={24} style={{ color: 'var(--primary-accent)' }} />
            <span>Drag & drop compliance PDFs/TXTs or <strong>browse files</strong></span>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              disabled={uploading || reindexing}
            />
          </div>

          <div style={{ margin: '0.75rem 0', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            — OR SCRAPE WEB —
          </div>

          {/* URL Scraper Input */}
          <form onSubmit={handleScrapeUrl} style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
            <input 
              type="url"
              className="form-input"
              placeholder="Paste policy URL (https://...)"
              value={scrapingUrl}
              onChange={(e) => setScrapingUrl(e.target.value)}
              disabled={scraping || reindexing}
            />
            <button 
              type="submit" 
              className="btn-secondary" 
              style={{ padding: '0.625rem' }} 
              title="Scrape Page"
              disabled={scraping || !scrapingUrl.trim() || reindexing}
            >
              <Globe size={14} />
            </button>
          </form>

          {/* Ingestion Progress bar */}
          {(uploading || scraping || reindexing) && (
            <div className="progress-container">
              <div className="progress-header">
                <span>
                  {uploading ? "Ingesting Uploads..." : scraping ? "Scraping Webpage..." : "Rebuilding Index..."}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Reference Corpus File list */}
        <div className="card" style={{ flex: 1, minHeight: '130px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="section-title">Reference Corpus ({systemStatus.doc_count})</h2>
          <div className="doc-list">
            {systemStatus.indexed_documents.length > 0 ? (
              systemStatus.indexed_documents.map((doc, idx) => (
                <div key={idx} className="doc-item">
                  <FileText size={12} style={{ color: 'var(--primary-accent)' }} />
                  <span className="doc-name" title={doc}>{doc}</span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '1rem 0' }}>
                No active guidelines indexed.
              </div>
            )}
          </div>
        </div>
        
        {/* Core telemetry details */}
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>Telemetry: <strong>Langfuse (Vendor-Agnostic)</strong></span>
        </div>
      </aside>

      {/* 2. Main Chat Panel (Center) */}
      <main className="chat-section">
        <header className="chat-header">
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div 
              className={`chat-header-title ${activeTab === 'chat' ? 'active' : ''}`}
              style={{ cursor: 'pointer', borderBottom: activeTab === 'chat' ? '2px solid var(--primary-accent)' : '2px solid transparent', paddingBottom: '0.25rem' }}
              onClick={() => setActiveTab('chat')}
            >
              <ShieldCheck size={18} style={{ color: activeTab === 'chat' ? 'var(--primary-accent)' : 'var(--text-muted)' }} />
              <span style={{ color: activeTab === 'chat' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: activeTab === 'chat' ? '600' : '500' }}>AI Compliance Advisor</span>
            </div>
            <div 
              className={`chat-header-title ${activeTab === 'dashboard' ? 'active' : ''}`}
              style={{ cursor: 'pointer', borderBottom: activeTab === 'dashboard' ? '2px solid var(--primary-accent)' : '2px solid transparent', paddingBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={() => setActiveTab('dashboard')}
            >
              <FileText size={18} style={{ color: activeTab === 'dashboard' ? 'var(--primary-accent)' : 'var(--text-muted)' }} />
              <span style={{ color: activeTab === 'dashboard' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: activeTab === 'dashboard' ? '600' : '500' }}>LLM-as-a-Judge Dashboard</span>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Active Model: <strong>{selectedModel || systemStatus.active_llm_model}</strong></span>
          </div>
        </header>

        {activeTab === 'chat' ? (
          <>
            {/* Conversational message logs */}
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message-row ${msg.role}`}>
                  {msg.role === 'ai' && <div className="avatar ai">AI</div>}
                  
                  <div className="bubble-container">
                    <div className="bubble">
                      {msg.role === 'ai' 
                        ? (msg.text.trim() ? renderMessageText(msg.text, msg.citations, idx) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Thinking...</span>
                          ))
                        : msg.text
                      }
                    </div>

                    {/* Footnote citations accordion beneath AI bubble */}
                    {msg.role === 'ai' && msg.citations && msg.citations.length > 0 && (
                      <div className="footnotes-container">
                        {msg.citations.map((cit) => {
                          const isExpanded = !!expandedFootnotes[`${idx}_${cit.id}`];
                          return (
                            <div key={cit.id} className="footnote-card">
                              <div 
                                className="footnote-header"
                                onClick={() => toggleFootnote(idx, cit.id)}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <BookOpen size={10} style={{ color: 'var(--primary-accent)' }} />
                                  Source [{cit.id}]: {cit.source.replace('.pdf', '')} - Page {cit.page}
                                </span>
                                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                              </div>
                              {isExpanded && (
                                <div className="footnote-body">
                                  {cit.snippet}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Output Grounding Safety Alert */}
                    {msg.role === 'ai' && msg.metrics && msg.metrics.faithfulness && msg.metrics.faithfulness.score < 0.6 && (
                      <div className="guardrail-alert" style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#b45309', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                        <AlertTriangle size={12} style={{ color: '#d97706', flexShrink: 0 }} />
                        <span>
                          <strong>Grounding Warning:</strong> This answer could not be fully verified against the source documents. (Faithfulness: {Math.round(msg.metrics.faithfulness.score * 100)}%).
                        </span>
                      </div>
                    )}

                    {/* Safety Guardrail flag */}
                    {msg.role === 'ai' && msg.guardrails && !msg.guardrails.safe && (
                      <div className="guardrail-alert">
                        <AlertTriangle size={12} />
                        <span>{msg.guardrails.reason}</span>
                      </div>
                    )}

                    {/* Message action bar (copy / thumbs up-down) */}
                    {msg.role === 'ai' && msg.text && (
                      <div className="bubble-actions">
                        <button 
                          className="action-icon-btn" 
                          onClick={() => copyToClipboard(msg.text, idx)}
                          title="Copy response"
                        >
                          {copiedIndex === idx ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
                        </button>
                        <button 
                          className={`action-icon-btn ${feedback[idx] === 'up' ? 'active' : ''}`}
                          onClick={() => setFeedback(prev => ({ ...prev, [idx]: prev[idx] === 'up' ? null : 'up' }))}
                          title="Good response"
                        >
                          <ThumbsUp size={12} />
                        </button>
                        <button 
                          className={`action-icon-btn ${feedback[idx] === 'down' ? 'active' : ''}`}
                          onClick={() => setFeedback(prev => ({ ...prev, [idx]: prev[idx] === 'down' ? null : 'down' }))}
                          title="Poor response"
                        >
                          <ThumbsDown size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {msg.role === 'user' && <div className="avatar user">U</div>}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat submit area */}
            <div className="chat-input-container">
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  className="chat-input"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={systemStatus.vector_db_initialized 
                    ? "Ask compliance questions (e.g. 'What is high-risk under EU AI Act?')..."
                    : "Initialize the database using sidebar to begin..."
                  }
                  disabled={loading || !systemStatus.vector_db_initialized}
                />
                <button 
                  type="submit" 
                  className="chat-submit-btn"
                  disabled={loading || !inputMessage.trim() || !systemStatus.vector_db_initialized}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Render Judge Dashboard */
          <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', overflowY: 'auto' }}>
            
            {/* Aggregate Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', width: '100%' }}>
              
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', textAlign: 'center', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Avg Faithfulness</span>
                <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-accent)', marginTop: '0.25rem' }}>
                  {evalDashboard.avg_faithfulness ? Math.round(evalDashboard.avg_faithfulness * 100) : 0}%
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Grounded in Context</span>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', textAlign: 'center', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Avg Answer Relevance</span>
                <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-accent)', marginTop: '0.25rem' }}>
                  {evalDashboard.avg_relevance ? Math.round(evalDashboard.avg_relevance * 100) : 0}%
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Addresses Question</span>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', textAlign: 'center', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Avg Context Precision</span>
                <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-accent)', marginTop: '0.25rem' }}>
                  {evalDashboard.avg_precision ? Math.round(evalDashboard.avg_precision * 100) : 0}%
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Retriever Accuracy</span>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', textAlign: 'center', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Total Evaluated</span>
                <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-accent)', marginTop: '0.25rem' }}>
                  {evalDashboard.total_queries || 0}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Queries in Session</span>
              </div>

            </div>

            {/* Historical Logs List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="section-title" style={{ margin: 0, fontSize: '1rem' }}>Historical Audit Logs (Last 10 Runs)</h3>
                {evalDashboard.logs && evalDashboard.logs.length > 0 && (
                  <button 
                    onClick={exportLogsToFile}
                    style={{ 
                      fontSize: '0.75rem', 
                      background: '#f1f5f9', 
                      border: '1px solid var(--border-light)', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--text-main)',
                      fontWeight: '500'
                    }}
                  >
                    <span>📥 Export Logs (.txt)</span>
                  </button>
                )}
              </div>
              
              {evalDashboard.logs && evalDashboard.logs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {evalDashboard.logs.slice().reverse().map((log, idx) => (
                    <div key={idx} className="card" style={{ padding: '0.75rem 1rem', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', flexShrink: 0 }}>
                            Run #{evalDashboard.logs.length - idx} 
                            <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.25rem', fontSize: '0.65rem' }}>
                              [{log.model_name || "Unknown Model"}]
                            </span>
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.query}>
                            {log.query}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
                          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                            F: {log.metrics.faithfulness ? Math.round(log.metrics.faithfulness.score * 100) : 0}%
                          </span>
                          <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                            R: {log.metrics.answer_relevance ? Math.round(log.metrics.answer_relevance.score * 100) : 0}%
                          </span>
                          <span className="badge" style={{ background: '#f5f3ff', color: '#6d28d9', fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                            P: {log.metrics.context_precision ? Math.round(log.metrics.context_precision.score * 100) : 0}%
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setSelectedAuditLog(log)}
                        style={{
                          fontSize: '0.7rem',
                          background: 'var(--primary-accent)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.35rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          flexShrink: 0
                        }}
                      >
                        🔍 View Audit Details
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No queries evaluated yet. Ask questions in the chat to populate the dashboard!
                </div>
              )}

            </div>

          </div>
        )}
      </main>

      {/* 3. Evaluation & Settings Dashboard (Right) */}
      <section className="eval-panel">
        
        {/* Quality scores for current message */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <Gauge size={16} style={{ color: 'var(--primary-accent)' }} />
            <h3 className="section-title" style={{ margin: 0 }}>Turn Quality Metrics</h3>
          </div>
          {lastAiMessage && lastAiMessage.metrics ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Faithfulness */}
              <div className="metric-row">
                <div className="metric-meta">
                  <span className="metric-name">Faithfulness</span>
                  <span className="metric-value" style={{ color: getMetricColor(lastAiMessage.metrics.faithfulness.score) }}>
                    {(lastAiMessage.metrics.faithfulness.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="metric-bar-bg">
                  <div 
                    className="metric-bar-fill" 
                    style={{ 
                      width: `${lastAiMessage.metrics.faithfulness.score * 100}%`,
                      backgroundColor: getMetricColor(lastAiMessage.metrics.faithfulness.score)
                    }}
                  ></div>
                </div>
                <p className="metric-desc">{lastAiMessage.metrics.faithfulness.reasoning}</p>
              </div>

              {/* Relevance */}
              <div className="metric-row">
                <div className="metric-meta">
                  <span className="metric-name">Answer Relevance</span>
                  <span className="metric-value" style={{ color: getMetricColor(lastAiMessage.metrics.answer_relevance.score) }}>
                    {(lastAiMessage.metrics.answer_relevance.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="metric-bar-bg">
                  <div 
                    className="metric-bar-fill" 
                    style={{ 
                      width: `${lastAiMessage.metrics.answer_relevance.score * 100}%`,
                      backgroundColor: getMetricColor(lastAiMessage.metrics.answer_relevance.score)
                    }}
                  ></div>
                </div>
                <p className="metric-desc">{lastAiMessage.metrics.answer_relevance.reasoning}</p>
              </div>

              {/* Precision */}
              <div className="metric-row">
                <div className="metric-meta">
                  <span className="metric-name">Context Precision</span>
                  <span className="metric-value" style={{ color: getMetricColor(lastAiMessage.metrics.context_precision.score) }}>
                    {(lastAiMessage.metrics.context_precision.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="metric-bar-bg">
                  <div 
                    className="metric-bar-fill" 
                    style={{ 
                      width: `${lastAiMessage.metrics.context_precision.score * 100}%`,
                      backgroundColor: getMetricColor(lastAiMessage.metrics.context_precision.score)
                    }}
                  ></div>
                </div>
                <p className="metric-desc">{lastAiMessage.metrics.context_precision.reasoning}</p>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.5rem 0' }}>
              <Info size={18} style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', opacity: 0.7 }} />
              <p>Scores will load automatically once chat streaming completes.</p>
            </div>
          )}
        </div>

        {/* Diagnostics / Settings Panel */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <Sliders size={16} style={{ color: 'var(--primary-accent)' }} />
            <h3 className="section-title" style={{ margin: 0 }}>System Diagnostics</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Model Select */}
            <div className="slider-container">
              <div className="slider-header">
                <strong>Target LLM Model</strong>
              </div>
              <select 
                className="form-input"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={loading}
              >
                {systemStatus.available_models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div className="slider-container">
              <div className="slider-header">
                <strong>Temperature</strong>
                <span>{temperature}</span>
              </div>
              <input 
                type="range"
                className="slider"
                min="0.0"
                max="1.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={loading}
              />
            </div>

            {/* Chunk Size */}
            <div className="slider-container">
              <div className="slider-header">
                <strong>Chunk Size</strong>
                <span>{chunkSize} tokens</span>
              </div>
              <input 
                type="range"
                className="slider"
                min="200"
                max="2000"
                step="100"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value))}
                disabled={loading || reindexing}
              />
            </div>

            {/* Chunk Overlap */}
            <div className="slider-container">
              <div className="slider-header">
                <strong>Overlap</strong>
                <span>{chunkOverlap} tokens</span>
              </div>
              <input 
                type="range"
                className="slider"
                min="0"
                max="500"
                step="50"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                disabled={loading || reindexing}
              />
            </div>

            <button 
              className="btn-secondary"
              onClick={handleInitialize}
              disabled={loading || reindexing || !systemStatus.api_key_configured}
              style={{ fontSize: '0.8rem', padding: '0.5rem', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
            >
              <RefreshCw size={12} className={reindexing ? "animate-spin" : ""} />
              Apply & Re-Index DB
            </button>

          </div>
        </div>

        {/* Offline Evaluation Tests */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 className="section-title">Offline Benchmark</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Verify database accuracy against standard preset compliance questions.
          </p>
          <button 
            className="btn-secondary"
            onClick={handleRunBenchmark}
            disabled={benchmarking || !systemStatus.vector_db_initialized}
            style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
          >
            {benchmarking ? (
              <>
                <RefreshCw className="animate-spin" size={12} />
                Benchmarking...
              </>
            ) : (
              <>
                <Play size={12} />
                Run QA Benchmark
              </>
            )}
          </button>

          {benchmarkResults && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '4px', border: '1px dashed var(--border-light)', background: '#f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Faithfulness:</span>
                  <strong style={{ color: getMetricColor(benchmarkResults.benchmark_summary.average_faithfulness) }}>
                    {(benchmarkResults.benchmark_summary.average_faithfulness * 100).toFixed(0)}%
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Relevance:</span>
                  <strong style={{ color: getMetricColor(benchmarkResults.benchmark_summary.average_relevance) }}>
                    {(benchmarkResults.benchmark_summary.average_relevance * 100).toFixed(0)}%
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Precision:</span>
                  <strong style={{ color: getMetricColor(benchmarkResults.benchmark_summary.average_precision) }}>
                    {(benchmarkResults.benchmark_summary.average_precision * 100).toFixed(0)}%
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

      </section>

      {/* 4. Audit Log Details Modal Overlay */}
      {selectedAuditLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Gauge size={16} style={{ color: 'var(--primary-accent)' }} />
                  Compliance Audit Details
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Evaluated Model: <strong>{selectedAuditLog.model_name || "Unknown Model"}</strong>
                </span>
              </div>
              <button 
                onClick={() => setSelectedAuditLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: '600'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              
              {/* Question */}
              <div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User Query</strong>
                <p style={{ fontSize: '0.85rem', margin: '0.25rem 0 0 0', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  {selectedAuditLog.query}
                </p>
              </div>

              {/* Structured Answer */}
              <div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grounded Answer</strong>
                <div style={{ fontSize: '0.85rem', margin: '0.25rem 0 0 0', background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {renderMessageText(selectedAuditLog.answer, null, 99999)}
                </div>
              </div>

              {/* Evaluation Metrics Breakdown */}
              <div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>LLM Judge Scores</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <div style={{ padding: '0.5rem', background: '#f0f9ff', borderRadius: '6px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                    <span style={{ fontSize: '0.65rem', color: '#0369a1', display: 'block', fontWeight: '600' }}>Faithfulness</span>
                    <strong style={{ fontSize: '1rem', color: '#0284c7' }}>
                      {selectedAuditLog.metrics.faithfulness ? Math.round(selectedAuditLog.metrics.faithfulness.score * 100) : 0}%
                    </strong>
                  </div>
                  <div style={{ padding: '0.5rem', background: '#ecfdf5', borderRadius: '6px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
                    <span style={{ fontSize: '0.65rem', color: '#047857', display: 'block', fontWeight: '600' }}>Relevance</span>
                    <strong style={{ fontSize: '1rem', color: '#059669' }}>
                      {selectedAuditLog.metrics.answer_relevance ? Math.round(selectedAuditLog.metrics.answer_relevance.score * 100) : 0}%
                    </strong>
                  </div>
                  <div style={{ padding: '0.5rem', background: '#f5f3ff', borderRadius: '6px', textAlign: 'center', border: '1px solid #ddd6fe' }}>
                    <span style={{ fontSize: '0.65rem', color: '#6d28d9', display: 'block', fontWeight: '600' }}>Precision</span>
                    <strong style={{ fontSize: '1rem', color: '#7c3aed' }}>
                      {selectedAuditLog.metrics.context_precision ? Math.round(selectedAuditLog.metrics.context_precision.score * 100) : 0}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Audit Explanation */}
              <div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Auditor Explanation</strong>
                <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0 0', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px dashed var(--border-light)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {selectedAuditLog.metrics.faithfulness?.reasoning || "No details available."}
                </p>
              </div>

            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setSelectedAuditLog(null)}
                style={{ padding: '0.4rem 1rem' }}
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
