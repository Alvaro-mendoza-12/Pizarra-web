import React, { Suspense, lazy, useState, useRef, useEffect, useCallback } from 'react';
import type Konva from 'konva';
import { Stage, Layer, Rect as KonvaRect, Line, Transformer } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import type { BoardElement, Tool } from '../types';
import { ShapeElement } from './ShapeElement';
import { URLImage } from './URLImage';
import { Toolbar } from './Toolbar';
import { ShareModal } from './ShareModal';
import { useBoardStore } from '../store/boardStore';
import { useCollaboration } from '../hooks/useCollaboration';

const GRID_SIZE = 40;
const MAX_IMAGE_SIDE = 960;
const GraphFullscreen = lazy(() => import('./GraphFullscreen').then(module => ({
  default: module.GraphFullscreen,
})));

type EditorKind = 'text' | 'sticky' | 'code';

interface TextEditorState {
  id?: string;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  kind: EditorKind;
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  stickyColor?: string;
}

function isEditableContent(element: BoardElement): element is BoardElement & { type: EditorKind } {
  return element.type === 'text' || element.type === 'sticky' || element.type === 'code';
}

function GridLines({ scale, pos }: { scale: number; pos: { x: number; y: number } }) {
  const theme = useBoardStore(state => state.theme);
  const strokeColor = theme === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)';
  const lines: React.ReactNode[] = [];
  const w = window.innerWidth / scale + GRID_SIZE * 2;
  const h = window.innerHeight / scale + GRID_SIZE * 2;
  const sx = Math.floor(-pos.x / scale / GRID_SIZE) * GRID_SIZE;
  const sy = Math.floor(-pos.y / scale / GRID_SIZE) * GRID_SIZE;
  for (let x = sx; x < sx + w; x += GRID_SIZE)
    lines.push(<Line key={`v${x}`} points={[x, sy, x, sy + h]} stroke={strokeColor} strokeWidth={1 / scale} listening={false} />);
  for (let y = sy; y < sy + h; y += GRID_SIZE)
    lines.push(<Line key={`h${y}`} points={[sx, y, sx + w, y]} stroke={strokeColor} strokeWidth={1 / scale} listening={false} />);
  return <>{lines}</>;
}

