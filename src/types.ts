export type Tool = 'select' | 'pan' | 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' | 'image';

export interface BoardElement {
  id: string;
  type: Tool;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: number[];
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  src?: string;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  isLocked?: boolean;
}

export type Point = { x: number; y: number };
