import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Search,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';

import type { ChatMessage, AIProvider } from '../../types/ifc';
import { sendCopilotChat, fetchCopilotProviders, fetchCopilotModels } from '../../services/api';
import { CopilotSettingsModal, loadCopilotConfig, type CopilotConfig } from './CopilotSettingsModal';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';


interface CopilotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  selectedExpressId: number | null;
  onModelModified: () => void;
  onWidthChange?: (width: number) => void;
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
  onModelModified,
  onWidthChange
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
  const [dynamicModels, setDynamicModels] = useState<Record<string, string[]>>({});
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, { state: 'checking' | 'connected' | 'error' | 'needs_key'; error?: string }>>({
    local: { state: 'connected' }
  });
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isCustomModelActive, setIsCustomModelActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<CopilotConfig>(loadCopilotConfig());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = useCallback(
    async (messageId: string, content: string, toolCalls?: ChatMessage['toolCalls']) => {
      let textToCopy = content || '';
      if (!textToCopy && toolCalls && toolCalls.length > 0) {
        textToCopy = toolCalls
          .map((tc) => `${tc.name}: ${JSON.stringify(tc.arguments, null, 2)}`)
          .join('\n\n');
      }
      if (!textToCopy) return;

      let successful = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          successful = true;
        } catch {
          // Fall back to DOM execCommand
        }
      }

      if (!successful) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = textToCopy;
          textarea.style.position = 'fixed';
          textarea.style.top = '0';
          textarea.style.left = '0';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          successful = document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch (err) {
          console.warn('Fallback copy failed:', err);
        }
      }

      if (successful) {
        setCopiedMessageId(messageId);
        setTimeout(() => {
          setCopiedMessageId((cur) => (cur === messageId ? null : cur));
        }, 2000);
      }
    },
    []
  );


  const { width, isDragging, startResizing, resetWidth } = useResizable({
    initialWidth: 384,
    minWidth: 300,
    maxWidth: 750,
    storageKey: 'ifc_editor_copilot_sidebar_width',
    direction: 'left'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDynamicModels = useCallback(
    async (providerId: string, currentConfig: CopilotConfig, currentProviders: AIProvider[]) => {
      if (providerId === 'local') {
        setConnectionStatuses((prev) => ({
          ...prev,
          [providerId]: { state: 'connected' }
        }));
        return;
      }

      let apiKey = '';
      let baseUrl: string | undefined = undefined;

      if (providerId === 'gemini') apiKey = currentConfig.geminiKey;
      else if (providerId === 'claude') apiKey = currentConfig.claudeKey;
      else if (providerId === 'openai') apiKey = currentConfig.openaiKey;
      else if (providerId === 'openrouter') apiKey = currentConfig.openrouterKey;
      else if (providerId === 'custom') {
        apiKey = currentConfig.customApiKey;
        baseUrl = currentConfig.customBaseUrl.trim() || undefined;
      } else if (providerId === 'ollama') {
        baseUrl = currentConfig.ollamaBaseUrl.trim() || undefined;
      }

      const prov = currentProviders.find((p) => p.id === providerId);
      const requiresKey = prov ? prov.requires_api_key : true;
      const hasKeyOrServer = Boolean(apiKey.trim() || prov?.has_server_key);

      // Check missing prerequisites
      if (requiresKey && !hasKeyOrServer) {
        setConnectionStatuses((prev) => ({
          ...prev,
          [providerId]: { state: 'needs_key', error: 'API key required' }
        }));
        return;
      }

      if (providerId === 'custom' && !baseUrl) {
        setConnectionStatuses((prev) => ({
          ...prev,
          [providerId]: { state: 'needs_key', error: 'Base URL required' }
        }));
        return;
      }

      setIsRefreshingModels(true);
      setConnectionStatuses((prev) => ({
        ...prev,
        [providerId]: { state: 'checking' }
      }));

      try {
        const res = await fetchCopilotModels({
          provider: providerId,
          api_key: apiKey.trim() || undefined,
          base_url: baseUrl
        });

        if (res && res.connected) {
          setConnectionStatuses((prev) => ({
            ...prev,
            [providerId]: { state: 'connected' }
          }));

          if (res.models && res.models.length > 0) {
            setDynamicModels((prev) => ({
              ...prev,
              [providerId]: res.models
            }));

            setSelectedModel((current) => {
              if (current === 'gemini-2.5-flash' || current === 'gemini-2.0-flash-exp' || !res.models.includes(current)) {
                return res.default_model || res.models[0];
              }
              return current;
            });
          }
        } else {
          setConnectionStatuses((prev) => ({
            ...prev,
            [providerId]: { state: 'error', error: res?.error || 'Connection failed or unauthorized' }
          }));
        }
      } catch (err: unknown) {
        console.warn(`Dynamic model fetch failed for ${providerId}:`, err);
        setConnectionStatuses((prev) => ({
          ...prev,
          [providerId]: { state: 'error', error: err instanceof Error ? err.message : String(err) }
        }));
      } finally {
        setIsRefreshingModels(false);
      }
    },
    []
  );

  // Load providers on mount
  useEffect(() => {
    fetchCopilotProviders()
      .then((data) => {
        setProviders(data);
        const savedCfg = loadCopilotConfig();
        const activeProvId = savedCfg.preferredProvider || 'gemini';
        setSelectedProviderId(activeProvId);

        let activeModel = savedCfg.preferredModel || 'gemini-3.8-flash';
        if (activeModel === 'gemini-2.5-flash' || activeModel === 'gemini-2.0-flash-exp') {
          activeModel = 'gemini-3.8-flash';
        }
        setSelectedModel(activeModel);

        loadDynamicModels(activeProvId, savedCfg, data);
      })
      .catch((err) => console.warn('Could not load AI providers:', err));
  }, [loadDynamicModels]);

  const handleProviderChange = (newProviderId: string) => {
    setSelectedProviderId(newProviderId);
    const prov = providers.find((p) => p.id === newProviderId);
    const modelsForProv = dynamicModels[newProviderId] || prov?.models || [];
    if (prov && !modelsForProv.includes(selectedModel)) {
      setSelectedModel(prov.default_model);
    }
    loadDynamicModels(newProviderId, config, providers);
  };

  // Update selected model when provider changes
  useEffect(() => {
    const prov = providers.find((p) => p.id === selectedProviderId);
    const modelsForProv = dynamicModels[selectedProviderId] || prov?.models || [];
    if (prov && !modelsForProv.includes(selectedModel)) {
      setSelectedModel(prov.default_model);
    }
  }, [selectedProviderId, providers, selectedModel, dynamicModels]);

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
    if (newCfg.preferredProvider) setSelectedProviderId(newCfg.preferredProvider);
    if (newCfg.preferredModel && newCfg.preferredModel !== 'gemini-2.5-flash') {
      setSelectedModel(newCfg.preferredModel);
    }
    loadDynamicModels(newCfg.preferredProvider || selectedProviderId, newCfg, providers);
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
    let baseUrl: string | undefined = undefined;

    if (selectedProviderId === 'gemini') apiKey = config.geminiKey;
    else if (selectedProviderId === 'claude') apiKey = config.claudeKey;
    else if (selectedProviderId === 'openai') apiKey = config.openaiKey;
    else if (selectedProviderId === 'openrouter') apiKey = config.openrouterKey;
    else if (selectedProviderId === 'custom') {
      apiKey = config.customApiKey;
      baseUrl = config.customBaseUrl.trim() || undefined;
    } else if (selectedProviderId === 'ollama') {
      baseUrl = config.ollamaBaseUrl.trim() || undefined;
    }

    try {
      const response = await sendCopilotChat({
        project_id: projectId,
        messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        provider: selectedProviderId,
        model: selectedModel,
        api_key: apiKey.trim() || undefined,
        base_url: baseUrl,
        selected_express_id: selectedExpressId
      });

      // Update connection status to connected on success
      setConnectionStatuses((prev) => ({
        ...prev,
        [selectedProviderId]: { state: 'connected' }
      }));

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
      const errMsg = err instanceof Error ? err.message : String(err);
      setConnectionStatuses((prev) => ({
        ...prev,
        [selectedProviderId]: { state: 'error', error: errMsg }
      }));

      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error communicating with AI Copilot: ${errMsg}`,
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

  useEffect(() => {
    if (onWidthChange && isOpen) {
      onWidthChange(width);
    }
  }, [width, isOpen, onWidthChange]);

  const currentProvider = providers.find((p) => p.id === selectedProviderId);

  const availableModels = useMemo(() => {
    const dynamic = dynamicModels[selectedProviderId];
    if (dynamic && dynamic.length > 0) return dynamic;
    if (selectedProviderId === 'custom' && config.customModel.trim()) {
      return [config.customModel.trim()];
    }
    return currentProvider?.models || [];
  }, [dynamicModels, selectedProviderId, currentProvider, config.customModel]);

  const activeStatus = connectionStatuses[selectedProviderId] || (
    selectedProviderId === 'local'
      ? { state: 'connected' as const }
      : { state: 'checking' as const }
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        data-qa="copilot-sidebar-drawer"
        style={{ width: `${width}px` }}
        className="fixed top-16 right-4 bottom-6 bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl flex flex-col z-30 shadow-[var(--shadow-hud)] overflow-hidden transition-all duration-200 animate-in fade-in-50 slide-in-from-right-4 select-text"
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
              <h2 className="text-xs font-semibold text-slate-900 dark:text-white tracking-wide uppercase">AI BIM Copilot</h2>
              <div className="flex items-center space-x-1.5 text-[10px]">
                {selectedProviderId === 'local' ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-cyan-300 font-mono">Offline CAD Engine</span>
                  </>
                ) : activeStatus.state === 'checking' || isRefreshingModels ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-cyan-300 font-medium">Checking...</span>
                  </>
                ) : activeStatus.state === 'connected' ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-medium">Connected</span>
                  </>
                ) : activeStatus.state === 'error' ? (
                  <div className="flex items-center space-x-1.5" title={activeStatus.error || "Connection error"}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span className="text-rose-400 font-medium max-w-[130px] truncate">
                      {activeStatus.error?.toLowerCase().includes('401') || activeStatus.error?.toLowerCase().includes('unauthorized')
                        ? 'Auth Error (401)'
                        : 'Failed'}
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-amber-300 font-medium">
                      {selectedProviderId === 'custom' ? 'Base URL Needed' : 'Key Needed'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              data-qa="copilot-settings-btn"
              onClick={() => setSettingsOpen(true)}
              title="Copilot Settings & API Keys"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              data-qa="copilot-clear-btn"
              onClick={handleClearHistory}
              title="Clear Chat History"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              data-qa="copilot-close-btn"
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
              data-qa="copilot-provider-select"
              value={selectedProviderId}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="flex-1 bg-[var(--dock-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-md px-2 py-1 text-[11px] text-slate-200 outline-none"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Model Selector */}
            {isCustomModelActive ? (
              <div className="flex-1 flex items-center space-x-1">
                <input
                  type="text"
                  placeholder="e.g. gemini-3.8-flash"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="flex-1 bg-[var(--dock-bg)] border border-cyan-400 rounded-md px-2 py-1 text-[11px] text-white outline-none font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCustomModelActive(false)}
                  className="px-1.5 py-1 text-[10px] text-slate-300 hover:text-white bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded transition-colors"
                  title="Switch back to dropdown list"
                >
                  List
                </button>
              </div>
            ) : (
              <select
                data-qa="copilot-model-select"
                value={selectedModel}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomModelActive(true);
                  } else {
                    setSelectedModel(e.target.value);
                  }
                }}
                className="flex-1 bg-[var(--dock-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-md px-2 py-1 text-[11px] text-slate-200 outline-none"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {selectedModel && !availableModels.includes(selectedModel) && (
                  <option value={selectedModel}>{selectedModel}</option>
                )}
                <option value="__custom__">+ Custom model...</option>
              </select>
            )}

            {/* Refresh Models Button */}
            {selectedProviderId !== 'local' && (
              <button
                type="button"
                onClick={() => loadDynamicModels(selectedProviderId, config, providers)}
                disabled={isRefreshingModels}
                title="Fetch latest available models dynamically"
                className="p-1.5 rounded-md bg-[var(--dock-bg)] border border-[var(--border-subtle)] hover:border-cyan-400 text-slate-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            )}
          </div>


          {/* Active selection badge */}
          {selectedExpressId !== null && (
            <div className="flex items-center space-x-1.5 px-2 py-1 bg-cyan-950/40 border border-cyan-800/40 rounded text-[11px] text-cyan-300">
              <Box className="w-3 h-3 text-cyan-400" />
              <span>Target Element:</span>
              <span className="font-mono font-medium text-cyan-200">#{selectedExpressId}</span>
            </div>
          )}

          {/* Missing API Key or Error Warning Callout */}
          {activeStatus.state === 'needs_key' && (
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-200">
              <span className="truncate mr-2">
                {selectedProviderId === 'custom' ? 'Endpoint Base URL required' : `API key needed for ${currentProvider?.name || 'provider'}`}
              </span>
              <button
                onClick={() => setSettingsOpen(true)}
                className="shrink-0 text-[10px] font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 px-2 py-0.5 rounded transition-colors"
              >
                Configure
              </button>
            </div>
          )}

          {activeStatus.state === 'error' && (
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] text-rose-200">
              <div className="flex items-center space-x-1.5 truncate mr-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span className="truncate">{activeStatus.error || 'Connection failed'}</span>
              </div>
              <button
                onClick={() => setSettingsOpen(true)}
                className="shrink-0 text-[10px] font-semibold bg-rose-400 hover:bg-rose-300 text-slate-950 px-2 py-0.5 rounded transition-colors"
              >
                Fix Key
              </button>
            </div>
          )}
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            const isCopied = copiedMessageId === m.id;
            return (
              <div
                key={m.id}
                className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'} select-text`}
              >
                <div className="flex items-center space-x-1.5 mb-1 px-1 text-[10px] text-slate-500 select-none">
                  <span>{isUser ? 'You' : 'Copilot'}</span>
                  <span>•</span>
                  <span>{m.timestamp}</span>
                  {isCopied && (
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in duration-150">
                      <Check className="w-2.5 h-2.5" /> Copied
                    </span>
                  )}
                </div>

                <div
                  className={`relative group/bubble max-w-[90%] rounded-xl px-3.5 py-2.5 leading-relaxed break-words shadow-sm select-text cursor-text ${
                    isUser
                      ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-[var(--control-bg)] text-slate-200 border border-[var(--border-subtle)] rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap select-text cursor-text pr-6">{m.content}</p>

                  {/* Quick Copy Hover Button */}
                  <button
                    type="button"
                    data-qa="copilot-message-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyMessage(m.id, m.content, m.toolCalls);
                    }}
                    title="Copy message to clipboard"
                    className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-hover/bubble:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md shadow-sm select-none cursor-pointer ${
                      isUser
                        ? 'bg-cyan-600/80 hover:bg-cyan-700 text-slate-950 hover:text-white'
                        : 'bg-[var(--dock-bg)] hover:bg-[var(--control-hover)] text-slate-400 hover:text-white border border-[var(--border-subtle)]'
                    }`}
                  >
                    {isCopied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  {/* Render Tool Calls */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] space-y-2 select-text">
                      {m.toolCalls.map((tc) => {
                        const isSuccess = tc.result && tc.result.success;
                        return (
                          <div
                            key={tc.id}
                            className="bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-lg p-2.5 space-y-1.5 select-text"
                          >
                            <div className="flex items-center justify-between select-none">
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
                            <div className="text-[10px] text-slate-400 bg-black/30 rounded px-2 py-1 font-mono overflow-x-auto select-text cursor-text">
                              {JSON.stringify(tc.arguments)}
                            </div>

                            {/* Result Summary */}
                            {tc.result && typeof tc.result.summary === 'string' && (
                              <p className="text-[11px] text-slate-300 italic pt-0.5 select-text cursor-text">
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
                data-qa="copilot-quick-prompt"
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
              data-qa="copilot-input"
              type="text"
              placeholder="Ask Copilot or type a command..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/10 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-500 outline-none transition-colors"
            />
            <button
              data-qa="copilot-send-btn"
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
        serverProviders={providers}
      />
    </>
  );
};
