import React from 'react';
import { Rect, Circle, Line, Text, Arrow, Group } from 'react-konva';
import type { BoardElement } from '../types';

interface ShapeElementProps {
  shapeProps: BoardElement;
  onSelect: (e: any, additive: boolean) => void;
  onChange: (newAttrs: any) => void;
  draggable?: boolean;
  onNode?: (node: any) => void;
  onDragStart?: (e: any) => void;
  onDragMove?: (e: any) => void;
}

export const ShapeElement = ({ shapeProps, onSelect, onChange, draggable = false, onNode, onDragStart, onDragMove }: ShapeElementProps) => {

  const handleDragEnd = (e: any) => {
    e.cancelBubble = true;
    onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
  };

  const commonProps = {
    onClick: (e: any) => { e.cancelBubble = true; onSelect(e, e.evt.shiftKey); },
    onTap: (e: any) => { e.cancelBubble = true; onSelect(e, false); },
    ref: onNode,
    ...shapeProps,
    draggable,
    onDragStart: (e: any) => { e.cancelBubble = true; if (onDragStart) onDragStart(e); },
    onDragMove: (e: any) => { e.cancelBubble = true; if (onDragMove) onDragMove(e); },
    onDragEnd: handleDragEnd,
    onTransformStart: (e: any) => { e.cancelBubble = true; },
  };

  return (
    <React.Fragment>
      {shapeProps.type === 'rect' && <Rect {...commonProps} />}
      {shapeProps.type === 'circle' && (
        <Circle
          {...commonProps}
          radius={Math.max((shapeProps.width || 0), (shapeProps.height || 0)) / 2}
          offsetX={-(shapeProps.width || 0) / 2}
          offsetY={-(shapeProps.height || 0) / 2}
        />
      )}
      {(shapeProps.type === 'pen' || shapeProps.type === 'eraser' || shapeProps.type === 'line') && (
        <Line
          {...commonProps}
          tension={shapeProps.type === 'pen' ? 0.5 : 0}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation={shapeProps.type === 'eraser' ? 'destination-out' : 'source-over'}
          hitStrokeWidth={Math.max(20, shapeProps.strokeWidth || 5)}
        />
      )}
      {shapeProps.type === 'arrow' && (
        <Arrow
          {...commonProps}
          points={shapeProps.points || []}
          pointerLength={10}
          pointerWidth={10}
          fill={shapeProps.stroke}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {shapeProps.type === 'axis' && (
        <Group {...commonProps}>
          <Arrow points={[-100, 0, 100, 0]} stroke={shapeProps.stroke} strokeWidth={shapeProps.strokeWidth} pointerLength={10} pointerWidth={10} fill={shapeProps.stroke} />
          <Arrow points={[0, 100, 0, -100]} stroke={shapeProps.stroke} strokeWidth={shapeProps.strokeWidth} pointerLength={10} pointerWidth={10} fill={shapeProps.stroke} />
          <Text text="X" x={105} y={-5} fill={shapeProps.stroke} fontSize={14} />
          <Text text="Y" x={-5} y={-115} fill={shapeProps.stroke} fontSize={14} />
        </Group>
      )}
      {shapeProps.type === 'text' && (
        <Text
          {...commonProps}
          fontSize={shapeProps.fontSize || 22}
          fontFamily={shapeProps.fontFamily || 'Inter, sans-serif'}
          perfectDrawEnabled={false}
        />
      )}
    </React.Fragment>
  );
};
