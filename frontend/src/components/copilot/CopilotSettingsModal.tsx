import React, { useState, useEffect } from 'react';
import { X, Key, Server, ShieldCheck, Check } from 'lucide-react';

import type { AIProvider } from '../../types/ifc';

interface CopilotSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  serverProviders?: AIProvider[];
}

export interface CopilotConfig {
  geminiKey: string;
  claudeKey: string;
  openaiKey: string;
  ollamaBaseUrl: string;
  preferredProvider: string;
  preferredModel: string;
}

export const COPILOT_CONFIG_STORAGE_KEY = 'ifc_copilot_config';

export function loadCopilotConfig(): CopilotConfig {
  try {
    const raw = localStorage.getItem(COPILOT_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.preferredModel === 'gemini-3.8-flash') {
        parsed.preferredModel = 'gemini-2.5-flash';
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load copilot config from localStorage', e);
  }
  return {
    geminiKey: '',
    claudeKey: '',
    openaiKey: '',
    ollamaBaseUrl: 'http://localhost:11434/v1',
    preferredProvider: 'gemini',
    preferredModel: 'gemini-2.5-flash'
  };
}

export const CopilotSettingsModal: React.FC<CopilotSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  serverProviders = []
}) => {
  const [config, setConfig] = useState<CopilotConfig>(loadCopilotConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadCopilotConfig());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem(COPILOT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    setSavedSuccess(true);
    onSaved();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">AI Copilot Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          <div className="flex items-center gap-2 p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-cyan-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>API keys are saved in your browser's local storage and transmitted directly per request. They are never written to disk on the server.</span>
          </div>

          {/* Google Gemini */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-medium">Google Gemini API Key</label>
              {serverProviders.find((p) => p.id === 'gemini')?.has_server_key && (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Server .env key active
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={config.geminiKey}
              onChange={(e) => setConfig({ ...config, geminiKey: e.target.value })}
              className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
            />
            <span className="text-[10px] text-slate-500">Supports gemini-2.5-flash (recommended), gemini-2.0-flash, and gemini-1.5-pro.</span>
          </div>

          {/* Anthropic Claude */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-medium">Anthropic Claude API Key</label>
              {serverProviders.find((p) => p.id === 'claude')?.has_server_key && (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Server .env key active
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={config.claudeKey}
              onChange={(e) => setConfig({ ...config, claudeKey: e.target.value })}
              className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
            />
            <span className="text-[10px] text-slate-500">Supports claude-3-7-sonnet and claude-3-5-sonnet.</span>
          </div>

          {/* OpenAI */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-medium">OpenAI API Key</label>
              {serverProviders.find((p) => p.id === 'openai')?.has_server_key && (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Server .env key active
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder="sk-proj-..."
              value={config.openaiKey}
              onChange={(e) => setConfig({ ...config, openaiKey: e.target.value })}
              className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
            />
            <span className="text-[10px] text-slate-500">Supports gpt-4o, gpt-4.5, and o3-mini.</span>
          </div>

          {/* Ollama / Local Endpoint */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <label className="text-slate-300 font-medium">Ollama / OpenAI-Compatible Base URL</label>
            </div>
            <input
              type="text"
              placeholder="http://localhost:11434/v1"
              value={config.ollamaBaseUrl}
              onChange={(e) => setConfig({ ...config, ollamaBaseUrl: e.target.value })}
              className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] focus:border-cyan-400 rounded-lg px-3 py-2 text-white outline-none font-mono text-xs"
            />
            <span className="text-[10px] text-slate-500">Local inference without keys. Ensure CORS is enabled if running locally.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-3.5 bg-[var(--canvas-bg)] border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full font-medium text-xs transition-all ${
              savedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Configuration</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
