// js/gestionProveedores.js

const API_BASE = 'https://backend-naty.onrender.com';
const API = (p = '') => `${API_BASE}/api/proveedores${p}`;
const $  = (s) => document.querySelector(s);

// Toma por ID si existe, si no por clase (como en tu HTML original)
const grid = document.getElementById('suppliersGrid') || document.querySelector('.suppliers-grid');
const searchBox = document.getElementById('searchBox') || document.querySelector('.search-input');

let debTimer = null;

// ---------- UI ----------
function cardHTML(p) {
  return `
  <div class="supplier-card" data-id="${p.id_proveedor}">
    <div class="supplier-info">
      <h3>${p.nombre ?? '-'}</h3>
      <p class="phone"><i class="fas fa-phone"></i> ${p.telefono ?? '-'}</p>
      <p class="contact"><i class="fas a-envelope"></i> ${p.correo ?? '-'}</p>
      <p class="products"><i class="fas fa-map-marker-alt"></i> ${p.direccion ?? '-'}</p>
      <span class="status active">Activo</span>
    </div>
    <div class="supplier-actions">
      <button class="btn-view" title="Ver" onclick="viewSupplier(${p.id_proveedor})"><i class="fas fa-eye"></i></button>
      <button class="btn-edit" title="Editar" onclick="openModal('edit', ${p.id_proveedor})"><i class="fas fa-edit"></i></button>
      <button class="btn-delete" title="Eliminar" onclick="deleteSupplier(${p.id_proveedor})"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

function render(list) {
  if (!grid) {
    console.warn('[proveedores] No encontré el contenedor de la lista (.suppliers-grid)');
    return;
  }
  grid.innerHTML = (Array.isArray(list) && list.length)
    ? list.map(cardHTML).join('')
    : '<p style="color:#6C757D">Sin proveedores</p>';
}

// ---------- Data ----------
async function fetchAndRender(query = '') {
  // Igual que productos: el front manda ?q=... al backend
  const url = query ? API(`?q=${encodeURIComponent(query)}`) : API();
  const res = await fetch(url);
  const data = await res.json();
  render(data);
}

async function loadSuppliers() {
  await fetchAndRender('');
}

// ---------- Modal Crear/Editar ----------
function openModal(type, id = null) {
  const modal = $('#supplierModal');
  const title = $('#modalTitle');
  const form  = $('#supplierForm');
  if (!modal || !title || !form) {
    console.warn('[proveedores] Falta estructura del modal en el HTML');
    return;
  }

  form.reset();
  setReadOnly(false);
  $('#supplierId').value = '';

  if (type === 'edit' && id) {
    title.textContent = 'Editar Proveedor';
    fetch(API('/' + id))
      .then(r => r.json())
      .then(p => {
        $('#supplierId').value   = p.id_proveedor;
        $('#companyName').value  = p.nombre || '';
        $('#phone').value        = p.telefono || '';
        $('#email').value        = p.correo || '';
        $('#address').value      = p.direccion || '';
      });
  } else {
    title.textContent = 'Nuevo Proveedor';
  }
  const saveBtn = document.querySelector('.modal-footer .btn-primary');
  if (saveBtn) saveBtn.style.display = '';
  modal.style.display = 'flex';
}

function closeModal() {
  const modal = $('#supplierModal');
  if (modal) modal.style.display = 'none';
}

// ---------- Ver (solo lectura) ----------
async function viewSupplier(id) {
  try {
    const res = await fetch(API('/' + id));
    if (!res.ok) { alert('No se pudo cargar el proveedor'); return; }
    const p = await res.json();

    $('#modalTitle').textContent = 'Detalle del Proveedor';
    $('#supplierId').value  = p.id_proveedor;
    $('#companyName').value = p.nombre || '';
    $('#phone').value       = p.telefono || '';
    $('#email').value       = p.correo || '';
    $('#address').value     = p.direccion || '';

    setReadOnly(true);

    const saveBtn = document.querySelector('.modal-footer .btn-primary');
    if (saveBtn) saveBtn.style.display = 'none';

    $('#supplierModal').style.display = 'flex';
  } catch (e) {
    console.error(e);
    alert('Error al cargar el proveedor');
  }
}

function setReadOnly(ro) {
  ['companyName','phone','email','address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = ro;
      el.disabled = ro;
    }
  });
}

// ---------- Guardar / Eliminar ----------
async function saveSupplier() {
  const id = $('#supplierId').value;
  const payload = {
    nombre:   $('#companyName').value.trim(),
    telefono: $('#phone').value.trim(),
    direccion:$('#address').value.trim(),
    correo:   $('#email').value.trim(),
  };

  try {
    const res = await fetch(API(id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const resp = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(resp.error || `Error al guardar (HTTP ${res.status})`);
      console.error('Guardar proveedor error:', resp);
      return;
    }
    closeModal();
    await fetchAndRender(getQuery());
  } catch (e) {
    console.error(e);
    alert('No hay conexión con el servidor');
  }
}

async function deleteSupplier(id) {
  if (!confirm('¿Está seguro de que desea eliminar este proveedor?')) return;
  const res = await fetch(API('/' + id), { method: 'DELETE' });
  if (!res.ok) {
    const r = await res.json().catch(() => ({}));
    alert(r.error || 'No se pudo eliminar');
    return;
  }
  await fetchAndRender(getQuery());
}

// ---------- Búsqueda (MISMO PATRÓN QUE PRODUCTOS) ----------
function getQuery() {
  return (searchBox && typeof searchBox.value === 'string') ? searchBox.value : '';
}

function attachSearch() {
  if (!searchBox) {
    console.warn('[proveedores] No encontré el buscador (.search-input)');
    return;
  }
  // Debounce al escribir
  searchBox.addEventListener('input', () => {
    clearTimeout(debTimer);
    debTimer = setTimeout(() => fetchAndRender(getQuery()), 180);
  });
  // Enter fuerza búsqueda y evita submit
  searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchAndRender(getQuery());
    }
  });
}

// ---------- Exponer (onclick del HTML) ----------
window.openModal = openModal;
window.closeModal = closeModal;
window.saveSupplier = saveSupplier;
window.deleteSupplier = deleteSupplier;
window.viewSupplier = viewSupplier;

// ---------- Boot ----------
attachSearch();
loadSuppliers();
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "index.html"; // 🔥 Ahora sí manda al login
});