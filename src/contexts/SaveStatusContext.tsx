import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusValue {
  status: SaveStatus;
  setStatus: (s: SaveStatus) => void;
}

const SaveStatusContext = createContext<SaveStatusValue | null>(null);

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<SaveStatus>('idle');
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useCallback((s: SaveStatus) => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setStatusState(s);
    // saved/error는 잠시 후 idle로 자동 복귀
    if (s === 'saved') {
      clearTimer.current = setTimeout(() => setStatusState('idle'), 1500);
    } else if (s === 'error') {
      clearTimer.current = setTimeout(() => setStatusState('idle'), 3000);
    }
  }, []);

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  return (
    <SaveStatusContext.Provider value={{ status, setStatus }}>
      {children}
    </SaveStatusContext.Provider>
  );
}

export function useSaveStatus(): SaveStatusValue {
  const ctx = useContext(SaveStatusContext);
  if (!ctx) throw new Error('useSaveStatus must be used within SaveStatusProvider');
  return ctx;
}
