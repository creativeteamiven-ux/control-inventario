import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw) as User;
    return u?.id && u?.email ? u : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem('accessToken') ? getStoredUser() : null
  );
  const [isLoading, setIsLoading] = useState(() => !(localStorage.getItem('accessToken') && getStoredUser()));

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const { data } = await api.get<{ id: string; name: string; email: string; role: string; permissions?: string[]; avatar?: string }>('/api/auth/me');
        const u = { id: data.id, name: data.name, email: data.email, role: data.role, permissions: data.permissions, avatar: data.avatar };
        localStorage.setItem('user', JSON.stringify(u));
        setUser(u);
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      }
    } else {
      localStorage.removeItem('user');
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* ignore */
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
