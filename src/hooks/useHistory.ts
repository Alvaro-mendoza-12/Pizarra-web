import { useState, useCallback } from 'react';
import type { BoardElement } from '../types';

export function useHistory(initial: BoardElement[] = []) {
  const [stack, setStack] = useState<BoardElement[][]>([[...initial]]);
  const [step, setStep] = useState(0);

  const present = stack[step] ?? [];

  const push = useCallback((newState: BoardElement[]) => {
    setStack(prev => {
      const next = prev.slice(0, step + 1);
      return [...next, [...newState]];
    });
    setStep(s => s + 1);
  }, [step]);

  const undo = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
  }, []);

  const redo = useCallback(() => {
    setStack(prev => {
      setStep(s => Math.min(prev.length - 1, s + 1));
      return prev;
    });
  }, []);

  const canUndo = step > 0;
  const canRedo = step < stack.length - 1;

  return { present, push, undo, redo, canUndo, canRedo };
}
