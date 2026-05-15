import React, { useRef, useEffect } from 'react';
import { Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';

interface URLImageProps {
  imageSrc: string;
  shapeProps: any;
  isSelected: boolean;
  onSelect: (e: any, additive: boolean) => void;
  onChange: (newAttrs: any) => void;
  draggable?: boolean;
}

export const URLImage = ({ imageSrc, shapeProps, isSelected, onSelect, onChange, draggable = false }: URLImageProps) => {
  const [img] = useImage(imageSrc);
  const imageRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <React.Fragment>
      <KonvaImage
        image={img}
        onClick={(e: any) => { e.cancelBubble = true; onSelect(e, e.evt.shiftKey); }}
        onTap={(e: any) => { e.cancelBubble = true; onSelect(e, false); }}
        ref={imageRef}
        {...shapeProps}
        draggable={draggable}
        onDragStart={(e: any) => { e.cancelBubble = true; }}
        onDragMove={(e: any) => { e.cancelBubble = true; }}
        onDragEnd={(e: any) => {
          e.cancelBubble = true;
          onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
        }}
        onTransformStart={(e: any) => { e.cancelBubble = true; }}
        onTransformEnd={(e: any) => {
          e.cancelBubble = true;
          const node = imageRef.current;
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
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};
