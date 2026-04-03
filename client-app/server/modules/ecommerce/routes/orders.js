// server/routes/orders.js
const express = require('express');
const Order = require('../models/Order');
const auth = require('../../login/middleware/auth');
const Income = require('../../accounting/models/Income');
const CashMovement = require('../../accounting/models/CashMovement');

const router = express.Router();

// Función para generar número de orden
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const count = await Order.countDocuments();
  const sequential = (count + 1).toString().padStart(5, '0');
  return `ORD-${year}-${sequential}`;
}

async function updateCash(tipo, monto, descripcion, referenciaId) {
  const lastMovement = await CashMovement.findOne().sort({ fecha: -1 });
  const saldoAnterior = lastMovement ? lastMovement.saldoNuevo : 0;
  const saldoNuevo = tipo === 'ingreso' ? saldoAnterior + monto : saldoAnterior - monto;
  
  const movement = new CashMovement({
    tipo,
    monto,
    descripcion,
    referenciaId,
    saldoAnterior,
    saldoNuevo
  });
  
  await movement.save();
  return movement;
}

// ============================================
// MARCAR ORDEN COMO PAGADA (con sincronización automática)
// ============================================
router.put('/admin/:id/mark-paid', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        paymentStatus: 'paid',
        status: 'processing',
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    // ============================================
    // Sincronizar automáticamente con contabilidad
    // ============================================
    
    // Verificar si ya se registró en contabilidad
    const existingIncome = await Income.findOne({ pedidoOnlineId: order._id });
    
    if (!existingIncome) {
      // Registrar ingreso en contabilidad
      const income = new Income({
        tipo: 'pedido_online',
        monto: order.total,
        descripcion: `Pedido online #${order.orderNumber}`,
        metodo: order.paymentMethod === 'transfer' ? 'transferencia' : 'efectivo',
        clienteNombre: order.customer.name,
        pedidoOnlineId: order._id,
        esDeuda: false,
        notas: `Pedido ${order.orderNumber} - ${order.items.length} productos`,
        creadoPor: req.user.id
      });
      
      await income.save();
      
      // Actualizar caja
      await updateCash('ingreso', order.total, `Pedido online #${order.orderNumber}`, income._id);
      
      console.log(`✅ Pedido ${order.orderNumber} sincronizado con contabilidad`);
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error al marcar como pagado:', error);
    res.status(500).json({ error: 'Error al marcar como pagado' });
  }
});

// ============================================
// CREAR NUEVA ORDEN
// ============================================
router.post('/', async (req, res) => {
  try {
    console.log('=== ORDEN RECIBIDA EN BACKEND ===');
    console.log('Body completo:', req.body);
    console.log('paymentMethod:', req.body.paymentMethod);
    console.log('paymentStatus:', req.body.paymentStatus);
    
    const orderNumber = await generateOrderNumber();
    
    const order = new Order({
      orderNumber,
      customer: req.body.customer,
      items: req.body.items,
      subtotal: req.body.subtotal,
      shipping: req.body.shipping || 0,
      discount: req.body.discount || 0,
      total: req.body.total,
      userId: req.body.userId || null,
      couponCode: req.body.couponCode || null,
      paymentMethod: req.body.paymentMethod || 'cash',
      paymentStatus: req.body.paymentStatus || 'pending',
      status: req.body.status || 'pending'
    });
    
    console.log('Orden a guardar - paymentMethod:', order.paymentMethod);
    
    await order.save();
    console.log('Orden guardada con paymentMethod:', order.paymentMethod);
    
    res.status(201).json(order);
  } catch (error) {
    console.error('Error al crear orden:', error);
    res.status(500).json({ error: 'Error al crear orden: ' + error.message });
  }
});

// ============================================
// OBTENER ÓRDENES DEL USUARIO
// ============================================
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
});

// ============================================
// OBTENER DETALLE DE ORDEN
// ============================================
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener orden' });
  }
});

// ============================================
// OBTENER TODAS LAS ÓRDENES (admin)
// ============================================
router.get('/admin', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
});

// ============================================
// ACTUALIZAR ESTADO DE ORDEN (admin)
// ============================================
router.put('/admin/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// ============================================
// MARCAR ORDEN COMO PAGADA (admin)
// ============================================
router.put('/admin/:id/mark-paid', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        paymentStatus: 'paid',
        isDebt: false,
        status: 'processing',
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al marcar como pagado' });
  }
});

module.exports = router;