import React, { useState, useMemo } from 'react';
import { Stage, Layer, Line, Text, Group } from 'react-konva';
import { Plus, Trash2, Check, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface FunctionItem {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
}

interface GraphFullscreenProps {
  onClose: () => void;
  onInsert: (elements: any[]) => void;
}

export const GraphFullscreen: React.FC<GraphFullscreenProps> = ({ onClose, onInsert }) => {
  const [functions, setFunctions] = useState<FunctionItem[]>([
    { id: '1', expression: 'x^2 + y^2 = 25', color: '#818cf8', visible: true }
  ]);
  const [viewport, setViewport] = useState({ x: window.innerWidth / 2 + 100, y: window.innerHeight / 2, scale: 40 });
  const [is3D, setIs3D] = useState(false);

  const addFunction = () => {
    setFunctions([...functions, { id: uuidv4(), expression: '', color: '#' + Math.floor(Math.random()*16777215).toString(16), visible: true }]);
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
    return functions.filter(f => f.visible && f.expression).map(f => {
      const pts: number[] = [];
      const exprRaw = f.expression.toLowerCase().replace(/^(f\(x\)|y)\s*=\s*/, '');
      
      const prepareExpr = (raw: string) => raw
        .replace(/\^/g, '**')
        .replace(/(\d)([a-z\(])/g, '$1*$2')
        .replace(/([a-z\)])(\d)/g, '$1*$2')
        .replace(/([a-z\)])([a-z\(])/g, '$1*$2')
        .replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt').replace(/pow/g, 'Math.pow').replace(/pi/g, 'Math.PI')
        .replace(/abs/g, 'Math.abs').replace(/exp/g, 'Math.exp').replace(/log/g, 'Math.log');

      try {
        if (exprRaw.includes('=') && !exprRaw.startsWith('r=')) {
          // Implicit equation (e.g., x^2 + y^2 = 25)
          const [leftSide, rightSide] = exprRaw.split('=').map(prepareExpr);
          const evalFn = new Function('x', 'y', `return (${leftSide}) - (${rightSide})`);
          
          const step = 0.15;
          const range = 15;
          for (let x = -range; x <= range; x += step) {
            for (let y = -range; y <= range; y += step) {
              const val = evalFn(x, y);
              if (Math.abs(val) < 0.4) {
                pts.push(x * viewport.scale, -y * viewport.scale);
              }
            }
          }
        } else if (exprRaw.startsWith('r=')) {
          const expr = prepareExpr(exprRaw.slice(2));
          const evalFn = new Function('t', `return ${expr}`);
          for (let t = 0; t <= Math.PI * 4; t += 0.02) {
            const r = evalFn(t);
            if (!isNaN(r)) pts.push(r * Math.cos(t) * viewport.scale, -r * Math.sin(t) * viewport.scale);
          }
        } else if (exprRaw.includes(',')) {
          const parts = exprRaw.split(',').map(prepareExpr);
          const evalX = new Function('t', `return ${parts[0]}`);
          const evalY = new Function('t', `return ${parts[1]}`);
          for (let t = -10; t <= 10; t += 0.02) {
            const x = evalX(t); const y = evalY(t);
            if (!isNaN(x) && !isNaN(y)) pts.push(x * viewport.scale, -y * viewport.scale);
          }
        } else {
          const expr = prepareExpr(exprRaw);
          const evalFn = new Function('x', `return ${expr}`);
          for (let x = -50; x <= 50; x += 0.05) {
            const y = evalFn(x);
            if (!isNaN(y) && Math.abs(y) < 1000) pts.push(x * viewport.scale, -y * viewport.scale);
          }
        }
      } catch (e) { console.error(e); }
      return { id: f.id, points: pts, color: f.color };
    });
  }, [functions, viewport.scale]);

  const handleInsert = () => {
    const elementsToInsert = plotData.filter(d => d.points.length > 0).map(d => {
      let minX = Infinity, minY = Infinity;
      for(let i=0; i<d.points.length; i+=2) {
        minX = Math.min(minX, d.points[i]);
        minY = Math.min(minY, d.points[i+1]);
      }
      
      if (minX === Infinity) return null;

      const relativePoints = d.points.map((p, i) => i % 2 === 0 ? p - minX : p - minY);

      return {
        id: uuidv4(),
        type: 'pen',
        x: minX,
        y: minY,
        points: relativePoints,
        stroke: d.color,
        strokeWidth: 3
      };
    }).filter(e => e !== null);
    onInsert(elementsToInsert as any[]);
  };

  const gridLines = useMemo(() => {
    const lines = [];
    const step = viewport.scale;
    
    // Grid density
    const subStep = step / 5;
    for (let x = -100; x <= 100; x++) {
      const px = x * subStep;
      if (Math.abs(px) < 2000) {
        lines.push(<Line key={`vs${x}`} points={[px, -2000, px, 2000]} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />);
      }
    }
    for (let y = -100; y <= 100; y++) {
      const py = y * subStep;
      if (Math.abs(py) < 2000) {
        lines.push(<Line key={`hs${y}`} points={[-2000, py, 2000, py]} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />);
      }
    }

    // Vertical Main
    for (let x = -50; x <= 50; x++) {
      const px = x * step;
      lines.push(<Line key={`v${x}`} points={[px, -2000, px, 2000]} stroke={x === 0 ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'} strokeWidth={x === 0 ? 2 : 1} />);
      if (x !== 0) lines.push(<Text key={`tx${x}`} text={String(x)} x={px - 5} y={5} fill="rgba(255,255,255,0.4)" fontSize={11} fontWeight="bold" />);
    }
    // Horizontal Main
    for (let y = -50; y <= 50; y++) {
      const py = y * step;
      lines.push(<Line key={`h${y}`} points={[-2000, py, 2000, py]} stroke={y === 0 ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'} strokeWidth={y === 0 ? 2 : 1} />);
      if (y !== 0) lines.push(<Text key={`ty${y}`} text={String(-y)} x={5} y={py - 5} fill="rgba(255,255,255,0.4)" fontSize={11} fontWeight="bold" />);
    }
    return lines;
  }, [viewport.scale]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a0a0c', display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 350, borderRight: '1px solid rgba(255,255,255,0.1)', background: '#121218', display: 'flex', flexDirection: 'column', boxShadow: '10px 0 30px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex' }}><ArrowLeft size={20}/></button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>GeoGebra Math</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {functions.map(f => (
            <div key={f.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.2s' }}>
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
                  placeholder="f(x) = ..."
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 16, fontFamily: 'Fira Code, monospace', fontWeight: 500 }}
                />
                <button onClick={() => removeFunction(f.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 4 }}><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
          <button onClick={addFunction} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.3)', cursor: 'pointer', justifyContent: 'center', fontWeight: 600, marginTop: 8 }}>
            <Plus size={18}/> Nueva Función
          </button>
        </div>

        <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={handleInsert} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)' }}>
            <Check size={20}/> Insertar en Pizarra
          </button>
        </div>
      </div>

      {/* Main Graph Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
        <Stage 
          width={window.innerWidth - 350} 
          height={window.innerHeight}
          draggable
          onDragMove={(e) => setViewport({ ...viewport, x: e.target.x(), y: e.target.y() })}
          onWheel={(e) => {
            e.evt.preventDefault();
            const scaleBy = 1.15;
            const newScale = e.evt.deltaY < 0 ? viewport.scale * scaleBy : viewport.scale / scaleBy;
            setViewport({ ...viewport, scale: Math.max(5, Math.min(newScale, 1000)) });
          }}
          x={viewport.x}
          y={viewport.y}
        >
          <Layer>
            {gridLines}
            {is3D && (
              <Group>
                {/* 3D Z Axis */}
                <Line points={[0, 0, -500, -500]} stroke="#f43f5e" strokeWidth={2} dash={[10, 5]} />
                <Text text="Z" x={-520} y={-520} fill="#f43f5e" fontSize={14} fontWeight="bold" />
              </Group>
            )}
            {plotData.map(d => (
              <Line 
                key={d.id} 
                points={d.points} 
                stroke={d.color} 
                strokeWidth={3} 
                tension={d.points.length > 500 ? 0 : 0.5} 
                lineCap="round" 
                lineJoin="round"
                opacity={0.9}
              />
            ))}
          </Layer>
        </Stage>
        
        {/* Controls Overlay */}
        <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 10 }}>
          <button 
            onClick={() => setIs3D(!is3D)}
            style={{ 
              background: is3D ? '#f43f5e' : 'rgba(25,25,35,0.8)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#fff', padding: '8px 16px', borderRadius: 10, 
              cursor: 'pointer', fontSize: 13, fontWeight: 700, backdropFilter: 'blur(10px)',
              transition: 'all 0.2s'
            }}
          >
            {is3D ? 'Modo 2D' : 'Modo 3D (Ejes)'}
          </button>
          <button 
            onClick={() => setViewport({ x: (window.innerWidth - 350) / 2, y: window.innerHeight / 2, scale: 40 })}
            style={{ background: 'rgba(25,25,35,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500, backdropFilter: 'blur(10px)' }}
          >
            Centrar Vista
          </button>
        </div>

        {/* Help tooltip */}
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: 30, color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
          Zoom con rueda • Arrastra para mover el plano
        </div>
      </div>
    </div>
  );
};
