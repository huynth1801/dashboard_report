import React, { createContext, useContext, useState, useEffect } from "react";
import { getToken, setToken, clearToken } from "./api";
import { jwtDecode } from "jwt-decode";

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isReady: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        // Ensure token has not expired
        if (decoded.exp * 1000 < Date.now()) {
          throw new Error("Token expired");
        }
        setUser({
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
        });
      } catch (e) {
        clearToken();
      }
    }
    setIsReady(true);
  }, []);

  const login = (token: string) => {
    setToken(token);
    try {
      const decoded: any = jwtDecode(token);
      setUser({
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      });
      window.location.href = "/dashboard";
    } catch (e) {
      console.error("Invalid token");
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}
