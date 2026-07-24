import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  activeCompanyId: string | null;
  activeCompanyName: string | null;
  setContext: (id: string | null, name: string | null) => void;
  isOpen: boolean;
  openChat: () => void;
  setIsOpen: (open: boolean) => void;
  // Set by the Landing page's search box — ChatWidget (mounted globally) picks this up,
  // auto-sends it, then clears it.
  pendingQuery: string | null;
  setPendingQuery: (query: string | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  const setContext = (id: string | null, name: string | null) => {
    setActiveCompanyId(id);
    setActiveCompanyName(name);
  };

  return (
    <ChatContext.Provider value={{ activeCompanyId, activeCompanyName, setContext, isOpen, openChat: () => setIsOpen(true), setIsOpen, pendingQuery, setPendingQuery }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