export default function Whiteboard() {
  const store = useBoardStore();
  const { connect, disconnect, syncElements, updateCursor } = useCollaboration();

  const [isDrawing, setIsDrawing] = useState(false);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const isMarqueeActive = useRef(false);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [textValue, setTextValue] = useState('');
  const [showGraph, setShowGraph] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [initialFormula, setInitialFormula] = useState<string | null>(null);
  const [initialIs3D, setInitialIs3D] = useState<boolean>(false);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const dragStartPos = useRef<{ [id: string]: { x: number; y: number } }>({});
  const elementsRef = useRef(store.elements);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { elementsRef.current = store.elements; }, [store.elements]);

  useEffect(() => {
    if (store.selectedIds.length > 0 && trRef.current) {
      trRef.current.nodes(
        store.selectedIds
          .map(id => nodeRefs.current[id])
          .filter((node): node is Konva.Node => Boolean(node))
      );
      trRef.current.getLayer()?.batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [store.selectedIds, store.elements]);

  useEffect(() => {
    if (textEditor) {
      window.setTimeout(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }, 50);
    }
  }, [textEditor]);

  // Check URL for room
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const board = useBoardStore.getState();
    const isViewOnly = params.get('mode') === 'view';
    board.setIsReadOnly(isViewOnly);
    if (isViewOnly) board.setTool('pan');
    if (room) {
      board.setRoomId(room);
      setTimeout(() => setShowShare(true), 500);
    }
  }, []);

  // Back button popstate listener to safely close modal on mobile
  useEffect(() => {
    if (showGraph) {
      window.history.pushState({ modal: 'graph' }, '');
      const handlePopState = () => {
        setShowGraph(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [showGraph]);

  const handleInsertFormula = (formula: string, is3d: boolean) => {
    setInitialFormula(formula);
    setInitialIs3D(is3d);
    setShowGraph(true);
  };

  const getPos = useCallback(() => {
    const s = stageRef.current;
    if (!s) return { x: 0, y: 0 };
    const p = s.getPointerPosition();
    if (!p) return { x: 0, y: 0 };
    return { x: (p.x - s.x()) / s.scaleX(), y: (p.y - s.y()) / s.scaleY() };
  }, []);

  const commitElements = useCallback((els: BoardElement[]) => {
    useBoardStore.getState().pushHistory(els);
    syncElements(els);
  }, [syncElements]);

  const openTextEditor = useCallback((kind: EditorKind, cx: number, cy: number, element?: BoardElement) => {
    const stage = stageRef.current;
    if (!stage || useBoardStore.getState().isReadOnly) return;

    const box = stage.container().getBoundingClientRect();
    setTextValue(element?.text || '');
    setTextEditor({
      id: element?.id,
      sx: cx * stage.scaleX() + stage.x() + box.left,
      sy: cy * stage.scaleY() + stage.y() + box.top,
      cx,
      cy,
      kind,
      width: element?.width,
      height: element?.height,
      fontSize: element?.fontSize,
      fontFamily: element?.fontFamily,
      fill: element?.fill,
      stickyColor: element?.stickyColor,
    });
  }, []);

  const openElementEditor = useCallback((element: BoardElement) => {
    if (!isEditableContent(element)) return false;
    const board = useBoardStore.getState();
    if (board.isReadOnly) return false;

    board.setTool('select');
    board.setSelectedIds([element.id]);
    openTextEditor(element.type, element.x || 0, element.y || 0, element);
    return true;
  }, [openTextEditor]);

  const editSelectedContent = useCallback(() => {
    const board = useBoardStore.getState();
    if (board.selectedIds.length !== 1) return false;
    const element = board.elements.find(item => item.id === board.selectedIds[0]);
    return element ? openElementEditor(element) : false;
  }, [openElementEditor]);

  const syncCurrentElements = useCallback(() => {
    syncElements(useBoardStore.getState().elements);
  }, [syncElements]);

  const undoBoard = useCallback(() => {
    const board = useBoardStore.getState();
    if (board.isReadOnly) return;
    board.undo();
    syncCurrentElements();
  }, [syncCurrentElements]);

  const redoBoard = useCallback(() => {
    const board = useBoardStore.getState();
    if (board.isReadOnly) return;
    board.redo();
    syncCurrentElements();
  }, [syncCurrentElements]);

  const deleteSelectedBoard = useCallback(() => {
    const board = useBoardStore.getState();
    if (board.isReadOnly || board.selectedIds.length === 0) return;
    board.deleteSelected();
    syncCurrentElements();
  }, [syncCurrentElements]);

  const clearBoard = useCallback(() => {
    const board = useBoardStore.getState();
    if (board.isReadOnly) return;
    board.clearBoard();
    syncCurrentElements();
  }, [syncCurrentElements]);

  const handleMouseMove = useCallback(() => {
    const pos = getPos();
    if (isConnected) updateCursor(pos.x, pos.y);

    const { tool } = store;
    if (tool === 'select' && marqueeStart.current) {
      const { x: sx, y: sy } = marqueeStart.current;
      const w = Math.abs(pos.x - sx), h = Math.abs(pos.y - sy);
      if (w > 3 || h > 3) {
        isMarqueeActive.current = true;
        setMarquee({ x: Math.min(sx, pos.x), y: Math.min(sy, pos.y), w, h });
      }
      return;
    }
    if (!isDrawing || store.elements.length === 0) return;
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
  }, [store, isDrawing, getPos, isConnected, updateCursor]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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

    if (tool === 'text' || tool === 'sticky' || tool === 'code') {
      const cp = getPos();
      openTextEditor(tool, cp.x, cp.y);
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
  }, [store, getPos, openTextEditor]);

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
      commitElements(store.elements);
    }
    setIsDrawing(false);
  }, [store, marquee, isDrawing, commitElements]);

  const commitText = useCallback(() => {
    if (!textEditor) return;
    const board = useBoardStore.getState();
    const { color } = board;
    const fontSize = textEditor.fontSize || board.fontSize;
    const text = textValue.trimEnd();
    if (text.trim()) {
      const isSt = textEditor.kind === 'sticky';
      const isCode = textEditor.kind === 'code';
      const textarea = textareaRef.current;
      const scale = Math.max(0.05, board.stageScale);
      const editorWidth = textarea ? Math.round(textarea.offsetWidth / scale) : undefined;
      const editorHeight = textarea ? Math.round(textarea.offsetHeight / scale) : undefined;
      const contentWidth = isSt
        ? Math.max(180, editorWidth || textEditor.width || 200)
        : isCode
          ? Math.max(320, editorWidth || textEditor.width || 420)
          : textEditor.width;
      const codeHeight = Math.min(620, Math.max(
        180,
        editorHeight || textEditor.height || text.split('\n').length * (fontSize + 5) + 78
      ));
      const contentHeight = isSt
        ? Math.max(160, editorHeight || textEditor.height || 200)
        : isCode
          ? codeHeight
          : textEditor.height;

      if (textEditor.id) {
        const updated = board.elements.map(element => element.id === textEditor.id ? {
          ...element,
          text,
          fontSize,
          width: contentWidth,
          height: contentHeight,
        } : element);
        commitElements(updated);
      } else {
        const newArr: BoardElement[] = [...board.elements, {
          id: uuidv4(),
          type: isSt ? 'sticky' as Tool : isCode ? 'code' as Tool : 'text' as Tool,
          x: textEditor.cx,
          y: textEditor.cy,
          text,
          fill: isSt || isCode ? undefined : color,
          fontSize,
          fontFamily: isCode ? 'Fira Code, Consolas, monospace' : 'Inter, sans-serif',
          strokeWidth: 0,
          width: contentWidth,
          height: contentHeight,
          stickyColor: isSt ? 'yellow' : undefined,
          language: isCode ? 'codigo' : undefined,
        }];
        commitElements(newArr);
      }
    }
    setTextEditor(null); setTextValue('');
  }, [textEditor, textValue, commitElements]);

  const handleChange = useCallback((id: string, attrs: Partial<BoardElement>) => {
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
    commitElements(updated);
  }, [store, commitElements]);

  const duplicateSelectedBoard = useCallback(() => {
    const board = useBoardStore.getState();
    if (board.isReadOnly || board.selectedIds.length === 0) return;

    const offset = 28 / Math.max(0.25, board.stageScale);
    const selected = board.elements.filter(element => board.selectedIds.includes(element.id));
    const clones = selected.map(element => ({
      ...element,
      id: uuidv4(),
      x: (element.x || 0) + offset,
      y: (element.y || 0) + offset,
    }));

    commitElements([...board.elements, ...clones]);
    useBoardStore.getState().setSelectedIds(clones.map(element => element.id));
  }, [commitElements]);

  const moveSelectedLayer = useCallback((direction: 'front' | 'back') => {
    const board = useBoardStore.getState();
    if (board.isReadOnly || board.selectedIds.length === 0) return;

    const selected = board.elements.filter(element => board.selectedIds.includes(element.id));
    const rest = board.elements.filter(element => !board.selectedIds.includes(element.id));
    commitElements(direction === 'front' ? [...rest, ...selected] : [...selected, ...rest]);
  }, [commitElements]);

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

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const s = stageRef.current;
    if (!s) return;
    const old = s.scaleX();
    const ptr = s.getPointerPosition();
    if (!ptr) return;
    const mpt = { x: (ptr.x - s.x()) / old, y: (ptr.y - s.y()) / old };
    const ns = Math.max(0.05, Math.min(10, e.evt.deltaY > 0 ? old / 1.06 : old * 1.06));
    store.setStageScale(ns);
    store.setStagePos({ x: ptr.x - mpt.x * ns, y: ptr.y - mpt.y * ns });
  }, [store]);

  const addImage = useCallback((src: string) => {
    if (useBoardStore.getState().isReadOnly) return;
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      const board = useBoardStore.getState();
      const fitScale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * fitScale));
      const height = Math.max(1, Math.round(img.height * fitScale));
      const newArr = [...board.elements, {
        id: uuidv4(), type: 'image' as Tool, src,
        x: -board.stagePos.x / board.stageScale + window.innerWidth / 2 / board.stageScale - width / 2,
        y: -board.stagePos.y / board.stageScale + window.innerHeight / 2 / board.stageScale - height / 2,
        width, height,
      }];
      commitElements(newArr);
    };
  }, [commitElements]);

  const saveBoard = useCallback(() => {
    const data = JSON.stringify({ elements: store.elements, version: 1 });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `pizarra-${Date.now()}.json`;
    a.click();
  }, [store.elements]);

  const loadBoard = useCallback(() => {
    if (useBoardStore.getState().isReadOnly) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = ev => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (Array.isArray(data.elements)) commitElements(data.elements);
        } catch { alert('Archivo inválido'); }
      };
      fr.readAsText(f);
    };
    input.click();
  }, [commitElements]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const board = useBoardStore.getState();
      const k = e.key.toLowerCase();
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!board.isReadOnly) { e.preventDefault(); deleteSelectedBoard(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === 'z') {
        if (!board.isReadOnly) { e.preventDefault(); undoBoard(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && k === 'z'))) {
        if (!board.isReadOnly) { e.preventDefault(); redoBoard(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveBoard(); }
      if (!board.isReadOnly && (e.key === 'Enter' || e.key === 'F2') && editSelectedContent()) {
        e.preventDefault();
        return;
      }
      if (!board.isReadOnly && (e.ctrlKey || e.metaKey) && k === 'd') {
        e.preventDefault();
        duplicateSelectedBoard();
        return;
      }
      if (k === 'g' && !e.ctrlKey) board.setShowGrid(!board.showGrid);
      if (e.key === '+' || e.key === '=') zoom(1.15);
      if (e.key === '-') zoom(0.85);
      if (e.key === ' ') { e.preventDefault(); board.setTool('pan'); }
      if (board.isReadOnly) return;
      const map: Record<string, Tool> = {
        v: 'select',
        p: 'pen',
        h: 'highlighter',
        e: e.shiftKey ? 'eraser-stroke' : 'eraser',
        r: 'rect',
        c: 'circle',
        l: 'line',
        t: 'text',
        n: 'sticky',
        k: 'code',
      };
      if (map[k] && !e.ctrlKey) board.setTool(map[k]);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !useBoardStore.getState().isReadOnly) useBoardStore.getState().setTool('select');
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData || useBoardStore.getState().isReadOnly) return;
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
  }, [zoom, addImage, saveBoard, deleteSelectedBoard, redoBoard, undoBoard, editSelectedContent, duplicateSelectedBoard]);

  const handleNodeDragStart = useCallback((id: string) => {
    if (!store.selectedIds.includes(id)) return;
    store.selectedIds.forEach(sid => {
      const node = nodeRefs.current[sid];
      if (node) dragStartPos.current[sid] = { x: node.x(), y: node.y() };
    });
  }, [store.selectedIds]);

  const handleNodeDragMove = useCallback((id: string, e: Konva.KonvaEventObject<DragEvent>) => {
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
  const canEditSelected = store.selectedIds.length === 1
    && store.elements.some(element => element.id === store.selectedIds[0] && isEditableContent(element));

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative', touchAction: 'none' }}>
      <Toolbar
        canUndo={store.canUndo()} canRedo={store.canRedo()}
        onUndo={undoBoard} onRedo={redoBoard}
        selectedCount={store.selectedIds.length}
        onDeleteSelected={deleteSelectedBoard}
        canEditSelected={canEditSelected}
        onEditSelected={() => { editSelectedContent(); }}
        onDuplicateSelected={duplicateSelectedBoard}
        onBringToFront={() => moveSelectedLayer('front')}
        onSendToBack={() => moveSelectedLayer('back')}
        onClear={() => { if (confirm('¿Limpiar toda la pizarra?')) clearBoard(); }}
        onExport={() => {
          if (!stageRef.current) return;
          const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
          const a = document.createElement('a'); a.download = 'pizarra.png'; a.href = uri;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
        onImport={e => {
          if (store.isReadOnly) return;
          const f = e.target.files?.[0];
          if (f) {
            const fr = new FileReader();
            fr.onload = ev => addImage(ev.target?.result as string);
            fr.readAsDataURL(f);
          }
        }}
        onZoomIn={() => zoom(1.2)} onZoomOut={() => zoom(0.8)}
        onZoomReset={() => { store.setStageScale(1); store.setStagePos({ x: 0, y: 0 }); }}
        onInsertFormula={handleInsertFormula}
        onOpenGraphModal={() => { setInitialFormula(null); setShowGraph(true); }}
        onShare={() => setShowShare(true)}
        onSave={saveBoard} onLoad={loadBoard}
        readOnly={store.isReadOnly}
      />

      {/* Text editor overlay */}
      {textEditor && (
        <textarea
          ref={textareaRef} value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={e => {
            if (e.key === 'Escape') { setTextEditor(null); setTextValue(''); }
            if (e.key === 'Enter' && textEditor.kind === 'code' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commitText();
            }
            if (e.key === 'Enter' && textEditor.kind !== 'code' && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
          }}
          style={{
            position: 'fixed', zIndex: 500, left: textEditor.sx, top: textEditor.sy,
            width: textEditor.width ? `${textEditor.width * store.stageScale}px` : textEditor.kind === 'code' ? `${420 * store.stageScale}px` : undefined,
            height: textEditor.height ? `${textEditor.height * store.stageScale}px` : textEditor.kind === 'code' ? `${220 * store.stageScale}px` : undefined,
            minWidth: textEditor.kind === 'code' ? 320 : textEditor.kind === 'sticky' ? 180 : 160,
            minHeight: textEditor.kind === 'code' ? 140 : textEditor.kind === 'sticky' ? 120 : 48,
            background: textEditor.kind === 'sticky' ? '#fde68a' : textEditor.kind === 'code' ? '#0f172a' : 'rgba(15,15,20,0.95)',
            border: `2px solid ${textEditor.kind === 'sticky' ? '#f59e0b' : textEditor.kind === 'code' ? '#06b6d4' : textEditor.fill || store.color}`,
            borderRadius: 10,
            color: textEditor.kind === 'sticky' ? '#78350f' : textEditor.kind === 'code' ? '#e2e8f0' : textEditor.fill || store.color,
            outline: 'none', resize: 'both',
            fontSize: `${(textEditor.fontSize || store.fontSize) * store.stageScale}px`,
            fontFamily: textEditor.fontFamily || (textEditor.kind === 'code' ? 'Fira Code, Consolas, monospace' : 'Inter, sans-serif'),
            padding: '10px 14px', lineHeight: textEditor.kind === 'code' ? 1.35 : 1.5,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          placeholder={textEditor.kind === 'sticky' ? 'Escribe tu nota...' : textEditor.kind === 'code' ? 'Pega o escribe el código...' : 'Escribe... (Enter para confirmar)'}
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

      {showGraph && (
        <Suspense fallback={<div className="graph-container graph-loader">Cargando graficador...</div>}>
          <GraphFullscreen
            onClose={() => setShowGraph(false)}
            onInsert={els => {
              if (!store.isReadOnly) {
                const board = useBoardStore.getState();
                const centerX = (window.innerWidth / 2 - board.stagePos.x) / board.stageScale;
                const centerY = (window.innerHeight / 2 - board.stagePos.y) / board.stageScale;
                const offsetX = centerX - window.innerWidth / 2;
                const offsetY = centerY - window.innerHeight / 2;
                const centeredEls = els.map(el => ({
                  ...el,
                  x: el.x === undefined ? el.x : el.x + offsetX,
                  y: el.y === undefined ? el.y : el.y + offsetY,
                }));
                commitElements([...board.elements, ...centeredEls]);
              }
              setShowGraph(false);
            }}
            initialFormula={initialFormula}
            initialIs3D={initialIs3D}
          />
        </Suspense>
      )}

      {showShare && (
        <ShareModal
          onClose={() => setShowShare(false)}
          isConnected={isConnected}
          onConnect={(room, name) => {
            store.setRoomId(room);
            setIsConnected(false);
            connect(room, name, status => setIsConnected(status === 'connected'));
            const url = new URL(window.location.href);
            url.searchParams.set('room', room);
            window.history.replaceState({}, '', url.toString());
          }}
          onDisconnect={() => {
            disconnect();
            store.setRoomId('');
            store.setIsReadOnly(false);
            setIsConnected(false);
            const url = new URL(window.location.href);
            url.searchParams.delete('room');
            url.searchParams.delete('mode');
            window.history.replaceState({}, '', url.toString());
          }}
        />
      )}

      <Stage
        width={window.innerWidth} height={window.innerHeight}
        ref={stageRef}
        x={store.stagePos.x} y={store.stagePos.y}
        scaleX={store.stageScale} scaleY={store.stageScale}
        draggable={store.tool === 'pan'}
        onDragEnd={e => { if (e.target === stageRef.current) store.setStagePos({ x: e.target.x(), y: e.target.y() }); }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
        onWheel={handleWheel} style={{ cursor }}
      >
        {store.showGrid && (
          <Layer>
            <GridLines scale={store.stageScale} pos={store.stagePos} />
          </Layer>
        )}
        <Layer>
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
                    commitElements(filtered);
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
                    commitElements(filtered);
                    return;
                  }
                  if (store.tool !== 'select') return;
                  e.cancelBubble = true;
                  store.setSelectedIds(add ? (store.selectedIds.includes(el.id) ? store.selectedIds.filter(i => i !== el.id) : [...store.selectedIds, el.id]) : [el.id]);
                }}
                onChange={a => handleChange(el.id, a)}
                onEdit={() => { openElementEditor(el); }}
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
              const updated = [...store.elements];
              nodes.forEach(node => {
                const idx = updated.findIndex(e => e.id === node.id());
                if (idx !== -1) {
                  const el = updated[idx];
                  const sx = node.scaleX(), sy = node.scaleY();
                  node.scaleX(1); node.scaleY(1);
                  updated[idx] = { ...el, x: node.x(), y: node.y(), width: Math.max(5, (el.width || 0) * sx), height: Math.max(5, (el.height || 0) * sy), rotation: node.rotation() };
                }
              });
              commitElements(updated);
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
