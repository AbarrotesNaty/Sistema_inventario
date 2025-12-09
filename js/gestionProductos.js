// js/gestionProductos.js

const API_BASE = 'https://backend-naty.onrender.com';
const API_PRODUCTS = (p = '') => `${API_BASE}/api/productos${p}`;
const API_PROV = (p = '') => `${API_BASE}/api/productos/proveedores${p}`;
const $ = (s) => document.querySelector(s);

const grid = document.getElementById('productsGrid');
const searchBox = document.getElementById('searchBox');

let debTimer = null;
let currentMode = 'new'; // new | edit | view

// ---------- UI: Card ----------

function productCardHTML(p) {
  const estado = p.estado || 'Sin estado';
  const estadoClass =
    estado === 'Activo' ? 'activo' :
    estado === 'Inactivo' ? 'inactivo' : 'inactivo';

  return `
    <div class="product-card" data-id="${p.codigo_producto}">
      <div class="product-info">
        <h3>${escapeHtml(p.nombre ?? '-')}</h3>
        <p class="product-detail"><strong>Categoría:</strong> ${escapeHtml(p.categoria ?? '-')}</p>
        <p class="product-detail"><strong>Stock:</strong> ${p.stock_minimo != null ? p.stock_minimo + ' unidades' : '-'}</p>
        ${
          p.proveedor_nombre
            ? `<p class="product-detail"><strong>Proveedor:</strong> ${escapeHtml(p.proveedor_nombre)}</p>`
            : ''
        }
        <span class="product-status ${estadoClass}">${escapeHtml(estado)}</span>
      </div>
      <div class="product-actions">
        <button class="btn-view" title="Ver" onclick="viewProduct(${p.codigo_producto})">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn-edit" title="Editar" onclick="openModal('edit', ${p.codigo_producto})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-delete" title="Eliminar" onclick="deleteProduct(${p.codigo_producto})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function renderProducts(list) {
  if (!grid) return;
  grid.innerHTML =
    Array.isArray(list) && list.length
      ? list.map(productCardHTML).join('')
      : '<p style="color:#6C757D">Sin productos</p>';
}

// ---------- API Calls ----------

async function fetchProducts(query = '') {
  const url = query ? API_PRODUCTS(`?q=${encodeURIComponent(query)}`) : API_PRODUCTS();
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al cargar productos');
  return res.json();
}

async function fetchProduct(id) {
  const res = await fetch(API_PRODUCTS('/' + id));
  if (!res.ok) throw new Error('Error al cargar producto');
  return res.json();
}

async function fetchProveedores() {
  const res = await fetch(API_PROV());
  if (!res.ok) throw new Error('Error al cargar proveedores');
  return res.json();
}

// ---------- Proveedores en Select ----------

async function loadProveedoresSelect(selectedId = null) {
  const data = await fetchProveedores();
  const select = $('#proveedorId');
  if (!select) return;

  if (!Array.isArray(data) || !data.length) {
    select.innerHTML = '<option value="">No hay proveedores registrados</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecciona un proveedor...</option>';
  data.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id_proveedor;
    opt.textContent = p.nombre;
    if (selectedId && Number(selectedId) === Number(p.id_proveedor)) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

// ---------- Modal Helpers ----------

function setReadOnly(ro) {
  const form = $('#productForm');
  if (!form) return;
  const fields = form.querySelectorAll('input, textarea, select');
  fields.forEach(el => {
    if (el.id === 'codigoProducto') return;
    el.disabled = ro;
  });
  const saveBtn = $('#btnGuardar');
  if (saveBtn) saveBtn.style.display = ro ? 'none' : 'inline-block';
}

function fillForm(p) {
  $('#codigoProducto').value = p.codigo_producto ?? '';
  $('#codigoBarras').value = p.codigo_barras ?? '';
  $('#nombre').value = p.nombre ?? '';
  $('#descripcion').value = p.descripcion ?? '';
  $('#categoria').value = p.categoria ?? '';
  $('#unidadMedida').value = p.unidad_medida ?? '';
  $('#precioVenta').value = p.precio_venta ?? '';
  $('#stockMinimo').value = p.stock_minimo ?? '';
  $('#estado').value = p.estado ?? 'Activo';
  $('#precioSugerido').value = p.precio_sugerido ?? '';

  if ($('#proveedorId') && p.proveedor_id) {
    $('#proveedorId').value = p.proveedor_id;
  }
}

function getFormData() {
  return {
    codigo_barras: ($('#codigoBarras').value || '').trim(),
    nombre: ($('#nombre').value || '').trim(),
    descripcion: ($('#descripcion').value || '').trim() || null,
    categoria: ($('#categoria').value || '').trim() || null,
    unidad_medida: ($('#unidadMedida').value || '').trim() || null,
    precio_venta: $('#precioVenta').value ? Number($('#precioVenta').value) : null,
    stock_minimo: $('#stockMinimo').value ? Number($('#stockMinimo').value) : null,
    estado: $('#estado').value || 'Activo',
    proveedor_id: $('#proveedorId').value || null,
    precio_sugerido: $('#precioSugerido').value ? Number($('#precioSugerido').value) : null
  };
}

// ---------- Modal Open/Close ----------

async function openModal(type, id = null) {
  currentMode = type;
  const modal = $('#productModal');
  const title = $('#modalTitle');
  const form = $('#productForm');

  if (!modal || !title || !form) return;

  form.reset();
  $('#codigoProducto').value = '';

  title.textContent =
    type === 'new' ? 'Nuevo Producto' :
    type === 'edit' ? 'Editar Producto' :
    'Detalle de Producto';

  setReadOnly(false);

  try {
    await loadProveedoresSelect();

    if ((type === 'edit' || type === 'view') && id) {
      const p = await fetchProduct(id);
      await loadProveedoresSelect(p.proveedor_id);
      fillForm(p);
      if (type === 'view') setReadOnly(true);
    }
  } catch (e) {
    console.error(e);
    alert('Error al cargar datos');
  }

  modal.style.display = 'flex';
}

function closeModal() {
  const modal = $('#productModal');
  if (modal) modal.style.display = 'none';
  currentMode = 'new';
  setReadOnly(false);
}

// ---------- View / Save / Delete ----------

async function viewProduct(id) {
  await openModal('view', id);
}

async function saveProduct() {
  if (currentMode === 'view') return;

  const data = getFormData();

  if (!data.nombre || !data.codigo_barras || !data.proveedor_id) {
    alert('Nombre, código de barras y proveedor son obligatorios.');
    return;
  }

  const id = $('#codigoProducto').value;
  const isEdit = currentMode === 'edit' && id;

  try {
    const res = await fetch(API_PRODUCTS(isEdit ? '/' + id : ''), {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const resp = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(resp.error || `Error al guardar (HTTP ${res.status})`);
      console.error('Guardar producto error:', resp);
      return;
    }

    closeModal();
    await loadAndRenderProducts(getQuery());
  } catch (e) {
    console.error(e);
    alert('No hay conexión con el servidor');
  }
}

async function deleteProduct(id) {
  if (!confirm('¿Está seguro de que desea eliminar este producto?')) return;
  try {
    const res = await fetch(API_PRODUCTS('/' + id), { method: 'DELETE' });
    const resp = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(resp.error || 'No se pudo eliminar');
      return;
    }
    await loadAndRenderProducts(getQuery());
  } catch (e) {
    console.error(e);
    alert('No hay conexión con el servidor');
  }
}

// ---------- Búsqueda ----------

function getQuery() {
  return (searchBox && typeof searchBox.value === 'string') ? searchBox.value.trim() : '';
}

async function loadAndRenderProducts(query = '') {
  try {
    const data = await fetchProducts(query);
    renderProducts(data);
  } catch (e) {
    console.error(e);
    if (grid) grid.innerHTML = '<p style="color:#6C757D">Error al cargar productos</p>';
  }
}

function attachSearch() {
  if (!searchBox) return;
  searchBox.addEventListener('input', () => {
    clearTimeout(debTimer);
    debTimer = setTimeout(() => loadAndRenderProducts(getQuery()), 180);
  });
  searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadAndRenderProducts(getQuery());
    }
  });
}

// ---------- Utils ----------

function escapeHtml(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- Exponer funciones ----------

window.openModal = openModal;
window.closeModal = closeModal;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.viewProduct = viewProduct;

// ---------- Init ----------

attachSearch();
loadAndRenderProducts();
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html"; // 🔥 Ahora sí manda al login
});