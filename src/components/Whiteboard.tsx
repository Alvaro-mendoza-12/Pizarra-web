import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect as KonvaRect, Line } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import type { BoardElement, Tool } from '../types';
import { ShapeElement } from './ShapeElement';
import { URLImage } from './URLImage';
import { Toolbar } from './Toolbar';
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

// Wrap each element so hooks are always called at the top level
interface ElementWrapperProps {
  el: BoardElement;
  isSelected: boolean;
  isDraggable: boolean;
  onSelect: (el: BoardElement, e: any, additive: boolean) => void;
  onChange: (id: string, attrs: any) => void;
}
function ElementWrapper({ el, isSelected, isDraggable, onSelect, onChange }: ElementWrapperProps) {
  const handleSelect = useCallback((e: any, additive: boolean) => onSelect(el, e, additive), [el, onSelect]);
  const handleChange = useCallback((attrs: any) => onChange(el.id, attrs), [el.id, onChange]);

  if (el.type === 'image') {
    return (
      <URLImage
        imageSrc={el.src!}
        shapeProps={{ ...el, id: el.id }}
        isSelected={isSelected}
        draggable={isDraggable}
        onSelect={handleSelect}
        onChange={handleChange}
      />
    );
  }
  return (
    <ShapeElement
      shapeProps={{ ...el, id: el.id }}
      isSelected={isSelected}
      draggable={isDraggable}
      onSelect={handleSelect}
      onChange={handleChange}
    />
  );
}

export default function Whiteboard() {
  const { present: elements, push, undo, redo, canUndo, canRedo } = useHistory([]);

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

  const stageRef = useRef<any>(null);

  // Focus textarea when opened
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

    if (tool === 'pen' || tool === 'eraser' || tool === 'line') {
      newEl.points = [pos.x, pos.y];
      newEl.x = 0; newEl.y = 0;
    }

    push([...elements, newEl]);
  }, [tool, color, strokeWidth, elements, push, getCanvasPos]);

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
    } else if (tool === 'line') {
      const pts = last.points || [0, 0];
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
    push(updated);
  }, [tool, isDrawing, elements, push, getCanvasPos]);

  const handleMouseUp = useCallback(() => {
    if (tool === 'select' && marqueeStart.current) {
      if (isMarqueeActive.current && marquee) {
        const { x, y, w, h } = marquee;
        const selected = elements.filter(el => {
          if (el.type === 'pen' || el.type === 'eraser' || el.type === 'line') {
            const pts = el.points || [];
            return pts.some((_, i) => i % 2 === 0 && i + 1 < pts.length && pts[i] >= x && pts[i] <= x + w && pts[i + 1] >= y && pts[i + 1] <= y + h);
          }
          const ex = el.x || 0, ey = el.y || 0;
          return ex + (el.width || 0) >= x && ex <= x + w && ey + (el.height || 0) >= y && ey <= y + h;
        }).map(el => el.id);
        if (selected.length > 0) setSelectedIds(selected);
      }
      setMarquee(null);
      marqueeStart.current = null;
      isMarqueeActive.current = false;
      return;
    }
    setIsDrawing(false);
  }, [tool, marquee, elements]);

  const commitText = useCallback(() => {
    if (!textEditor) return;
    if (textValue.trim()) {
      push([...elements, {
        id: uuidv4(), type: 'text',
        x: textEditor.canvasX, y: textEditor.canvasY,
        text: textValue, fill: color,
        fontSize, fontFamily: 'Inter, sans-serif', strokeWidth: 0,
      }]);
    }
    setTextEditor(null);
    setTextValue('');
  }, [textEditor, textValue, elements, push, color, fontSize]);

  const handleElementSelect = useCallback((el: BoardElement, e: any, additive: boolean) => {
    if (tool !== 'select') return;
    e.cancelBubble = true;
    setSelectedIds(prev => additive
      ? (prev.includes(el.id) ? prev.filter(i => i !== el.id) : [...prev, el.id])
      : [el.id]
    );
  }, [tool]);

  const handleChange = useCallback((id: string, attrs: any) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const dx = (attrs.x ?? el.x ?? 0) - (el.x ?? 0);
    const dy = (attrs.y ?? el.y ?? 0) - (el.y ?? 0);
    const isMove = (Math.abs(dx) > 0 || Math.abs(dy) > 0) && selectedIds.length > 1;

    if (isMove) {
      push(elements.map(e =>
        e.id === id ? { ...e, ...attrs } :
        selectedIds.includes(e.id) ? { ...e, x: (e.x || 0) + dx, y: (e.y || 0) + dy } : e
      ));
    } else {
      push(elements.map(e => e.id === id ? { ...e, ...attrs } : e));
    }
  }, [elements, push, selectedIds]);

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    push(elements.filter(e => !selectedIds.includes(e.id)));
    setSelectedIds([]);
  }, [selectedIds, elements, push]);

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
      push([...elements, {
        id: uuidv4(), type: 'image', src,
        x: -stagePos.x / stageScale + window.innerWidth / 2 / stageScale - img.width / 2,
        y: -stagePos.y / stageScale + window.innerHeight / 2 / stageScale - img.height / 2,
        width: img.width, height: img.height,
      }]);
    };
  }, [elements, push, stagePos, stageScale]);

  // Keyboard shortcuts + clipboard paste
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

  const cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0f0f13', fontFamily: 'Inter, sans-serif', position: 'relative' }}>

      <Toolbar
        tool={tool} color={color} strokeWidth={strokeWidth} fontSize={fontSize}
        showGrid={showGrid} canUndo={canUndo} canRedo={canRedo}
        selectedCount={selectedIds.length}
        onTool={setTool} onColor={setColor} onStroke={setStrokeWidth}
        onFontSize={setFontSize} onUndo={undo} onRedo={redo}
        onClear={() => { if (confirm('¿Limpiar toda la pizarra?')) { push([]); setSelectedIds([]); } }}
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
            border: '2px solid #818cf8',
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
            // Show single-element transformer only when one element selected
            const showTransformer = isSel && selectedIds.length === 1;
            return (
              <ElementWrapper
                key={el.id}
                el={el}
                isSelected={showTransformer}
                isDraggable={isDraggable}
                onSelect={handleElementSelect}
                onChange={handleChange}
              />
            );
          })}

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
