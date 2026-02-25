import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { EditalItem } from '@/components/proposta/EditalUploader';

const STORAGE_KEY = 'proposta_cart_items';

interface PropostaCartContextType {
  pendingItems: EditalItem[];
  addItem: (item: EditalItem) => void;
  clearPending: () => void;
  hasPending: boolean;
}

const PropostaCartContext = createContext<PropostaCartContextType>({
  pendingItems: [],
  addItem: () => {},
  clearPending: () => {},
  hasPending: false,
});

export function PropostaCartProvider({ children }: { children: ReactNode }) {
  const [pendingItems, setPendingItems] = useState<EditalItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingItems));
  }, [pendingItems]);

  const addItem = useCallback((item: EditalItem) => {
    setPendingItems(prev => [...prev, item]);
  }, []);

  const clearPending = useCallback(() => {
    setPendingItems([]);
  }, []);

  return (
    <PropostaCartContext.Provider value={{ pendingItems, addItem, clearPending, hasPending: pendingItems.length > 0 }}>
      {children}
    </PropostaCartContext.Provider>
  );
}

export const usePropostaCart = () => useContext(PropostaCartContext);
