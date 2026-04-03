// client/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useModules } from './ModuleContext';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { hasModule } = useModules();
  const loginEnabled = hasModule('login');

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      
      if (!token || !loginEnabled) {
        setLoading(false);
        return;
      }
      
      try {
        const { data } = await api.get('/auth/verify');
        setUser(data.user);
      } catch (error) {
        console.error('Token inválido:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    verifyToken();
  }, [loginEnabled]);

  const login = async (email, password) => {
    if (!loginEnabled) throw new Error('Login no disponible');
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password, role = 'user') => {
    if (!loginEnabled) throw new Error('Registro no disponible');
    const { data } = await api.post('/auth/register', { name, email, password, role });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    console.log('🚪 Cerrando sesión - El carrito se conserva en localStorage');
    localStorage.removeItem('token');
    setUser(null);
    // NO borramos 'cart' del localStorage
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginEnabled }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}