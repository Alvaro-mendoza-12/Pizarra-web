export type Tool =
  | 'select'
  | 'pan'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'eraser-stroke'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'text'
  | 'image'
  | 'arrow'
  | 'axis'
  | 'graph'
  | 'sticky'
  | 'laser';

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
  opacity?: number;
  // Sticky note
  stickyColor?: string;
  // Highlighter
  isHighlighter?: boolean;
}

export type Point = { x: number; y: number };
