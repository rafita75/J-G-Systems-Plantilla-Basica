// server/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');

const { generalLimiter } = require('./middleware/rateLimit');

// Cargar variables de entorno desde .env
dotenv.config();

// Crear la aplicación de Express
const app = express();

// ============================================
// MIDDLEWARES DE SEGURIDAD
// ============================================

// Helmet protege cabeceras HTTP
app.use(helmet());

// CORS configurado (solo permite el frontend)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Parsear JSON
app.use(express.json());

// Rate limiting global (protege toda la API)
app.use('/api', generalLimiter);

// ============================================
// RUTAS DE LA API
// ============================================

// Ruta de prueba para verificar que el servidor funciona
app.get('/api/test', (req, res) => {
  res.json({ message: 'El servidor funciona correctamente!' });
});

// Rutas de autenticación
app.use('/api/auth', require('./routes/auth'));

// Configuracion de colores
app.use('/api/config', require('./routes/config'));

app.use('/api/superadmin', require('./routes/superadmin'));

app.use('/api/modules', require('./routes/modules'));

app.use('/api/sections', require('./routes/sections'));

app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));

app.use('/api/orders', require('./routes/orders'));

app.use('/api/reviews', require('./routes/reviews'));

app.use('/api/wishlist', require('./routes/wishlist'));

app.use('/api/coupons', require('./routes/coupons'));

app.use('/api/accounting', require('./routes/accounting'));

app.use('/api/services', require('./routes/services'));
app.use('/api/professionals', require('./routes/professionals'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/appointments', require('./routes/appointments'));
// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mi-app')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Iniciar el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});