import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Layers,
  Cpu,
  Binary,
  Microchip,
  Activity,
  Lightbulb,
  Type,
  Gauge,
} from 'lucide-react';
import { COMPONENT_CATEGORIES } from '../../constants/componentLibrary';
import { ComponentRegistry } from '../../registry/ComponentRegistry';
import { ComponentDefinition } from '../../types/componentRegistry';
import { ComponentThumbnail } from './ComponentThumbnail';
import { useCircuitStore } from '../../store/useCircuitStore';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  power: Zap,
  passives: Layers,
  semiconductors: Cpu,
  logic: Binary,
  mcu: Microchip,
  sensors: Activity,
  outputs: Lightbulb,
  instruments: Gauge,
  annotations: Type,
};

export const ComponentSidebar: React.FC = () => {
  const { theme, addComponent } = useCircuitStore();
  const isDark = theme === 'dark';

  const didDragRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [hoveredComp, setHoveredComp] = useState<{
    comp: ComponentDefinition;
    categoryLabel: string;
    rect: DOMRect;
  } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    power: true,
    passives: true,
    semiconductors: true,
    logic: true,
    mcu: true,
    sensors: true,
    outputs: true,
    instruments: true,
    annotations: true,
  });

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const filteredComponents = useMemo(() => {
    const list = ComponentRegistry.getAllComponents();
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((comp) => {
      const matchName = comp.name.toLowerCase().includes(q);
      const matchDesc = comp.description.toLowerCase().includes(q);
      const matchTags = (comp.tags || []).some((tag) => tag.toLowerCase().includes(q));
      const matchCat = comp.category.toLowerCase().includes(q);
      return matchName || matchDesc || matchTags || matchCat;
    });
  }, [searchQuery]);

  const quickSearchResults = useMemo(() => {
    if (!quickSearchQuery.trim()) return ComponentRegistry.getAllComponents().slice(0, 15);
    return ComponentRegistry.searchComponents(quickSearchQuery);
  }, [quickSearchQuery]);

  const componentsByCategory = useMemo(() => {
    const map: Record<string, ComponentDefinition[]> = {
      power: [],
      passives: [],
      semiconductors: [],
      logic: [],
      mcu: [],
      sensors: [],
      outputs: [],
      instruments: [],
      annotations: [],
    };

    filteredComponents.forEach((comp) => {
      if (!map[comp.category]) {
        map[comp.category] = [];
      }
      map[comp.category].push(comp);
    });

    return map;
  }, [filteredComponents]);

  // -------------------------------------------------------------
  // COLLAPSED / MINIMIZED SIDEBAR VIEW
  // -------------------------------------------------------------
  if (collapsed) {
    return (
      <aside
        className={`w-14 sm:w-16 border-r flex flex-col items-center py-2 select-none relative transition-colors shrink-0 z-20 ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        {/* Top Controls: Expand Button + Quick Search Magnifying Glass Button */}
        <div className="flex flex-col items-center gap-1.5 pb-2 border-b w-full px-2 border-slate-700/50">
          <button
            onClick={() => setCollapsed(false)}
            className={`p-2 rounded-lg transition ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
            title="Expand Component Library"
          >
            <PanelLeftOpen className="w-5 h-5 text-sky-500" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowQuickSearch(!showQuickSearch)}
              className={`p-2 rounded-lg transition ${
                showQuickSearch
                  ? 'bg-sky-500 text-white shadow-md'
                  : isDark
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-sky-400'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-sky-600'
              }`}
              title="Search Components"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Floating Quick Search Popover */}
            {showQuickSearch && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowQuickSearch(false)}
                />
                <div
                  className={`absolute left-12 top-0 z-50 w-72 rounded-xl shadow-2xl border p-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
                    isDark
                      ? 'bg-slate-900/98 border-slate-700/80 text-slate-100 shadow-sky-950/40'
                      : 'bg-white/98 border-slate-200 text-slate-800 shadow-slate-400/20'
                  }`}
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
                    <Search className="w-4 h-4 text-sky-500 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={quickSearchQuery}
                      onChange={(e) => setQuickSearchQuery(e.target.value)}
                      placeholder="Quick search components..."
                      className={`w-full text-xs bg-transparent border-none focus:outline-none ${
                        isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'
                      }`}
                    />
                    {quickSearchQuery && (
                      <button
                        onClick={() => setQuickSearchQuery('')}
                        className="p-0.5 rounded-full hover:bg-slate-700/50 text-slate-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto mt-2 space-y-1">
                    {quickSearchResults.map((comp) => {
                      const compId = comp.id || (comp as any).type;
                      return (
                        <div
                          key={compId}
                          draggable
                          onDragStart={(e) => {
                            didDragRef.current = true;
                            e.dataTransfer.setData('application/secs-component', compId);
                            e.dataTransfer.setData('text/plain', compId);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={() => {
                            setTimeout(() => {
                              didDragRef.current = false;
                            }, 100);
                          }}
                          onClick={() => {
                            if (didDragRef.current) {
                              didDragRef.current = false;
                              return;
                            }
                            addComponent(compId);
                            setShowQuickSearch(false);
                          }}
                          className={`group flex items-center gap-2 p-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition ${
                            isDark
                              ? 'bg-slate-800/60 hover:bg-slate-800 border-transparent hover:border-slate-700'
                              : 'bg-white hover:bg-sky-50 hover:border-sky-300 border-slate-200/90 shadow-sm'
                          }`}
                          title="Click to place, or drag directly onto canvas"
                        >
                          <ComponentThumbnail definition={comp as any} theme={theme} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate group-hover:text-sky-400">
                              {comp.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {comp.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Mini Component Thumbnails Strip */}
        <div className="flex-1 w-full overflow-y-auto overflow-x-hidden py-2 px-1 flex flex-col items-center space-y-2.5">
          {COMPONENT_CATEGORIES.map((category) => {
            const items = componentsByCategory[category.id] || [];
            if (items.length === 0) return null;
            const Icon = CATEGORY_ICONS[category.id];

            return (
              <div key={category.id} className="flex flex-col items-center w-full space-y-1.5">
                {/* Thin Category Divider */}
                <div
                  className="w-full flex items-center justify-center py-1 group relative cursor-pointer"
                  title={category.label}
                >
                  <div className="w-4 h-[1px] bg-slate-700/60" />
                  <Icon className="w-3.5 h-3.5 mx-0.5 text-slate-500 group-hover:text-sky-400 transition" />
                  <div className="w-4 h-[1px] bg-slate-700/60" />

                  <div className="hidden group-hover:flex absolute left-12 z-50 whitespace-nowrap px-2 py-0.5 bg-slate-900 text-sky-400 text-[10px] font-bold rounded shadow-lg border border-slate-700 pointer-events-none items-center gap-1">
                    {category.label}
                  </div>
                </div>

                {/* Mini Component Icon Tiles (40x40px) */}
                {items.map((comp) => {
                  const compId = comp.id || (comp as any).type;
                  return (
                    <div key={compId} className="relative">
                      <button
                        draggable
                        onDragStart={(e) => {
                          didDragRef.current = true;
                          setHoveredComp(null);
                          e.dataTransfer.setData('application/secs-component', compId);
                          e.dataTransfer.setData('text/plain', compId);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => {
                          setTimeout(() => {
                            didDragRef.current = false;
                          }, 100);
                        }}
                        onClick={() => {
                          if (didDragRef.current) {
                            didDragRef.current = false;
                            return;
                          }
                          addComponent(compId);
                        }}
                        onMouseEnter={(e) => {
                          setHoveredComp({
                            comp,
                            categoryLabel: category.label,
                            rect: e.currentTarget.getBoundingClientRect(),
                          });
                        }}
                        onMouseLeave={() => setHoveredComp(null)}
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center p-0.5 cursor-grab active:cursor-grabbing transition hover:scale-105 shadow-sm ${
                          isDark
                            ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-sky-500'
                            : 'bg-white hover:bg-sky-50 border-slate-200 hover:border-sky-400'
                        }`}
                      >
                        <ComponentThumbnail definition={comp as any} theme={theme} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Floating High-Contrast Tooltip (Escapes scroll container clipping via position: fixed) */}
        {hoveredComp && (
          <div
            style={{
              position: 'fixed',
              left: hoveredComp.rect.right + 10,
              top: Math.max(10, Math.min(window.innerHeight - 100, hoveredComp.rect.top)),
              zIndex: 9999,
            }}
            className="pointer-events-none min-w-[190px] max-w-[260px] p-2.5 rounded-xl shadow-2xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 bg-slate-900/98 border-slate-700 text-white shadow-sky-950/40"
          >
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800">
              <span className="font-bold text-xs text-white">{hoveredComp.comp.name}</span>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {hoveredComp.categoryLabel}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 pt-1 leading-snug">
              {hoveredComp.comp.description}
            </div>
            {hoveredComp.comp.pins && hoveredComp.comp.pins.length > 0 && (
              <div className="text-[9.5px] text-slate-400 font-mono pt-1">
                Pins: {hoveredComp.comp.pins.length}
              </div>
            )}
          </div>
        )}
      </aside>
    );
  }

  // -------------------------------------------------------------
  // EXPANDED SIDEBAR VIEW
  // -------------------------------------------------------------
  return (
    <aside
      className={`w-72 border-r flex flex-col select-none shrink-0 transition-colors z-20 ${
        isDark
          ? 'border-slate-800 bg-slate-900 text-slate-100'
          : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      {/* Header & Collapse Toggle */}
      <div
        className={`p-3 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-500" />
          <span
            className={`font-bold text-xs uppercase tracking-wider ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            Component Library
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className={`p-1 rounded transition ${
            isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
          }`}
          title="Collapse Panel"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Sticky Search Bar */}
      <div
        className={`p-2.5 border-b sticky top-0 z-10 backdrop-blur-md ${
          isDark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white/95'
        }`}
      >
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parts, tags (e.g. 555, led)..."
            className={`w-full border rounded-lg pl-8 pr-7 py-1.5 text-xs transition focus:outline-none focus:border-sky-500 ${
              isDark
                ? 'bg-slate-950 border-slate-700/80 text-slate-200 placeholder-slate-500'
                : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400 focus:bg-white'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-2 p-0.5 rounded-full transition ${
                isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category Accordion List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {COMPONENT_CATEGORIES.map((category) => {
          const items = componentsByCategory[category.id] || [];
          if (searchQuery && items.length === 0) return null;

          const isExpanded = expandedCategories[category.id] || searchQuery.length > 0;
          const Icon = CATEGORY_ICONS[category.id];

          return (
            <div
              key={category.id}
              className={`rounded-lg border overflow-hidden transition-colors ${
                isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50/80'
              }`}
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left transition group ${
                  isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`w-3.5 h-3.5 transition ${
                      isDark
                        ? 'text-slate-400 group-hover:text-sky-400'
                        : 'text-slate-500 group-hover:text-sky-600'
                    }`}
                  />
                  <span
                    className={`text-xs font-semibold ${
                      isDark
                        ? 'text-slate-300 group-hover:text-white'
                        : 'text-slate-700 group-hover:text-slate-900'
                    }`}
                  >
                    {category.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {items.length}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Component Items */}
              {isExpanded && items.length > 0 && (
                <div
                  className={`p-1.5 space-y-1 border-t ${
                    isDark
                      ? 'border-slate-800/60 bg-slate-900/30'
                      : 'border-slate-200 bg-white/50'
                  }`}
                >
                  {items.map((comp) => {
                    const compId = comp.id || (comp as any).type;
                    return (
                      <div
                        key={compId}
                        draggable
                        onDragStart={(e) => {
                          didDragRef.current = true;
                          e.dataTransfer.setData('application/secs-component', compId);
                          e.dataTransfer.setData('text/plain', compId);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => {
                          setTimeout(() => {
                            didDragRef.current = false;
                          }, 100);
                        }}
                        onClick={() => {
                          if (didDragRef.current) {
                            didDragRef.current = false;
                            return;
                          }
                          addComponent(compId);
                        }}
                        className={`group flex items-center gap-2.5 p-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition ${
                          isDark
                            ? 'bg-slate-800/60 hover:bg-slate-800 border-transparent hover:border-slate-700'
                            : 'bg-white hover:bg-sky-50 hover:border-sky-300 border-slate-200/90 shadow-sm'
                        }`}
                        title="Click to place, or drag directly onto canvas"
                      >
                        <ComponentThumbnail definition={comp as any} theme={theme} />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-xs font-semibold truncate ${
                              isDark
                                ? 'text-slate-200 group-hover:text-sky-300'
                                : 'text-slate-800 group-hover:text-sky-600'
                            }`}
                          >
                            {comp.name}
                          </div>
                          <div
                            className={`text-[10px] truncate leading-snug ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {comp.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredComponents.length === 0 && (
          <div
            className={`text-center py-8 text-xs ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            No components matched &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div
        className={`p-2 border-t text-[10px] text-center ${
          isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
        }`}
      >
        Click to place, or drag items directly onto canvas
      </div>
    </aside>
  );
};
