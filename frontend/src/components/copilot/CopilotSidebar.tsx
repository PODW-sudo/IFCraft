import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Settings,
  Send,
  Loader2,
  Trash2,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Box,
  Layers,
  Move,
  Tag,
  Search
} from 'lucide-react';
import type { ChatMessage, AIProvider } from '../../types/ifc';
import { sendCopilotChat, fetchCopilotProviders } from '../../services/api';
import { CopilotSettingsModal, loadCopilotConfig, type CopilotConfig } from './CopilotSettingsModal';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';

interface CopilotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  selectedExpressId: number | null;
  onModelModified: () => void;
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: "Hello! I am your autonomous OpenBIM AI Copilot. I can parametrically generate buildings, transform elements in 3D, edit properties, and query spatial geometry. How can I help you today?",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
];

const QUICK_PROMPTS = [
  "Create a 2-storey building 12m by 8m",
  "Move selected element 2 meters along X",
  "Set IsExternal to True on selected wall",
  "How many walls are in this model?",
  "Summarize spatial hierarchy"
];

export const CopilotSidebar: React.FC<CopilotSidebarProps> = ({
  isOpen,
  onClose,
  projectId,
  selectedExpressId,
  onModelModified
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(`ifc_copilot_chat_${projectId}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_MESSAGES;
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<CopilotConfig>(loadCopilotConfig());

  const { width, isDragging, startResizing, resetWidth } = useResizable({
    initialWidth: 384,
    minWidth: 300,
    maxWidth: 750,
    storageKey: 'ifc_editor_copilot_sidebar_width',
    direction: 'left'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load providers on mount
  useEffect(() => {
    fetchCopilotProviders()
      .then((data) => {
        setProviders(data);
        const savedCfg = loadCopilotConfig();
        if (savedCfg.preferredProvider) {
          setSelectedProviderId(savedCfg.preferredProvider);
        }
        if (savedCfg.preferredModel) {
          setSelectedModel(savedCfg.preferredModel);
        }
      })
      .catch((err) => console.warn('Could not load AI providers:', err));
  }, []);

  // Update selected model when provider changes
  useEffect(() => {
    const prov = providers.find((p) => p.id === selectedProviderId);
    if (prov && !prov.models.includes(selectedModel)) {
      setSelectedModel(prov.default_model);
    }
  }, [selectedProviderId, providers, selectedModel]);

  // Persist messages per project
  useEffect(() => {
    if (projectId) {
      try {
        localStorage.setItem(`ifc_copilot_chat_${projectId}`, JSON.stringify(messages));
      } catch (e) {
        console.error(e);
      }
    }
  }, [messages, projectId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleConfigSaved = () => {
    const newCfg = loadCopilotConfig();
    setConfig(newCfg);
  };

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Determine API key / base url
    let apiKey = '';
    if (selectedProviderId === 'gemini') apiKey = config.geminiKey;
    else if (selectedProviderId === 'claude') apiKey = config.claudeKey;
    else if (selectedProviderId === 'openai') apiKey = config.openaiKey;

    try {
      const response = await sendCopilotChat({
        project_id: projectId,
        messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        provider: selectedProviderId,
        model: selectedModel,
        api_key: apiKey || undefined,
        base_url: selectedProviderId === 'ollama' ? config.ollamaBaseUrl : undefined,
        selected_express_id: selectedExpressId
      });

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.message.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: response.tool_calls
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (response.project_updated) {
        onModelModified();
      }
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error communicating with AI Copilot: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages(DEFAULT_MESSAGES);
    try {
      localStorage.removeItem(`ifc_copilot_chat_${projectId}`);
    } catch (e) {
      console.error(e);
    }
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'generate_building':
        return <Layers className="w-3.5 h-3.5 text-indigo-400" />;
      case 'transform_element':
        return <Move className="w-3.5 h-3.5 text-amber-400" />;
      case 'update_property':
        return <Tag className="w-3.5 h-3.5 text-emerald-400" />;
      case 'query_model':
        return <Search className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  if (!isOpen) return null;

  const currentProvider = providers.find((p) => p.id === selectedProviderId);

  return (
    <>
      <div
        style={{ width: `${width}px` }}
        className="fixed top-16 right-4 bottom-6 bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl flex flex-col z-30 shadow-[var(--shadow-hud)] overflow-hidden transition-all duration-200 animate-in fade-in-50 slide-in-from-right-4"
      >
        <ResizeHandle
          position="left"
          onMouseDown={startResizing}
          onDoubleClick={resetWidth}
          isDragging={isDragging}
        />
        {/* Top Header */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border-subtle)] bg-[var(--control-bg)]/40">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white tracking-wide uppercase">AI BIM Copilot</h2>
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ready</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setSettingsOpen(true)}
              title="Copilot Settings & API Keys"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClearHistory}
              title="Clear Chat History"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Close Copilot"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Model & Target Selector Bar */}
        <div className="px-3.5 py-2 bg-[var(--control-bg)]/30 border-b border-[var(--border-subtle)] flex flex-col gap-1.5">
          <div className="flex items-center space-x-2">
            {/* Provider Selector */}
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="flex-1 bg-[var(--dock-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-md px-2 py-1 text-[11px] text-slate-200 outline-none"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="flex-1 bg-[var(--dock-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-md px-2 py-1 text-[11px] text-slate-200 outline-none"
            >
              {currentProvider?.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Active selection badge */}
          {selectedExpressId !== null && (
            <div className="flex items-center space-x-1.5 px-2 py-1 bg-cyan-950/40 border border-cyan-800/40 rounded text-[11px] text-cyan-300">
              <Box className="w-3 h-3 text-cyan-400" />
              <span>Target Element:</span>
              <span className="font-mono font-medium text-cyan-200">#{selectedExpressId}</span>
            </div>
          )}
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-1.5 mb-1 px-1 text-[10px] text-slate-500">
                  <span>{isUser ? 'You' : 'Copilot'}</span>
                  <span>•</span>
                  <span>{m.timestamp}</span>
                </div>

                <div
                  className={`max-w-[90%] rounded-xl px-3.5 py-2.5 leading-relaxed break-words shadow-sm ${
                    isUser
                      ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-[var(--control-bg)] text-slate-200 border border-[var(--border-subtle)] rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Render Tool Calls */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] space-y-2">
                      {m.toolCalls.map((tc) => {
                        const isSuccess = tc.result && tc.result.success;
                        return (
                          <div
                            key={tc.id}
                            className="bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-lg p-2.5 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-300">
                                {getToolIcon(tc.name)}
                                <span className="font-semibold text-white">{tc.name}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                {isSuccess ? (
                                  <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-medium">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Executed</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center space-x-1 text-[10px] text-rose-400 font-medium">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>Failed</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Arguments Preview */}
                            <div className="text-[10px] text-slate-400 bg-black/30 rounded px-2 py-1 font-mono overflow-x-auto">
                              {JSON.stringify(tc.arguments)}
                            </div>

                            {/* Result Summary */}
                            {tc.result && typeof tc.result.summary === 'string' && (
                              <p className="text-[11px] text-slate-300 italic pt-0.5">
                                {tc.result.summary}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center space-x-2 text-slate-400 text-xs px-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Analyzing geometry & executing tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--control-bg)]/20">
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--control-bg)] hover:bg-[var(--control-hover)] border border-[var(--border-subtle)] text-[10px] text-slate-300 hover:text-white transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--control-bg)]/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask Copilot or type a command..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-[var(--dock-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:hover:bg-cyan-400 text-slate-950 font-bold transition-colors shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Settings Modal */}
      <CopilotSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleConfigSaved}
      />
    </>
  );
};
