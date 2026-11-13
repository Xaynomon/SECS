import { useEffect, useRef } from 'react';
import { useCircuitStore } from '../store/useCircuitStore';

/**
 * Automatically persists circuit changes to IndexedDB in real time
 * with a 400ms debounce.
 */
export function useAutoSave(): void {
  const components = useCircuitStore((state) => state.components);
  const wires = useCircuitStore((state) => state.wires);
  const currentProjectName = useCircuitStore((state) => state.currentProjectName);
  const simulationMode = useCircuitStore((state) => state.simulationMode);
  const currentView = useCircuitStore((state) => state.currentView);
  const triggerAutoSave = useCircuitStore((state) => state.triggerAutoSave);

  const isInitialMount = useRef(true);

  useEffect(() => {
    // Avoid triggering auto-save on initial mount before user makes changes
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Auto-save project whenever components, wires, project title, or sim mode change
    if (currentView === 'editor') {
      triggerAutoSave();
    }
  }, [components, wires, currentProjectName, simulationMode, currentView, triggerAutoSave]);
}
