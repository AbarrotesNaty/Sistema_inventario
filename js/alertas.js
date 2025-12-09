// frontend/js/alertas.js
(() => {
  const API_BASE = 'https://backend-naty.onrender.com';

  const callApi = async (path, opts = {}) => {
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
  };

  const $search    = document.getElementById('searchInput');
  const $tipoFiltro= document.getElementById('tipoFiltro');
  const $lista     = document.getElementById('alertsList');
  const $toast     = document.getElementById('toast');

  let alertas = [];

  function showToast(msg) {
    if (!$toast) { alert(msg); return; }
    $toast.textContent = msg;
    $toast.style.display = 'block';
    $toast.classList.add('show');
    setTimeout(() => {
      $toast.classList.remove('show');
      $toast.style.display = 'none';
    }, 2500);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function iconFor(tipo) {
    if (tipo === 'stock_bajo') return '<i class="fas fa-exclamation-triangle"></i>';
    if (tipo === 'por_vencer') return '<i class="fas fa-clock"></i>';
    if (tipo === 'vencido')    return '<i class="fas fa-ban"></i>';
    return '<i class="fas fa-info-circle"></i>';
  }

  function labelFor(tipo) {
    if (tipo === 'stock_bajo') return 'Stock Bajo';
    if (tipo === 'por_vencer') return 'Por Vencer';
    if (tipo === 'vencido')    return 'Vencido';
    return 'Alerta';
  }

  function classFor(tipo) {
    if (tipo === 'stock_bajo') return 'stock-bajo';
    if (tipo === 'por_vencer') return 'por-vencer';
    if (tipo === 'vencido')    return 'vencido';
    return '';
  }

  function filtrar() {
    const q    = ($search.value || '').toLowerCase();
    const tipo = $tipoFiltro.value;

    return alertas.filter(a => {
      if (tipo !== 'all' && a.tipo !== tipo) return false;

      if (q) {
        const texto = [
          a.nombre,
          a.categoria,
          a.mensaje,
          a.codigo_producto,
          a.lote
        ].filter(Boolean).join(' ').toLowerCase();
        if (!texto.includes(q)) return false;
      }

      return true;
    });
  }

  function render() {
    const data = filtrar();
    $lista.innerHTML = '';

    if (!data.length) {
      $lista.innerHTML = `
        <p class="alerts-empty">No hay alertas para mostrar con los filtros seleccionados.</p>
      `;
      return;
    }

    data.forEach(a => {
      const card = document.createElement('div');
      card.className = `alert-card ${classFor(a.tipo)}`;

      const fv = a.fecha_vencimiento ? fmtDate(a.fecha_vencimiento) : null;

      const metaParts = [];
      if (a.tipo === 'stock_bajo') {
        metaParts.push(`Código: ${a.codigo_producto}`);
      } else if (a.tipo === 'por_vencer' || a.tipo === 'vencido') {
        if (a.lote) metaParts.push(`Lote #${a.lote}`);
        if (fv) metaParts.push(`Vencimiento: ${fv}`);
        if (a.codigo_producto) metaParts.push(`Código: ${a.codigo_producto}`);
      }

      card.innerHTML = `
        <div class="alert-icon">
          ${iconFor(a.tipo)}
        </div>
        <div class="alert-content">
          <div class="alert-title">${labelFor(a.tipo)} - ${a.nombre}</div>
          <div class="alert-message">${a.mensaje}</div>
          ${metaParts.length
            ? `<div class="alert-meta">${metaParts.join(' | ')}</div>`
            : ''
          }
        </div>
      `;

      $lista.appendChild(card);
    });
  }

  async function cargarAlertas() {
    try {
      const data = await callApi('/api/alertas');
      alertas = Array.isArray(data) ? data : [];
      render();
    } catch (e) {
      console.error('Error alertas:', e);
      showToast('Error al cargar las alertas');
      $lista.innerHTML = `<p class="alerts-empty">No se pudieron cargar las alertas.</p>`;
    }
  }

  $search.addEventListener('input', render);
  $tipoFiltro.addEventListener('change', render);

  (async () => {
    await cargarAlertas();
  })();
})();
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html"; // 🔥 Ahora sí manda al login
});
