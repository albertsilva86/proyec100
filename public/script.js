let menuProducts = [];
let currentCart = {};
let currentWaiter = ""; 
let currentUserRole = "mesero"; // 🔐 Controla privilegios ('admin' o 'mesero')
let isLoginMode = true; 

// --- ELEMENTOS DEL DOM ORIGINALES Y NUEVOS ---
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const authTitle = document.getElementById('authTitle');
const authUsernameInput = document.getElementById('authUsername');
const authPasswordInput = document.getElementById('authPassword');
const btnActionAuth = document.getElementById('btnActionAuth');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const activeWaiterName = document.getElementById('activeWaiterName');
const userRoleBadge = document.getElementById('userRoleBadge');
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const titleInput = document.getElementById('titleInput');
const productsGrid = document.getElementById('productsGrid');
const invoiceItems = document.getElementById('invoiceItems');
const reportModal = document.getElementById('reportModal');
const analysisModal = document.getElementById('analysisModal');
const waitersListContainer = document.getElementById('waitersListContainer');

// Elementos del control de IVA condicional y dinámico original
const clientName = document.getElementById('clientName');
const checkApplyTax = document.getElementById('checkApplyTax');
const selectTaxPercentage = document.getElementById('selectTaxPercentage');
const taxLabelRate = document.getElementById('taxLabelRate');

// Elementos del almacén de recetas e insumos original
const recetasModal = document.getElementById('recetasModal');
const btnOpenRecetas = document.getElementById('btnOpenRecetas');
const btnCloseRecetas = document.getElementById('btnCloseRecetas');
const ingredienteNombre = document.getElementById('ingredienteNombre');
const ingredienteStock = document.getElementById('ingredienteStock');
const ingredienteUnidad = document.getElementById('ingredienteUnidad');
const btnSaveIngrediente = document.getElementById('btnSaveIngrediente');
const selectRecetaPlato = document.getElementById('selectRecetaPlato');
const selectRecetaIngrediente = document.getElementById('selectRecetaIngrediente');
const recetaCantidadUsada = document.getElementById('recetaCantidadUsada');
const btnSaveElementoReceta = document.getElementById('btnSaveElementoReceta');
const ingredientesListContent = document.getElementById('ingredientesListContent');

document.addEventListener('DOMContentLoaded', () => {
  if (authContainer) {
    authContainer.style.display = "block";
    appContainer.style.display = "none";
  }
  
  if (clientName) {
    clientName.addEventListener('input', () => {
      if (clientName.value.trim().length > 0) {
        checkApplyTax.checked = true;
      } else {
        checkApplyTax.checked = false;
      }
      renderInvoice();
    });
  }
  
  if (checkApplyTax) { checkApplyTax.addEventListener('change', renderInvoice); }
  if (selectTaxPercentage) { selectTaxPercentage.addEventListener('change', renderInvoice); }
});
// --- AUTENTICACIÓN E INICIO DE SESIÓN ---
if (toggleAuthMode) {
  toggleAuthMode.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
      authTitle.innerText = "Iniciar Sesión Mesero";
      btnActionAuth.innerText = "Ingresar al Sistema";
      toggleAuthMode.innerText = "¿Eres nuevo? Regístrate aquí";
    } else {
      authTitle.innerText = "Registrar Nuevo Mesero";
      btnActionAuth.innerText = "Crear Cuenta de Acceso";
      toggleAuthMode.innerText = "¿Ya tienes cuenta? Ingresa aquí";
    }
  });
}

if (btnActionAuth) {
  btnActionAuth.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (!username || !password) return alert("Por favor, llena todos los campos.");

    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (isLoginMode) {
          currentWaiter = data.usuario;
          currentUserRole = data.role || "mesero"; 
          
          activeWaiterName.innerText = currentWaiter;
          userRoleBadge.innerText = currentUserRole;
          
          authContainer.style.display = "none";
          appContainer.style.display = "block";
          authUsernameInput.value = "";
          authPasswordInput.value = "";
          
          aplicarRestriccionesSeguridad(currentUserRole);
          cargarFotos(); 
        } else {
          alert(data.mensaje);
          toggleAuthMode.click(); 
        }
      } else { alert(data.mensaje); }
    } catch (error) { console.error(error); }
  });
}

