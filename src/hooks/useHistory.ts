import { useState, useCallback } from 'react';
import type { BoardElement } from '../types';

export function useHistory(initial: BoardElement[] = []) {
  const [history, setHistory] = useState<BoardElement[][]>([initial]);
  const [step, setStep] = useState(0);

  const pushHistory = useCallback((newState: BoardElement[]) => {
    setHistory(prev => {
      const next = prev.slice(0, step + 1);
      return [...next, [...newState]];
    });
    setStep(s => s + 1);
  }, [step]);

  const undoHistory = useCallback(() => {
    if (step > 0) {
      const nextStep = step - 1;
      setStep(nextStep);
      return history[nextStep];
    }
    return history[step];
  }, [history, step]);

  const redoHistory = useCallback(() => {
    if (step < history.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      return history[nextStep];
    }
    return history[step];
  }, [history, step]);

  const clearHistory = useCallback((initialState: BoardElement[] = []) => {
    setHistory([initialState]);
    setStep(0);
  }, []);

  return { 
    pushHistory, 
    undoHistory, 
    redoHistory, 
    clearHistory,
    canUndo: step > 0, 
    canRedo: step < history.length - 1 
  };
}
