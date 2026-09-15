import React, { useState, useCallback } from 'react';

interface SplitterProps {
  direction: 'horizontal' | 'vertical';
  onDrag: (delta: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  title?: string;
}

export const Splitter: React.FC<SplitterProps> = ({
  direction,
  onDrag,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  className = '',
  title = '拖曳調整大小，雙擊可重設',
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      onDragStart?.();

      let lastPos = direction === 'horizontal' ? e.clientY : e.clientX;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const currentPos = direction === 'horizontal' ? moveEvent.clientY : moveEvent.clientX;
        const delta = currentPos - lastPos;
        lastPos = currentPos;
        onDrag(delta);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        try {
          (e.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
        } catch {
          // ignore if already released
        }
        setIsDragging(false);
        onDragEnd?.();
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [direction, onDrag, onDragStart, onDragEnd]
  );

  const isH = direction === 'horizontal';

  return (
    <div
      onPointerDown={handlePointerDown}
      onDoubleClick={onDoubleClick}
      title={title}
      role="separator"
      aria-orientation={isH ? 'horizontal' : 'vertical'}
      className={`relative select-none z-20 transition-colors flex items-center justify-center ${
        isH
          ? 'h-2 w-full cursor-row-resize border-y border-cyber-border hover:border-cyber-line/70'
          : 'w-2 h-full cursor-col-resize border-x border-cyber-border hover:border-cyber-line/70'
      } ${
        isDragging
          ? 'bg-cyber-line/25 border-cyber-line shadow-[0_0_8px_rgba(0,255,102,0.4)]'
          : 'bg-black/80 hover:bg-cyber-line/10'
      } ${className}`}
    >
      {/* Decorative Cyber Grip Indicator */}
      <div
        className={`pointer-events-none transition-colors ${
          isH ? 'w-12 h-0.5 flex gap-1 justify-center' : 'h-12 w-0.5 flex flex-col gap-1 justify-center'
        }`}
      >
        <span
          className={`rounded-full transition-colors ${
            isH ? 'w-1.5 h-0.5' : 'h-1.5 w-0.5'
          } ${isDragging ? 'bg-cyber-line shadow-[0_0_4px_#00ff66]' : 'bg-cyber-dim group-hover:bg-cyber-line'}`}
        />
        <span
          className={`rounded-full transition-colors ${
            isH ? 'w-1.5 h-0.5' : 'h-1.5 w-0.5'
          } ${isDragging ? 'bg-cyber-line shadow-[0_0_4px_#00ff66]' : 'bg-cyber-dim group-hover:bg-cyber-line'}`}
        />
        <span
          className={`rounded-full transition-colors ${
            isH ? 'w-1.5 h-0.5' : 'h-1.5 w-0.5'
          } ${isDragging ? 'bg-cyber-line shadow-[0_0_4px_#00ff66]' : 'bg-cyber-dim group-hover:bg-cyber-line'}`}
        />
      </div>
    </div>
  );
};
