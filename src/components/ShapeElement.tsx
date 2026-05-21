import React from 'react';
import type Konva from 'konva';
import { Rect, Circle, Line, Text, Arrow, Group, RegularPolygon } from 'react-konva';
import type { BoardElement } from '../types';

type SelectEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;
type DragEventObject = Konva.KonvaEventObject<DragEvent>;

interface ShapeElementProps {
  shapeProps: BoardElement;
  onSelect: (e: SelectEvent, additive: boolean) => void;
  onChange: (newAttrs: Partial<BoardElement>) => void;
  onEdit?: () => void;
  draggable?: boolean;
  onNode?: (node: Konva.Node | null) => void;
  onDragStart?: (e: DragEventObject) => void;
  onDragMove?: (e: DragEventObject) => void;
}

const STICKY_COLORS: Record<string, { bg: string; text: string }> = {
  yellow: { bg: '#fde68a', text: '#78350f' },
  pink: { bg: '#fbcfe8', text: '#831843' },
  green: { bg: '#bbf7d0', text: '#14532d' },
  blue: { bg: '#bfdbfe', text: '#1e3a8a' },
  purple: { bg: '#e9d5ff', text: '#581c87' },
  orange: { bg: '#fed7aa', text: '#7c2d12' },
};

export const ShapeElement = ({
  shapeProps, onSelect, onChange,
  draggable = false, onNode, onDragStart, onDragMove, onEdit
}: ShapeElementProps) => {

  const handleDragEnd = (e: DragEventObject) => {
    e.cancelBubble = true;
    onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
  };

  const commonProps = {
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect(e, e.evt.shiftKey); },
    onTap: (e: Konva.KonvaEventObject<TouchEvent>) => { e.cancelBubble = true; onSelect(e, false); },
    onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onEdit?.(); },
    onDblTap: (e: Konva.KonvaEventObject<TouchEvent>) => { e.cancelBubble = true; onEdit?.(); },
    onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.buttons === 1 && onSelect) {
        onSelect(e, false);
      }
    },
    ref: onNode,
    ...shapeProps,
    draggable,
    onDragStart: (e: DragEventObject) => { e.cancelBubble = true; if (onDragStart) onDragStart(e); },
    onDragMove: (e: DragEventObject) => { e.cancelBubble = true; if (onDragMove) onDragMove(e); },
    onDragEnd: handleDragEnd,
    onTransformStart: (e: Konva.KonvaEventObject<Event>) => { e.cancelBubble = true; },
  };

  // Highlighter mode
  const isHighlighter = shapeProps.isHighlighter || shapeProps.type === 'highlighter';
  const lineProps = isHighlighter
    ? { ...commonProps, opacity: 0.45, lineCap: 'round' as const, lineJoin: 'round' as const, globalCompositeOperation: 'multiply' as const }
    : { ...commonProps };

  return (
    <React.Fragment>
      {/* Rectangle */}
      {shapeProps.type === 'rect' && (
        <Rect
          {...commonProps}
          cornerRadius={4}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={shapeProps.fill !== 'transparent' && shapeProps.fill ? 6 : 0}
          shadowOffset={{ x: 0, y: 2 }}
          shadowOpacity={0.3}
        />
      )}

      {/* Circle/Ellipse */}
      {shapeProps.type === 'circle' && (
        <Circle
          {...commonProps}
          radius={Math.max((shapeProps.width || 0), (shapeProps.height || 0)) / 2}
          offsetX={-(shapeProps.width || 0) / 2}
          offsetY={-(shapeProps.height || 0) / 2}
        />
      )}

      {/* Triangle */}
      {shapeProps.type === 'triangle' && (
        <RegularPolygon
          {...commonProps}
          sides={3}
          radius={Math.max((shapeProps.width || 60), (shapeProps.height || 60)) / 2}
        />
      )}

      {/* Pen / Line (regular + highlighter) */}
      {(shapeProps.type === 'pen' || shapeProps.type === 'highlighter') && (
        <Line
          {...lineProps}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(20, shapeProps.strokeWidth || 5)}
        />
      )}

      {/* Eraser */}
      {shapeProps.type === 'eraser' && (
        <Line
          {...commonProps}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="destination-out"
          hitStrokeWidth={Math.max(20, shapeProps.strokeWidth || 5)}
        />
      )}

      {/* Straight line */}
      {shapeProps.type === 'line' && (
        <Line
          {...commonProps}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(20, shapeProps.strokeWidth || 5)}
        />
      )}

      {/* Arrow */}
      {shapeProps.type === 'arrow' && (
        <Arrow
          {...commonProps}
          points={shapeProps.points || []}
          pointerLength={12}
          pointerWidth={10}
          fill={shapeProps.stroke}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* Axis (Cartesian) */}
      {shapeProps.type === 'axis' && (
        <Group {...commonProps}>
          <Arrow points={[-120, 0, 120, 0]} stroke={shapeProps.stroke} strokeWidth={shapeProps.strokeWidth || 2}
            pointerLength={10} pointerWidth={8} fill={shapeProps.stroke} />
          <Arrow points={[0, 120, 0, -120]} stroke={shapeProps.stroke} strokeWidth={shapeProps.strokeWidth || 2}
            pointerLength={10} pointerWidth={8} fill={shapeProps.stroke} />
          <Text text="X" x={126} y={-7} fill={shapeProps.stroke} fontSize={13} fontStyle="bold" />
          <Text text="Y" x={-6} y={-135} fill={shapeProps.stroke} fontSize={13} fontStyle="bold" />
          <Text text="O" x={4} y={4} fill={shapeProps.stroke} fontSize={11} />
          {/* Tick marks */}
          {[-3, -2, -1, 1, 2, 3].map(n => (
            <React.Fragment key={n}>
              <Line key={`xt${n}`} points={[n * 40, -4, n * 40, 4]} stroke={shapeProps.stroke} strokeWidth={1} opacity={0.5} />
              <Line key={`yt${n}`} points={[-4, n * 40, 4, n * 40]} stroke={shapeProps.stroke} strokeWidth={1} opacity={0.5} />
              <Text key={`txl${n}`} text={String(n)} x={n * 40 - 6} y={8} fill={shapeProps.stroke} fontSize={9} opacity={0.6} />
              <Text key={`tyl${n}`} text={String(-n)} x={8} y={n * 40 - 5} fill={shapeProps.stroke} fontSize={9} opacity={0.6} />
            </React.Fragment>
          ))}
        </Group>
      )}

      {/* Regular text */}
      {shapeProps.type === 'text' && (
        <Text
          {...commonProps}
          fontSize={shapeProps.fontSize || 22}
          fontFamily={shapeProps.fontFamily || 'Inter, sans-serif'}
          perfectDrawEnabled={false}
        />
      )}

      {/* Sticky Note */}
      {shapeProps.type === 'sticky' && (() => {
        const sc = STICKY_COLORS[shapeProps.stickyColor || 'yellow'];
        const w = shapeProps.width || 200;
        const h = shapeProps.height || 200;
        return (
          <Group {...commonProps}>
            <Rect
              width={w} height={h}
              fill={sc.bg}
              cornerRadius={6}
              shadowColor="rgba(0,0,0,0.3)"
              shadowBlur={8}
              shadowOffset={{ x: 2, y: 4 }}
              shadowOpacity={0.4}
            />
            {/* Top fold effect */}
            <Rect width={w} height={8} fill="rgba(0,0,0,0.08)" cornerRadius={[6, 6, 0, 0]} />
            <Text
              text={shapeProps.text || 'Nota adhesiva'}
              x={12} y={20}
              width={w - 24}
              height={h - 32}
              fill={sc.text}
              fontSize={shapeProps.fontSize || 15}
              fontFamily="Inter, sans-serif"
              fontStyle="500"
              wrap="word"
              ellipsis
            />
          </Group>
        );
      })()}

      {/* Code block */}
      {shapeProps.type === 'code' && (() => {
        const w = shapeProps.width || 380;
        const h = shapeProps.height || 220;
        return (
          <Group {...commonProps}>
            <Rect
              width={w}
              height={h}
              fill="#0f172a"
              stroke="#334155"
              strokeWidth={1}
              cornerRadius={6}
              shadowColor="rgba(0,0,0,0.45)"
              shadowBlur={10}
              shadowOffset={{ x: 1, y: 4 }}
              shadowOpacity={0.45}
            />
            <Rect width={w} height={30} fill="#111827" cornerRadius={[6, 6, 0, 0]} />
            <Circle x={16} y={15} radius={4} fill="#fb7185" />
            <Circle x={30} y={15} radius={4} fill="#fbbf24" />
            <Circle x={44} y={15} radius={4} fill="#34d399" />
            <Text
              text={shapeProps.language || 'codigo'}
              x={w - 94}
              y={9}
              width={82}
              align="right"
              fill="#94a3b8"
              fontSize={11}
              fontFamily="Fira Code, monospace"
            />
            <Text
              text={shapeProps.text || '// Escribe un ejemplo'}
              x={16}
              y={44}
              width={w - 32}
              height={h - 58}
              fill="#e2e8f0"
              fontSize={shapeProps.fontSize || 16}
              fontFamily="Fira Code, Consolas, monospace"
              lineHeight={1.35}
              wrap="word"
              ellipsis
              perfectDrawEnabled={false}
            />
          </Group>
        );
      })()}
    </React.Fragment>
  );
};
