// frontend/js/controlCompras.js
(() => {
  const API_BASE = 'https://backend-naty.onrender.com';

  const callApi = window.api || (async (path, opts = {}) => {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );
    const res = await fetch(API_BASE + path, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  });

  const rowsOf = (r) =>
    Array.isArray(r) ? r :
    (r && Array.isArray(r.data)) ? r.data :
    (r && Array.isArray(r.rows)) ? r.rows :
    (r && r.data && Array.isArray(r.data.rows)) ? r.data.rows : [];

  // ==== REFS ====
  const $btnOpen  = document.getElementById("btnOpenPurchase");
  const $purchases= document.getElementById("purchasesContainer");

  const $modal    = document.getElementById("purchaseModal");
  const $btnClose = document.getElementById("btnClosePurchaseModal");
  const $btnCancel= document.getElementById("btnCancelPurchase");
  const $btnSave  = document.getElementById("btnSavePurchase");
  const $form     = document.getElementById("purchaseForm");

  const $proveedor= document.getElementById("proveedorSelect");
  const $fecha    = document.getElementById("fechaCompraInput");
  const $estado   = document.getElementById("estadoCompraSelect");

  const $btnAdd   = document.querySelector(".btn-add-product");
  const $items    = document.querySelector(".product-items");

  const $sumSub   = document.querySelector(".sum-subtotal");
  const $sumIva   = document.querySelector(".sum-iva");
  const $sumTot   = document.querySelector(".sum-total");

  const $search   = document.getElementById("searchInput");
  const $estadoFiltro = document.getElementById("estadoFiltro");
  const $fechaDesde   = document.getElementById("fechaDesde");
  const $fechaHasta   = document.getElementById("fechaHasta");

  const $detailModal = document.getElementById("purchaseDetailModal");
  const $btnCloseDetailModal = document.getElementById("btnCloseDetailModal");
  const $btnCloseDetail = document.getElementById("btnCloseDetail");
  const $btnPrintDetail = document.getElementById("btnPrintDetail");
  const $btnDownloadDetail = document.getElementById("btnDownloadDetail");
  const $detailTitle = document.getElementById("detailTitle");
  const $detailBody  = document.getElementById("detailBody");

  const show  = el => el && (el.style.display = "flex");
  const hide  = el => el && (el.style.display = "none");
  const money = n => `$${Number(n || 0).toFixed(2)}`;
  const fmtDate = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return iso || "";
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d) ? null : d;
  };

  let productosProveedor = [];
  let comprasData = []; // todas las compras desde el backend

  const getEstadoClass = (estado) => {
    switch ((estado || 'Pendiente')) {
      case 'Completada': return 'completed';
      case 'Cancelada':  return 'canceled';
      default:           return 'pending';
    }
  };

  // ===== PROVEEDORES =====
  async function loadProveedores() {
    try {
      const r = await callApi("/api/proveedores");
      const rows = rowsOf(r);
      $proveedor.innerHTML =
        '<option value="">Seleccionar proveedor</option>' +
        rows.map(p => `<option value="${p.id_proveedor}">${p.nombre}</option>`).join("");
    } catch (e) {
      console.error("proveedores:", e);
      $proveedor.innerHTML =
        '<option value="">(Error al cargar proveedores)</option>';
    }
  }

  // ===== PRODUCTOS POR PROVEEDOR =====
  async function loadProductosByProveedor(id_proveedor) {
    productosProveedor = [];
    $items.innerHTML = "";
    recalcTotals();
    if (!id_proveedor) return;

    try {
      const r = await callApi(`/api/proveedores/${id_proveedor}/productos`);
      const rows = rowsOf(r);
      productosProveedor = rows.map(p => ({
        id: p.codigo_producto,
        nombre: p.nombre
      }));
      if (productosProveedor.length) {
        crearItemProducto();
        recalcTotals();
      }
    } catch (e) {
      console.error("productos proveedor:", e);
    }
  }

  // ===== CARGAR COMPRAS (desde backend) =====
  async function loadCompras() {
    try {
      $purchases.innerHTML = "";
      const r = await callApi("/api/compras");
      comprasData = rowsOf(r);
      renderCompras();
    } catch (e) {
      console.error("compras:", e);
      $purchases.innerHTML =
        '<p style="opacity:.7;padding:12px">Error cargando compras.</p>';
    }
  }

  // ===== RENDER CON FILTROS =====
  function renderCompras() {
    $purchases.innerHTML = "";

    if (!Array.isArray(comprasData) || !comprasData.length) {
      $purchases.innerHTML =
        '<p style="opacity:.7;padding:12px">No hay compras registradas.</p>';
      return;
    }

    const texto = ($search?.value || "").toLowerCase().trim();
    const estadoFiltro = $estadoFiltro?.value || "all";
    const dDesde = parseDate($fechaDesde?.value);
    const dHasta = parseDate($fechaHasta?.value);

    const filtradas = comprasData.filter(c => {
      // texto: busca en proveedor, id y total
      if (texto) {
        const s = `compra ${c.id_compra} ${c.proveedor || ''} ${c.total || ''}`.toLowerCase();
        if (!s.includes(texto)) return false;
      }

      // estado
      if (estadoFiltro !== "all") {
        if ((c.estado || "Pendiente") !== estadoFiltro) return false;
      }

      // fecha
      if (dDesde || dHasta) {
        const f = parseDate(c.fecha);
        if (!f) return false;
        if (dDesde && f < dDesde) return false;
        if (dHasta) {
          const fHasta = new Date(dHasta);
          fHasta.setHours(23,59,59,999);
          if (f > fHasta) return false;
        }
      }

      return true;
    });

    if (!filtradas.length) {
      $purchases.innerHTML =
        '<p style="opacity:.7;padding:12px">No hay compras con esos filtros.</p>';
      return;
    }

    filtradas.forEach(c => {
      const estado = c.estado || 'Pendiente';
      const estadoClass = getEstadoClass(estado);

      const card = document.createElement("div");
      card.className = "purchase-card";
      card.dataset.id = c.id_compra;

      card.innerHTML = `
        <div class="purchase-header">
          <h3>Compra #${String(c.id_compra).padStart(3,"0")}</h3>
          <span class="status ${estadoClass}">${estado}</span>
        </div>
        <div class="purchase-body">
          <div class="purchase-info">
            <p><i class="fas fa-truck"></i> Proveedor: ${c.proveedor}</p>
            <p><i class="fas fa-calendar"></i> Fecha: ${fmtDate(c.fecha)}</p>
            <p><i class="fas fa-box"></i> Productos: ${c.items} items</p>
            <p><i class="fas fa-dollar-sign"></i> Total: ${money(c.total)}</p>
          </div>
          <div class="purchase-actions">
            <div class="status-control">
              <select class="estado-select">
                <option value="Pendiente"  ${estado === 'Pendiente'  ? 'selected' : ''}>Pendiente</option>
                <option value="Completada" ${estado === 'Completada' ? 'selected' : ''}>Completada</option>
                <option value="Cancelada"  ${estado === 'Cancelada'  ? 'selected' : ''}>Cancelada</option>
              </select>
              <button class="btn-update-estado" title="Actualizar estado">
                <i class="fas fa-save"></i>
              </button>
            </div>
            <button class="btn-view" title="Ver detalle"><i class="fas fa-eye"></i></button>
            <button class="btn-delete" title="Eliminar"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;

      // Ver detalle
      card.querySelector(".btn-view")
        .addEventListener("click", () => openDetail(c.id_compra));

      // Eliminar
      card.querySelector(".btn-delete")
        .addEventListener("click", async () => {
          if (!confirm(`¿Eliminar compra #${c.id_compra}?`)) return;
          try {
            await callApi(`/api/compras/${c.id_compra}`, { method: "DELETE" });
            await loadCompras();
          } catch (e) {
            console.error("eliminar compra:", e);
            alert("Error al eliminar la compra.");
          }
        });

      // Actualizar estado
      const selEstado = card.querySelector(".estado-select");
      const btnUpd    = card.querySelector(".btn-update-estado");
      btnUpd.addEventListener("click", async () => {
        const nuevo = selEstado.value;
        try {
          await callApi(`/api/compras/${c.id_compra}/estado`, {
            method: "PATCH",
            body: JSON.stringify({ estado: nuevo })
          });
          await loadCompras();
        } catch (e) {
          console.error("actualizar estado:", e);
          alert("Error al actualizar el estado.");
        }
      });

      $purchases.appendChild(card);
    });
  }

  // ===== DETALLE =====
  async function openDetail(id) {
    try {
      const r = await callApi(`/api/compras/${id}`);
      const { compra, detalles } = r;

      $detailTitle.textContent =
        `Detalle de Compra #${String(compra.id_compra).padStart(3,"0")}`;

      const rowsHtml = detalles.map(d => `
        <tr>
          <td>${d.producto}</td>
          <td>${d.cantidad}</td>
          <td>${money(d.precio_unit)}</td>
          <td>${money(d.cantidad * d.precio_unit)}</td>
        </tr>
      `).join("");

      const subtotal = detalles.reduce((a,d)=>a+d.cantidad*d.precio_unit,0);
      const iva = subtotal * 0.16;
      const total = subtotal + iva;

      $detailBody.innerHTML = `
        <div class="detail-section">
          <h3>Información General</h3>
          <div class="detail-info">
            <div class="detail-row">
              <span class="detail-label">Proveedor:</span>
              <span class="detail-value">${compra.proveedor}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fecha:</span>
              <span class="detail-value">${fmtDate(compra.fecha)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Usuario:</span>
              <span class="detail-value">${compra.usuario || ''}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Estado:</span>
              <span class="detail-value">${compra.estado || 'Pendiente'}</span>
            </div>
          </div>
        </div>
        <div class="detail-section">
          <h3>Productos</h3>
          <table class="detail-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Subtotal:</td>
                <td>${money(subtotal)}</td>
              </tr>
              <tr>
                <td colspan="3">Impuestos (16%):</td>
                <td>${money(iva)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3">Total:</td>
                <td>${money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
      show($detailModal);
    } catch (e) {
      console.error("detalle compra:", e);
      alert("Error al cargar el detalle de la compra.");
    }
  }

  // ===== IMPRESIÓN SIMPLE =====
  function printDetail() {
    if (!$detailBody || !$detailBody.innerHTML.trim()) return;

    const title = $detailTitle.textContent || 'Detalle de Compra';
    const content = $detailBody.innerHTML;

    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) {
      alert('Habilita las ventanas emergentes para poder imprimir.');
      return;
    }

    w.document.write(`
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <link rel="stylesheet" href="css/controlCompras.css">
        <style>
          body { font-family: 'Poppins', sans-serif; padding: 24px; }
          h2 { margin-bottom: 16px; }
          .detail-section { margin-bottom: 16px; }
          .detail-table { width: 100%; border-collapse: collapse; }
          .detail-table th, .detail-table td {
            border: 1px solid #e5e7eb;
            padding: 6px;
            font-size: 12px;
          }
          .detail-table th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${content}
      </body>
      </html>
    `);

    w.document.close();
    w.focus();
    w.print();
  }

  // ===== DESCARGAR PDF (jsPDF) =====
  function downloadDetailPdf() {
    if (!window.jspdf || !$detailBody || !$detailBody.innerHTML.trim()) {
      alert('No se pudo generar el PDF del detalle.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const title = $detailTitle.textContent || 'Detalle de Compra';
    const infoRows = $detailBody.querySelectorAll('.detail-info .detail-row');
    const table = $detailBody.querySelector('.detail-table');

    let y = 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, 10, y);
    y += 8;

    // Información general
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    infoRows.forEach(row => {
      const label = (row.querySelector('.detail-label')?.textContent || '').trim();
      const value = (row.querySelector('.detail-value')?.textContent || '').trim();
      if (!label && !value) return;
      doc.text(`${label} ${value}`, 10, y);
      y += 5;
    });

    y += 4;

    // Tabla productos
    if (table) {
      const headers = Array.from(table.querySelectorAll('thead th'))
        .map(th => th.textContent.trim());
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'))
        .map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
      const footRows = Array.from(table.querySelectorAll('tfoot tr'))
        .map(tr => tr.innerText.replace(/\s+/g, ' ').trim());

      const colWidths = [80, 20, 30, 30];

      // Encabezados
      doc.setFont('helvetica', 'bold');
      let x = 10;
      headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += colWidths[i];
      });
      y += 6;
      doc.setFont('helvetica', 'normal');

      // Filas
      bodyRows.forEach(cols => {
        x = 10;
        cols.forEach((text, i) => {
          const colWidth = colWidths[i];
          const txt = String(text || '');
          doc.text(txt.substring(0, 35), x, y);
          x += colWidth;
        });
        y += 6;
        if (y > 260) {
          doc.addPage();
          y = 15;
        }
      });

      // Totales
      if (y > 260) {
        doc.addPage();
        y = 15;
      }
      y += 4;
      footRows.forEach(line => {
        doc.text(line, 10, y);
        y += 5;
      });
    }

    const safeName = title.toLowerCase().replace(/\s+/g, '_');
    doc.save(`${safeName}.pdf`);
  }

  // ===== PRODUCT ITEMS =====
  function crearItemProducto() {
    if (!productosProveedor.length) {
      alert("Primero selecciona un proveedor con productos asociados.");
      return;
    }

    const row = document.createElement("div");
    row.className = "product-item";
    row.innerHTML = `
      <div class="product-select">
        <select class="sel-producto">
          <option value="">Seleccionar producto</option>
        </select>
      </div>
      <div class="product-quantity">
        <input class="inp-cantidad" type="number" min="1" value="1" placeholder="Cantidad">
      </div>
      <div class="product-price">
        <input class="inp-precio" type="number" min="0" step="0.01" value="0" placeholder="Precio Unitario">
      </div>
      <div class="product-subtotal">
        <span class="txt-subtotal">$0.00</span>
      </div>
      <div class="product-actions">
        <button type="button" class="btn-remove-product">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    $items.appendChild(row);

    const sel = row.querySelector(".sel-producto");
    sel.innerHTML =
      '<option value="">Seleccionar producto</option>' +
      productosProveedor
        .map(p => `<option value="${p.id}">${p.nombre}</option>`)
        .join("");

    const onChange = () => {
      const c = Number(row.querySelector(".inp-cantidad").value || 0);
      const p = Number(row.querySelector(".inp-precio").value || 0);
      row.querySelector(".txt-subtotal").textContent = money(c * p);
      recalcTotals();
    };

    row.querySelector(".inp-cantidad").addEventListener("input", onChange);
    row.querySelector(".inp-precio").addEventListener("input", onChange);
    row.querySelector(".btn-remove-product").addEventListener("click", () => {
      row.remove();
      recalcTotals();
    });
  }

  function getDetalles() {
    const out = [];
    $items.querySelectorAll(".product-item").forEach(row => {
      const codigo = Number(row.querySelector(".sel-producto")?.value || 0);
      const cantidad = Number(row.querySelector(".inp-cantidad")?.value || 0);
      const precio = Number(row.querySelector(".inp-precio")?.value || 0);
      if (codigo && cantidad > 0) {
        out.push({ codigo_producto_FK: codigo, cantidad, precio_unit: precio });
      }
    });
    return out;
  }

  function recalcTotals() {
    const det = getDetalles();
    const sub = det.reduce((a,d)=>a+d.cantidad*d.precio_unit,0);
    const iva = sub * 0.16;
    const tot = sub + iva;
    if ($sumSub) $sumSub.textContent = money(sub);
    if ($sumIva) $sumIva.textContent = money(iva);
    if ($sumTot) $sumTot.textContent = money(tot);
  }

  async function guardarCompra() {
    const id_proveedor_FK = Number($proveedor.value || 0);
    const fecha = $fecha.value || "";
    const detalles = getDetalles();

    if (!id_proveedor_FK) { alert("Selecciona un proveedor."); return; }
    if (!fecha)           { alert("Selecciona la fecha."); return; }
    if (!detalles.length) { alert("Agrega al menos un producto."); return; }

    const total = detalles.reduce((a,d)=>a+d.cantidad*d.precio_unit,0);

    const id_usuario_FK =
      (window.auth && window.auth.user && window.auth.user.id_usuario) || 1;

    try {
      await callApi("/api/compras", {
        method: "POST",
        body: JSON.stringify({
          compra: {
            fecha,
            id_proveedor_FK,
            id_usuario_FK,
            total
          },
          detalles
        })
      });

      hide($modal);
      resetForm();
      await loadCompras();
    } catch (e) {
      console.error("guardar compra:", e);
      alert("Error al guardar la compra.");
    }
  }

  function resetForm() {
    if ($form) $form.reset();
    if ($items) $items.innerHTML = "";
    productosProveedor = [];
    if ($fecha) $fecha.value = new Date().toISOString().slice(0,10);
    if ($estado) {
      $estado.value = "Pendiente";
      $estado.setAttribute("disabled","disabled");
    }
    recalcTotals();
  }

  // ===== EVENTOS =====
  function bindEvents() {
    if ($btnOpen) $btnOpen.addEventListener("click", e => {
      e.preventDefault();
      if ($estado) {
        $estado.value = "Pendiente";
        $estado.setAttribute("disabled","disabled");
      }
      show($modal);
    });

    if ($btnClose)  $btnClose.addEventListener("click", () => hide($modal));
    if ($btnCancel) $btnCancel.addEventListener("click", e => {
      e.preventDefault();
      hide($modal);
    });

    if ($btnSave) $btnSave.addEventListener("click", e => {
      e.preventDefault();
      guardarCompra();
    });

    if ($form) $form.addEventListener("submit", e => {
      e.preventDefault();
      guardarCompra();
    });

    if ($btnAdd) $btnAdd.addEventListener("click", () => crearItemProducto());

    if ($proveedor) $proveedor.addEventListener("change", () => {
      const id = Number($proveedor.value || 0);
      loadProductosByProveedor(id);
    });

    if ($btnCloseDetailModal)
      $btnCloseDetailModal.addEventListener("click", () => hide($detailModal));
    if ($btnCloseDetail)
      $btnCloseDetail.addEventListener("click", () => hide($detailModal));

    if ($btnPrintDetail)
      $btnPrintDetail.addEventListener("click", () => printDetail());

    if ($btnDownloadDetail)
      $btnDownloadDetail.addEventListener("click", () => downloadDetailPdf());

    // Filtros
    if ($search)       $search.addEventListener("input", renderCompras);
    if ($estadoFiltro) $estadoFiltro.addEventListener("change", renderCompras);
    if ($fechaDesde)   $fechaDesde.addEventListener("change", renderCompras);
    if ($fechaHasta)   $fechaHasta.addEventListener("change", renderCompras);
  }

  // ===== INIT =====
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if ($fecha) $fecha.value = new Date().toISOString().slice(0,10);
      await loadProveedores();
      bindEvents();
      await loadCompras();
    } catch (e) {
      console.error("init compras:", e);
    }
  });
})();
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html"; // 🔥 Ahora sí manda al login
});
