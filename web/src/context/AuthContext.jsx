// User Management: who is logged in (demo mode for now, see api/userManagement.js).

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateProfile,
} from "../api/userManagement";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser);

  const register = useCallback(async (input) => {
    const u = await registerUser(input);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (input) => {
    const u = await loginUser(input);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const saveProfile = useCallback(async (input) => {
    const u = await updateProfile(input);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, register, login, logout, saveProfile }),
    [user, register, login, logout, saveProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
