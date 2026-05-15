import React, { useRef, useEffect } from 'react';
import { Rect, Circle, Line, Text, Transformer, Arrow, Group } from 'react-konva';
import type { BoardElement } from '../types';

interface ShapeElementProps {
  shapeProps: BoardElement;
  isSelected: boolean;
  onSelect: (e: any, additive: boolean) => void;
  onChange: (newAttrs: any) => void;
  draggable?: boolean;
}

export const ShapeElement = ({ shapeProps, isSelected, onSelect, onChange, draggable = false }: ShapeElementProps) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, shapeProps.type]);

  const handleDragEnd = (e: any) => {
    e.cancelBubble = true;
    onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = (e: any) => {
    e.cancelBubble = true;
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      ...shapeProps,
      x: node.x(),
      y: node.y(),
      width: Math.max(5, (node.width() || 0) * scaleX),
      height: Math.max(5, (node.height() || 0) * scaleY),
      rotation: node.rotation(),
    });
  };

  const commonProps = {
    onClick: (e: any) => { e.cancelBubble = true; onSelect(e, e.evt.shiftKey); },
    onTap: (e: any) => { e.cancelBubble = true; onSelect(e, false); },
    ref: shapeRef,
    ...shapeProps,
    draggable,
    onDragStart: (e: any) => { e.cancelBubble = true; },
    onDragMove: (e: any) => { e.cancelBubble = true; },
    onDragEnd: handleDragEnd,
    onTransformStart: (e: any) => { e.cancelBubble = true; },
    onTransformEnd: handleTransformEnd,
  };

  return (
    <React.Fragment>
      {shapeProps.type === 'rect' && (
        <Rect {...commonProps} />
      )}
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
          <Arrow
            points={[-100, 0, 100, 0]}
            stroke={shapeProps.stroke}
            strokeWidth={shapeProps.strokeWidth}
            pointerLength={10}
            pointerWidth={10}
            fill={shapeProps.stroke}
          />
          <Arrow
            points={[0, 100, 0, -100]}
            stroke={shapeProps.stroke}
            strokeWidth={shapeProps.strokeWidth}
            pointerLength={10}
            pointerWidth={10}
            fill={shapeProps.stroke}
          />
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

      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
          rotateEnabled={true}
          enabledAnchors={shapeProps.type === 'text' ? ['middle-left', 'middle-right'] : undefined}
        />
      )}
    </React.Fragment>
  );
};
