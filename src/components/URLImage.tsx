import React from 'react';
import type Konva from 'konva';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type { BoardElement } from '../types';

type SelectEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;
type DragEventObject = Konva.KonvaEventObject<DragEvent>;

interface URLImageProps {
  imageSrc: string;
  shapeProps: BoardElement;
  onSelect: (e: SelectEvent, additive: boolean) => void;
  onChange: (newAttrs: Partial<BoardElement>) => void;
  draggable?: boolean;
  onNode?: (node: Konva.Node | null) => void;
  onDragStart?: (e: DragEventObject) => void;
  onDragMove?: (e: DragEventObject) => void;
}

export const URLImage = ({ imageSrc, shapeProps, onSelect, onChange, draggable = false, onNode, onDragStart, onDragMove }: URLImageProps) => {
  const [img] = useImage(imageSrc);

  return (
    <React.Fragment>
      <KonvaImage
        image={img}
        onClick={(e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect(e, e.evt.shiftKey); }}
        onTap={(e: Konva.KonvaEventObject<TouchEvent>) => { e.cancelBubble = true; onSelect(e, false); }}
        ref={onNode}
        {...shapeProps}
        draggable={draggable}
        onDragStart={(e: DragEventObject) => { e.cancelBubble = true; if (onDragStart) onDragStart(e); }}
        onDragMove={(e: DragEventObject) => { e.cancelBubble = true; if (onDragMove) onDragMove(e); }}
        onDragEnd={(e: DragEventObject) => {
          e.cancelBubble = true;
          onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
        }}
        onTransformStart={(e: Konva.KonvaEventObject<Event>) => { e.cancelBubble = true; }}
      />
    </React.Fragment>
  );
};
