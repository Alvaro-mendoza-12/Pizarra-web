import React, { useState } from 'react';
import {
  MousePointer2, Pen, Eraser, Square, Circle as CircleIcon,
  Minus, Type, Download, Upload, Undo2, Redo2, Hand, Trash2,
  ZoomIn, ZoomOut, RotateCcw, Grid, Sigma, ArrowUpRight,
  Plus, Activity, Highlighter, StickyNote, Triangle,
  Share2, Save, FolderOpen
} from 'lucide-react';
import type { Tool } from '../types';
import { useBoardStore } from '../store/boardStore';

const COLORS = [
  '#ffffff', '#f1f5f9',
  '#f43f5e', '#fb923c', '#f59e0b',
  '#84cc16', '#10b981', '#06b6d4',
  '#6366f1', '#a855f7', '#ec4899',
  '#000000'
];

const STROKE_WIDTHS = [1, 2, 4, 8, 16, 24];
const FONT_SIZES = [14, 18, 22, 30, 42, 60];

const TOOL_GROUPS = [
  {
    label: 'Navegación',
    tools: [
      { tool: 'select' as Tool, icon: MousePointer2, label: 'Seleccionar', shortcut: 'V' },
      { tool: 'pan' as Tool, icon: Hand, label: 'Mover lienzo', shortcut: 'Space' },
    ]
  },
  {
    label: 'Dibujo',
    tools: [
      { tool: 'pen' as Tool, icon: Pen, label: 'Lápiz', shortcut: 'P' },
      { tool: 'highlighter' as Tool, icon: Highlighter, label: 'Marcador', shortcut: 'H' },
      { tool: 'eraser' as Tool, icon: Eraser, label: 'Borrador', shortcut: 'E' },
    ]
  },
  {
    label: 'Formas',
    tools: [
      { tool: 'rect' as Tool, icon: Square, label: 'Rectángulo', shortcut: 'R' },
      { tool: 'circle' as Tool, icon: CircleIcon, label: 'Círculo', shortcut: 'C' },
      { tool: 'triangle' as Tool, icon: Triangle, label: 'Triángulo' },
      { tool: 'line' as Tool, icon: Minus, label: 'Línea', shortcut: 'L' },
      { tool: 'arrow' as Tool, icon: ArrowUpRight, label: 'Flecha' },
      { tool: 'axis' as Tool, icon: Plus, label: 'Ejes Cartesianos' },
    ]
  },
  {
    label: 'Contenido',
    tools: [
      { tool: 'text' as Tool, icon: Type, label: 'Texto', shortcut: 'T' },
      { tool: 'sticky' as Tool, icon: StickyNote, label: 'Nota adhesiva', shortcut: 'N' },
    ]
  },
  {
    label: 'Matemáticas',
    tools: [
      { tool: 'graph' as Tool, icon: Activity, label: 'Graficador' },
    ]
  },
];

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDeleteSelected: () => void;
  onInsertFormula: () => void;
  onOpenGraphModal: () => void;
  onShare: () => void;
  onSave: () => void;
  onLoad: () => void;
  selectedCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = (p) => {
  const { tool, color, strokeWidth, fontSize, showGrid, setTool, setColor, setStrokeWidth, setFontSize, setShowGrid, peers, roomId } = useBoardStore();
  const [showMathMenu, setShowMathMenu] = useState(false);

  const MATH_FORMULAS = [
    { label: 'Circunferencia', value: '(x - h)² + (y - k)² = r²', group: '2D' },
    { label: 'Elipse', value: 'x²/a² + y²/b² = 1', group: '2D' },
    { label: 'Hipérbola H', value: 'x²/a² - y²/b² = 1', group: '2D' },
    { label: 'Hipérbola V', value: 'y²/a² - x²/b² = 1', group: '2D' },
    { label: 'Parábola', value: 'y = a(x - h)² + k', group: '2D' },
    { label: 'Polares: Caracol', value: 'r = a ± b·cos(θ)', group: 'Polar' },
    { label: 'Polares: Rosa', value: 'r = a·cos(nθ)', group: 'Polar' },
    { label: 'Polares: Espiral', value: 'r = a + b·θ', group: 'Polar' },
    { label: 'Polares: Lemniscata', value: 'r² = a²·cos(2θ)', group: 'Polar' },
    { label: 'Esfera', value: 'x² + y² + z² = r²', group: '3D' },
    { label: 'Cilindro', value: 'x² + y² = r²', group: '3D' },
    { label: 'Elipsoide', value: 'x²/a² + y²/b² + z²/c² = 1', group: '3D' },
    { label: 'Paraboloide E.', value: 'z = x²/a² + y²/b²', group: '3D' },
    { label: 'Paraboloide H.', value: 'z = y²/b² - x²/a²', group: '3D' },
    { label: 'Hiperboloide 1H', value: 'x²/a² + y²/b² - z²/c² = 1', group: '3D' },
    { label: 'Hiperboloide 2H', value: 'z²/c² - x²/a² - y²/b² = 1', group: '3D' },
    { label: 'Cono Elíptico', value: 'z²/c² = x²/a² + y²/b²', group: '3D' },
  ];

  const groups: Record<string, typeof MATH_FORMULAS> = {};
  MATH_FORMULAS.forEach(f => {
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  });

  return (
    <>
      {/* ── Top Bar ──────────────────────────────────────── */}
      <div className="glass-panel" style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, display: 'flex', gap: 4, padding: '8px 12px',
        alignItems: 'center', animation: 'slideInLeft 0.3s ease'
      }}>
        {/* Logo */}
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginRight: 6, flexShrink: 0, boxShadow: '0 2px 8px rgba(99,102,241,0.4)'
        }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>P</span>
        </div>

        <div className="toolbar-sep-v" />

        <button className={`toolbar-btn ${!p.canUndo ? '' : ''}`} onClick={p.onUndo} title="Deshacer (Ctrl+Z)"
          style={{ opacity: p.canUndo ? 1 : 0.35 }}>
          <Undo2 size={17} />
        </button>
        <button className="toolbar-btn" onClick={p.onRedo} title="Rehacer (Ctrl+Y)"
          style={{ opacity: p.canRedo ? 1 : 0.35 }}>
          <Redo2 size={17} />
        </button>

        <div className="toolbar-sep-v" />

        <button className="toolbar-btn" onClick={p.onZoomOut} title="Alejar (-)"><ZoomOut size={17} /></button>
        <button className="toolbar-btn" onClick={p.onZoomReset} title="Restablecer zoom"><RotateCcw size={15} /></button>
        <button className="toolbar-btn" onClick={p.onZoomIn} title="Acercar (+)"><ZoomIn size={17} /></button>

        <div className="toolbar-sep-v" />

        <button className={`toolbar-btn ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(!showGrid)} title="Cuadrícula (G)">
          <Grid size={17} />
        </button>

        <div className="toolbar-sep-v" />

        <button className="toolbar-btn" onClick={p.onSave} title="Guardar board (Ctrl+S)"><Save size={17} /></button>
        <button className="toolbar-btn" onClick={p.onLoad} title="Abrir board"><FolderOpen size={17} /></button>
        <button className="toolbar-btn" onClick={p.onExport} title="Exportar PNG"><Download size={17} /></button>
        <label className="toolbar-btn" title="Importar imagen" style={{ cursor: 'pointer' }}>
          <Upload size={17} />
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={p.onImport} />
        </label>

        <div className="toolbar-sep-v" />

        {/* Collaboration indicator */}
        {roomId ? (
          <button
            onClick={p.onShare}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 8, color: '#34d399', cursor: 'pointer', fontSize: 12, fontWeight: 600
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
            {peers.length + 1} en sala
            {peers.length > 0 && (
              <div style={{ display: 'flex', marginLeft: 2 }}>
                {peers.slice(0, 3).map(peer => (
                  <div key={peer.id} title={peer.name} style={{
                    width: 18, height: 18, borderRadius: '50%', background: peer.color,
                    border: '2px solid var(--bg-panel)', marginLeft: -6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#fff'
                  }}>
                    {peer.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </button>
        ) : (
          <button className="btn-primary" onClick={p.onShare} style={{ padding: '6px 14px', fontSize: 13 }}>
            <Share2 size={15} />
            Compartir
          </button>
        )}

        {/* Selected actions */}
        {p.selectedCount > 0 && (
          <>
            <div className="toolbar-sep-v" />
            <span className="badge badge-accent">{p.selectedCount} sel.</span>
            <button className="toolbar-btn danger" onClick={p.onDeleteSelected} title="Eliminar (Del)">
              <Trash2 size={16} color="var(--danger)" />
            </button>
          </>
        )}
      </div>

      {/* ── Left Tools Sidebar ────────────────────────────── */}
      <div className="glass-panel" style={{
        position: 'fixed', top: '50%', left: 16, transform: 'translateY(-50%)',
        zIndex: 100, display: 'flex', flexDirection: 'column', gap: 2,
        padding: 8, maxHeight: '88vh', overflowY: 'auto', scrollbarWidth: 'none',
        animation: 'slideInLeft 0.3s ease'
      }}>
        {TOOL_GROUPS.map((group, gi) => (
          <React.Fragment key={group.label}>
            {gi > 0 && <div className="toolbar-sep-h" />}
            {group.tools.map(({ tool: t, icon: Icon, label, shortcut }) => (
              <button
                key={t}
                className={`toolbar-btn ${tool === t ? 'active' : ''}`}
                onClick={() => {
                  if (t === 'graph') p.onOpenGraphModal();
                  else setTool(t);
                }}
                title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
              >
                <Icon size={19} />
              </button>
            ))}
          </React.Fragment>
        ))}

        <div className="toolbar-sep-h" />

        {/* Formulas */}
        <button
          className="toolbar-btn"
          onClick={() => setShowMathMenu(v => !v)}
          title="Fórmulas matemáticas"
        >
          <Sigma size={19} />
        </button>

        <div className="toolbar-sep-h" />

        <button className="toolbar-btn danger" onClick={p.onClear} title="Limpiar pizarra">
          <Trash2 size={18} />
        </button>
      </div>

      {/* ── Right Properties Panel ────────────────────────── */}
      <div className="glass-panel" style={{
        position: 'fixed', top: '50%', right: 16, transform: 'translateY(-50%)',
        zIndex: 100, display: 'flex', flexDirection: 'column', gap: 16,
        padding: '16px 14px', alignItems: 'center', minWidth: 68
      }}>
        {/* Color picker */}
        <div style={{ width: '100%' }}>
          <div className="panel-label">Color</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {COLORS.map(c => (
              <div
                key={c}
                className={`color-btn ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c, outline: c === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : 'none' }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
          {/* Custom color */}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              title="Color personalizado"
              style={{
                width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer',
                background: 'none', padding: 0, outline: '1px solid var(--border)'
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Fira Code, monospace' }}>
              {color.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="toolbar-sep-h" />

        {/* Stroke width */}
        <div style={{ width: '100%' }}>
          <div className="panel-label">Grosor</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STROKE_WIDTHS.map(w => (
              <div
                key={w}
                className={`stroke-option ${strokeWidth === w ? 'active' : ''}`}
                onClick={() => setStrokeWidth(w)}
              >
                <div style={{
                  width: '85%', height: Math.min(w, 14),
                  backgroundColor: strokeWidth === w ? color : 'rgba(255,255,255,0.5)',
                  borderRadius: w, transition: 'all 0.15s'
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Font size - only for text/sticky */}
        {(tool === 'text' || tool === 'sticky') && (
          <>
            <div className="toolbar-sep-h" />
            <div style={{ width: '100%' }}>
              <div className="panel-label">Tamaño</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {FONT_SIZES.map(s => (
                  <div
                    key={s}
                    className={`stroke-option ${fontSize === s ? 'active' : ''}`}
                    onClick={() => setFontSize(s)}
                    style={{ fontSize: 11, fontWeight: 600, color: fontSize === s ? 'var(--accent-light)' : 'var(--text-secondary)' }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Math Formulas Panel ───────────────────────────── */}
      {showMathMenu && (
        <div className="glass-panel" style={{
          position: 'fixed', left: 76, top: '50%', transform: 'translateY(-50%)',
          width: 280, padding: 14, zIndex: 200,
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: '82vh', overflowY: 'auto',
          animation: 'slideInLeft 0.2s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.3 }}>Fórmulas Matemáticas</span>
            <button onClick={() => setShowMathMenu(false)} className="toolbar-btn" style={{ width: 28, height: 28 }}>✕</button>
          </div>
          {Object.entries(groups).map(([groupName, formulas]) => (
            <div key={groupName}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 4 }}>
                {groupName}
              </div>
              {formulas.map(f => (
                <button
                  key={f.label}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                    borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onClick={() => { p.onInsertFormula(); setShowMathMenu(false); }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Fira Code, monospace' }}>{f.value}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Keyboard Hints ────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, fontSize: 11, color: 'var(--text-muted)',
        pointerEvents: 'none', letterSpacing: 0.3, whiteSpace: 'nowrap'
      }}>
        V · P · H · E · R · C · T · N · L · G&nbsp; | &nbsp;Scroll: zoom&nbsp; | &nbsp;Space: mover&nbsp; | &nbsp;Ctrl+Z: deshacer
      </div>
    </>
  );
};
