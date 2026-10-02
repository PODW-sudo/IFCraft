import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  History, 
  X,
  Clock,
  User
} from 'lucide-react';
import type { AuditTimelineItem } from '../../types/ifc';

interface TimelineScrubberProps {
  isOpen: boolean;
  onClose: () => void;
  timeline: AuditTimelineItem[];
  onSelectEvent: (event: AuditTimelineItem | null) => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  isOpen,
  onClose,
  timeline,
  onSelectEvent,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync index when timeline loads or changes
  useEffect(() => {
    if (timeline.length > 0) {
      setCurrentIndex(timeline.length - 1);
    }
  }, [timeline.length]);

  // Handle Play / Step interval playback
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isPlaying && timeline.length > 0) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= timeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          onSelectEvent(timeline[next]);
          return next;
        });
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, timeline, onSelectEvent]);

  if (!isOpen) return null;

  const currentEvent = timeline[currentIndex] || null;

  const handleStepPrev = () => {
    if (currentIndex > 0) {
      const nextIdx = currentIndex - 1;
      setCurrentIndex(nextIdx);
      onSelectEvent(timeline[nextIdx]);
    }
  };

  const handleStepNext = () => {
    if (currentIndex < timeline.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      onSelectEvent(timeline[nextIdx]);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setCurrentIndex(val);
    if (timeline[val]) {
      onSelectEvent(timeline[val]);
    }
  };

  return (
    <div
      role="region"
      aria-label="Collaborative Session Playback Scrubber"
      data-qa="timeline-scrubber"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl p-3 rounded-2xl bg-surface-dock/95 backdrop-blur-xl border border-border-subtle shadow-dock flex flex-col gap-2 select-none animate-in fade-in slide-in-from-bottom-2 text-xs text-text-primary pointer-events-auto"
    >
      {/* Top Header & Event Info */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-action-primary-text" />
          <span className="font-semibold text-text-primary text-[11px] uppercase tracking-wider">
            Audit Playback Scrubber
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-canvas border border-border-subtle font-mono text-text-secondary">
            {timeline.length > 0 ? `${currentIndex + 1} / ${timeline.length}` : '0 / 0'}
          </span>
        </div>

        <button
          onClick={onClose}
          data-qa="timeline-close-btn"
          className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-all"
        >
          <X size={14} />
        </button>
      </div>

      {/* Active Event Card Preview */}
      {currentEvent ? (
        <div
          data-qa="timeline-event-card"
          className="flex items-center justify-between p-2 rounded-xl bg-surface-canvas/50 border border-border-subtle text-[11px]"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-action-primary-text font-mono">
              {currentEvent.action_type.replace('_', ' ').toUpperCase()}
            </span>
            {currentEvent.express_id && (
              <span className="px-1.5 py-0.5 rounded bg-surface-dock border border-border-subtle font-mono text-[10px]">
                #{currentEvent.express_id} {currentEvent.entity_type ? `(${currentEvent.entity_type})` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-text-secondary text-[10px]">
            <span className="flex items-center gap-1">
              <User size={11} />
              <span>{currentEvent.user_name}</span>
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Clock size={11} />
              <span>{new Date(currentEvent.timestamp).toLocaleTimeString()}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-text-secondary/60 italic text-[11px]">
          No recorded change events in timeline.
        </div>
      )}

      {/* Scrubbing Slider & Controls */}
      <div className="flex items-center gap-3 pt-0.5">
        <button
          data-qa="timeline-play-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={timeline.length <= 1}
          className="p-1.5 rounded-xl bg-action-primary-bg text-action-primary-text font-medium hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all shadow-sm"
          title={isPlaying ? 'Pause timeline playback' : 'Play timeline forward'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          data-qa="timeline-step-prev"
          onClick={handleStepPrev}
          disabled={currentIndex <= 0}
          className="p-1.5 rounded-xl bg-surface-canvas border border-border-subtle hover:bg-surface-canvas/80 disabled:opacity-40 text-text-secondary hover:text-text-primary transition-all"
          title="Previous event"
        >
          <ChevronLeft size={14} />
        </button>

        <input
          data-qa="timeline-slider"
          type="range"
          min={0}
          max={Math.max(0, timeline.length - 1)}
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={timeline.length <= 1}
          className="flex-1 accent-cyan-400 cursor-pointer"
        />

        <button
          data-qa="timeline-step-next"
          onClick={handleStepNext}
          disabled={currentIndex >= timeline.length - 1}
          className="p-1.5 rounded-xl bg-surface-canvas border border-border-subtle hover:bg-surface-canvas/80 disabled:opacity-40 text-text-secondary hover:text-text-primary transition-all"
          title="Next event"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
