import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';

interface URLImageProps {
  imageSrc: string;
  shapeProps: any;
  onSelect: (e: any, additive: boolean) => void;
  onChange: (newAttrs: any) => void;
  draggable?: boolean;
  onNode?: (node: any) => void;
  onDragStart?: (e: any) => void;
  onDragMove?: (e: any) => void;
}

export const URLImage = ({ imageSrc, shapeProps, onSelect, onChange, draggable = false, onNode, onDragStart, onDragMove }: URLImageProps) => {
  const [img] = useImage(imageSrc);

  return (
    <React.Fragment>
      <KonvaImage
        image={img}
        onClick={(e: any) => { e.cancelBubble = true; onSelect(e, e.evt.shiftKey); }}
        onTap={(e: any) => { e.cancelBubble = true; onSelect(e, false); }}
        ref={onNode}
        {...shapeProps}
        draggable={draggable}
        onDragStart={(e: any) => { e.cancelBubble = true; if (onDragStart) onDragStart(e); }}
        onDragMove={(e: any) => { e.cancelBubble = true; if (onDragMove) onDragMove(e); }}
        onDragEnd={(e: any) => {
          e.cancelBubble = true;
          onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
        }}
        onTransformStart={(e: any) => { e.cancelBubble = true; }}
      />
    </React.Fragment>
  );
};
