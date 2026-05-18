import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as math from 'mathjs';
import { Plus, Trash2, Check, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const Plot = ({ data, layout, config, style }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const Plotly = (window as any).Plotly;
    if (!Plotly) {
      console.warn("Plotly is not loaded yet.");
      return;
    }

    Plotly.newPlot(containerRef.current, data, layout, config);

    const handleResize = () => {
      if (containerRef.current && Plotly) {
        Plotly.Plots.resize(containerRef.current);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && Plotly) {
        Plotly.purge(containerRef.current);
      }
    };
  }, [data, layout, config]);

  return <div ref={containerRef} style={style} />;
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
  onInsert: (elements: any[]) => void;
}

const COLORS = ['#818cf8', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export const GraphFullscreen: React.FC<GraphFullscreenProps> = ({ onClose, onInsert }) => {
  const [functions, setFunctions] = useState<FunctionItem[]>([
    { id: '1', expression: 'x^2', color: '#818cf8', visible: true, type: '2d' }
  ]);
  const [is3D, setIs3D] = useState(false);

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

  const plotData = useMemo(() => {
    const data: any[] = [];
    
    functions.filter(f => f.visible && f.expression).forEach(f => {
      try {
        let exprRaw = f.expression.toLowerCase().replace(/\s+/g, '');
        
        // --- 2D GRAPHING ---
        if (!is3D) {
          if (exprRaw.startsWith('r=')) {
            // Polar
            const expr = exprRaw.slice(2);
            const node = math.parse(expr);
            const compiled = node.compile();
            const theta: number[] = [];
            const r: number[] = [];
            for (let t = 0; t <= Math.PI * 4; t += 0.05) {
              theta.push(t);
              r.push(compiled.evaluate({ theta: t, t: t }));
            }
            // Convert to cartesian for plotting
            const x = r.map((rad, i) => rad * Math.cos(theta[i]));
            const y = r.map((rad, i) => rad * Math.sin(theta[i]));
            data.push({ x, y, type: 'scatter', mode: 'lines', line: { color: f.color, width: 3 }, name: f.expression });
          } else {
            // Y(x) explicitly
            if (exprRaw.includes('y=')) exprRaw = exprRaw.split('y=')[1];
            else if (exprRaw.includes('f(x)=')) exprRaw = exprRaw.split('f(x)=')[1];
            
            const node = math.parse(exprRaw);
            const compiled = node.compile();
            const x = [];
            const y = [];
            for (let i = -20; i <= 20; i += 0.2) {
              x.push(i);
              y.push(compiled.evaluate({ x: i }));
            }
            data.push({ x, y, type: 'scatter', mode: 'lines', line: { color: f.color, width: 3 }, name: f.expression });
          }
        } 
        // --- 3D GRAPHING ---
        else {
          // Explicit z = f(x, y)
          if (exprRaw.includes('z=')) exprRaw = exprRaw.split('z=')[1];
          else if (exprRaw.includes('f(x,y)=')) exprRaw = exprRaw.split('f(x,y)=')[1];

          const node = math.parse(exprRaw);
          const compiled = node.compile();

          const x = [];
          const y = [];
          const z = [];
          const steps = 40;
          const range = 10;
          for (let i = -range; i <= range; i += (range * 2) / steps) {
            x.push(i);
            y.push(i);
          }
          
          for (let i = 0; i < y.length; i++) {
            const zRow = [];
            for (let j = 0; j < x.length; j++) {
              try {
                const val = compiled.evaluate({ x: x[j], y: y[i] });
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

  const handleInsert = () => {
    // Basic mapping of 2D data to strokes for the whiteboard
    if (is3D) {
      alert("La inserción de gráficos 3D en la pizarra 2D aún no está soportada. Por favor toma una captura de pantalla.");
      return;
    }

    const elementsToInsert = plotData.filter(d => d.x && d.x.length > 0).map(d => {
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
    }).filter(e => e !== null);
    
    onInsert(elementsToInsert as any[]);
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
          <button onClick={handleInsert} disabled={is3D} style={{ background: is3D ? 'rgba(255,255,255,0.1)' : '#4f46e5', color: is3D ? 'rgba(255,255,255,0.4)' : '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, cursor: is3D ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: is3D ? 'none' : '0 4px 15px rgba(79, 70, 229, 0.4)' }}>
            <Check size={20}/> Insertar en Pizarra
          </button>
        </div>
      </div>

      {/* Main Graph Area with Plotly */}
      <div className="graph-main">
        <Plot
          data={plotData}
          useResizeHandler={true}
          layout={{
            autosize: true,
            paper_bgcolor: '#0a0a0c',
            plot_bgcolor: '#0a0a0c',
            margin: { l: 0, r: 0, t: 0, b: 0 },
            showlegend: false,
            scene: is3D ? {
              xaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#818cf8' },
              yaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#f43f5e' },
              zaxis: { color: '#fff', gridcolor: '#333', zerolinecolor: '#10b981' },
              camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
            } : undefined,
            xaxis: !is3D ? { color: '#fff', gridcolor: '#333', zerolinecolor: '#818cf8', scaleanchor: 'y', scaleratio: 1 } : undefined,
            yaxis: !is3D ? { color: '#fff', gridcolor: '#333', zerolinecolor: '#f43f5e' } : undefined,
          }}
          config={{ displayModeBar: true, responsive: true }}
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* Help tooltip */}
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: 30, color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', pointerEvents: 'none' }}>
          {is3D ? 'Arrastra para rotar • Scroll para zoom 3D' : 'Arrastra para mover • Scroll para zoom 2D'}
        </div>
      </div>
    </div>
  );
};
