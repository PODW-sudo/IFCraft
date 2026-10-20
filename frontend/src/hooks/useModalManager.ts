import { useState, useCallback } from 'react';

export interface ModalManager {
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNewProjectModalOpen: boolean;
  setIsNewProjectModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isOmnibarOpen: boolean;
  setIsOmnibarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFederationOpen: boolean;
  setIsFederationOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isClashInspectorOpen: boolean;
  setIsClashInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBcfOpen: boolean;
  setIsBcfOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isTimelineOpen: boolean;
  setIsTimelineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStoreyNavOpen: boolean;
  setIsStoreyNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAnnotationsOpen: boolean;
  setIsAnnotationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeAllModals: () => void;
}

/**
 * useModalManager
 * Centralizes floating dialog visibility, modal focus states, and dismiss helpers.
 */
export function useModalManager(): ModalManager {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);
  const [isFederationOpen, setIsFederationOpen] = useState(false);
  const [isClashInspectorOpen, setIsClashInspectorOpen] = useState(false);
  const [isBcfOpen, setIsBcfOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStoreyNavOpen, setIsStoreyNavOpen] = useState(false);
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false);

  const closeAllModals = useCallback(() => {
    setIsUploadModalOpen(false);
    setIsNewProjectModalOpen(false);
    setIsOmnibarOpen(false);
    setIsFederationOpen(false);
    setIsClashInspectorOpen(false);
    setIsBcfOpen(false);
    setIsTimelineOpen(false);
    setIsSettingsOpen(false);
    setIsStoreyNavOpen(false);
    setIsAnnotationsOpen(false);
  }, []);

  return {
    isUploadModalOpen,
    setIsUploadModalOpen,
    isNewProjectModalOpen,
    setIsNewProjectModalOpen,
    isOmnibarOpen,
    setIsOmnibarOpen,
    isFederationOpen,
    setIsFederationOpen,
    isClashInspectorOpen,
    setIsClashInspectorOpen,
    isBcfOpen,
    setIsBcfOpen,
    isTimelineOpen,
    setIsTimelineOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isStoreyNavOpen,
    setIsStoreyNavOpen,
    isAnnotationsOpen,
    setIsAnnotationsOpen,
    closeAllModals
  };
}
