// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useModules } from './contexts/ModuleContext';

import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Home from './pages/Home';
import AdminDashboard from './pages/Admin/AdminDashboard';
import SuperAdminLogin from './pages/SuperAdmin/Login';
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import SectionsManager from './pages/Admin/SectionManager';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import MyOrders from './pages/MyOrders';
import OrderTracking from './pages/OrderTracking';
import Profile from './pages/Profile';
import Wishlist from './pages/Wishlist';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Booking from './pages/Booking';
import MyBookings from './pages/MyBookings';



function App() {
  const { user, loading: authLoading } = useAuth();
  const { hasModule, loading: modulesLoading } = useModules();

  if (authLoading || modulesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  const loginEnabled = hasModule('login');
  const hasEcommerce = hasModule('ecommerce');
  const hasAppointments = hasModule('appointments');

  return (
    <BrowserRouter>
      <Routes>
        {/* Superadmin */}
        <Route path="/superadmin" element={<SuperAdminLogin />} />
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />

        {/* Login/Register */}
        {loginEnabled && (
          <>
            <Route
              path="/login"
              element={
                user ? <Navigate to={user.role === 'admin' ? "/admin" : "/home"} replace /> : <Login />
              }
            />
            <Route
              path="/register"
              element={
                user ? <Navigate to={user.role === 'admin' ? "/admin" : "/home"} replace /> : <Register />
              }
            />
          </>
        )}

        {/* Landing Page */}
        <Route
          path="/"
          element={
            !loginEnabled ? (
              <Landing />
            ) : user ? (
              // Si es admin, redirigir a /admin, si no a /home
              user.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : (
                <Navigate to="/home" replace />
              )
            ) : (
              <Landing />
            )
          }
        />

        {/* Ecommerce - solo si el módulo está activo */}
        {hasEcommerce && (
          <>
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/producto/:slug" element={<ProductDetail />} />
            <Route path="/carrito" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/pedido/confirmacion/:orderNumber" element={<OrderConfirmation />} />
            <Route path="/mis-pedidos" element={<MyOrders />} />
            <Route path="/pedido/seguimiento/:orderNumber" element={<OrderTracking />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/wishlist" element={<Wishlist />} />
          </>
        )}

        {hasAppointments &&(
          <>
            <Route path="/servicios" element={<Services />} />
            <Route path="/servicio/:id" element={<ServiceDetail />} />
            <Route path="/reservar/:serviceId" element={<Booking />} />
            <Route path="/mis-reservas" element={<MyBookings />} />
          </>
        )}

        {/* Home - solo para usuarios normales (no admin) */}
        <Route
          path="/home"
          element={
            loginEnabled && user && user.role !== 'admin' ? (
              <Home />
            ) : loginEnabled && !user ? (
              <Navigate to="/login" />
            ) : (
              <Navigate to="/admin" />
            )
          }
        />

        {/* Panel Admin - solo para admin */}
        <Route
          path="/admin"
          element={
            user && user.role === 'admin'
              ? <AdminDashboard />
              : <Navigate to={loginEnabled ? "/login" : "/"} />
          }
        />
        
        {/* Sections Manager - solo si tiene el módulo de personalización */}
        {hasModule('landingCustomization') && (
          <Route
            path="/admin/sections"
            element={
              user && user.role === 'admin'
                ? <SectionsManager />
                : <Navigate to={loginEnabled ? "/login" : "/"} />
            }
          />
        )}

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;