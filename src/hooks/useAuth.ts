// useAuth.ts — manages auth token, user info, and login/register API calls

import { useState, useCallback, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'velotype_auth_token';
const USER_KEY = 'velotype_auth_user';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  rating: number | null;           // hidden MMR (null = unranked)
  competitiveElo: number | null;   // null until Apex; starts at 0 on promotion
  placementGamesPlayed: number;    // 0–5, how many placement games completed
  createdAt: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

function loadPersistedAuth(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      return { token, user: JSON.parse(userJson) as AuthUser };
    }
  } catch { /* ignore */ }
  return { token: null, user: null };
}

function persistAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(loadPersistedAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!auth.token) return null;
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) {
        clearAuth();
        setAuth({ token: null, user: null });
        return null;
      }

      const data = await res.json();
      const user: AuthUser = {
        id: data.id,
        username: data.username,
        email: data.email,
        rating: data.rating,
        competitiveElo: data.competitiveElo ?? null,
        placementGamesPlayed: data.placementGamesPlayed ?? 0,
        createdAt: data.createdAt,
      };
      setAuth((prev) => ({ ...prev, user }));
      persistAuth(auth.token, user);
      return user;
    } catch {
      return null;
    }
  }, [auth.token]);

  // Fetch fresh profile using stored token on mount.
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed');
        return false;
      }
      const user: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        rating: data.user.rating,
        competitiveElo: data.user.competitiveElo ?? null,
        placementGamesPlayed: data.user.placementGamesPlayed ?? 0,
        createdAt: data.user.createdAt,
      };
      persistAuth(data.token, user);
      setAuth({ token: data.token, user });
      return true;
    } catch (err) {
      setError('Network error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return false;
      }
      const user: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        rating: data.user.rating,
        competitiveElo: data.user.competitiveElo ?? null,
        placementGamesPlayed: data.user.placementGamesPlayed ?? 0,
        createdAt: data.user.createdAt,
      };
      persistAuth(data.token, user);
      setAuth({ token: data.token, user });
      return true;
    } catch (err) {
      setError('Network error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuth({ token: null, user: null });
  }, []);

  return {
    token: auth.token,
    user: auth.user,
    isAuthenticated: !!auth.token && !!auth.user,
    loading,
    error,
    register,
    login,
    logout,
    refreshProfile,
    clearError: () => setError(null),
  };
}
