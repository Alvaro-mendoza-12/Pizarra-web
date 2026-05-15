import React, { useState } from 'react';
import {
  MousePointer2, Pen, Eraser, Square, Circle as CircleIcon,
  Minus, Type, Download, Upload, Undo2, Redo2, Hand, Trash2,
  ZoomIn, ZoomOut, RotateCcw, Grid, Sigma, ArrowUpRight, Plus, Activity
} from 'lucide-react';
import type { Tool } from '../types';

const COLORS = [
  '#ffffff', '#000000', '#f87171', '#fb923c',
  '#facc15', '#4ade80', '#2dd4bf', '#60a5fa',
  '#a78bfa', '#f472b6'
];
const STROKE_WIDTHS = [2, 5, 8, 14, 22];
const FONT_SIZES = [16, 22, 30, 42];

const MATH_FORMULAS = [
  { label: 'Circunferencia', value: '(x - h)² + (y - k)² = r²' },
  { label: 'Elipse', value: 'x²/a² + y²/b² = 1' },
  { label: 'Hipérbola', value: 'x²/a² - y²/b² = 1' },
  { label: 'Parábola', value: 'y = a(x - h)² + k' },
  { label: 'Esfera', value: 'x² + y² + z² = r²' },
  { label: 'Cilíndro', value: 'x² + y² = r²' },
  { label: 'Elipsoide', value: 'x²/a² + y²/b² + z²/c² = 1' },
  { label: 'Paraboloide Elíptico', value: 'z = x²/a² + y²/b²' },
  { label: 'Paraboloide Hiperbólico', value: 'z = y²/b² - x²/a²' },
  { label: 'Hiperboloide 1 hoja', value: 'x²/a² + y²/b² - z²/c² = 1' },
  { label: 'Hiperboloide 2 hojas', value: 'z²/c² - x²/a² - y²/b² = 1' },
  { label: 'Cono Elíptico', value: 'z²/c² = x²/a² + y²/b²' },
  { label: 'Polares (x, y)', value: 'x = r cos(θ), y = r sin(θ)' },
  { label: 'Polares: Caracol', value: 'r = a ± b cos(θ)' },
  { label: 'Polares: Rosa', value: 'r = a cos(nθ)' },
  { label: 'Polares: Espiral', value: 'r = a + bθ' },
];

interface ToolbarProps {
  tool: Tool;
  color: string;
  strokeWidth: number;
  fontSize: number;
  showGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  onTool: (t: Tool) => void;
  onColor: (c: string) => void;
  onStroke: (w: number) => void;
  onFontSize: (s: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDeleteSelected: () => void;
  onToggleGrid: () => void;
  onInsertFormula: (formula: string) => void;
  onOpenGraphModal: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = (p) => {
  const [showMath, setShowMath] = useState(false);

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <button className={`toolbar-btn ${active ? 'active' : ''}`} onClick={onClick} title={title}>
      {icon}
    </button>
  );

  return (
    <>
      {/* Top bar */}
      <div className="glass-panel" style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: 6, padding: '8px 14px', alignItems: 'center'
      }}>
        {btn(false, p.onUndo, <Undo2 size={18} />, 'Deshacer (Ctrl+Z)')}
        {btn(false, p.onRedo, <Redo2 size={18} />, 'Rehacer (Ctrl+Y)')}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        {btn(false, p.onZoomOut, <ZoomOut size={18} />, 'Alejar (-)')}
        {btn(false, p.onZoomReset, <RotateCcw size={16} />, 'Restablecer zoom')}
        {btn(false, p.onZoomIn, <ZoomIn size={18} />, 'Acercar (+)')}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        {btn(p.showGrid, p.onToggleGrid, <Grid size={18} />, 'Cuadrícula (G)')}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        {p.selectedCount > 1 && (
          <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>{p.selectedCount} seleccionados</span>
        )}
        {p.selectedCount > 0 && (
          <button className="toolbar-btn" onClick={p.onDeleteSelected} title="Eliminar selección (Del)">
            <Trash2 size={18} color="#f87171" />
          </button>
        )}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
        <button className="toolbar-btn" onClick={p.onClear} title="Limpiar pizarra">
          <Trash2 size={18} color="#f87171" />
        </button>
        <button className="toolbar-btn" onClick={p.onExport} title="Exportar PNG">
          <Download size={18} />
        </button>
        <label className="toolbar-btn" title="Importar imagen" style={{ cursor: 'pointer' }}>
          <Upload size={18} />
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={p.onImport} />
        </label>
      </div>

