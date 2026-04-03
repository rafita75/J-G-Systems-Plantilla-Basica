// server/routes/accounting.js
const express = require('express');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const CustomerDebt = require('../models/CustomerDebt');
const BusinessDebt = require('../models/BusinessDebt');
const CashMovement = require('../models/CashMovement');
const auth = require('../middleware/auth');
const SiteConfig = require('../models/SiteConfig');

const router = express.Router();

async function checkAccountingModule(req, res, next) {
  try {
    const config = await SiteConfig.findOne();
    if (!config?.modules?.accounting) {
      return res.status(403).json({ error: 'Módulo de contabilidad no disponible. Contrata este módulo para acceder.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar módulo' });
  }
}


router.use(checkAccountingModule);

// ============================================
// OBTENER SALDO ACTUAL DE CAJA
// ============================================
async function getCurrentCashBalance() {
  const lastMovement = await CashMovement.findOne().sort({ fecha: -1 });
  return lastMovement ? lastMovement.saldoNuevo : 0;
}

// ============================================
// ACTUALIZAR CAJA (SOLO PARA MOVIMIENTOS REALES)
// ============================================
async function updateCash(tipo, monto, descripcion, referenciaId) {
  const saldoAnterior = await getCurrentCashBalance();
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
// REGISTRAR VENTA RÁPIDA (POS)
// ============================================
router.post('/sale', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const { monto, descripcion, metodo, clienteNombre, clienteTelefono, esDeuda, notas } = req.body;
    
    console.log('=== REGISTRANDO VENTA ===');
    console.log('Body recibido:', req.body);
    console.log('esDeuda valor:', esDeuda);
    console.log('esDeuda tipo:', typeof esDeuda);
    console.log('clienteNombre:', clienteNombre);
    
    // Crear el ingreso (para historial)
    const income = new Income({
      tipo: 'venta_rapida',
      monto,
      descripcion,
      metodo: metodo || 'efectivo',
      clienteNombre: clienteNombre || '',
      clienteTelefono: clienteTelefono || '',
      esDeuda: esDeuda === true || esDeuda === 'true',
      notas: notas || '',
      creadoPor: req.user.id
    });
    
    await income.save();
    console.log('Ingreso guardado:', income);
    
    // Si es deuda, NO actualizar caja, solo crear deuda
    const isDebt = esDeuda === true || esDeuda === 'true';
    
    if (isDebt) {
      console.log('Creando deuda para cliente:', clienteNombre);
      const debt = new CustomerDebt({
        clienteNombre: clienteNombre || 'Cliente sin nombre',
        clienteTelefono: clienteTelefono || '',
        monto,
        notas: `Venta: ${descripcion} - ${new Date().toLocaleDateString()}`
      });
      await debt.save();
      console.log('Deuda creada:', debt);
    } else {
      // Si NO es deuda, actualizar caja
      console.log('Actualizando caja con ingreso');
      await updateCash('ingreso', monto, `Venta: ${descripcion}`, income._id);
    }
    
    res.status(201).json(income);
  } catch (error) {
    console.error('Error al registrar venta:', error);
    res.status(500).json({ error: 'Error al registrar venta' });
  }
});

// ============================================
// REGISTRAR GASTO
// ============================================
router.post('/expense', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const expense = new Expense({
      ...req.body,
      creadoPor: req.user.id
    });
    
    await expense.save();
    await updateCash('gasto', expense.monto, `Gasto: ${expense.descripcion}`, expense._id);
    
    res.status(201).json(expense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar gasto' });
  }
});

// ============================================
// REGISTRAR DEUDA DE CLIENTE (sin afectar caja)
// ============================================
router.post('/customer-debt', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const debt = new CustomerDebt(req.body);
    await debt.save();
    res.status(201).json(debt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar deuda' });
  }
});

// ============================================
// PAGAR DEUDA DE CLIENTE (afecta caja)
// ============================================
router.put('/customer-debt/:id/pay', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const debt = await CustomerDebt.findById(req.params.id);
    if (!debt) {
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }
    
    if (debt.estado === 'pagado') {
      return res.status(400).json({ error: 'Esta deuda ya fue pagada' });
    }
    
    debt.estado = 'pagado';
    debt.fechaPago = Date.now();
    await debt.save();
    
    // Registrar ingreso por pago de deuda (afecta caja)
    const income = new Income({
      tipo: 'manual',
      monto: debt.monto,
      descripcion: `Pago de deuda - ${debt.clienteNombre}`,
      metodo: req.body.metodo || 'efectivo',
      clienteNombre: debt.clienteNombre,
      esDeuda: false,
      notas: `Deuda pagada: ${debt._id}`
    });
    await income.save();
    
    await updateCash('ingreso', debt.monto, `Pago de deuda: ${debt.clienteNombre}`, income._id);
    
    res.json(debt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al pagar deuda' });
  }
});

