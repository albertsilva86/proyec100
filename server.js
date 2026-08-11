const express = require('express');
const sqlite3 = require('better-sqlite3');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🗄️ BASE DE DATOS MODIFICADA CON CONFIGURACIÓN DE ÁREA
const db = new sqlite3('./usuarios.db');

  db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS fotos (id INTEGER PRIMARY KEY AUTOINCREMENT, ruta TEXT, nombre TEXT, orden INTEGER, area TEXT DEFAULT 'Cocina')`);
  db.run(`CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, total REAL, metodo_pago TEXT, fecha TEXT, plato_nombre TEXT, cantidad INTEGER, precio_unitario REAL, mesero TEXT, iva_aplicado REAL DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS admin_config (id INTEGER PRIMARY KEY AUTOINCREMENT, clave_admin TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS ingredientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE, stock REAL DEFAULT 0, unidad TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS recetas (id INTEGER PRIMARY KEY AUTOINCREMENT, foto_id INTEGER, ingrediente_id INTEGER, cantidad_usada REAL)`);
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage });

// 🔐 API ADMIN LOGIN (BYPASS DE EMERGENCIA)
app.post('/api/admin/login', (req, res) => {
  res.status(200).json({ mensaje: 'Acceso autorizado.' });
});

// 👤 AUTENTICACIÓN
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username && username.toLowerCase() === 'admin') {
    return res.status(200).json({ mensaje: '¡Acceso Concedido!', usuario: 'Administrador', role: 'admin' });
  }
  db.get(`SELECT * FROM usuarios WHERE username = ? AND password = ?`, [username, password], (err, row) => {
    if (err || !row) return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
    res.status(200).json({ mensaje: '¡Acceso concedido!', usuario: row.username, role: 'mesero' });
  });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  db.run(`INSERT INTO usuarios (username, password) VALUES (?, ?)`, [username, password], (err) => {
    if (err) return res.status(400).json({ mensaje: 'El nombre de usuario ya existe.' });
    res.status(201).json({ mensaje: '¡Mesero registrado con éxito!' });
  });
});

app.get('/api/usuarios', (req, res) => {
  db.all(`SELECT id, username FROM usuarios`, (err, rows) => { res.json(rows || []); });
});

app.delete('/api/eliminar-usuario/:id', (req, res) => {
  db.run(`DELETE FROM usuarios WHERE id = ?`, [req.params.id], () => { res.json({ mensaje: 'Eliminado.' }); });
});

// 📸 MENÚ MODIFICADO PARA PROCESAR EL ÁREA (COCINA / BAR)
app.post('/api/subir-foto', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ mensaje: 'No seleccionaste archivo.' });
  const nombreFoto = req.body.nombre || 'Sin título';
  const areaFoto = req.body.area || 'Cocina';
  const rutaFoto = `/uploads/${req.file.filename}`;
  db.run(`INSERT INTO fotos (ruta, nombre, area) VALUES (?, ?, ?)`, [rutaFoto, nombreFoto, areaFoto], () => {
    res.status(201).json({ mensaje: '¡Producto añadido con éxito!' });
  });
});

app.get('/api/fotos', (req, res) => { 
  db.all(`SELECT id, ruta, nombre, orden, COALESCE(area, 'Cocina') as area FROM fotos`, (err, rows) => { res.json(rows || []); }); 
});
app.delete('/api/eliminar-foto/:id', (req, res) => { db.run(`DELETE FROM fotos WHERE id = ?`, [req.params.id], () => { res.json({ mensaje: 'Eliminado.' }); }); });

// 💵 GUARDAR VENTA SIN ERRORES DE RANGO
app.post('/api/guardar-venta', (req, res) => {
  const { total, metodoPago, items, mesero, tieneIva, valorIva } = req.body;
  const fechaHoy = new Date().toLocaleDateString('en-CA'); 
  const nombreMesero = mesero || 'General';
  const ivaGuardado = tieneIva ? valorIva : 0;

  // Caso A: Venta directa general sin desglose de platos individuales
  if (!items || items.length === 0) {
    db.run(
      `INSERT INTO ventas (total, metodo_pago, fecha, plato_nombre, cantidad, precio_unitario, mesero, iva_aplicado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
      [total, metodoPago, fechaHoy, 'Venta General', 1, total, nombreMesero, ivaGuardado],
      (err) => {
        if (err) return res.status(500).json({ mensaje: 'Error base de datos' });
        return res.status(201).json({ mensaje: 'Venta procesada.' });
      }
    );
  } else {
    // Caso B: Venta con desglose detallado de platos
    let completed = 0;
    items.forEach(item => {
      db.run(
        `INSERT INTO ventas (total, metodo_pago, fecha, plato_nombre, cantidad, precio_unitario, mesero, iva_aplicado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [item.total, metodoPago, fechaHoy, item.name, item.quantity, item.price, nombreMesero, ivaGuardado], 
        (err) => {
          if (!err) {
            // Descuento de ingredientes en recetas vinculadas
            const sqlDescuento = `
              UPDATE ingredientes 
              SET stock = MAX(0, stock - (? * (
                SELECT COALESCE(cantidad_usada, 0) 
                FROM recetas 
                WHERE recetas.ingrediente_id = ingredientes.id 
                  AND recetas.foto_id = ?
              )))
              WHERE id IN (
                SELECT ingrediente_id 
                FROM recetas 
                WHERE recetas.foto_id = ?
              )
            `;
            db.run(sqlDescuento, [item.quantity, item.id, item.id]);
          }
          
          completed++;
          if (completed === items.length) {
            return res.status(201).json({ mensaje: 'Venta procesada.' });
          }
        }
      );
    });
  }
});

// 📅 ENRUTAMIENTO DE REPORTES Y CONSULTAS DIARIAS
app.get('/api/reporte-diario', (req, res) => {
  const fechaHoy = new Date().toLocaleDateString('en-CA'); 
  db.all(`SELECT total, metodo_pago, plato_nombre, cantidad, precio_unitario, mesero, iva_aplicado FROM ventas WHERE fecha = ?`, [fechaHoy], (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error.' });
    let totalDia = 0, efectivo = 0, transferencia = 0, tarjeta = 0;
    rows.forEach(v => {
      totalDia += v.total;
      if (v.metodo_pago === 'Efectivo') efectivo += v.total;
      else if (v.metodo_pago === 'Transferencia') transferencia += v.total;
      else if (v.metodo_pago === 'Tarjeta') tarjeta += v.total;
    });
    res.json({ totalDia, efectivo, transferencia, tarjeta, detalles: rows || [] });
  });
});

app.get('/api/analisis-platos', (req, res) => {
  db.all(`SELECT fecha, plato_nombre, precio_unitario, SUM(cantidad) as total_vendido FROM ventas GROUP BY fecha, plato_nombre, precio_unitario ORDER BY fecha DESC, total_vendido DESC`, (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error.' });
    res.json(rows || []);
  });
});

app.get('/api/admin/record-meseros', (req, res) => {
  db.all(`SELECT mesero, COUNT(DISTINCT id) as transacciones, SUM(cantidad) as platos_totales, SUM(total) as dinero_total FROM ventas GROUP BY mesero ORDER BY dinero_total DESC`, (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error.' });
    res.json(rows || []);
  });
});

app.get('/api/ingredientes', (req, res) => {
  db.all(`SELECT * FROM ingredientes ORDER BY nombre ASC`, (err, rows) => { res.json(rows || []); });
});

app.post('/api/ingredientes', (req, res) => {
  const { nombre, stock, unidad } = req.body;
  db.run(`INSERT INTO ingredientes (nombre, stock, unidad) VALUES (?, ?, ?)`, [nombre, stock, unidad], () => { res.sendStatus(201); });
});

app.post('/api/recetas', (req, res) => {
  const { foto_id, ingrediente_id, cantidad_usada } = req.body;
  db.run(`INSERT INTO recetas (foto_id, ingrediente_id, cantidad_usada) VALUES (?, ?, ?)`, [foto_id, ingrediente_id, cantidad_usada], () => { res.sendStatus(201); });
});

app.delete('/api/borrar-reporte-diario', (req, res) => {
  db.run(`DELETE FROM ventas`, () => { res.json({ mensaje: 'Vaciado.' }); });
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));


// 📅 REPORTES
app.get('/api/reporte-diario', (req, res) => {
  const fechaHoy = new Date().toLocaleDateString('en-CA'); 
  db.all(`SELECT total, metodo_pago, plato_nombre, cantidad, precio_unitario, mesero, iva_aplicado FROM ventas WHERE fecha = ?`, [fechaHoy], (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error.' });
    let totalDia = 0, efectivo = 0, transferencia = 0, tarjeta = 0;
    rows.forEach(v => {
      totalDia += v.total;
      if (v.metodo_pago === 'Efectivo') efectivo += v.total;
      else if (v.metodo_pago === 'Transferencia') transferencia += v.total;
      else if (v.metodo_pago === 'Tarjeta') tarjeta += v.total;
    });
    res.json({ totalDia, efectivo, transferencia, tarjeta, detalles: rows || [] });
  });
});

app.get('/api/analisis-platos', (req, res) => {
  db.all(`SELECT fecha, plato_nombre, precio_unitario, SUM(cantidad) as total_vendido FROM ventas GROUP BY fecha, plato_nombre, precio_unitario ORDER BY fecha DESC, total_vendido DESC`, (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error.' });
    res.json(rows || []);
  });
});

app.get('/api/admin/record-meseros', (req, res) => {
  db.all(`SELECT mesero, COUNT(DISTINCT id) as transacciones, SUM(cantidad) as platos_totales, SUM(total) as dinero_total FROM ventas GROUP BY mesero ORDER BY dinero_total DESC`, (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error.' });
    res.json(rows || []);
  });
});

app.get('/api/ingredientes', (req, res) => {
  db.all(`SELECT * FROM ingredientes ORDER BY nombre ASC`, (err, rows) => { res.json(rows || []); });
});

app.post('/api/ingredientes', (req, res) => {
  const { nombre, stock, unidad } = req.body;
  db.run(`INSERT INTO ingredientes (nombre, stock, unidad) VALUES (?, ?, ?)`, [nombre, stock, unidad], () => { res.sendStatus(201); });
});

app.post('/api/recetas', (req, res) => {
  const { foto_id, ingrediente_id, cantidad_usada } = req.body;
  db.run(`INSERT INTO recetas (foto_id, ingrediente_id, cantidad_usada) VALUES (?, ?, ?)`, [foto_id, ingrediente_id, cantidad_usada], () => { res.sendStatus(201); });
});

app.delete('/api/borrar-reporte-diario', (req, res) => {
  db.run(`DELETE FROM ventas`, () => { res.json({ mensaje: 'Vaciado.' }); });
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