      {/* Barra Izquierda */}
      <div className="glass-panel" style={{
        position: 'absolute', top: '50%', left: 20, transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8, padding: 12, zIndex: 100,
        maxHeight: '90vh', overflowY: 'auto', scrollbarWidth: 'none'
      }}>
        <style>{`.glass-panel::-webkit-scrollbar { display: none; }`}</style>
        {btn(p.tool === 'select', () => p.onTool('select'), <MousePointer2 size={20} />, 'Seleccionar (V)')}
        {btn(p.tool === 'pan', () => p.onTool('pan'), <Hand size={20} />, 'Mover lienzo (Space)')}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 0' }} />
        {btn(p.tool === 'pen', () => p.onTool('pen'), <Pen size={20} />, 'Lápiz (P)')}
        {btn(p.tool === 'eraser', () => p.onTool('eraser'), <Eraser size={20} />, 'Borrador (E)')}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 0' }} />
        {btn(p.tool === 'rect', () => p.onTool('rect'), <Square size={20} />, 'Rectángulo (R)')}
        {btn(p.tool === 'circle', () => p.onTool('circle'), <CircleIcon size={20} />, 'Círculo (C)')}
        {btn(p.tool === 'line', () => p.onTool('line'), <Minus size={20} />, 'Línea (L)')}
        {btn(p.tool === 'arrow', () => p.onTool('arrow'), <ArrowUpRight size={20} />, 'Flecha')}
        {btn(p.tool === 'axis', () => p.onTool('axis'), <Plus size={20} />, 'Ejes Cartesianos')}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '2px 0' }} />
        {btn(p.tool === 'text', () => p.onTool('text'), <Type size={20} />, 'Texto (T)')}
        {btn(false, () => p.onOpenGraphModal(), <Activity size={20} />, 'Graficador Matemático')}
        <div style={{ position: 'relative' }}>
          {btn(showMath, () => setShowMath(!showMath), <Sigma size={20} />, 'Fórmulas Matemáticas')}
          {showMath && (
            <div className="glass-panel" style={{
              position: 'fixed', // Fixed to avoid clipping by sidebar overflow
              bottom: 'auto', 
              top: '50%',
              left: 75, // Next to the sidebar
              transform: 'translateY(-50%)',
              width: 220, padding: 8, display: 'flex', flexDirection: 'column', gap: 4,
              maxHeight: 400, overflowY: 'auto', zIndex: 1000
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, padding: '4px 8px', textTransform: 'uppercase' }}>
                Fórmulas
              </div>
              {MATH_FORMULAS.map(f => (
                <button 
                  key={f.label}
                  className="toolbar-btn" 
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', height: 'auto', textAlign: 'left', borderRadius: 6 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onInsertFormula(f.value);
                    setShowMath(false);
                    p.onTool('select');
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{f.label}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontFamily: 'monospace' }}>{f.value}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right properties panel */}
      <div className="glass-panel" style={{
        position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', gap: 16, padding: '18px 14px', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Color</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {COLORS.map(c => (
              <div key={c} className={`color-btn ${p.color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }} onClick={() => p.onColor(c)} />
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.12)' }} />

        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Grosor</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STROKE_WIDTHS.map(w => (
              <div key={w} style={{
                height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', background: p.strokeWidth === w ? 'rgba(99,102,241,0.25)' : 'transparent',
                borderRadius: 6, border: p.strokeWidth === w ? '1px solid rgba(99,102,241,0.8)' : '1px solid transparent'
              }} onClick={() => p.onStroke(w)}>
                <div style={{ width: '75%', height: w, backgroundColor: p.strokeWidth === w ? p.color : '#fff', borderRadius: w }} />
              </div>
            ))}
          </div>
        </div>

        {p.tool === 'text' && (
          <>
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Tamaño</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FONT_SIZES.map(s => (
                  <div key={s} style={{
                    height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', background: p.fontSize === s ? 'rgba(99,102,241,0.25)' : 'transparent',
                    borderRadius: 6, border: p.fontSize === s ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                    fontSize: 13, fontWeight: 600, color: p.fontSize === s ? '#818cf8' : 'rgba(255,255,255,0.7)'
                  }} onClick={() => p.onFontSize(s)}>
                    {s}px
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none',
        fontFamily: 'Inter, sans-serif', letterSpacing: 0.5
      }}>
        V·Select &nbsp;|&nbsp; P·Lápiz &nbsp;|&nbsp; E·Borrador &nbsp;|&nbsp; R·Rect &nbsp;|&nbsp; C·Círculo &nbsp;|&nbsp; L·Línea &nbsp;|&nbsp; T·Texto &nbsp;|&nbsp; G·Grid &nbsp;|&nbsp; Scroll·Zoom &nbsp;|&nbsp; Ctrl+Z·Deshacer
      </div>
    </>
  );
};
