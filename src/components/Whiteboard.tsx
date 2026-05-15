import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect as KonvaRect, Line, Transformer } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import type { BoardElement, Tool } from '../types';
import { ShapeElement } from './ShapeElement';
import { URLImage } from './URLImage';
import { Toolbar } from './Toolbar';
import { GraphFullscreen } from './GraphFullscreen';
import { useHistory } from '../hooks/useHistory';

const GRID_SIZE = 40;

function GridLines({ stageScale, stagePos }: { stageScale: number; stagePos: { x: number; y: number } }) {
  const lines: React.ReactNode[] = [];
  const w = window.innerWidth / stageScale + GRID_SIZE * 2;
  const h = window.innerHeight / stageScale + GRID_SIZE * 2;
  const startX = Math.floor(-stagePos.x / stageScale / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(-stagePos.y / stageScale / GRID_SIZE) * GRID_SIZE;
  for (let x = startX; x < startX + w; x += GRID_SIZE)
    lines.push(<Line key={`v${x}`} points={[x, startY, x, startY + h]} stroke="rgba(255,255,255,0.07)" strokeWidth={1 / stageScale} listening={false} />);
  for (let y = startY; y < startY + h; y += GRID_SIZE)
    lines.push(<Line key={`h${y}`} points={[startX, y, startX + w, y]} stroke="rgba(255,255,255,0.07)" strokeWidth={1 / stageScale} listening={false} />);
  return <>{lines}</>;
}

interface ElementWrapperProps {
  el: BoardElement;
  isDraggable: boolean;
  onSelect: (el: BoardElement, e: any, additive: boolean) => void;
  onChange: (id: string, attrs: any) => void;
  onNode: (id: string, node: any) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, e: any) => void;
}
function ElementWrapper({ el, isDraggable, onSelect, onChange, onNode, onDragStart, onDragMove }: ElementWrapperProps) {
  const handleSelect = useCallback((e: any, additive: boolean) => onSelect(el, e, additive), [el, onSelect]);
  const handleChange = useCallback((attrs: any) => onChange(el.id, attrs), [el.id, onChange]);
  const handleNode = useCallback((node: any) => onNode(el.id, node), [el.id, onNode]);
  const handleDragStart = useCallback(() => onDragStart(el.id), [el.id, onDragStart]);
  const handleDragMove = useCallback((e: any) => onDragMove(el.id, e), [el.id, onDragMove]);

  if (el.type === 'image') {
    return (
      <URLImage
        imageSrc={el.src!}
        shapeProps={{ ...el, id: el.id }}
        draggable={isDraggable}
        onSelect={handleSelect}
        onChange={handleChange}
        onNode={handleNode}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
      />
    );
  }
  return (
    <ShapeElement
      shapeProps={{ ...el, id: el.id }}
      draggable={isDraggable}
      onSelect={handleSelect}
      onChange={handleChange}
      onNode={handleNode}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
    />
  );
}

