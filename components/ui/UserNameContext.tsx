'use client';

import { createContext, useContext, useState } from 'react';

interface UserNameContextType {
  userName: string;
  setUserName: (name: string) => void;
}

const UserNameContext = createContext<UserNameContextType | null>(null);

export function UserNameProvider({ initialName, children }: { initialName: string; children: React.ReactNode }) {
  const [userName, setUserName] = useState(initialName);
  return (
    <UserNameContext.Provider value={{ userName, setUserName }}>
      {children}
    </UserNameContext.Provider>
  );
}

export function useUserName() {
  const ctx = useContext(UserNameContext);
  if (ctx === null) throw new Error('useUserName must be used within UserNameProvider');
  return ctx;
}
