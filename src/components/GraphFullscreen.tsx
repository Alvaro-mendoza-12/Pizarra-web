import React, { useState, useMemo } from 'react';
import { Stage, Layer, Line, Text } from 'react-konva';
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
    { id: '1', expression: 'sin(x)', color: '#818cf8', visible: true }
  ]);
  const [viewport, setViewport] = useState({ x: window.innerWidth / 2 + 100, y: window.innerHeight / 2, scale: 40 });

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
      const expr = f.expression.toLowerCase()
        .replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt').replace(/pow/g, 'Math.pow').replace(/pi/g, 'Math.PI')
        .replace(/abs/g, 'Math.abs').replace(/exp/g, 'Math.exp').replace(/log/g, 'Math.log');
      
      try {
        if (expr.startsWith('r=')) {
          const evalFn = new Function('t', `return ${expr.slice(2)}`);
          for (let t = 0; t <= Math.PI * 4; t += 0.05) {
            const r = evalFn(t);
            if (!isNaN(r)) pts.push(r * Math.cos(t) * viewport.scale, -r * Math.sin(t) * viewport.scale);
          }
        } else if (expr.includes(',')) {
          const parts = expr.split(',');
          const evalX = new Function('t', `return ${parts[0]}`);
          const evalY = new Function('t', `return ${parts[1]}`);
          for (let t = -10; t <= 10; t += 0.05) {
            const x = evalX(t); const y = evalY(t);
            if (!isNaN(x) && !isNaN(y)) pts.push(x * viewport.scale, -y * viewport.scale);
          }
        } else {
          const evalFn = new Function('x', `return ${expr}`);
          for (let x = -20; x <= 20; x += 0.1) {
            const y = evalFn(x);
            if (!isNaN(y)) pts.push(x * viewport.scale, -y * viewport.scale);
          }
        }
      } catch (e) {}
      return { id: f.id, points: pts, color: f.color };
    });
  }, [functions, viewport.scale]);

  const handleInsert = () => {
    const elements = plotData.map(d => ({
      id: uuidv4(),
      type: 'pen',
      x: 0,
      y: 0,
      points: d.points,
      stroke: d.color,
      strokeWidth: 2
    }));
    onInsert(elements);
  };

  const gridLines = useMemo(() => {
    const lines = [];
    const step = viewport.scale;
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    // Vertical
    for (let x = -20; x <= 20; x++) {
      lines.push(<Line key={`v${x}`} points={[x * step, -h, x * step, h]} stroke={x === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'} strokeWidth={x === 0 ? 2 : 1} />);
      if (x !== 0) lines.push(<Text key={`tx${x}`} text={String(x)} x={x * step - 5} y={5} fill="rgba(255,255,255,0.5)" fontSize={10} />);
    }
    // Horizontal
    for (let y = -20; y <= 20; y++) {
      lines.push(<Line key={`h${y}`} points={[-w, y * step, w, y * step]} stroke={y === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'} strokeWidth={y === 0 ? 2 : 1} />);
      if (y !== 0) lines.push(<Text key={`ty${y}`} text={String(-y)} x={5} y={y * step - 5} fill="rgba(255,255,255,0.5)" fontSize={10} />);
    }
    return lines;
  }, [viewport.scale]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a0a0c', display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 350, borderRight: '1px solid rgba(255,255,255,0.1)', background: '#121218', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><ArrowLeft size={20}/></button>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>GeoGebra Math</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {functions.map(f => (
            <div key={f.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div onClick={() => toggleVisibility(f.id)} style={{ width: 18, height: 18, borderRadius: '50%', background: f.visible ? f.color : 'transparent', border: `2px solid ${f.color}`, cursor: 'pointer' }} />
                <input 
                  value={f.expression}
                  onChange={(e) => updateFunction(f.id, e.target.value)}
                  placeholder="f(x) = ..."
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 16, fontFamily: 'monospace' }}
                />
                <button onClick={() => removeFunction(f.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
          <button onClick={addFunction} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', cursor: 'pointer', justifyContent: 'center' }}>
            <Plus size={18}/> Nueva Función
          </button>
        </div>

        <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleInsert} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Check size={18}/> Insertar en Pizarra
          </button>
        </div>
      </div>

      {/* Main Graph Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Stage 
          width={window.innerWidth - 350} 
          height={window.innerHeight}
          draggable
          onDragMove={(e) => setViewport({ ...viewport, x: e.target.x(), y: e.target.y() })}
          onWheel={(e) => {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const newScale = e.evt.deltaY < 0 ? viewport.scale * scaleBy : viewport.scale / scaleBy;
            setViewport({ ...viewport, scale: Math.max(5, Math.min(newScale, 500)) });
          }}
          x={viewport.x}
          y={viewport.y}
        >
          <Layer>
            {gridLines}
            {plotData.map(d => (
              <Line key={d.id} points={d.points} stroke={d.color} strokeWidth={3} tension={0.5} />
            ))}
          </Layer>
        </Stage>
        
        {/* Help tooltip */}
        <div style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: 20, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          Usa scroll para zoom, arrastra para mover el plano
        </div>
      </div>
    </div>
  );
};