export default function Whiteboard() {
  const [elements, setElements] = useState<BoardElement[]>([]);
  const { pushHistory, undoHistory, redoHistory, clearHistory, canUndo, canRedo } = useHistory([]);

  const undo = useCallback(() => setElements(undoHistory()), [undoHistory]);
  const redo = useCallback(() => setElements(redoHistory()), [redoHistory]);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [fontSize, setFontSize] = useState(22);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Marquee
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const isMarqueeActive = useRef(false);

  // Inline text editor
  const [textEditor, setTextEditor] = useState<{ screenX: number; screenY: number; canvasX: number; canvasY: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Graph View (Full Screen)
  const [isGraphViewOpen, setIsGraphViewOpen] = useState(false);

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const nodeRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    if (selectedIds.length > 0 && trRef.current) {
      const nodes = selectedIds.map(id => nodeRefs.current[id]).filter(Boolean);
      trRef.current.nodes(nodes);
      trRef.current.getLayer().batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedIds, elements]);

  useEffect(() => {
    if (textEditor) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [textEditor]);

  const getCanvasPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const p = stage.getPointerPosition();
    if (!p) return { x: 0, y: 0 };
    return { x: (p.x - stage.x()) / stage.scaleX(), y: (p.y - stage.y()) / stage.scaleY() };
  }, []);

  const handleMouseDown = useCallback((e: any) => {
    if (tool === 'pan') return;
    const isOnStage = e.target === stageRef.current;

    if (tool === 'select') {
      if (isOnStage) {
        setSelectedIds([]);
        const pos = getCanvasPos();
        marqueeStart.current = pos;
        isMarqueeActive.current = false;
        setMarquee(null);
      }
      return;
    }

    if (tool === 'text') {
      const stage = stageRef.current;
      if (!stage) return;
      const canvasPos = getCanvasPos();
      const stageBox = stage.container().getBoundingClientRect();
      const pointer = stage.getPointerPosition();
      setTextValue('');
      setTextEditor({
        screenX: pointer.x + stageBox.left,
        screenY: pointer.y + stageBox.top,
        canvasX: canvasPos.x,
        canvasY: canvasPos.y,
      });
      return;
    }

    setIsDrawing(true);
    setSelectedIds([]);
    const pos = getCanvasPos();
    const id = uuidv4();

    const newEl: BoardElement = {
      id,
      type: tool,
      x: pos.x,
      y: pos.y,
      stroke: tool === 'eraser' ? 'rgba(0,0,0,1)' : color,
      strokeWidth: tool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      fill: (tool === 'rect' || tool === 'circle') ? 'transparent' : undefined,
    };

    if (tool === 'pen' || tool === 'eraser' || tool === 'line' || tool === 'arrow') {
      newEl.points = [pos.x, pos.y, pos.x, pos.y];
      newEl.x = 0; newEl.y = 0;
    }
    
    if (tool === 'axis') {
      newEl.width = 0; newEl.height = 0; // Fixed size in component
    }

    setElements([...elements, newEl]);
  }, [tool, color, strokeWidth, elements, getCanvasPos, pushHistory]);

  const handleMouseMove = useCallback(() => {
    if (tool === 'select' && marqueeStart.current) {
      const pos = getCanvasPos();
      const sx = marqueeStart.current.x;
      const sy = marqueeStart.current.y;
      const w = Math.abs(pos.x - sx);
      const h = Math.abs(pos.y - sy);
      if (w > 3 || h > 3) {
        isMarqueeActive.current = true;
        setMarquee({ x: Math.min(sx, pos.x), y: Math.min(sy, pos.y), w, h });
      }
      return;
    }

    if (!isDrawing || elements.length === 0) return;
    const pos = getCanvasPos();
    const last = { ...elements[elements.length - 1] };

    if (tool === 'pen' || tool === 'eraser') {
      last.points = [...(last.points || []), pos.x, pos.y];
    } else if (tool === 'line' || tool === 'arrow') {
      const pts = last.points || [pos.x, pos.y];
      last.points = [pts[0], pts[1], pos.x, pos.y];
    } else if (tool === 'rect') {
      last.width = pos.x - (last.x || 0);
      last.height = pos.y - (last.y || 0);
    } else if (tool === 'circle') {
      const dx = pos.x - (last.x || 0);
      const dy = pos.y - (last.y || 0);
      const r = Math.sqrt(dx * dx + dy * dy);
      last.width = r * 2; last.height = r * 2;
    }

    const updated = [...elements];
    updated[updated.length - 1] = last;
    setElements(updated);
  }, [tool, isDrawing, elements, getCanvasPos]);

  const handleMouseUp = useCallback(() => {
    if (tool === 'select' && marqueeStart.current) {
      if (isMarqueeActive.current && marquee) {
        const mx1 = marquee.x, my1 = marquee.y, mx2 = marquee.x + marquee.w, my2 = marquee.y + marquee.h;
        const selected = elements.filter(el => {
          let minX, minY, maxX, maxY;
          if (el.type === 'pen' || el.type === 'eraser' || el.type === 'line' || el.type === 'arrow') {
            const pts = el.points || [];
            if (!pts.length) return false;
            minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
            for (let i = 0; i < pts.length; i += 2) {
              if (pts[i] < minX) minX = pts[i];
              if (pts[i] > maxX) maxX = pts[i];
              if (pts[i+1] < minY) minY = pts[i+1];
              if (pts[i+1] > maxY) maxY = pts[i+1];
            }
          } else if (el.type === 'text') {
            minX = el.x || 0; minY = el.y || 0;
            maxX = minX + 150; maxY = minY + (el.fontSize || 22) * 2;
          } else {
            const x1 = el.x || 0;
            const x2 = x1 + (el.width || 0);
            minX = Math.min(x1, x2); maxX = Math.max(x1, x2);
            const y1 = el.y || 0;
            const y2 = y1 + (el.height || 0);
            minY = Math.min(y1, y2); maxY = Math.max(y1, y2);
          }
          return !(maxX < mx1 || minX > mx2 || maxY < my1 || minY > my2);
        }).map(el => el.id);
        if (selected.length > 0) setSelectedIds(selected);
      }
      setMarquee(null);
      marqueeStart.current = null;
      isMarqueeActive.current = false;
      return;
    }
    if (isDrawing) {
      pushHistory(elements);
    }
    setIsDrawing(false);
  }, [tool, marquee, elements, isDrawing, pushHistory]);

  const commitText = useCallback(() => {
    if (!textEditor) return;
    if (textValue.trim()) {
      const newArr = [...elements, {
        id: uuidv4(), type: 'text' as Tool,
        x: textEditor.canvasX, y: textEditor.canvasY,
        text: textValue, fill: color,
        fontSize, fontFamily: 'Inter, sans-serif', strokeWidth: 0,
      }];
      setElements(newArr);
      pushHistory(newArr);
    }
    setTextEditor(null);
    setTextValue('');
  }, [textEditor, textValue, elements, pushHistory, color, fontSize]);

  const handleInsertFormula = useCallback((formula: string) => {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const x = (center.x - stagePos.x) / stageScale;
    const y = (center.y - stagePos.y) / stageScale;

    const newArr = [...elements, {
      id: uuidv4(), type: 'text' as Tool,
      x, y, text: formula, fill: color,
      fontSize: fontSize * 1.5, fontFamily: 'monospace', strokeWidth: 0,
    }];
    setElements(newArr);
    pushHistory(newArr);
  }, [elements, stagePos, stageScale, color, fontSize, pushHistory]);

  const handleElementSelect = useCallback((el: BoardElement, e: any, additive: boolean) => {
    if (tool !== 'select') return;
    e.cancelBubble = true;
    setSelectedIds(prev => additive
      ? (prev.includes(el.id) ? prev.filter(i => i !== el.id) : [...prev, el.id])
      : [el.id]
    );
  }, [tool]);

  const handleChange = useCallback((id: string, attrs: any) => {
    // If multiple elements are selected, we should update all of them based on their physical nodes
    if (selectedIds.length > 1 && selectedIds.includes(id)) {
      const updated = elements.map(e => {
        if (selectedIds.includes(e.id)) {
          const node = nodeRefs.current[e.id];
          if (node) {
            return {
              ...e,
              x: node.x(),
              y: node.y(),
              // If the change came from a transform, we'd have rotation/scale here too,
              // but for simple dragging, x/y is enough.
              ...(e.id === id ? attrs : {})
            };
          }
        }
        return e;
      });
      setElements(updated);
      pushHistory(updated);
    } else {
      const updated = elements.map(e => e.id === id ? { ...e, ...attrs } : e);
      setElements(updated);
      pushHistory(updated);
    }
  }, [elements, pushHistory, selectedIds]);

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    const filtered = elements.filter(e => !selectedIds.includes(e.id));
    setElements(filtered);
    pushHistory(filtered);
    setSelectedIds([]);
  }, [selectedIds, elements, pushHistory]);

  const zoom = useCallback((factor: number) => {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    setStageScale(prev => {
      const newScale = Math.max(0.05, Math.min(10, prev * factor));
      setStagePos(pos => ({
        x: center.x - ((center.x - pos.x) / prev) * newScale,
        y: center.y - ((center.y - pos.y) / prev) * newScale,
      }));
      return newScale;
    });
  }, []);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mpt = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.05, Math.min(10, dir > 0 ? oldScale * 1.06 : oldScale / 1.06));
    setStageScale(newScale);
    setStagePos({ x: pointer.x - mpt.x * newScale, y: pointer.y - mpt.y * newScale });
  }, []);

  const addImage = useCallback((src: string) => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      const newArr = [...elements, {
        id: uuidv4(), type: 'image' as Tool, src,
        x: -stagePos.x / stageScale + window.innerWidth / 2 / stageScale - img.width / 2,
        y: -stagePos.y / stageScale + window.innerHeight / 2 / stageScale - img.height / 2,
        width: img.width, height: img.height,
      }];
      setElements(newArr);
      pushHistory(newArr);
    };
  }, [elements, pushHistory, stagePos, stageScale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
      const map: Record<string, Tool> = { v: 'select', p: 'pen', e: 'eraser', r: 'rect', c: 'circle', l: 'line', t: 'text' };
      const k = e.key.toLowerCase();
      if (map[k] && !e.ctrlKey) setTool(map[k]);
      if (k === 'g' && !e.ctrlKey) setShowGrid(g => !g);
      if (e.key === '+' || e.key === '=') zoom(1.15);
      if (e.key === '-') zoom(0.85);
      if (e.key === ' ') { e.preventDefault(); setTool('pan'); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setTool('select');
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) { const fr = new FileReader(); fr.onload = ev => addImage(ev.target?.result as string); fr.readAsDataURL(blob); }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('paste', onPaste); };
  }, [deleteSelected, undo, redo, addImage, zoom]);

  const dragStartPositions = useRef<{ [key: string]: { x: number, y: number } }>({});

  const handleNodeDragStart = useCallback((id: string) => {
    if (!selectedIds.includes(id)) return;
    selectedIds.forEach(sid => {
      const node = nodeRefs.current[sid];
      if (node) dragStartPositions.current[sid] = { x: node.x(), y: node.y() };
    });
  }, [selectedIds]);

  const handleNodeDragMove = useCallback((id: string, e: any) => {
    if (selectedIds.length <= 1 || !selectedIds.includes(id)) return;
    const startPos = dragStartPositions.current[id];
    if (!startPos) return;
    const dx = e.target.x() - startPos.x;
    const dy = e.target.y() - startPos.y;

    selectedIds.forEach(sid => {
      if (sid === id) return;
      const node = nodeRefs.current[sid];
      const sPos = dragStartPositions.current[sid];
      if (node && sPos) {
        node.x(sPos.x + dx);
        node.y(sPos.y + dy);
      }
    });
    // Force transformer to update its box
    if (trRef.current) trRef.current.getLayer()?.batchDraw();
  }, [selectedIds]);

  const cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0f0f13', fontFamily: 'Inter, sans-serif', position: 'relative', touchAction: 'none' }}>

      <Toolbar
        tool={tool} color={color} strokeWidth={strokeWidth} fontSize={fontSize}
        showGrid={showGrid} canUndo={canUndo} canRedo={canRedo}
        selectedCount={selectedIds.length}
        onTool={setTool} onColor={setColor} onStroke={setStrokeWidth}
        onFontSize={setFontSize} onUndo={undo} onRedo={redo}
        onClear={() => { if (confirm('¿Limpiar toda la pizarra?')) { setElements([]); clearHistory([]); setSelectedIds([]); } }}
        onExport={() => {
          if (!stageRef.current) return;
          const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
          const a = document.createElement('a'); a.download = 'pizarra.png'; a.href = uri;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
        onImport={e => {
          const f = e.target.files?.[0];
          if (f) { const fr = new FileReader(); fr.onload = ev => addImage(ev.target?.result as string); fr.readAsDataURL(f); }
        }}
        onZoomIn={() => zoom(1.2)} onZoomOut={() => zoom(0.8)}
        onZoomReset={() => { setStageScale(1); setStagePos({ x: 0, y: 0 }); }}
        onDeleteSelected={deleteSelected}
        onToggleGrid={() => setShowGrid(g => !g)}
        onInsertFormula={handleInsertFormula}
        onOpenGraphModal={() => setIsGraphViewOpen(true)}
      />

      {/* Inline text editor overlay */}
      {textEditor && (
        <textarea
          ref={textareaRef}
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={e => {
            if (e.key === 'Escape') { setTextEditor(null); setTextValue(''); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
          }}
          style={{
            position: 'fixed', zIndex: 200,
            left: textEditor.screenX, top: textEditor.screenY,
            minWidth: 140, minHeight: 44,
            background: 'rgba(18,18,24,0.92)',
            border: `2px solid ${color}`,
            borderRadius: 10, color, outline: 'none', resize: 'both',
            fontSize: `${fontSize * stageScale}px`,
            fontFamily: 'Inter, sans-serif',
            padding: '8px 12px', lineHeight: 1.4,
            boxShadow: '0 0 0 4px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}
          placeholder="Escribe aquí…&#10;Enter para confirmar&#10;Shift+Enter nueva línea"
        />
      )}

      {isGraphViewOpen && (
        <GraphFullscreen 
          onClose={() => setIsGraphViewOpen(false)}
          onInsert={(newElements) => {
            const updated = [...elements, ...newElements];
            setElements(updated);
            pushHistory(updated);
            setIsGraphViewOpen(false);
          }}
        />
      )}

      <Stage
        width={window.innerWidth} height={window.innerHeight}
        ref={stageRef}
        x={stagePos.x} y={stagePos.y}
        scaleX={stageScale} scaleY={stageScale}
        draggable={tool === 'pan'}
        onDragEnd={(e: any) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor }}
      >
        <Layer>
          {showGrid && <GridLines stageScale={stageScale} stagePos={stagePos} />}

          {elements.map(el => {
            const isSel = selectedIds.includes(el.id);
            const isDraggable = isSel && tool === 'select';
            return (
              <ElementWrapper
                key={el.id}
                el={el}
                isDraggable={isDraggable}
                onSelect={handleElementSelect}
                onChange={handleChange}
                onNode={(id, node) => {
                  if (node) nodeRefs.current[id] = node;
                  else delete nodeRefs.current[id];
                }}
                onDragStart={handleNodeDragStart}
                onDragMove={handleNodeDragMove}
              />
            );
          })}

          <Transformer
            ref={trRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) return oldBox;
              return newBox;
            }}
            onTransformEnd={() => {
              if (!trRef.current) return;
              const nodes = trRef.current.nodes();
              let updated = [...elements];
              nodes.forEach((node: any) => {
                const elIdx = updated.findIndex(e => e.id === node.id());
                if (elIdx !== -1) {
                  const el = updated[elIdx];
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  updated[elIdx] = {
                    ...el,
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(5, (el.width || 0) * scaleX),
                    height: Math.max(5, (el.height || 0) * scaleY),
                    rotation: node.rotation(),
                  };
                }
              });
              setElements(updated);
              pushHistory(updated);
            }}
          />

          {/* Marquee */}
          {marquee && (
            <KonvaRect
              x={marquee.x} y={marquee.y}
              width={marquee.w} height={marquee.h}
              fill="rgba(99,102,241,0.08)"
              stroke="#818cf8"
              strokeWidth={1.5 / stageScale}
              dash={[6 / stageScale, 3 / stageScale]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {/* Zoom badge */}
      <div style={{
        position: 'fixed', bottom: 44, right: 20, zIndex: 10,
        color: 'rgba(255,255,255,0.45)', fontSize: 12,
        background: 'rgba(25,25,35,0.7)', padding: '4px 12px', borderRadius: 20,
        backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)',
        pointerEvents: 'none', fontVariantNumeric: 'tabular-nums',
      }}>
        {Math.round(stageScale * 100)}%
      </div>
    </div>
  );
}
