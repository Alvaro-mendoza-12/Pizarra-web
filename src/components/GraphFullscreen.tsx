import React, { useState, useMemo, useRef, useEffect } from 'react';
import { parse } from 'mathjs/number';
import { Plus, Trash2, Check, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { BoardElement } from '../types';

interface LinePlotTrace {
  x: number[];
  y: number[];
  type: 'scatter';
  mode: 'lines';
  line: { color: string; width: number };
  name: string;
}

interface SurfacePlotTrace {
  x: number[];
  y: number[];
  z: number[][];
  type: 'surface';
  colorscale: [[number, string], [number, string]];
  opacity: number;
  showscale: false;
  name: string;
}

type PlotTrace = LinePlotTrace | SurfacePlotTrace;
type PlotLayout = Record<string, unknown>;
type PlotConfig = Record<string, unknown>;

interface RenderedAxis {
  range?: [number, number];
}

interface RenderedLayout {
  xaxis?: RenderedAxis;
  yaxis?: RenderedAxis;
}

type PlotContainer = HTMLDivElement & { layout?: RenderedLayout };

interface PlotlyApi {
  newPlot: (target: HTMLElement, data: PlotTrace[], layout: PlotLayout, config: PlotConfig) => void;
  purge: (target: HTMLElement) => void;
  relayout: (target: HTMLElement, update: Record<string, unknown>) => void;
  toImage: (target: HTMLElement, options: { format: 'png'; width: number; height: number }) => Promise<string>;
  Plots: { resize: (target: HTMLElement) => void };
}

type PlotlyLoadState = 'loading' | 'ready' | 'error';

interface PlotProps {
  data: PlotTrace[];
  layout: PlotLayout;
  config: PlotConfig;
  style?: React.CSSProperties;
  plotly: PlotlyApi;
}

const PLOTLY_SRC = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
let plotlyPromise: Promise<PlotlyApi> | null = null;

function getPlotly() {
  return (window as Window & { Plotly?: PlotlyApi }).Plotly;
}

function getPlotContainer() {
  return document.querySelector<HTMLDivElement>('[data-plot-root]') as PlotContainer | null;
}

function loadPlotly() {
  const readyPlotly = getPlotly();
  if (readyPlotly) return Promise.resolve(readyPlotly);
  if (plotlyPromise) return plotlyPromise;

  plotlyPromise = new Promise<PlotlyApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${PLOTLY_SRC}"]`);
    const script = existingScript ?? document.createElement('script');

    const finish = () => {
      const plotly = getPlotly();
      if (plotly) {
        resolve(plotly);
      } else {
        plotlyPromise = null;
        reject(new Error('Plotly no quedó disponible al terminar de cargar.'));
      }
    };

    const fail = () => {
      plotlyPromise = null;
      script.remove();
      reject(new Error('No se pudo cargar Plotly.'));
    };

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });

    if (!existingScript) {
      script.src = PLOTLY_SRC;
      script.async = true;
      script.dataset.plotly = 'lazy';
      document.head.appendChild(script);
    }
  });

  return plotlyPromise;
}

const Plot = ({ data, layout, config, style, plotly }: PlotProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    plotly.newPlot(container, data, layout, config);

    const handleResize = () => {
      plotly.Plots.resize(container);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      plotly.purge(container);
    };
  }, [data, layout, config, plotly]);

  return <div ref={containerRef} data-plot-root style={style} />;
};

interface FunctionItem {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  type: '2d' | '3d';
}

interface GraphFullscreenProps {
  onClose: () => void;
  onInsert: (elements: BoardElement[]) => void;
  initialFormula: string | null;
  initialIs3D: boolean;
}

