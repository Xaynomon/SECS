import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Plus,
  FolderOpen,
  Search,
  Clock,
  Cpu,
  Layers,
  ArrowRight,
  Copy,
  Trash2,
  Download,
  Sparkles,
  LayoutGrid,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { useCircuitStore } from '../../store/useCircuitStore';
import {
  getAllProjects,
  deleteProject,
  duplicateProject,
  SavedProject,
  saveProject,
} from '../../utils/indexedDb';
import { STARTER_TEMPLATES, StarterTemplate } from '../../constants/starterTemplates';
import { saveProjectToFile, validateCircuitFile } from '../../utils/fileIo';

export const ProjectDashboard: React.FC = () => {
  const {
    theme,
    openEditor,
    newCircuit,
    loadCircuit,
    loadProjectFromDb,
    setCurrentProjectName,
    setCurrentProjectId,
  } = useCircuitStore();

  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'recent' | 'templates'>('recent');
  const [templateTierFilter, setTemplateTierFilter] = useState<'All' | 'Basic' | 'Intermediate' | 'High-Level' | 'Professional'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load saved projects from IndexedDB
  const refreshProjects = async () => {
    setLoading(true);
    try {
      const list = await getAllProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Filtered projects
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Filtered templates
  const filteredTemplates = STARTER_TEMPLATES.filter((t) => {
    const matchesTier = templateTierFilter === 'All' || t.tier === templateTierFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q);
    return matchesTier && matchesQuery;
  });

  // New Circuit Handler
  const handleCreateNew = () => {
    newCircuit();
    openEditor();
  };

  // File Upload Handler
  const handleOpenLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = validateCircuitFile(json);
        if (result.isValid && result.data) {
          loadCircuit(result.data);
          // Save imported circuit to IndexedDB so it appears in recent
          const now = new Date().toISOString();
          const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const title = result.data.name || file.name.replace(/\.[^/.]+$/, '');
          setCurrentProjectName(title);
          setCurrentProjectId(newId);
          await saveProject({
            id: newId,
            name: title,
            createdAt: now,
            updatedAt: now,
            componentCount: result.data.components?.length || 0,
            wireCount: result.data.wires?.length || 0,
            data: result.data,
          });
          openEditor();
        } else {
          alert(`Corrupted or invalid .secs project file:\n${result.error || 'Unknown format'}`);
        }
      } catch (err: any) {
        alert(`Failed to parse file as JSON: ${err?.message || err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Open Project Handler
  const handleOpenProject = async (projId: string) => {
    await loadProjectFromDb(projId);
    openEditor();
  };

  // Duplicate Project Handler
  const handleDuplicateProject = async (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup = await duplicateProject(projId);
    if (dup) {
      showNotice(`Created copy: "${dup.name}"`);
      await refreshProjects();
    }
  };

  // Delete Project Handler
  const handleDeleteProject = async (projId: string, projName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${projName}"?`)) {
      await deleteProject(projId);
      showNotice(`Deleted "${projName}"`);
      await refreshProjects();
    }
  };

  // Export Project Handler
  const handleExportProject = async (project: SavedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    await saveProjectToFile(project.data);
    showNotice(`Exported "${project.name}.secs"`);
  };

  // Load Template Handler
  const handleLoadTemplate = async (template: StarterTemplate) => {
    loadCircuit(template.circuit);
    setCurrentProjectName(template.title);

    const currentWires = useCircuitStore.getState().wires;
    const routedCircuit = {
      ...template.circuit,
      wires: currentWires,
    };

    // Save template as a new user project in IndexedDB
    const now = new Date().toISOString();
    const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentProjectId(newId);
    await saveProject({
      id: newId,
      name: template.title,
      createdAt: now,
      updatedAt: now,
      componentCount: template.circuit.components?.length || 0,
      wireCount: currentWires.length,
      data: routedCircuit,
    });

    openEditor();
    setTimeout(() => {
      useCircuitStore.getState().zoomToFit();
    }, 50);
  };

  // Format Date helper
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col select-none overflow-y-auto transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl bg-sky-500 text-white font-medium text-xs animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Top Header / Navigation Bar */}
      <header
        className={`h-16 border-b px-6 sm:px-12 flex items-center justify-between shrink-0 transition-colors ${
          isDark ? 'border-slate-800 bg-slate-900/80 backdrop-blur' : 'border-slate-200 bg-white/80 backdrop-blur'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/20">
            <Zap className="w-5 h-5 fill-slate-950 stroke-none" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight">SECS</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-400/30">
                Dashboard
              </span>
            </div>
            <div className={`text-[11px] leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Standalone Electronic Circuit Simulator
            </div>
          </div>
        </div>

        <button
          onClick={openEditor}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <span>Open Canvas</span>
          <ArrowRight className="w-4 h-4 text-sky-400" />
        </button>
      </header>

      {/* Hero Banner */}
      <div
        className={`border-b py-10 px-6 sm:px-12 relative overflow-hidden transition-colors ${
          isDark
            ? 'border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/60 to-slate-950'
            : 'border-slate-200 bg-gradient-to-b from-sky-50/50 via-white to-slate-50'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phase 7.2: Verified Starter Templates & Multi-Tier Circuits</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Design, Simulate, and Document Schematics
            </h1>
            <p className={`text-xs sm:text-sm max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Create clean orthogonal wiring, double-click to add schematic sticky notes, and load starter circuits from our verified library.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 shadow-lg shadow-sky-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Circuit</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
              <span>Open .secs File</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleOpenLocalFile}
              accept=".secs,.json"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto px-6 sm:px-12 py-8 flex-1 flex flex-col space-y-6">
        {/* Navigation Tabs & Search Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-800/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('recent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'recent'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Circuits</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'recent'
                    ? 'bg-sky-600 text-white'
                    : isDark
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {projects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'templates'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Starter Templates</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'templates'
                    ? 'bg-sky-600 text-white'
                    : isDark
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {STARTER_TEMPLATES.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'recent' ? 'Search circuits...' : 'Search templates...'
              }
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border transition focus:outline-none focus:border-sky-500 ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* TAB 1: RECENT CIRCUITS */}
        {activeTab === 'recent' && (
          <div>
            {loading ? (
              <div className="py-20 text-center text-xs text-slate-500">
                Loading saved circuits...
              </div>
            ) : filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className={`group rounded-2xl border p-4 cursor-pointer transition flex flex-col justify-between hover:shadow-xl hover:border-sky-500/50 ${
                      isDark
                        ? 'bg-slate-900/70 border-slate-800 hover:bg-slate-900'
                        : 'bg-white border-slate-200 hover:bg-sky-50/30'
                    }`}
                  >
                    <div>
                      {/* Card Header & Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-2 rounded-xl transition ${
                              isDark
                                ? 'bg-slate-800 group-hover:bg-sky-500/10 text-sky-400'
                                : 'bg-slate-100 group-hover:bg-sky-100 text-sky-600'
                            }`}
                          >
                            <FileCode className="w-5 h-5" />
                          </div>
                          <div>
                            <h3
                              className={`font-bold text-sm leading-tight transition ${
                                isDark
                                  ? 'text-slate-100 group-hover:text-sky-300'
                                  : 'text-slate-900 group-hover:text-sky-600'
                              }`}
                            >
                              {project.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(project.updatedAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats Pills */}
                      <div className="flex items-center gap-2 mb-4">
                        <span
                          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-mono ${
                            isDark
                              ? 'bg-slate-800/80 text-slate-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Cpu className="w-3 h-3 text-sky-500" />
                          {project.componentCount} components
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-mono ${
                            isDark
                              ? 'bg-slate-800/80 text-slate-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Layers className="w-3 h-3 text-emerald-500" />
                          {project.wireCount} wires
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div
                      className={`pt-3 border-t flex items-center justify-between transition-colors ${
                        isDark ? 'border-slate-800' : 'border-slate-100'
                      }`}
                    >
                      <span className="text-[11px] font-medium text-sky-500 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Open Editor &rarr;
                      </span>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDuplicateProject(project.id, e)}
                          title="Duplicate Circuit"
                          className={`p-1.5 rounded-lg transition ${
                            isDark
                              ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                              : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleExportProject(project, e)}
                          title="Export to .secs File"
                          className={`p-1.5 rounded-lg transition ${
                            isDark
                              ? 'hover:bg-slate-800 text-slate-400 hover:text-purple-400'
                              : 'hover:bg-slate-100 text-slate-500 hover:text-purple-600'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(project.id, project.name, e)}
                          title="Delete Circuit"
                          className={`p-1.5 rounded-lg transition ${
                            isDark
                              ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                              : 'hover:bg-red-50 text-slate-500 hover:text-red-600'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`py-16 text-center border-2 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-3 ${
                  isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-sm">No saved circuits yet</div>
                  <div className="text-xs max-w-sm mt-1">
                    Start a new project or explore our pre-built starter templates to get designing right away.
                  </div>
                </div>
                <button
                  onClick={handleCreateNew}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Your First Circuit</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STARTER TEMPLATES */}
        {activeTab === 'templates' && (
          <div>
            {/* Tier Filter Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              {(['All', 'Basic', 'Intermediate', 'High-Level', 'Professional'] as const).map((tier) => {
                const count =
                  tier === 'All'
                    ? STARTER_TEMPLATES.length
                    : STARTER_TEMPLATES.filter((t) => t.tier === tier).length;
                const isSelected = templateTierFilter === tier;
                return (
                  <button
                    key={tier}
                    onClick={() => setTemplateTierFilter(tier)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                      isSelected
                        ? tier === 'Professional'
                          ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/25'
                          : 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                        : isDark
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <span>{tier === 'All' ? 'All' : tier === 'Professional' ? '🏆 Professional' : tier}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? tier === 'Professional'
                            ? 'bg-amber-700/60 text-amber-100'
                            : 'bg-sky-600 text-white'
                          : isDark
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => {
                  const compCount = template.circuit.components?.length || template.componentCount;
                  const wireCount = template.circuit.wires?.length || 0;

                  const badgeStyle =
                    template.tier === 'Basic'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : template.tier === 'Intermediate'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : template.tier === 'High-Level'
                      ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                      : 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10';

                  const hoverBorder =
                    template.tier === 'Basic'
                      ? 'hover:border-emerald-500/50 hover:bg-emerald-50/10'
                      : template.tier === 'Intermediate'
                      ? 'hover:border-amber-500/50 hover:bg-amber-50/10'
                      : template.tier === 'High-Level'
                      ? 'hover:border-purple-500/50 hover:bg-purple-50/10'
                      : 'hover:border-amber-400/60 hover:bg-amber-500/10';

                  const textHover =
                    template.tier === 'Basic'
                      ? isDark ? 'group-hover:text-emerald-300' : 'group-hover:text-emerald-700'
                      : template.tier === 'Intermediate'
                      ? isDark ? 'group-hover:text-amber-300' : 'group-hover:text-amber-700'
                      : template.tier === 'High-Level'
                      ? isDark ? 'group-hover:text-purple-300' : 'group-hover:text-purple-700'
                      : isDark ? 'group-hover:text-amber-300' : 'group-hover:text-amber-600';

                  const btnColor =
                    template.tier === 'Basic'
                      ? 'text-emerald-500'
                      : template.tier === 'Intermediate'
                      ? 'text-amber-500'
                      : template.tier === 'High-Level'
                      ? 'text-purple-400'
                      : 'text-amber-400';

                  return (
                    <div
                      key={template.id}
                      onClick={() => handleLoadTemplate(template)}
                      className={`group rounded-2xl border p-4 cursor-pointer transition flex flex-col justify-between hover:shadow-xl ${hoverBorder} ${
                        isDark
                          ? 'bg-slate-900/70 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        {/* Header Badges */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeStyle}`}
                          >
                            {template.tier}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {template.category}
                          </span>
                        </div>

                        {/* Title */}
                        <h3
                          className={`font-bold text-sm mb-1.5 transition ${
                            isDark ? 'text-slate-100' : 'text-slate-900'
                          } ${textHover}`}
                        >
                          {template.title}
                        </h3>

                        {/* Description */}
                        <p
                          className={`text-xs leading-relaxed line-clamp-3 mb-4 ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {template.description}
                        </p>

                        {/* Stats Pills */}
                        <div className="flex items-center gap-2 mb-4">
                          <span
                            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-mono ${
                              isDark
                                ? 'bg-slate-800/80 text-slate-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Cpu className="w-3 h-3 text-sky-500" />
                            {compCount} components
                          </span>
                          <span
                            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-mono ${
                              isDark
                                ? 'bg-slate-800/80 text-slate-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Layers className="w-3 h-3 text-emerald-500" />
                            {wireCount} wires
                          </span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div
                        className={`pt-3 border-t flex items-center justify-between transition-colors ${
                          isDark ? 'border-slate-800' : 'border-slate-100'
                        }`}
                      >
                        <span className={`text-[11px] font-medium ${btnColor} flex items-center gap-1 group-hover:translate-x-0.5 transition-transform`}>
                          Load Circuit &rarr;
                        </span>
                        <div className="text-[11px] font-mono text-slate-500">
                          Ready to simulate
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={`py-16 text-center border-2 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-3 ${
                  isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <LayoutGrid className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-sm">No templates found</div>
                  <div className="text-xs max-w-sm mt-1">
                    No starter templates match your current filter or search criteria.
                  </div>
                </div>
                <button
                  onClick={() => {
                    setTemplateTierFilter('All');
                    setSearchQuery('');
                  }}
                  className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