// ============================================
// REGISTRAR DEUDA DEL NEGOCIO (sin afectar caja)
// ============================================
router.post('/business-debt', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const debt = new BusinessDebt(req.body);
    await debt.save();
    res.status(201).json(debt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar deuda' });
  }
});

// ============================================
// PAGAR DEUDA DEL NEGOCIO (afecta caja)
// ============================================
router.put('/business-debt/:id/pay', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const debt = await BusinessDebt.findById(req.params.id);
    if (!debt) {
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }
    
    if (debt.estado === 'pagado') {
      return res.status(400).json({ error: 'Esta deuda ya fue pagada' });
    }
    
    debt.estado = 'pagado';
    debt.fechaPago = Date.now();
    await debt.save();
    
    // Registrar gasto por pago de deuda (afecta caja)
    const expense = new Expense({
      monto: debt.monto,
      categoria: 'insumos',
      descripcion: `Pago a proveedor: ${debt.proveedor}`,
      notas: `Deuda pagada: ${debt._id}`
    });
    await expense.save();
    
    await updateCash('gasto', debt.monto, `Pago a proveedor: ${debt.proveedor}`, expense._id);
    
    res.json(debt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al pagar deuda' });
  }
});

// ============================================
// OBTENER DASHBOARD
// ============================================
router.get('/dashboard', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const semanaAtras = new Date();
    semanaAtras.setDate(semanaAtras.getDate() - 7);
    
    const mesAtras = new Date();
    mesAtras.setMonth(mesAtras.getMonth() - 1);
    
    // Ventas de hoy (solo las que NO son deuda y están pagadas)
    const ventasHoy = await Income.find({ 
      fecha: { $gte: hoy }, 
      esDeuda: false 
    });
    const ingresosHoy = ventasHoy.reduce((sum, i) => sum + i.monto, 0);
    
    // Gastos de hoy
    const gastosHoy = await Expense.find({ fecha: { $gte: hoy } });
    const egresosHoy = gastosHoy.reduce((sum, g) => sum + g.monto, 0);
    
    // Ventas de la semana
    const ventasSemana = await Income.find({ 
      fecha: { $gte: semanaAtras }, 
      esDeuda: false 
    });
    const ingresosSemana = ventasSemana.reduce((sum, i) => sum + i.monto, 0);
    
    // Gastos de la semana
    const gastosSemana = await Expense.find({ fecha: { $gte: semanaAtras } });
    const egresosSemana = gastosSemana.reduce((sum, g) => sum + g.monto, 0);
    
    // Ventas del mes
    const ventasMes = await Income.find({ 
      fecha: { $gte: mesAtras }, 
      esDeuda: false 
    });
    const ingresosMes = ventasMes.reduce((sum, i) => sum + i.monto, 0);
    
    // Gastos del mes
    const gastosMes = await Expense.find({ fecha: { $gte: mesAtras } });
    const egresosMes = gastosMes.reduce((sum, g) => sum + g.monto, 0);
    
    // Deudas pendientes de clientes (NO pagadas)
    const deudasClientes = await CustomerDebt.find({ estado: 'pendiente' });
    const totalDeudasClientes = deudasClientes.reduce((sum, d) => sum + d.monto, 0);
    
    // Deudas pendientes del negocio
    const deudasNegocio = await BusinessDebt.find({ estado: 'pendiente' });
    const totalDeudasNegocio = deudasNegocio.reduce((sum, d) => sum + d.monto, 0);
    
    // Últimos movimientos de caja
    const ultimosMovimientos = await CashMovement.find().sort({ fecha: -1 }).limit(15);
    
    // Saldo actual
    const saldoActual = await getCurrentCashBalance();
    
    res.json({
      hoy: {
        ingresos: ingresosHoy,
        gastos: egresosHoy,
        ganancia: ingresosHoy - egresosHoy
      },
      semana: {
        ingresos: ingresosSemana,
        gastos: egresosSemana,
        ganancia: ingresosSemana - egresosSemana
      },
      mes: {
        ingresos: ingresosMes,
        gastos: egresosMes,
        ganancia: ingresosMes - egresosMes
      },
      deudas: {
        clientes: { total: totalDeudasClientes, items: deudasClientes },
        negocio: { total: totalDeudasNegocio, items: deudasNegocio }
      },
      caja: {
        saldoActual,
        ultimosMovimientos
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

// ============================================
// OBTENER INGRESOS
// ============================================
router.get('/incomes', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const { fechaInicio, fechaFin } = req.query;
    const query = {};
    
    if (fechaInicio) query.fecha = { $gte: new Date(fechaInicio) };
    if (fechaFin) query.fecha = { ...query.fecha, $lte: new Date(fechaFin) };
    
    const incomes = await Income.find(query).sort({ fecha: -1 });
    res.json(incomes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ingresos' });
  }
});

// ============================================
// OBTENER GASTOS
// ============================================
router.get('/expenses', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const { fechaInicio, fechaFin } = req.query;
    const query = {};
    
    if (fechaInicio) query.fecha = { $gte: new Date(fechaInicio) };
    if (fechaFin) query.fecha = { ...query.fecha, $lte: new Date(fechaFin) };
    
    const expenses = await Expense.find(query).sort({ fecha: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// ============================================
// SINCRONIZAR PEDIDO ONLINE (cuando se marca como pagado)
// ============================================
router.post('/sync-order/:orderId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const Order = require('../models/Order');
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    // Verificar si ya se registró en contabilidad
    const existingIncome = await Income.findOne({ pedidoOnlineId: order._id });
    if (existingIncome) {
      return res.status(400).json({ error: 'Este pedido ya fue sincronizado' });
    }
    
    // Registrar ingreso en contabilidad
    const income = new Income({
      tipo: 'pedido_online',
      monto: order.total,
      descripcion: `Pedido online #${order.orderNumber}`,
      metodo: order.paymentMethod || 'transferencia',
      clienteNombre: order.customer.name,
      pedidoOnlineId: order._id,
      esDeuda: false,
      notas: `Pedido ${order.orderNumber} - ${order.items.length} productos`,
      creadoPor: req.user.id
    });
    
    await income.save();
    
    // Actualizar caja
    await updateCash('ingreso', order.total, `Pedido online #${order.orderNumber}`, income._id);
    
    res.json({ message: 'Pedido sincronizado con contabilidad', income });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al sincronizar pedido' });
  }
});

// ============================================
// OBTENER REPORTE CON GRÁFICAS
// ============================================
router.get('/report', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    let startDate, endDate;
    const { period, start, end } = req.query;
    
    if (period === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      endDate = new Date();
    } else if (period === 'month') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      endDate = new Date();
    } else if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default: últimos 30 días
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      endDate = new Date();
    }
    
    // Ingresos en el período
    const incomes = await Income.find({
      fecha: { $gte: startDate, $lte: endDate },
      esDeuda: false
    });
    
    // Gastos en el período
    const expenses = await Expense.find({
      fecha: { $gte: startDate, $lte: endDate }
    });
    
    // Datos diarios para gráficas
    const dailyData = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyData[dateStr] = { income: 0, expense: 0 };
    }
    
    incomes.forEach(i => {
      const dateStr = new Date(i.fecha).toISOString().split('T')[0];
      if (dailyData[dateStr]) dailyData[dateStr].income += i.monto;
    });
    
    expenses.forEach(e => {
      const dateStr = new Date(e.fecha).toISOString().split('T')[0];
      if (dailyData[dateStr]) dailyData[dateStr].expense += e.monto;
    });
    
    const dailyLabels = Object.keys(dailyData);
    const dailyIncomes = dailyLabels.map(d => dailyData[d].income);
    const dailyExpenses = dailyLabels.map(d => dailyData[d].expense);
    const dailyProfits = dailyLabels.map(d => dailyData[d].income - dailyData[d].expense);
    
    // Gastos por categoría
    const expenseCategories = {};
    expenses.forEach(e => {
      if (!expenseCategories[e.categoria]) expenseCategories[e.categoria] = 0;
      expenseCategories[e.categoria] += e.monto;
    });
    
    // Total ingresos y gastos
    const totalIncomes = incomes.reduce((sum, i) => sum + i.monto, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.monto, 0);
    
    // Transacciones combinadas
    const incomeTransactions = incomes.map(i => ({
      fecha: i.fecha,
      tipo: 'ingreso',
      descripcion: i.descripcion,
      monto: i.monto,
      metodo: i.metodo
    }));
    
    const expenseTransactions = expenses.map(e => ({
      fecha: e.fecha,
      tipo: 'gasto',
      descripcion: e.descripcion,
      monto: e.monto,
      metodo: '-'
    }));
    
    const allTransactions = [...incomeTransactions, ...expenseTransactions].sort((a, b) => b.fecha - a.fecha);
    
    res.json({
      totalIncomes,
      totalExpenses,
      netProfit: totalIncomes - totalExpenses,
      dailyLabels,
      dailyIncomes,
      dailyExpenses,
      dailyProfits,
      expenseCategories: Object.entries(expenseCategories).map(([categoria, total]) => ({ categoria, total })),
      transactions: allTransactions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

module.exports = router;