const COLORS = ['#818cf8', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

function createInitialFunctions(initialFormula: string | null, initialIs3D: boolean): FunctionItem[] {
  if (initialFormula) {
    return [{
      id: uuidv4(),
      expression: initialFormula,
      color: '#818cf8',
      visible: true,
      type: initialIs3D ? '3d' : '2d',
    }];
  }

  return [{ id: '1', expression: 'x^2', color: '#818cf8', visible: true, type: '2d' }];
}

export const GraphFullscreen: React.FC<GraphFullscreenProps> = ({ onClose, onInsert, initialFormula, initialIs3D }) => {
  const [functions, setFunctions] = useState<FunctionItem[]>(() => createInitialFunctions(initialFormula, initialIs3D));
  const [is3D, setIs3D] = useState(() => initialFormula ? initialIs3D : false);
  const [isInserting, setIsInserting] = useState(false);
  const [plotlyState, setPlotlyState] = useState<PlotlyLoadState>(() => getPlotly() ? 'ready' : 'loading');
  const [plotlyRetry, setPlotlyRetry] = useState(0);
  const [plotly, setPlotly] = useState<PlotlyApi | null>(() => getPlotly() ?? null);

  useEffect(() => {
    let mounted = true;

    loadPlotly()
      .then(api => {
        if (!mounted) return;
        setPlotly(api);
        setPlotlyState('ready');
      })
      .catch(error => {
        if (!mounted) return;
        console.warn('Plotly load error:', error);
        setPlotlyState('error');
      });

    return () => {
      mounted = false;
    };
  }, [plotlyRetry]);

  const addFunction = () => {
    setFunctions([...functions, { id: uuidv4(), expression: '', color: COLORS[functions.length % COLORS.length], visible: true, type: is3D ? '3d' : '2d' }]);
  };

  const removeFunction = (id: string) => {
    setFunctions(functions.filter(f => f.id !== id));
  };

  const updateFunction = (id: string, expression: string) => {
    setFunctions(functions.map(f => f.id === id ? { ...f, expression } : f));
  };

  const toggleVisibility = (id: string) => {
    setFunctions(functions.map(f => f.id === id ? { ...f, visible: !f.visible } : f));
  };

  const plotData = useMemo<PlotTrace[]>(() => {
    const data: PlotTrace[] = [];
    
    functions.filter(f => f.visible && f.expression).forEach(f => {
      try {
        let exprRaw = f.expression.toLowerCase().replace(/\s+/g, '');
        
        // --- 2D GRAPHING ---
        if (!is3D) {
          if (exprRaw.startsWith('r=')) {
            // Polar
            const expr = exprRaw.slice(2);
            const node = parse(expr);
            const compiled = node.compile();
            const theta: number[] = [];
            const r: number[] = [];
            for (let t = 0; t <= Math.PI * 4; t += 0.05) {
              theta.push(t);
              r.push(Number(compiled.evaluate({ theta: t, t: t })));
            }
            // Convert to cartesian for plotting
            const x = r.map((rad, i) => rad * Math.cos(theta[i]));
            const y = r.map((rad, i) => rad * Math.sin(theta[i]));
            data.push({ x, y, type: 'scatter', mode: 'lines', line: { color: f.color, width: 3 }, name: f.expression });
          } else {
            // Y(x) explicitly
            if (exprRaw.includes('y=')) exprRaw = exprRaw.split('y=')[1];
            else if (exprRaw.includes('f(x)=')) exprRaw = exprRaw.split('f(x)=')[1];
            
            const node = parse(exprRaw);
            const compiled = node.compile();
            const x: number[] = [];
            const y: number[] = [];
            for (let i = -20; i <= 20; i += 0.2) {
              x.push(i);
              y.push(Number(compiled.evaluate({ x: i })));
            }
            data.push({ x, y, type: 'scatter', mode: 'lines', line: { color: f.color, width: 3 }, name: f.expression });
          }
        } 
        // --- 3D GRAPHING ---
        else {
          // Explicit z = f(x, y)
          if (exprRaw.includes('z=')) exprRaw = exprRaw.split('z=')[1];
          else if (exprRaw.includes('f(x,y)=')) exprRaw = exprRaw.split('f(x,y)=')[1];

          const node = parse(exprRaw);
          const compiled = node.compile();

          const x: number[] = [];
          const y: number[] = [];
          const z: number[][] = [];
          const steps = 40;
          const range = 10;
          for (let i = -range; i <= range; i += (range * 2) / steps) {
            x.push(i);
            y.push(i);
          }
          
          for (let i = 0; i < y.length; i++) {
            const zRow: number[] = [];
            for (let j = 0; j < x.length; j++) {
              try {
                const val = Number(compiled.evaluate({ x: x[j], y: y[i] }));
                // Limit very large values to prevent plot distortion
                zRow.push(Math.max(-50, Math.min(50, val)));
              } catch {
                zRow.push(NaN);
              }
            }
            z.push(zRow);
          }

          data.push({
            x, y, z,
            type: 'surface',
            colorscale: [[0, f.color], [1, f.color]], // monochromatic surface matching the color
            opacity: 0.8,
            showscale: false,
            name: f.expression
          });
        }
      } catch (e) {
        console.warn('Math parse error:', e);
      }
    });

    return data;
  }, [functions, is3D]);

  const handleZoom2D = (factor: number) => {
    const Plotly = getPlotly();
    const div = getPlotContainer();
    if (!div || !Plotly) return;
    
    const layout = div.layout;
    if (!layout || !layout.xaxis || !layout.yaxis) return;
    
    const xRange = layout.xaxis.range;
    const yRange = layout.yaxis.range;
    if (!xRange || !yRange) return;
    
    const xCenter = (xRange[0] + xRange[1]) / 2;
    const yCenter = (yRange[0] + yRange[1]) / 2;
    const xSpan = (xRange[1] - xRange[0]) * factor;
    const ySpan = (yRange[1] - yRange[0]) * factor;
    
    Plotly.relayout(div, {
      'xaxis.range': [xCenter - xSpan / 2, xCenter + xSpan / 2],
      'yaxis.range': [yCenter - ySpan / 2, yCenter + ySpan / 2]
    });
  };

  const handleInsert = async () => {
    if (isInserting || plotData.length === 0) return;

    // Plotly can export the rendered 3D scene as a PNG snapshot for the board.
    if (is3D) {
      const Plotly = getPlotly();
      const div = getPlotContainer();
      if (!Plotly || !div) return;

      setIsInserting(true);
      try {
        const width = Math.min(920, Math.max(560, Math.round(window.innerWidth * 0.64)));
        const height = Math.round(width * 0.68);
        const src = await Plotly.toImage(div, { format: 'png', width, height });
        onInsert([{
          id: uuidv4(),
          type: 'image',
          src,
          x: window.innerWidth / 2 - width / 2,
          y: window.innerHeight / 2 - height / 2,
          width,
          height,
        }]);
      } finally {
        setIsInserting(false);
      }
      return;
    }

    const elementsToInsert = plotData
      .filter((trace): trace is LinePlotTrace => trace.type === 'scatter' && trace.x.length > 0)
      .map((d): BoardElement | null => {
      let minX = Infinity, minY = Infinity;
      const points = [];
      const scale = 20; // scale factor
      
      for(let i = 0; i < d.x.length; i++) {
        if (!isNaN(d.y[i]) && Math.abs(d.y[i]) < 1000) {
          const px = d.x[i] * scale;
          const py = -d.y[i] * scale; // invert Y for canvas
          points.push(px, py);
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
        }
      }
      
      if (points.length === 0) return null;

      const relativePoints = points.map((p, i) => i % 2 === 0 ? p - minX : p - minY);

      return {
        id: uuidv4(),
        type: 'pen',
        x: window.innerWidth / 2 + minX,
        y: window.innerHeight / 2 + minY,
        points: relativePoints,
        stroke: d.line?.color || '#fff',
        strokeWidth: 3
      };
      })
      .filter(e => e !== null);
    
    onInsert(elementsToInsert.filter((element): element is BoardElement => element !== null));
  };

  return (
    <div className="graph-container">
      {/* Sidebar */}
      <div className="graph-sidebar">
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}><ArrowLeft size={20}/></button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>GeoGebra Studio</span>
        </div>

        {/* Mode Toggle */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4 }}>
            <button 
              onClick={() => setIs3D(false)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: !is3D ? '#6366f1' : 'transparent', color: !is3D ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }}
            >
              Plano 2D
            </button>
            <button 
              onClick={() => setIs3D(true)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: is3D ? '#f43f5e' : 'transparent', color: is3D ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }}
            >
              Espacio 3D
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {functions.map(f => (
            <div key={f.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div 
                  onClick={() => toggleVisibility(f.id)} 
                  style={{ 
                    width: 22, height: 22, borderRadius: '50%', 
                    background: f.visible ? f.color : 'transparent', 
                    border: `2.5px solid ${f.color}`, 
                    cursor: 'pointer',
                    boxShadow: f.visible ? `0 0 10px ${f.color}44` : 'none'
                  }} 
                />
                <input 
                  value={f.expression}
                  onChange={(e) => updateFunction(f.id, e.target.value)}
                  placeholder={is3D ? "Ej: z = x^2 + y^2" : "Ej: y = sin(x)"}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 16, fontFamily: 'Fira Code, monospace' }}
                />
                <button onClick={() => removeFunction(f.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }}><Trash2 size={16}/></button>
              </div>
              
              {/* Color Palette */}
              <div style={{ display: 'flex', gap: 6, marginLeft: 34 }}>
                {COLORS.map(c => (
                  <div 
                    key={c} 
                    onClick={() => setFunctions(functions.map(fn => fn.id === f.id ? { ...fn, color: c } : fn))}
                    style={{ 
                      width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: f.color === c ? '2px solid white' : 'none',
                      opacity: f.color === c ? 1 : 0.4
                    }} 
                  />
                ))}
              </div>
            </div>
          ))}
          <button onClick={addFunction} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.3)', cursor: 'pointer', justifyContent: 'center', fontWeight: 600, marginTop: 8 }}>
            <Plus size={18}/> Nueva Función
          </button>
        </div>

        <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={handleInsert} disabled={isInserting || plotData.length === 0} style={{ background: isInserting || plotData.length === 0 ? 'rgba(255,255,255,0.1)' : '#4f46e5', color: isInserting || plotData.length === 0 ? 'rgba(255,255,255,0.4)' : '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, cursor: isInserting || plotData.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isInserting || plotData.length === 0 ? 'none' : '0 4px 15px rgba(79, 70, 229, 0.4)' }}>
            <Check size={20}/> {isInserting ? 'Insertando...' : is3D ? 'Insertar captura 3D' : 'Insertar en Pizarra'}
          </button>
        </div>
      </div>

      {/* Main Graph Area with Plotly */}
      <div className="graph-main">
        {plotly && plotlyState === 'ready' ? (
          <Plot
            data={plotData}
            plotly={plotly}
            layout={{
              autosize: true,
              paper_bgcolor: '#0a0a0c',
              plot_bgcolor: '#0a0a0c',
              margin: { l: 0, r: 0, t: 0, b: 0 },
              showlegend: false,
              ...(is3D ? {
                scene: {
                  xaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#818cf8' },
                  yaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#f43f5e' },
                  zaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#10b981' },
                  camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
                }
              } : {
                xaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#818cf8', scaleanchor: 'y', scaleratio: 1 },
                yaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#f43f5e' }
              })
            }}
            config={{ displayModeBar: true, responsive: true }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : plotlyState === 'error' ? (
          <div className="graph-loader">
            <span>No se pudo cargar el graficador.</span>
            <button onClick={() => {
              setPlotlyState('loading');
              setPlotlyRetry(value => value + 1);
            }}>Reintentar</button>
          </div>
        ) : (
          <div className="graph-loader">Cargando motor gráfico...</div>
        )}
        
        {/* Floating Zoom Controls for 2D */}
        {!is3D && (
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 8, zIndex: 10 }}>
            <button 
              onClick={() => handleZoom2D(0.7)} 
              title="Acercar Zoom"
              style={{
                background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, backdropFilter: 'blur(12px)', fontSize: 13,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(79, 70, 229, 0.85)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)'}
            >
              Zoom +
            </button>
            <button 
              onClick={() => handleZoom2D(1.4)} 
              title="Alejar Zoom"
              style={{
                background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                fontWeight: 600, backdropFilter: 'blur(12px)', fontSize: 13,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(79, 70, 229, 0.85)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)'}
            >
              Zoom -
            </button>
          </div>
        )}

        {/* Help tooltip */}
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: 30, color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', pointerEvents: 'none' }}>
          {is3D ? 'Arrastra para rotar • Scroll para zoom 3D' : 'Arrastra para mover • Zoom + y - para ajustar • Scroll para zoom'}
        </div>
      </div>
    </div>
  );
};
