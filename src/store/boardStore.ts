import { create } from 'zustand';
import type { BoardElement, Tool } from '../types';

const MAX_HISTORY = 60;

interface BoardStore {
  elements: BoardElement[];
  history: BoardElement[][];
  historyIndex: number;
  tool: Tool;
  color: string;
  strokeWidth: number;
  fontSize: number;
  showGrid: boolean;
  selectedIds: string[];
  stagePos: { x: number; y: number };
  stageScale: number;
  roomId: string;
  userName: string;
  peers: { id: string; name: string; color: string; cursor?: { x: number; y: number } }[];

  // Actions
  setElements: (els: BoardElement[]) => void;
  pushHistory: (els: BoardElement[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
  setFontSize: (s: number) => void;
  setShowGrid: (v: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  setStagePos: (pos: { x: number; y: number }) => void;
  setStageScale: (s: number) => void;
  deleteSelected: () => void;
  clearBoard: () => void;
  setRoomId: (id: string) => void;
  setUserName: (n: string) => void;
  setPeers: (peers: any[]) => void;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  elements: [],
  history: [[]],
  historyIndex: 0,
  tool: 'pen',
  color: '#ffffff',
  strokeWidth: 5,
  fontSize: 22,
  showGrid: true,
  selectedIds: [],
  stagePos: { x: 0, y: 0 },
  stageScale: 1,
  roomId: '',
  userName: 'Tú',
  peers: [],

  setElements: (els) => set({ elements: els }),

  pushHistory: (els) => {
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(els);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({
      elements: els,
      history: newHistory,
      historyIndex: Math.min(newHistory.length - 1, MAX_HISTORY - 1),
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    set({ elements: history[newIdx], historyIndex: newIdx });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    set({ elements: history[newIdx], historyIndex: newIdx });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setTool: (t) => set({ tool: t }),
  setColor: (c) => set({ color: c }),
  setStrokeWidth: (w) => set({ strokeWidth: w }),
  setFontSize: (s) => set({ fontSize: s }),
  setShowGrid: (v) => set({ showGrid: v }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setStagePos: (pos) => set({ stagePos: pos }),
  setStageScale: (s) => set({ stageScale: s }),

  deleteSelected: () => {
    const { elements, selectedIds, pushHistory } = get();
    const filtered = elements.filter((e) => !selectedIds.includes(e.id));
    pushHistory(filtered);
    set({ selectedIds: [] });
  },

  clearBoard: () => {
    const { pushHistory } = get();
    pushHistory([]);
    set({ selectedIds: [] });
  },

  setRoomId: (id) => set({ roomId: id }),
  setUserName: (n) => set({ userName: n }),
  setPeers: (peers) => set({ peers }),
}));
