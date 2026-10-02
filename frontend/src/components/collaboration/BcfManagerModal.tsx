import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Plus, 
  Camera, 
  AlertCircle, 
  MessageSquare
} from 'lucide-react';
import type { BcfTopic, BcfTopicCreateRequest } from '../../types/ifc';

interface BcfManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  topics: BcfTopic[];
  onCreateTopic: (req: BcfTopicCreateRequest) => Promise<void>;
  onImportClashes: () => Promise<void>;
  clashCount: number;
  onViewViewpoint?: (pos: [number, number, number], target: [number, number, number]) => void;
  onSelectTopic?: (topic: BcfTopic) => void;
  currentCameraView?: {
    position: [number, number, number];
    target: [number, number, number];
  };
  selectedExpressID?: number | null;
  exportUrl: string;
}

export const BcfManagerModal: React.FC<BcfManagerModalProps> = ({
  isOpen,
  onClose,
  projectName,
  topics,
  onCreateTopic,
  onImportClashes,
  clashCount,
  onViewViewpoint,
  onSelectTopic,
  currentCameraView,
  selectedExpressID,
  exportUrl,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [topicType, setTopicType] = useState('Clash');
  const [includeViewpoint, setIncludeViewpoint] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateTopic({
        title: title.trim(),
        description: description.trim(),
        priority,
        topic_type: topicType,
        camera_position: includeViewpoint && currentCameraView ? currentCameraView.position : undefined,
        camera_target: includeViewpoint && currentCameraView ? currentCameraView.target : undefined,
        selected_elements: selectedExpressID ? [selectedExpressID] : undefined,
      });
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error('Failed to create topic:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportClashesClick = async () => {
    setIsImporting(true);
    try {
      await onImportClashes();
    } finally {
      setIsImporting(false);
    }
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'low':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BCF Issue Management"
      data-qa="bcf-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl bg-surface-dock/95 border border-border-subtle shadow-dock flex flex-col overflow-hidden text-xs text-text-primary">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-canvas/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-action-primary-bg/15 border border-action-primary-bg/30 flex items-center justify-center text-action-primary-text">
              <MessageSquare size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                BIM Collaboration Format (BCF 2.1)
              </h2>
              <p className="text-[11px] text-text-secondary">
                Track issues, clashes & viewpoints for {projectName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              data-qa="bcf-export-btn"
              href={exportUrl}
              download={`${projectName.replace(/\s+/g, '_')}_issues.bcfzip`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-action-primary-bg text-action-primary-text font-medium hover:opacity-90 active:scale-95 transition-all shadow-sm"
              title="Download standard .bcfzip issue archive"
            >
              <Download size={14} />
              <span>Export .bcfzip</span>
            </a>

            <button
              onClick={onClose}
              data-qa="bcf-close-btn"
              className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Import Clashes Action */}
          {clashCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-text-primary">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-medium text-amber-200">
                    {clashCount} geometric clashes detected
                  </span>
                  <p className="text-[11px] text-text-secondary">
                    Automatically convert detected clashes into persistent BCF issue topics with camera viewpoints.
                  </p>
                </div>
              </div>
              <button
                data-qa="bcf-import-clashes-btn"
                onClick={handleImportClashesClick}
                disabled={isImporting}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium border border-amber-500/30 transition-all shrink-0"
              >
                {isImporting ? 'Converting...' : 'Import Clashes'}
              </button>
            </div>
          )}

          {/* New Topic Creation Form */}
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-surface-canvas/40 border border-border-subtle space-y-3">
            <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider">
              Create New Issue Topic
            </span>

            <div className="space-y-1">
              <input
                data-qa="bcf-topic-input"
                type="text"
                placeholder="Issue Title (e.g. Beam clearance collision)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-surface-canvas border border-border-subtle text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-action-primary-bg"
              />
            </div>

            <div className="space-y-1">
              <textarea
                placeholder="Detailed description, resolution guidance, or requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-surface-canvas border border-border-subtle text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-action-primary-bg resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-text-secondary">
                  <span>Priority:</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-surface-canvas border border-border-subtle text-text-primary"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-text-secondary">
                  <span>Type:</span>
                  <select
                    value={topicType}
                    onChange={(e) => setTopicType(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-surface-canvas border border-border-subtle text-text-primary"
                  >
                    <option value="Clash">Clash</option>
                    <option value="Issue">Issue</option>
                    <option value="Request">Request</option>
                    <option value="Remark">Remark</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeViewpoint}
                    onChange={(e) => setIncludeViewpoint(e.target.checked)}
                    className="rounded bg-surface-canvas border-border-subtle text-action-primary-bg"
                  />
                  <Camera size={13} />
                  <span>Attach 3D Viewpoint</span>
                </label>

                <button
                  type="submit"
                  data-qa="bcf-create-btn"
                  disabled={isSubmitting || !title.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-action-primary-bg text-action-primary-text font-medium hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all shadow-sm"
                >
                  <Plus size={14} />
                  <span>{isSubmitting ? 'Saving...' : 'Add Topic'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Topics List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider">
                Topics ({topics.length})
              </span>
            </div>

            {topics.length === 0 ? (
              <div className="text-center py-8 text-text-secondary/60 italic">
                No BCF issue topics created yet. Add a topic above or import detected clashes.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topics.map((t) => (
                  <div
                    key={t.id}
                    data-qa="bcf-topic-card"
                    onClick={() => onSelectTopic && onSelectTopic(t)}
                    className="p-3 rounded-2xl bg-surface-canvas/30 border border-border-subtle hover:border-border-subtle/80 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-medium ${getPriorityBadgeClass(
                            t.priority
                          )}`}
                        >
                          {t.priority}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-canvas border border-border-subtle text-text-secondary font-mono">
                          {t.topic_type}
                        </span>
                        <span className="text-xs font-semibold text-text-primary">
                          {t.title}
                        </span>
                      </div>

                      {t.camera_position && t.camera_target && onViewViewpoint && (
                        <button
                          onClick={() => onViewViewpoint(t.camera_position!, t.camera_target!)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-canvas hover:bg-surface-canvas/80 text-action-primary-text text-[11px] border border-border-subtle transition-all"
                          title="Fly 3D camera to this topic's viewpoint"
                        >
                          <Camera size={12} />
                          <span>View 3D</span>
                        </button>
                      )}
                    </div>

                    {t.description && (
                      <p className="text-[11px] text-text-secondary pl-0.5">
                        {t.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-text-secondary/60 pt-1 border-t border-border-subtle/40">
                      <span>By {t.creation_author} • {new Date(t.created_at).toLocaleDateString()}</span>
                      {t.selected_elements && t.selected_elements.length > 0 && (
                        <span>{t.selected_elements.length} elements associated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