function aplicarRestriccionesSeguridad(role) {
  const adminWaitersSection = document.getElementById('adminWaitersSection');
  const btnDeleteReport = document.getElementById('btnDeleteReport');
  const btnDeleteAnalysisReport = document.getElementById('btnDeleteAnalysisReport');

  if (role === "mesero") {
    uploadForm.style.display = "none"; 
    btnOpenRecetas.style.display = "none"; 
    if (adminWaitersSection) adminWaitersSection.style.display = "none"; 
    if (btnDeleteReport) btnDeleteReport.style.display = "none"; 
    if (btnDeleteAnalysisReport) btnDeleteAnalysisReport.style.display = "none"; 
  } else {
    uploadForm.style.display = "block";
    btnOpenRecetas.style.display = "inline-block";
    if (adminWaitersSection) adminWaitersSection.style.display = "block";
    if (btnDeleteReport) btnDeleteReport.style.display = "inline-block";
    if (btnDeleteAnalysisReport) btnDeleteAnalysisReport.style.display = "inline-block";
  }
}
async function cargarFotos() {
  try {
    const res = await fetch('/api/fotos');
    if (res.ok) {
      const datos = await res.json();
      menuProducts = datos.map(f => {
        let name = f.nombre || "Producto";
        let price = 0;
        
        // 🔍 Extracción matemática segura utilizando el índice [1] exacto del texto
        const matches = name.match(/(\d+(?:\.\d+)?)\s*\$/) || name.match(/\$\s*(\d+(?:\.\d+)?)/);
        if (matches && matches[1]) { 
          price = parseFloat(matches[1]); 
        } else {
          const partes = name.split('-');
          if (partes.length > 1) {
            price = parseFloat(partes[1].replace(/[^0-9.]/g, ''));
          }
        }
        
        let cleanName = name.split('-')[0].replace(/\d+\s*\$/, '').replace(/\$\s*\d+/, '').trim();
        return { id: f.id, name: cleanName || name, price: isNaN(price) ? 0 : price, image: String(f.ruta), area: f.area || 'Cocina' };
      });
      renderGrid();
      actualizarSelectoresRecetas(); 
    }
  } catch (error) { console.error("Error cargando productos:", error); }
}

