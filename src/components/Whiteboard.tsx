import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect as KonvaRect, Line, Transformer } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import type { BoardElement, Tool } from '../types';
import { ShapeElement } from './ShapeElement';
import { URLImage } from './URLImage';
import { Toolbar } from './Toolbar';
import { GraphFullscreen } from './GraphFullscreen';
import { ShareModal } from './ShareModal';
import { useBoardStore } from '../store/boardStore';
import { useCollaboration } from '../hooks/useCollaboration';

const GRID_SIZE = 40;

function GridLines({ scale, pos }: { scale: number; pos: { x: number; y: number } }) {
  const lines: React.ReactNode[] = [];
  const w = window.innerWidth / scale + GRID_SIZE * 2;
  const h = window.innerHeight / scale + GRID_SIZE * 2;
  const sx = Math.floor(-pos.x / scale / GRID_SIZE) * GRID_SIZE;
  const sy = Math.floor(-pos.y / scale / GRID_SIZE) * GRID_SIZE;
  for (let x = sx; x < sx + w; x += GRID_SIZE)
    lines.push(<Line key={`v${x}`} points={[x, sy, x, sy + h]} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / scale} listening={false} />);
  for (let y = sy; y < sy + h; y += GRID_SIZE)
    lines.push(<Line key={`h${y}`} points={[sx, y, sx + w, y]} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / scale} listening={false} />);
  return <>{lines}</>;
}

