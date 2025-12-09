// frontend/js/gestionInventario.js
(() => {
  const API_BASE = 'https://backend-naty.onrender.com';

  const callApi = window.api || (async (path, opts = {}) => {
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      opts.headers || {}
    );
    const res = await fetch(API_BASE + path, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  });

  // ===== DOM =====
  const $search          = document.getElementById('searchInput');
  const $estadoFiltro    = document.getElementById('estadoFiltro');
  const $categoriaFiltro = document.getElementById('categoriaFiltro');
  const $grid            = document.getElementById('inventoryGrid');

  const $totalProductos = document.getElementById('totalProductos');
  const $stockBajo      = document.getElementById('stockBajo');
  const $porCaducar     = document.getElementById('porCaducar');
  const $vencidos       = document.getElementById('vencidos');
  const $stockOptimo    = document.getElementById('stockOptimo');

  const $detalleModal   = document.getElementById('detalleModal');
  const $detalleTitulo  = document.getElementById('detalleTitulo');
  const $detalleBody    = document.getElementById('detalleBody');
  const $cerrarDetalle  = document.getElementById('cerrarDetalleBtn');

  const $caducidadModal    = document.getElementById('caducidadModal');
  const $caducidadBody     = document.getElementById('caducidadBody');
  const $cerrarCaducidad   = document.getElementById('cerrarCaducidadBtn');
  const $cancelarCaducidad = document.getElementById('cancelarCaducidadBtn');
  const $guardarCaducidad  = document.getElementById('guardarCaducidadBtn');

  const $historialModal  = document.getElementById('historialModal');
  const $historialBody   = document.getElementById('historialBody');
  const $cerrarHistorial = document.getElementById('cerrarHistorialBtn');

  const $vencidosModal   = document.getElementById('vencidosModal');
  const $vencidosBody    = document.getElementById('vencidosBody');
  const $cerrarVencidos  = document.getElementById('cerrarVencidosBtn');
  const $btnVerVencidos  = document.getElementById('btnVerVencidos');

  const $toast           = document.getElementById('toast');

  let inventario = [];

  const show = el => { if (el) el.style.display = 'flex'; };
  const hide = el => { if (el) el.style.display = 'none'; };

  function showToast(msg) {
    if (!$toast) {
      alert(msg);
      return;
    }
    $toast.textContent = msg;
    $toast.style.display = 'block';
    $toast.classList.add('show');
    setTimeout(() => {
      $toast.classList.remove('show');
      $toast.style.display = 'none';
    }, 2500);
  }

  const fmtDate = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  const estadoLabel = e => ({
    vacio: 'Stock Vacío',
    bajo: 'Stock Bajo',
    medio: 'Stock Medio',
    optimo: 'Stock Óptimo'
  }[e] || e);

  const estadoClass = e => ({
    vacio: 'empty',
    bajo: 'low',
    medio: 'medium',
    optimo: 'optimal'
  }[e] || '');

  // ===== Resumen =====
  async function cargarResumen() {
    try {
      const r = await callApi('/api/inventario/resumen');
      $totalProductos.textContent = r.totalProductos ?? 0;
      $stockBajo.textContent      = r.stockBajo ?? 0;
      $porCaducar.textContent     = r.porCaducar ?? 0;
      $vencidos.textContent       = r.vencidos ?? 0;
      $stockOptimo.textContent    = r.stockOptimo ?? 0;
    } catch (e) {
      console.error('Resumen inventario:', e);
    }
  }

  // ===== Inventario =====
  async function cargarInventario() {
    try {
      const r = await callApi('/api/inventario');
      inventario = Array.isArray(r) ? r : [];
      llenarCategorias();
      renderInventario();
    } catch (e) {
      console.error('Inventario:', e);
      $grid.innerHTML = '<p class="msg-error">Error al cargar el inventario.</p>';
    }
  }

  function llenarCategorias() {
    if (!$categoriaFiltro) return;
    const cats = new Set();
    inventario.forEach(p => { if (p.categoria) cats.add(p.categoria); });
    $categoriaFiltro.innerHTML = '<option value="all">Todas las categorías</option>';
    [...cats].sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      $categoriaFiltro.appendChild(opt);
    });
  }

  function filtrarDatos() {
    const q      = ($search.value || '').toLowerCase();
    const estado = $estadoFiltro.value;
    const cat    = $categoriaFiltro.value;

    return inventario.filter(p => {
      if (
        q &&
        !p.nombre.toLowerCase().includes(q) &&
        !String(p.codigo_producto).includes(q)
      ) return false;

      if (estado === 'optimal' && p.estado_stock !== 'optimo') return false;
      if (estado === 'medium'  && p.estado_stock !== 'medio')  return false;
      if (estado === 'low'     && p.estado_stock !== 'bajo')   return false;
      if (estado === 'empty'   && p.estado_stock !== 'vacio')  return false;

      if (cat !== 'all' && (p.categoria || '') !== cat) return false;

      return true;
    });
  }

  function obtenerUltimoIngreso(p) {
    if (!p.lotes || !p.lotes.length) return '';
    const fechas = p.lotes
      .map(l => l.fecha_ingreso)
      .filter(Boolean)
      .map(f => new Date(f))
      .filter(d => !isNaN(d));
    if (!fechas.length) return '';
    const max = fechas.reduce((a, b) => (b > a ? b : a));
    return fmtDate(max.toISOString());
  }

  function renderInventario() {
    const data = filtrarDatos();
    $grid.innerHTML = '';

    if (!data.length) {
      $grid.innerHTML = '<p class="msg-empty">No hay productos para mostrar.</p>';
      return;
    }

    data.forEach(p => {
      const lotesHtml = (p.lotes || []).length
        ? p.lotes.map(l => {
            const warning = l.por_caducar;
            const cls = warning ? 'expiry-date warning' : 'expiry-date';
            const expText = l.fecha_vencimiento
              ? `Vence: ${fmtDate(l.fecha_vencimiento)}`
              : 'Sin fecha';
            return `
              <div class="batch-item">
                <span class="batch-number">Lote #${l.id_lote}</span>
                <span class="batch-quantity">${l.cantidad_disponible} ${p.unidad_medida || ''}</span>
                <span class="${cls}">
                  ${warning ? '<i class="fas fa-exclamation-triangle"></i> ' : ''}
                  ${expText}
                </span>
              </div>
            `;
          }).join('')
        : '<p class="batch-empty">Sin lotes activos.</p>';

      const card = document.createElement('div');
      card.className = 'inventory-card';
      card.innerHTML = `
        <div class="product-header">
          <h3>${p.nombre}</h3>
          <span class="status ${estadoClass(p.estado_stock)}">
            ${estadoLabel(p.estado_stock)}
          </span>
        </div>

        <div class="batch-info">
          <div class="info-group">
            <label>Stock Actual:</label>
            <span>${p.stock_total} ${p.unidad_medida || ''}</span>
          </div>
          <div class="info-group">
            <label>Stock Mínimo:</label>
            <span>${p.stock_minimo || 0} ${p.unidad_medida || ''}</span>
          </div>
          <div class="info-group">
            <label>Último Ingreso:</label>
            <span>${obtenerUltimoIngreso(p) || '-'}</span>
          </div>
        </div>

        <div class="batch-list">
          <h4>Lotes Activos</h4>
          ${lotesHtml}
        </div>

        <div class="card-actions">
          <button class="btn-view" title="Ver detalles"
                  data-accion="ver" data-id="${p.codigo_producto}">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-edit" title="Editar fechas de caducidad"
                  data-accion="editar" data-id="${p.codigo_producto}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-history" title="Historial de lotes agotados"
                  data-accion="historial" data-id="${p.codigo_producto}">
            <i class="fas fa-history"></i>
          </button>
        </div>
      `;
      $grid.appendChild(card);
    });
  }

  // ===== Eventos filtros =====
  $search.addEventListener('input', renderInventario);
  $estadoFiltro.addEventListener('change', renderInventario);
  $categoriaFiltro.addEventListener('change', renderInventario);

  // ===== Clicks en tarjetas =====
  $grid.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const accion = btn.dataset.accion;
    const codigo = btn.dataset.id;
    const item = inventario.find(p => String(p.codigo_producto) === String(codigo));
    if (!item) return;

    if (accion === 'ver') {
      abrirDetalles(item);
    } else if (accion === 'editar') {
      abrirEditarCaducidad(item);
    } else if (accion === 'historial') {
      abrirHistorial(codigo, item.nombre);
    }
  });

  // ===== Modal: Ver detalles =====
  function abrirDetalles(p) {
    const lotesHtml = (p.lotes || []).length
      ? p.lotes.map(l => {
          const warning = l.por_caducar;
          const fv = l.fecha_vencimiento
            ? fmtDate(l.fecha_vencimiento)
            : '-';
          return `
            <tr>
              <td>#${l.id_lote}</td>
              <td>${l.cantidad_disponible}</td>
              <td>${fmtDate(l.fecha_ingreso)}</td>
              <td class="${warning ? 'expiry-date warning' : ''}">
                ${warning ? '<i class="fas fa-exclamation-triangle"></i> ' : ''}
                ${fv}
              </td>
              <td>$${Number(l.precio_compra || 0).toFixed(2)}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="5" class="text-muted">Sin lotes activos.</td></tr>';

    $detalleTitulo.textContent = `${p.nombre} (Código ${p.codigo_producto})`;

    $detalleBody.innerHTML = `
      <div class="detalle-resumen">
        <div class="detalle-item">
          <span class="detalle-label">Categoría</span>
          <span class="detalle-value">${p.categoria || 'Sin categoría'}</span>
        </div>
        <div class="detalle-item">
          <span class="detalle-label">Stock total</span>
          <span class="detalle-value">${p.stock_total} ${p.unidad_medida || ''}</span>
        </div>
        <div class="detalle-item">
          <span class="detalle-label">Stock mínimo</span>
          <span class="detalle-value">${p.stock_minimo || 0} ${p.unidad_medida || ''}</span>
        </div>
        <div class="detalle-item">
          <span class="detalle-label">Estado</span>
          <span class="detalle-value ${estadoClass(p.estado_stock)}">
            ${estadoLabel(p.estado_stock)}
          </span>
        </div>
      </div>

      <h3 class="detalle-subtitulo">Lotes activos</h3>
      <div class="detalle-table-wrapper">
        <table class="detalle-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Cantidad</th>
              <th>Ingreso</th>
              <th>Vencimiento</th>
              <th>Precio compra</th>
            </tr>
          </thead>
          <tbody>${lotesHtml}</tbody>
        </table>
      </div>
    `;
    show($detalleModal);
  }

  // ===== Modal: Editar caducidad =====
  function abrirEditarCaducidad(p) {
    if (!p.lotes || !p.lotes.length) {
      $caducidadBody.innerHTML = `
        <p class="text-muted">No hay lotes activos para este producto.</p>
      `;
      show($caducidadModal);
      return;
    }

    $caducidadBody.innerHTML = `
      <p class="modal-subtitle">
        Producto: <strong>${p.nombre}</strong> (Código ${p.codigo_producto})
      </p>
      ${p.lotes.map(l => {
        const val = l.fecha_vencimiento
          ? String(l.fecha_vencimiento).substring(0, 10)
          : '';
        return `
          <div class="cad-row">
            <div class="cad-info">
              <span class="cad-lote">Lote #${l.id_lote}</span>
              <span class="cad-cant">${l.cantidad_disponible} ${p.unidad_medida || ''}</span>
            </div>
            <div class="cad-input">
              <label>Fecha de vencimiento</label>
              <input type="date" data-lote="${l.id_lote}" value="${val}">
            </div>
          </div>
        `;
      }).join('')}
    `;
    show($caducidadModal);
  }

  $guardarCaducidad.addEventListener('click', async () => {
    const inputs = $caducidadBody.querySelectorAll('input[type="date"][data-lote]');
    try {
      for (const inp of inputs) {
        const idLote = inp.dataset.lote;
        const fecha  = inp.value;
        if (!fecha) continue;
        await callApi(`/api/inventario/lote/${idLote}/fecha-vencimiento`, {
          method: 'PUT',
          body: JSON.stringify({ fecha_vencimiento: fecha })
        });
      }
      hide($caducidadModal);
      await Promise.all([cargarResumen(), cargarInventario()]);
    } catch (e) {
      console.error('Guardar caducidad:', e);
      if (e.message && e.message.includes('No es posible asignar en esta fecha')) {
        showToast('No es posible asignar en esta fecha');
      } else {
        showToast('Error al guardar fechas de caducidad');
      }
    }
  });

  // ===== Modal: Historial (lotes agotados) =====
  async function abrirHistorial(codigo, nombreProducto) {
    try {
      const rows = await callApi(`/api/inventario/historial?codigo=${encodeURIComponent(codigo)}`);
      if (!rows.length) {
        $historialBody.innerHTML = `
          <p class="modal-subtitle">
            Producto: <strong>${nombreProducto}</strong>
          </p>
          <p class="text-muted">Este producto aún no tiene lotes agotados.</p>
        `;
      } else {
        $historialBody.innerHTML = `
          <p class="modal-subtitle">
            Producto: <strong>${nombreProducto}</strong>
          </p>
          <div class="detalle-table-wrapper">
            <table class="detalle-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Cant. final</th>
                  <th>Ingreso</th>
                  <th>Vencimiento</th>
                  <th>Precio compra</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td>#${r.id_lote}</td>
                    <td>${r.cantidad_disponible}</td>
                    <td>${fmtDate(r.fecha_ingreso)}</td>
                    <td>${r.fecha_vencimiento ? fmtDate(r.fecha_vencimiento) : '-'}</td>
                    <td>$${Number(r.precio_compra || 0).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
      show($historialModal);
    } catch (e) {
      console.error('Historial:', e);
      $historialBody.innerHTML = `<p class="text-error">Error al cargar el historial.</p>`;
      show($historialModal);
    }
  }

  // ===== Modal: Vencidos =====
  async function abrirVencidos() {
    try {
      const rows = await callApi('/api/inventario/vencidos');
      if (!rows.length) {
        $vencidosBody.innerHTML = `
          <p class="text-muted">No hay productos vencidos con stock disponible.</p>
        `;
      } else {
        $vencidosBody.innerHTML = `
          <div class="detalle-table-wrapper">
            <table class="detalle-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Lote</th>
                  <th>Cantidad</th>
                  <th>Ingreso</th>
                  <th>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td>${r.producto}</td>
                    <td>#${r.id_lote}</td>
                    <td>${r.cantidad_disponible} ${r.unidad_medida || ''}</td>
                    <td>${fmtDate(r.fecha_ingreso)}</td>
                    <td class="expiry-date warning">${fmtDate(r.fecha_vencimiento)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
      show($vencidosModal);
    } catch (e) {
      console.error('Vencidos:', e);
      $vencidosBody.innerHTML = `<p class="text-error">Error al cargar productos vencidos.</p>`;
      show($vencidosModal);
    }
  }

  if ($btnVerVencidos) {
    $btnVerVencidos.addEventListener('click', abrirVencidos);
  }

  // ===== Cerrar modales =====
  $cerrarDetalle.addEventListener('click', () => hide($detalleModal));
  $detalleModal.addEventListener('click', e => {
    if (e.target === $detalleModal) hide($detalleModal);
  });

  [$cerrarCaducidad, $cancelarCaducidad].forEach(btn => {
    if (btn) btn.addEventListener('click', () => hide($caducidadModal));
  });
  $caducidadModal.addEventListener('click', e => {
    if (e.target === $caducidadModal) hide($caducidadModal);
  });

  $cerrarHistorial.addEventListener('click', () => hide($historialModal));
  $historialModal.addEventListener('click', e => {
    if (e.target === $historialModal) hide($historialModal);
  });

  if ($cerrarVencidos) {
    $cerrarVencidos.addEventListener('click', () => hide($vencidosModal));
    $vencidosModal.addEventListener('click', e => {
      if (e.target === $vencidosModal) hide($vencidosModal);
    });
  }

  // ===== Init =====
  (async () => {
    await cargarResumen();
    await cargarInventario();
  })();
})();
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "index.html"; // 🔥 Ahora sí manda al login
});