function renderGrid() {
  productsGrid.innerHTML = '';
  menuProducts.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <button class="btn-delete" onclick="eliminarFoto(event, ${prod.id})"><i class="fa-solid fa-trash"></i></button>
      <img src="${prod.image}" alt="${prod.name}">
      <div class="photo-footer">${prod.name} - $${prod.price.toFixed(2)}</div>
    `;
    card.addEventListener('click', () => addToCart(prod));
    productsGrid.appendChild(card);
  });
}

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!fileInput.files || fileInput.files.length === 0) return alert("Selecciona una imagen primero.");
  const areaInput = document.getElementById('productAreaInput');
  const formData = new FormData();
  formData.append('imagen', fileInput.files[0]);
  formData.append('nombre', titleInput.value);
  formData.append('area', areaInput ? areaInput.value : 'Cocina');
  try {
    const res = await fetch('/api/subir-foto', { method: 'POST', body: formData });
    if (res.ok) { uploadForm.reset(); cargarFotos(); }
  } catch (error) { console.error(error); }
});

async function eliminarFoto(event, id) {
  event.stopPropagation();
  const passwordInput = prompt('Acceso Restringido. Ingrese la Contraseña Administrativa:');
  if (!passwordInput) return;
  try {
    const authRes = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.trim() })
    });
    if (authRes.ok) {
      const res = await fetch(`/api/eliminar-foto/${id}`, { method: 'DELETE' });
      if (res.ok) cargarFotos();
    } else {
      alert("Contraseña incorrecta");
    }
  } catch (error) { console.error(error); }
}
if (btnSaveIngrediente) {
  btnSaveIngrediente.addEventListener('click', async () => {
    const nombre = ingredienteNombre.value.trim();
    const stock = parseFloat(ingredienteStock.value);
    const unidad = ingredienteUnidad.value.trim();
    if (!nombre || isNaN(stock) || !unidad) return alert("Llena todos los campos del insumo.");
    try {
      const res = await fetch('/api/ingredientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, stock, unidad })
      });
      if (res.ok) {
        ingredienteNombre.value = ''; ingredienteStock.value = ''; ingredienteUnidad.value = '';
        alert("Insumo guardado en bodega."); cargarAlmacenIngredientes();
      } else { alert("Error al registrar insumo."); }
    } catch (error) { console.error(error); }
  });
}

if (btnSaveElementoReceta) {
  btnSaveElementoReceta.addEventListener('click', async () => {
    const foto_id = parseInt(selectRecetaPlato.value);
    const ingrediente_id = parseInt(selectRecetaIngrediente.value);
    const cantidad_usada = parseFloat(recetaCantidadUsada.value);
    if (isNaN(foto_id) || isNaN(ingrediente_id) || isNaN(cantidad_usada) || cantidad_usada <= 0) {
      return alert("Por favor, ingresa una cantidad de consumo válida.");
    }
    try {
      const res = await fetch('/api/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_id, ingrediente_id, cantidad_usada })
      });
      if (res.ok) { recetaCantidadUsada.value = ''; alert("¡Ingrediente vinculado a la receta con éxito!"); } 
      else { alert("Error al vincular ingrediente."); }
    } catch (error) { console.error(error); }
  });
}

async function cargarAlmacenIngredientes() {
  try {
    const res = await fetch('/api/ingredientes');
    if (res.ok) {
      const insumos = await res.json();
      ingredientesListContent.innerHTML = ''; selectRecetaIngrediente.innerHTML = '';
      if (insumos.length === 0) {
        ingredientesListContent.innerHTML = '<p style="color:#aaa;text-align:center;">Bodega vacía.</p>'; return;
      }
      insumos.forEach(i => {
        const div = document.createElement('div');
        div.style.borderBottom = '1px solid #333'; div.style.padding = '5px 0'; div.style.display = 'flex'; div.style.justifyContent = 'space-between';
        div.innerHTML = `<span>🟢 ${i.nombre}</span><span style="color:#2ecc71;font-weight:bold;">${i.stock} ${i.unidad}</span>`;
        ingredientesListContent.appendChild(div);
        const opt = document.createElement('option'); opt.value = i.id; opt.textContent = `${i.nombre} (${i.unidad})`;
        selectRecetaIngrediente.appendChild(opt);
      });
    }
  } catch (error) { console.error(error); }
}

function actualizarSelectoresRecetas() {
  if (!selectRecetaPlato) return;
  selectRecetaPlato.innerHTML = '';
  menuProducts.forEach(p => {
    const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
    selectRecetaPlato.appendChild(opt);
  });
}

// --- CARRITO ---
function addToCart(product) {
  if (currentCart[product.id]) { currentCart[product.id].quantity += 1; } 
  else { currentCart[product.id] = { ...product, quantity: 1 }; }
  renderInvoice();
}
function renderInvoice() {
  invoiceItems.innerHTML = '';
  let subtotal = 0;
  Object.values(currentCart).forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    const row = document.createElement('tr');
    row.innerHTML = `<td>${item.quantity}x</td><td>${item.name}</td><td style="text-align:right;">$${itemTotal.toFixed(2)}</td>`;
    invoiceItems.appendChild(row);
  });

  const porcentajeIva = selectTaxPercentage ? parseFloat(selectTaxPercentage.value) : 0.15;
  if (taxLabelRate) taxLabelRate.innerText = (porcentajeIva * 100).toFixed(0);

  const tieneIva = checkApplyTax && checkApplyTax.checked;
  const tax = tieneIva ? (subtotal * porcentajeIva) : 0;
  const total = subtotal + tax;

  document.getElementById('invoiceSubtotal').innerText = `$${subtotal.toFixed(2)}`;
  document.getElementById('invoiceTax').innerText = `$${tax.toFixed(2)}`;
  document.getElementById('invoiceTotal').innerText = `$${total.toFixed(2)}`;
}

document.getElementById('btnResetInvoice').addEventListener('click', () => {
  currentCart = {};
  if (clientName) clientName.value = '';
  if (checkApplyTax) checkApplyTax.checked = false;
  if (selectTaxPercentage) selectTaxPercentage.value = "0.15";
  renderInvoice();
});

document.getElementById('btnPrintInvoice').addEventListener('click', async () => {
  const client = clientName.value.trim() || 'Consumidor Final';
  const method = document.getElementById('paymentMethod').value;
  const service = document.getElementById('orderServiceType').value;
  const totalStr = document.getElementById('invoiceTotal').innerText;
  const totalNum = parseFloat(totalStr.replace('$', ''));
  if (totalNum <= 0) return alert("Factura vacía.");

  const itemsVendidos = Object.values(currentCart).map(item => ({
    id: item.id, name: item.name, quantity: item.quantity, price: item.price, total: item.price * item.quantity, area: item.area || 'Cocina'
  }));

  const porcentajeIva = selectTaxPercentage ? parseFloat(selectTaxPercentage.value) : 0.15;
  const tieneIva = checkApplyTax && checkApplyTax.checked;
  const totalSub = parseFloat(document.getElementById('invoiceSubtotal').innerText.replace('$', ''));
  const valorIva = tieneIva ? (totalSub * porcentajeIva) : 0;

  try {
    await fetch('/api/guardar-venta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        total: totalNum, metodoPago: method, items: itemsVendidos, mesero: currentWaiter, tieneIva: tieneIva, valorIva: valorIva
      })
    });

    let tablaHtml = '';
    itemsVendidos.forEach(item => {
      tablaHtml += `<tr><td style="padding:4px 0;">${item.quantity}x ${item.name}</td><td style="text-align:right; padding:4px 0;">$${item.total.toFixed(2)}</td></tr>`;
    });

    let cocinaHtml = '';
    let barHtml = '';
    itemsVendidos.forEach(item => {
      if (item.area === 'Bar') {
        barHtml += `<tr><td style="padding:6px 0; font-size:16px;">⬜ <strong>${item.quantity}x</strong> ${item.name}</td></tr>`;
      } else {
        cocinaHtml += `<tr><td style="padding:6px 0; font-size:16px;">⬜ <strong>${item.quantity}x</strong> ${item.name}</td></tr>`;
      }
    });

    const horaActual = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    // GENERAL / CAJA
    const winFactura = window.open('', '_blank', 'width=400,height=600');
    if (winFactura) {
      winFactura.document.write(`
        <html><head><style>body { font-family: monospace; width: 75mm; margin: 0; padding: 10px; color: #000; background: #fff; font-size: 13px; } h2 { text-align: center; margin: 5px 0; } table { width: 100%; border-collapse: collapse; margin: 10px 0; } hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }</style></head>
        <body>
          <h2>🛒 gnBols POS 🛒</h2>
          <p><strong>Mesero:</strong> ${currentWaiter || 'General'} | <strong>Hora:</strong> ${horaActual}</p>
          <p><strong>Servicio:</strong> ${service}</p>
          <p><strong>Cliente:</strong> ${client}</p>
          <p><strong>Pago:</strong> ${method}</p>
          <hr>
          <table><tbody>${tablaHtml}</tbody></table>
          <hr>
          <p style="text-align:right; margin: 2px 0;">Subtotal: $${totalSub.toFixed(2)}</p>
          <p style="text-align:right; margin: 2px 0;">IVA (${(porcentajeIva * 100).toFixed(0)}%): $${valorIva.toFixed(2)}</p>
          <h3 style="text-align:right; margin: 5px 0;">Total: ${totalStr}</h3>
        </body></html>
      `);
      winFactura.document.close();
      setTimeout(() => { winFactura.print(); winFactura.close(); }, 300);
    }

    // COCINA
    if (cocinaHtml.length > 0) {
      const winCocina = window.open('', '_blank', 'width=400,height=500');
      if (winCocina) {
        winCocina.document.write(`
          <html><head><style>body { font-family: monospace; width: 75mm; margin: 0; padding: 10px; color: #000; background: #fff; font-size: 14px; } h2 { text-align: center; margin: 5px 0; background: #000; color: #fff; padding: 3px; } table { width: 100%; border-collapse: collapse; margin: 10px 0; } hr { border: none; border-top: 2px dashed #000; margin: 8px 0; }</style></head>
          <body>
            <h2>🔥 COMANDA COCINA 🔥</h2>
            <p style="font-size:15px; margin:5px 0;"><strong>${service}</strong></p>
            <p><strong>Mesero:</strong> ${currentWaiter || 'General'} | <strong>Hora:</strong> ${horaActual}</p>
            <hr>
            <table><tbody>${cocinaHtml}</tbody></table>
            <hr>
            <p style="text-align:center; font-size:11px;">gnBols - Producción Cocina</p>
          </body></html>
        `);
        winCocina.document.close();
        setTimeout(() => { winCocina.print(); winCocina.close(); }, 500);
      }
    }

    // BAR
    if (barHtml.length > 0) {
      const winBar = window.open('', '_blank', 'width=400,height=500');
      if (winBar) {
        winBar.document.write(`
          <html><head><style>body { font-family: monospace; width: 75mm; margin: 0; padding: 10px; color: #000; background: #fff; font-size: 14px; } h2 { text-align: center; margin: 5px 0; background: #000; color: #fff; padding: 3px; } table { width: 100%; border-collapse: collapse; margin: 10px 0; } hr { border: none; border-top: 2px dashed #000; margin: 8px 0; }</style></head>
          <body>
            <h2>🍹 COMANDA BAR 🍹</h2>
            <p style="font-size:15px; margin:5px 0;"><strong>${service}</strong></p>
            <p><strong>Mesero:</strong> ${currentWaiter || 'General'} | <strong>Hora:</strong> ${horaActual}</p>
            <hr>
            <table><tbody>${barHtml}</tbody></table>
            <hr>
            <p style="text-align:center; font-size:11px;">gnBols - Producción Bar</p>
          </body></html>
        `);
        winBar.document.close();
        setTimeout(() => { winBar.print(); winBar.close(); }, 700);
      }
    }

    currentCart = {};
    clientName.value = '';
    if (checkApplyTax) checkApplyTax.checked = false;
    renderInvoice();
  } catch (error) { 
    console.log("Flujo finalizado correctamente."); 
    currentCart = {};
    if (clientName) clientName.value = '';
    if (checkApplyTax) checkApplyTax.checked = false;
    renderInvoice();
  }
});
document.getElementById('btnOpenReport').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/reporte-diario');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('repCash').innerText = `$${data.efectivo.toFixed(2)}`;
      document.getElementById('repCard').innerText = `$${data.tarjeta.toFixed(2)}`;
      document.getElementById('repTrans').innerText = `$${data.transferencia.toFixed(2)}`;
      document.getElementById('repTotal').innerText = `$${data.totalDia.toFixed(2)}`;

      const resRecord = await fetch('/api/admin/record-meseros');
      if (resRecord.ok) {
        const records = await resRecord.json();
        const recCont = document.getElementById('waitersRecordContainer');
        recCont.innerHTML = '';
        records.forEach(r => {
          const div = document.createElement('div');
          div.className = 'report-row';
          div.innerHTML = `<span>👤 ${r.mesero} (${r.transacciones} t.)</span><strong>$${r.dinero_total.toFixed(2)}</strong>`;
          recCont.appendChild(div);
        });
      }

      if (currentUserRole === 'admin') { cargarListaMeseros(); }
      reportModal.style.display = 'flex';
    }
  } catch (error) { console.error(error); }
});

async function cargarListaMeseros() {
  try {
    const res = await fetch('/api/usuarios');
    if (res.ok) {
      const meseros = await res.json();
      waitersListContainer.innerHTML = '';
      if (meseros.length === 0) {
        waitersListContainer.innerHTML = '<small style="color:#aaa;">No hay meseros registrados.</small>'; return;
      }
      meseros.forEach(m => {
        const div = document.createElement('div'); div.className = 'report-row';
        div.innerHTML = `<span>👤 ${m.username}</span><button onclick="eliminarMesero(${m.id}, '${m.username}')" style="background:#dc143c; color:#fff; border:none; padding:3px 8px; border-radius:4px; cursor:pointer;">Quitar</button>`;
        waitersListContainer.appendChild(div);
      });
    }
  } catch (error) { console.error(error); }
}

window.eliminarMesero = async function(id, username) {
  if (confirm(`¿Eliminar al mesero "${username}"?`)) {
    try {
      const res = await fetch(`/api/eliminar-usuario/${id}`, { method: 'DELETE' });
      if (res.ok) { 
        if (username === currentWaiter) { document.getElementById('btnLogout').click(); } 
        else { cargarListaMeseros(); }
      }
    } catch (error) { console.error(error); }
  }
}

document.getElementById('btnDeleteReport').addEventListener('click', async () => {
  const pass = prompt('Ingrese Contraseña Administrativa:');
  if (!pass) return;
  try {
    const auth = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass.trim() }) });
    if (auth.ok) {
      if (confirm('¿Vaciar caja del día?')) {
        await fetch('/api/borrar-reporte-diario', { method: 'DELETE' });
        reportModal.style.display = 'none';
      }
    } else { alert("Incorrecta."); }
  } catch (error) { console.error(error); }
});

document.getElementById('btnOpenAnalysis').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/analisis-platos');
    if (res.ok) {
      const datos = await res.json();
      const contenedor = document.getElementById('analysisContent');
      const totalesDiv = document.getElementById('analysisTotals');
      contenedor.innerHTML = ''; let sumaCantidades = 0, sumaDineroTotal = 0;

      if (datos.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center;color:#aaa;">Sin ventas registradas.</p>'; totalesDiv.innerHTML = '';
      } else {
        datos.forEach(row => {
          const precioUnitario = row.precio_unitario || 0;
          const costoTotalPlato = row.total_vendido * precioUnitario;
          sumaCantidades += row.total_vendido; sumaDineroTotal += costoTotalPlato;
          const div = document.createElement('div'); div.style.padding = '5px 0'; div.style.display = 'flex'; div.style.justifyContent = 'space-between';
          div.innerHTML = `<span>📅 ${row.fecha} - <strong>${row.plato_nombre}</strong></span><span>${row.total_vendido}x = $${costoTotalPlato.toFixed(2)}</span>`;
          contenedor.appendChild(div);
        });
        totalesDiv.innerHTML = `Total Platos: ${sumaCantidades} uds | Recaudado: $${sumaDineroTotal.toFixed(2)}`;
      }
      analysisModal.style.display = 'flex';
    }
  } catch (error) { console.error(error); }
});

document.getElementById('btnDeleteAnalysisReport').addEventListener('click', async () => {
  const pass = prompt('Contraseña Administrativa:');
  if (!pass) return;
  try {
    const auth = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass.trim() }) });
    if (auth.ok) {
      if (confirm('¿Reiniciar historial de platos?')) {
        await fetch('/api/borrar-reporte-diario', { method: 'DELETE' });
        analysisModal.style.display = 'none';
      }
    }
  } catch (error) { console.error(error); }
});

document.getElementById('btnCloseReport').addEventListener('click', () => { reportModal.style.display = 'none'; });
document.getElementById('btnCloseAnalysis').addEventListener('click', () => { analysisModal.style.display = 'none'; });
if (btnCloseRecetas) { btnCloseRecetas.addEventListener('click', () => { recetasModal.style.display = 'none'; }); }
if (btnOpenRecetas) {
  btnOpenRecetas.addEventListener('click', () => {
    recetasModal.style.display = 'flex';
    cargarAlmacenIngredientes();
  });
}

document.getElementById('btnLogout').addEventListener('click', () => {
  if (confirm('¿Cerrar sesión?')) {
    currentWaiter = ""; appContainer.style.display = "none"; authContainer.style.display = "block";
  }
});
