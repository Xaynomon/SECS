import { useEffect } from 'react';
import { useCircuitStore } from '../store/useCircuitStore';

/**
 * Custom hook that runs the real-time simulation clock loop when active
 */
export function useSimulationLoop() {
  const { simulationStatus, simulationSpeed, runSimulationCycle } = useCircuitStore();

  useEffect(() => {
    if (simulationStatus !== 'running') return;

    let lastTime = performance.now();
    // 25-30 ticks per second (35ms interval) - smooth and light on CPU
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(100, Math.max(16, now - lastTime));
      lastTime = now;
      runSimulationCycle(dt);
    }, 35);

    return () => clearInterval(interval);
  }, [simulationStatus, simulationSpeed, runSimulationCycle]);
}
