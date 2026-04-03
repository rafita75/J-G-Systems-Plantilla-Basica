// client/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ModuleProvider } from './contexts/ModuleContext';
import { SectionProvider } from './contexts/SectionContext';
import { CartProvider } from './contexts/CartContext';
import './index.css';
import { WishlistProvider } from './contexts/WishlistContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ModuleProvider>
      <AuthProvider>
        <SectionProvider>
          <CartProvider>
            <WishlistProvider>
              <App />
            </WishlistProvider>
          </CartProvider>
        </SectionProvider>
      </AuthProvider>
    </ModuleProvider>
  </React.StrictMode>
);