export default function Whiteboard() {
  const store = useBoardStore();
  const { connect, disconnect, syncElements, updateCursor } = useCollaboration();

  const [isDrawing, setIsDrawing] = useState(false);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const isMarqueeActive = useRef(false);
  const [textEditor, setTextEditor] = useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [showGraph, setShowGraph] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const nodeRefs = useRef<{ [id: string]: any }>({});
  const dragStartPos = useRef<{ [id: string]: { x: number; y: number } }>({});
  const elementsRef = useRef(store.elements);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { elementsRef.current = store.elements; }, [store.elements]);

  useEffect(() => {
    if (store.selectedIds.length > 0 && trRef.current) {
      trRef.current.nodes(store.selectedIds.map(id => nodeRefs.current[id]).filter(Boolean));
      trRef.current.getLayer()?.batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [store.selectedIds, store.elements]);

  useEffect(() => {
    if (textEditor) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [textEditor]);

  // Check URL for room
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      store.setRoomId(room);
      setTimeout(() => setShowShare(true), 500);
    }
  }, []);

  const getPos = useCallback(() => {
    const s = stageRef.current;
    if (!s) return { x: 0, y: 0 };
    const p = s.getPointerPosition();
    if (!p) return { x: 0, y: 0 };
    return { x: (p.x - s.x()) / s.scaleX(), y: (p.y - s.y()) / s.scaleY() };
  }, []);

  const handleMouseMove = useCallback(() => {
    const { tool } = store;
    if (tool === 'select' && marqueeStart.current) {
      const pos = getPos();
      const { x: sx, y: sy } = marqueeStart.current;
      const w = Math.abs(pos.x - sx), h = Math.abs(pos.y - sy);
      if (w > 3 || h > 3) {
        isMarqueeActive.current = true;
        setMarquee({ x: Math.min(sx, pos.x), y: Math.min(sy, pos.y), w, h });
      }
      return;
    }
    if (!isDrawing || store.elements.length === 0) return;
    const pos = getPos();
    const els = [...store.elements];
    const last = { ...els[els.length - 1] };
    if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter') {
      last.points = [...(last.points || []), pos.x, pos.y];
    } else if (tool === 'line' || tool === 'arrow') {
      const pts = last.points || [pos.x, pos.y];
      last.points = [pts[0], pts[1], pos.x, pos.y];
    } else if (tool === 'rect') {
      last.width = pos.x - (last.x || 0);
      last.height = pos.y - (last.y || 0);
    } else if (tool === 'circle' || tool === 'triangle') {
      const dx = pos.x - (last.x || 0), dy = pos.y - (last.y || 0);
      const r = Math.sqrt(dx * dx + dy * dy);
      last.width = r * 2; last.height = r * 2;
    }
    els[els.length - 1] = last;
    store.setElements(els);

    // Sync cursor
    if (isConnected) updateCursor(pos.x, pos.y);
  }, [store, isDrawing, getPos, isConnected, updateCursor]);

  const handleMouseDown = useCallback((e: any) => {
    const { tool, color, strokeWidth, elements, isReadOnly } = store;
    if (tool === 'pan' || isReadOnly) return;
    const isStage = e.target === stageRef.current;

    if (tool === 'select') {
      if (isStage) {
        store.setSelectedIds([]);
        marqueeStart.current = getPos();
        isMarqueeActive.current = false;
        setMarquee(null);
      }
      return;
    }

    if (tool === 'text' || tool === 'sticky') {
      const s = stageRef.current;
      if (!s) return;
      const cp = getPos();
      const box = s.container().getBoundingClientRect();
      const pp = s.getPointerPosition();
      setTextValue('');
      setTextEditor({ sx: pp.x + box.left, sy: pp.y + box.top, cx: cp.x, cy: cp.y });
      return;
    }

    setIsDrawing(true);
    store.setSelectedIds([]);
    const pos = getPos();
    const id = uuidv4();
    const newEl: BoardElement = {
      id, type: tool, x: pos.x, y: pos.y,
      stroke: tool === 'eraser' ? (store.theme === 'light' ? '#f1f5f9' : '#0c0c10') : color,
      strokeWidth: tool === 'eraser' ? strokeWidth * 4 : tool === 'highlighter' ? strokeWidth * 3 : strokeWidth,
      fill: (tool === 'rect' || tool === 'circle' || tool === 'triangle') ? 'transparent' : undefined,
      isHighlighter: tool === 'highlighter',
    };
    if (['pen', 'eraser', 'line', 'arrow', 'highlighter'].includes(tool)) {
      newEl.points = [pos.x, pos.y, pos.x, pos.y];
      newEl.x = 0; newEl.y = 0;
    }
    store.setElements([...elements, newEl]);
  }, [store, getPos]);

  const handleMouseUp = useCallback(() => {
    const { tool, elements } = store;
    if (tool === 'select' && marqueeStart.current) {
      if (isMarqueeActive.current && marquee) {
        const { x: mx1, y: my1 } = marquee;
        const mx2 = mx1 + marquee.w, my2 = my1 + marquee.h;
        const sel = elements.filter(el => {
          let minX: number, minY: number, maxX: number, maxY: number;
          if (['pen', 'eraser', 'line', 'arrow', 'highlighter'].includes(el.type)) {
            const pts = el.points || [];
            if (!pts.length) return false;
            minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
            for (let i = 0; i < pts.length; i += 2) {
              minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
              minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
            }
          } else {
            minX = el.x || 0; maxX = minX + (el.width || 100);
            minY = el.y || 0; maxY = minY + (el.height || 50);
          }
          return !(maxX < mx1 || minX > mx2 || maxY < my1 || minY > my2);
        }).map(e => e.id);
        if (sel.length) store.setSelectedIds(sel);
      }
      setMarquee(null);
      marqueeStart.current = null;
      isMarqueeActive.current = false;
      return;
    }
    if (isDrawing) {
      store.pushHistory(store.elements);
      if (isConnected) syncElements(store.elements);
    }
    setIsDrawing(false);
  }, [store, marquee, isDrawing, isConnected, syncElements]);

  const commitText = useCallback(() => {
    if (!textEditor) return;
    const { tool, color, fontSize, elements } = store;
    if (textValue.trim()) {
      const isSt = tool === 'sticky';
      const newArr = [...elements, {
        id: uuidv4(), type: isSt ? 'sticky' as Tool : 'text' as Tool,
        x: textEditor.cx, y: textEditor.cy,
        text: textValue, fill: isSt ? undefined : color,
        fontSize, fontFamily: 'Inter, sans-serif', strokeWidth: 0,
        width: isSt ? 200 : undefined, height: isSt ? 200 : undefined,
        stickyColor: isSt ? 'yellow' : undefined,
      }];
      store.pushHistory(newArr);
      if (isConnected) syncElements(newArr);
    }
    setTextEditor(null); setTextValue('');
  }, [textEditor, textValue, store, isConnected, syncElements]);

  const handleChange = useCallback((id: string, attrs: any) => {
    const { selectedIds } = store;
    let updated: BoardElement[];
    if (selectedIds.length > 1 && selectedIds.includes(id)) {
      updated = elementsRef.current.map(e => {
        if (selectedIds.includes(e.id)) {
          const node = nodeRefs.current[e.id];
          if (node) return { ...e, x: Math.round(node.x() * 10) / 10, y: Math.round(node.y() * 10) / 10 };
        }
        return e;
      });
    } else {
      updated = elementsRef.current.map(e => e.id === id ? { ...e, ...attrs } : e);
    }
    store.pushHistory(updated);
    if (isConnected) syncElements(updated);
  }, [store, isConnected, syncElements]);

  const zoom = useCallback((factor: number) => {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const prev = store.stageScale;
    const ns = Math.max(0.05, Math.min(10, prev * factor));
    store.setStageScale(ns);
    store.setStagePos({
      x: center.x - ((center.x - store.stagePos.x) / prev) * ns,
      y: center.y - ((center.y - store.stagePos.y) / prev) * ns,
    });
  }, [store]);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const s = stageRef.current;
    const old = s.scaleX();
    const ptr = s.getPointerPosition();
    const mpt = { x: (ptr.x - s.x()) / old, y: (ptr.y - s.y()) / old };
    const ns = Math.max(0.05, Math.min(10, e.evt.deltaY > 0 ? old / 1.06 : old * 1.06));
    store.setStageScale(ns);
    store.setStagePos({ x: ptr.x - mpt.x * ns, y: ptr.y - mpt.y * ns });
  }, [store]);

  const addImage = useCallback((src: string) => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      const newArr = [...store.elements, {
        id: uuidv4(), type: 'image' as Tool, src,
        x: -store.stagePos.x / store.stageScale + window.innerWidth / 2 / store.stageScale - img.width / 2,
        y: -store.stagePos.y / store.stageScale + window.innerHeight / 2 / store.stageScale - img.height / 2,
        width: img.width, height: img.height,
      }];
      store.pushHistory(newArr);
      if (isConnected) syncElements(newArr);
    };
  }, [store, isConnected, syncElements]);

  const saveBoard = useCallback(() => {
    const data = JSON.stringify({ elements: store.elements, version: 1 });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `pizarra-${Date.now()}.json`;
    a.click();
  }, [store.elements]);

  const loadBoard = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: any) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = ev => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.elements) { store.pushHistory(data.elements); if (isConnected) syncElements(data.elements); }
        } catch { alert('Archivo inválido'); }
      };
      fr.readAsText(f);
    };
    input.click();
  }, [store, isConnected, syncElements]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); store.deleteSelected(); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); store.undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); store.redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveBoard(); }
      if (store.isReadOnly) return;
      const map: Record<string, Tool> = { v: 'select', p: 'pen', h: 'highlighter', e: e.shiftKey ? 'eraser-stroke' : 'eraser', r: 'rect', c: 'circle', l: 'line', t: 'text', n: 'sticky' };
      const k = e.key.toLowerCase();
      if (map[k] && !e.ctrlKey) store.setTool(map[k]);
      if (k === 'g' && !e.ctrlKey) store.setShowGrid(!store.showGrid);
      if (e.key === '+' || e.key === '=') zoom(1.15);
      if (e.key === '-') zoom(0.85);
      if (e.key === ' ') { e.preventDefault(); store.setTool('pan'); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') store.setTool('select'); };
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
  }, [store, zoom, addImage, saveBoard]);

  const handleNodeDragStart = useCallback((id: string) => {
    if (!store.selectedIds.includes(id)) return;
    store.selectedIds.forEach(sid => {
      const node = nodeRefs.current[sid];
      if (node) dragStartPos.current[sid] = { x: node.x(), y: node.y() };
    });
  }, [store.selectedIds]);

  const handleNodeDragMove = useCallback((id: string, e: any) => {
    if (store.selectedIds.length <= 1 || !store.selectedIds.includes(id)) return;
    const sp = dragStartPos.current[id];
    if (!sp) return;
    const dx = e.target.x() - sp.x, dy = e.target.y() - sp.y;
    store.selectedIds.forEach(sid => {
      if (sid === id) return;
      const node = nodeRefs.current[sid];
      const s = dragStartPos.current[sid];
      if (node && s) { node.x(s.x + dx); node.y(s.y + dy); }
    });
    if (trRef.current) trRef.current.getLayer()?.batchDraw();
  }, [store.selectedIds]);

  const cursor = store.tool === 'pan' ? 'grab' : store.tool === 'select' ? 'default' : store.tool === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0c0c10', position: 'relative', touchAction: 'none' }}>
      <Toolbar
        canUndo={store.canUndo()} canRedo={store.canRedo()}
        onUndo={store.undo} onRedo={store.redo}
        selectedCount={store.selectedIds.length}
        onDeleteSelected={store.deleteSelected}
        onClear={() => { if (confirm('¿Limpiar toda la pizarra?')) store.clearBoard(); }}
        onExport={() => {
          if (!stageRef.current) return;
          const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
          const a = document.createElement('a'); a.download = 'pizarra.png'; a.href = uri;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
        onImport={e => { const f = e.target.files?.[0]; if (f) { const fr = new FileReader(); fr.onload = ev => addImage(ev.target?.result as string); fr.readAsDataURL(f); } }}
        onZoomIn={() => zoom(1.2)} onZoomOut={() => zoom(0.8)}
        onZoomReset={() => { store.setStageScale(1); store.setStagePos({ x: 0, y: 0 }); }}
        onInsertFormula={() => {}}
        onOpenGraphModal={() => setShowGraph(true)}
        onShare={() => setShowShare(true)}
        onSave={saveBoard} onLoad={loadBoard}
      />

      {/* Text editor overlay */}
      {textEditor && (
        <textarea
          ref={textareaRef} value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={e => {
            if (e.key === 'Escape') { setTextEditor(null); setTextValue(''); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
          }}
          style={{
            position: 'fixed', zIndex: 500, left: textEditor.sx, top: textEditor.sy,
            minWidth: 160, minHeight: 48,
            background: store.tool === 'sticky' ? '#fde68a' : 'rgba(15,15,20,0.95)',
            border: `2px solid ${store.tool === 'sticky' ? '#f59e0b' : store.color}`,
            borderRadius: 10, color: store.tool === 'sticky' ? '#78350f' : store.color,
            outline: 'none', resize: 'both',
            fontSize: `${store.fontSize * store.stageScale}px`,
            fontFamily: 'Inter, sans-serif', padding: '10px 14px', lineHeight: 1.5,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          placeholder={store.tool === 'sticky' ? 'Escribe tu nota...' : 'Escribe... (Enter para confirmar)'}
        />
      )}

      {/* Peer cursors */}
      {store.peers.filter(p => p.cursor).map(p => {
        const screenX = p.cursor!.x * store.stageScale + store.stagePos.x;
        const screenY = p.cursor!.y * store.stageScale + store.stagePos.y;
        return (
          <div key={p.id} className="peer-cursor" style={{ left: screenX, top: screenY }}>
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d="M0 0 L0 16 L4 12 L8 20 L10 19 L6 11 L12 11 Z" fill={p.color} stroke="#fff" strokeWidth="1" />
            </svg>
            <div className="peer-cursor-name" style={{ background: p.color }}>{p.name}</div>
          </div>
        );
      })}

      <div style={{ display: showGraph ? 'block' : 'none' }}>
        <GraphFullscreen
          onClose={() => setShowGraph(false)}
          onInsert={els => { const u = [...store.elements, ...els]; store.pushHistory(u); setShowGraph(false); }}
        />
      </div>

      {showShare && (
        <ShareModal
          onClose={() => setShowShare(false)}
          isConnected={isConnected}
          onConnect={(room, name) => {
            store.setRoomId(room);
            connect(room, name);
            setIsConnected(true);
            const url = new URL(window.location.href);
            url.searchParams.set('room', room);
            window.history.replaceState({}, '', url.toString());
          }}
          onDisconnect={() => { disconnect(); store.setRoomId(''); setIsConnected(false); }}
        />
      )}

      <Stage
        width={window.innerWidth} height={window.innerHeight}
        ref={stageRef}
        x={store.stagePos.x} y={store.stagePos.y}
        scaleX={store.stageScale} scaleY={store.stageScale}
        draggable={store.tool === 'pan'}
        onDragEnd={(e: any) => { if (e.target === stageRef.current) store.setStagePos({ x: e.target.x(), y: e.target.y() }); }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
        onWheel={handleWheel} style={{ cursor }}
      >
        <Layer>
          {store.showGrid && <GridLines scale={store.stageScale} pos={store.stagePos} />}
          {store.elements.map(el => {
            const isSel = store.selectedIds.includes(el.id);
            const isDrag = isSel && store.tool === 'select';
            if (el.type === 'image') return (
              <URLImage key={el.id} imageSrc={el.src!} shapeProps={{ ...el }} draggable={isDrag}
                onSelect={(e, add) => { 
                  if (store.isReadOnly) return;
                  if (store.tool === 'eraser-stroke') {
                    e.cancelBubble = true;
                    const filtered = store.elements.filter(i => i.id !== el.id);
                    store.setElements(filtered);
                    store.pushHistory(filtered);
                    if (isConnected) syncElements(filtered);
                    return;
                  }
                  if (store.tool !== 'select') return;
                  e.cancelBubble = true;
                  store.setSelectedIds(add ? (store.selectedIds.includes(el.id) ? store.selectedIds.filter(i => i !== el.id) : [...store.selectedIds, el.id]) : [el.id]);
                }}
                onChange={a => handleChange(el.id, a)}
                onNode={n => { if (n) nodeRefs.current[el.id] = n; else delete nodeRefs.current[el.id]; }}
                onDragStart={() => handleNodeDragStart(el.id)}
                onDragMove={(e) => handleNodeDragMove(el.id, e)}
              />
            );
            return (
              <ShapeElement key={el.id} shapeProps={{ ...el }} draggable={isDrag}
                onSelect={(e, add) => { 
                  if (store.isReadOnly) return;
                  if (store.tool === 'eraser-stroke') {
                    e.cancelBubble = true;
                    const filtered = store.elements.filter(i => i.id !== el.id);
                    store.setElements(filtered);
                    store.pushHistory(filtered);
                    if (isConnected) syncElements(filtered);
                    return;
                  }
                  if (store.tool !== 'select') return;
                  e.cancelBubble = true;
                  store.setSelectedIds(add ? (store.selectedIds.includes(el.id) ? store.selectedIds.filter(i => i !== el.id) : [...store.selectedIds, el.id]) : [el.id]);
                }}
                onChange={a => handleChange(el.id, a)}
                onNode={n => { if (n) nodeRefs.current[el.id] = n; else delete nodeRefs.current[el.id]; }}
                onDragStart={() => handleNodeDragStart(el.id)}
                onDragMove={(e) => handleNodeDragMove(el.id, e)}
              />
            );
          })}

          <Transformer ref={trRef}
            boundBoxFunc={(o, n) => (n.width < 5 || n.height < 5) ? o : n}
            onTransformEnd={() => {
              if (!trRef.current) return;
              const nodes = trRef.current.nodes();
              let updated = [...store.elements];
              nodes.forEach((node: any) => {
                const idx = updated.findIndex(e => e.id === node.id());
                if (idx !== -1) {
                  const el = updated[idx];
                  const sx = node.scaleX(), sy = node.scaleY();
                  node.scaleX(1); node.scaleY(1);
                  updated[idx] = { ...el, x: node.x(), y: node.y(), width: Math.max(5, (el.width || 0) * sx), height: Math.max(5, (el.height || 0) * sy), rotation: node.rotation() };
                }
              });
              store.pushHistory(updated);
              if (isConnected) syncElements(updated);
            }}
          />

          {marquee && (
            <KonvaRect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
              fill="rgba(99,102,241,0.07)" stroke="#818cf8" strokeWidth={1.5 / store.stageScale}
              dash={[6 / store.stageScale, 3 / store.stageScale]} listening={false} />
          )}
        </Layer>
      </Stage>

      <div className="zoom-badge">
        {Math.round(store.stageScale * 100)}%
      </div>
    </div>
  );
}
