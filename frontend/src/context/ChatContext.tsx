import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  activeCompanyId: string | null;
  activeCompanyName: string | null;
  setContext: (id: string | null, name: string | null) => void;
  isOpen: boolean;
  openChat: () => void;
  setIsOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const setContext = (id: string | null, name: string | null) => {
    setActiveCompanyId(id);
    setActiveCompanyName(name);
  };

  return (
    <ChatContext.Provider value={{ activeCompanyId, activeCompanyName, setContext, isOpen, openChat: () => setIsOpen(true), setIsOpen }}>
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
