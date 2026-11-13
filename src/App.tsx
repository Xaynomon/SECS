import React from 'react';
import { TopToolbar } from './components/topbar/TopToolbar';
import { ComponentSidebar } from './components/sidebar/ComponentSidebar';
import { CircuitCanvas } from './components/canvas/CircuitCanvas';
import { PropertiesInspector } from './components/inspector/PropertiesInspector';
import { SmartTipsHUD } from './components/diagnostics/SmartTipsHUD';
import { BenchInstruments } from './components/instruments/BenchInstruments';
import { ProjectDashboard } from './components/Dashboard/ProjectDashboard';
import { McuCodeEditorModal } from './components/mcu/McuCodeEditorModal';
import { useCircuitStore } from './store/useCircuitStore';
import { useSimulationLoop } from './hooks/useSimulationLoop';
import { useAutoSave } from './hooks/useAutoSave';

export const App: React.FC = () => {
  const { theme, currentView } = useCircuitStore();
  useSimulationLoop();
  useAutoSave();

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      {currentView === 'dashboard' ? (
        <ProjectDashboard />
      ) : (
        <>
          {/* Top Application Toolbar */}
          <TopToolbar />

          {/* Main CAD Workspace Layout */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Left Component Library Sidebar */}
            <ComponentSidebar />

            {/* Central Infinite Interactive Canvas */}
            <main className="flex-1 h-full relative overflow-hidden">
              <CircuitCanvas />
              {/* Bench Instruments Overlay (Phase 6 Ready) */}
              <BenchInstruments />
              {/* Smart Tips & Diagnostics Bottom-Right Card */}
              <SmartTipsHUD />
            </main>

            {/* Right Properties Inspector */}
            <PropertiesInspector />

            {/* Microcontroller Code Editor & Serial Monitor Modal */}
            <McuCodeEditorModal />
          </div>
        </>
      )}
    </div>
  );
};

export default App;
