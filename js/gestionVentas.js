/* ============================================================
   📌 Inicialización + Cargar ventas + KPIs + ID VISUAL
   ============================================================ */

console.log("📌 gestionVentas.js cargado correctamente");

const API_URL = "https://backend-naty.onrender.com/api/ventas";

// Elementos del DOM
const salesList = document.getElementById("salesList");
const ventasDiaEl = document.getElementById("ventasDia");
const gananciaDiaEl = document.getElementById("gananciaDia");
const totalVentasEl = document.getElementById("totalVentas");
const productosVendidosEl = document.getElementById("productosVendidos");
const promedioVentaEl = document.getElementById("promedioVenta");

// Filtros
const desdeInput = document.getElementById("desdeFiltro");
const hastaInput = document.getElementById("hastaFiltro");
const btnToggleAnuladas = document.getElementById("toggleAnuladasBtn");

// Estado interno
let ventasGlobal = [];
let mostrarAnuladas = false;

// Cargar ventas
document.addEventListener("DOMContentLoaded", () => {
    cargarVentas();
});


/* ============================================================
   📌 CARGAR TODAS LAS VENTAS DESDE EL BACKEND
   ============================================================ */
async function cargarVentas() {
    try {
        const res = await fetch(`${API_URL}/lista`);
        let ventas = await res.json();

        ventasGlobal = ventas; // Guardar copia global para filtros

        aplicarFiltros();

    } catch (e) {
        console.error("❌ Error cargando ventas:", e);
    }
}


/* ============================================================
   📌 RENDERIZAR LISTADO DE VENTAS
   ============================================================ */
function renderizarVentas(ventas) {
    salesList.innerHTML = "";

    ventas.forEach(v => {

        // ID visual (restar uno)
        const idVisual = v.id_venta - 1;

        const fecha = new Date(v.fecha);
        const fechaFormato =
            fecha.toLocaleDateString() + " " + fecha.toLocaleTimeString();

        const card = document.createElement("div");
        card.classList.add("sale-card");

        const anulada = v.estado === "Anulada";

        card.innerHTML = `
            <div class="sale-header">
                <div class="sale-id">
                    <h3>Venta #${idVisual}</h3>
                    <span class="timestamp">${fechaFormato}</span>
                </div>

                <span class="payment-method ${anulada ? "anulada" : ""}">
                    ${anulada 
                        ? '<i class="fas fa-ban"></i> Anulada'
                        : '<i class="fas fa-money-bill"></i> Efectivo'}
                </span>
            </div>

            <div class="sale-details">
                <div class="products-list" id="productos-${v.id_venta}" data-visible="false">
                    <p class="loading-text">Haz clic en "Ver detalle"</p>
                </div>

                <div class="sale-summary">
                    <div class="summary-row total">
                        <span>Total:</span>
                        <span>$${parseFloat(v.venta_total).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="sale-actions">
                ${anulada 
                    ? '<span class="disabled-action">Anulada</span>'
                    : `
                        <button class="btn-view" onclick="verDetalle(${v.id_venta})" title="Ver detalle">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-print" onclick="imprimirTicket(${v.id_venta})" title="Imprimir">
                            <i class="fas fa-print"></i>
                        </button>
                    `
                }
                <button class="btn-delete" onclick="anularVenta(${v.id_venta})" title="Anular">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        salesList.appendChild(card);
    });
}


/* ============================================================
   📌 ACTUALIZAR KPIs (incluye Ganancia del Día)
   ============================================================ */
async function actualizarKPIs(ventas) {
    let totalMonto = 0;
    let totalGanancia = 0;
    let totalProductos = 0;

    for (const v of ventas) {
        if (v.estado !== "Activa") continue;

        totalMonto += parseFloat(v.venta_total || 0);
        totalProductos += parseInt(v.total_productos || 0);

        // Calcular ganancia por venta
        const detalles = await (await fetch(`${API_URL}/detalles/${v.id_venta}`)).json();

        detalles.forEach(d => {
            const precioVenta = parseFloat(d.precio_unitario);
            const precioCompra = parseFloat(d.precio_compra || 0);
            const cantidad = d.cantidad;

            const gananciaItem = (precioVenta - precioCompra) * cantidad;

            totalGanancia += gananciaItem;
        });
    }

    ventasDiaEl.textContent = `$${totalMonto.toFixed(2)}`;
    gananciaDiaEl.textContent = `$${totalGanancia.toFixed(2)}`;
    productosVendidosEl.textContent = totalProductos;

    const ventasActivas = ventas.filter(v => v.estado === "Activa").length;
    totalVentasEl.textContent = ventasActivas;

    promedioVentaEl.textContent =
        ventasActivas > 0
            ? "$" + (totalMonto / ventasActivas).toFixed(2)
            : "$0.00";
}


/* ============================================================
   📌 EVENTOS DE LOS FILTROS
   ============================================================ */

desdeInput.addEventListener("change", aplicarFiltros);
hastaInput.addEventListener("change", aplicarFiltros);

btnToggleAnuladas.addEventListener("click", () => {
    mostrarAnuladas = !mostrarAnuladas;
    btnToggleAnuladas.textContent = mostrarAnuladas
        ? "Ocultar anuladas"
        : "Mostrar anuladas";
    aplicarFiltros();
});


/* ============================================================
   📌 FUNCIÓN PRINCIPAL DE FILTRADO (SOLO FECHA + ANULADAS)
   ============================================================ */
function aplicarFiltros() {
    let filtradas = [...ventasGlobal];

    // 1. Filtrar anuladas (si no se muestran)
    if (!mostrarAnuladas) {
        filtradas = filtradas.filter(v => v.estado !== "Anulada");
    }

    // 2. Filtro de fecha
    const desde = desdeInput.value ? new Date(desdeInput.value) : null;
    const hasta = hastaInput.value ? new Date(hastaInput.value) : null;

    filtradas = filtradas.filter(v => {
        const fecha = new Date(v.fecha);

        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;

        return true;
    });

    // Renderizar + KPIs
    renderizarVentas(filtradas);
    actualizarKPIs(filtradas);
}


/* ============================================================
   📌 TOGGLE VER DETALLE
   ============================================================ */
async function verDetalle(idVenta) {
    const contenedor = document.getElementById(`productos-${idVenta}`);

    if (contenedor.dataset.visible === "true") {
        contenedor.innerHTML = `<p class="loading-text">Haz clic en "Ver detalle"</p>`;
        contenedor.dataset.visible = "false";
        return;
    }

    try {
        const detalles = await (await fetch(`${API_URL}/detalles/${idVenta}`)).json();

        contenedor.innerHTML = "";
        contenedor.dataset.visible = "true";

        detalles.forEach(d => {
            const item = document.createElement("div");
            item.classList.add("product-item");

            item.innerHTML = `
                <span class="product-name">${d.producto}</span>
                <span class="product-quantity">${d.cantidad} x $${parseFloat(d.precio_unitario).toFixed(2)}</span>
                <span class="product-total">$${parseFloat(d.subtotal).toFixed(2)}</span>
            `;

            contenedor.appendChild(item);
        });

    } catch (e) {
        console.error("❌ Error cargando detalles:", e);
    }
}


/* ============================================================
   📌 TICKET TÉRMICO
   ============================================================ */
async function imprimirTicket(idVenta) {
    try {
        const ventas = await (await fetch(`${API_URL}/lista`)).json();
        const venta = ventas.find(v => v.id_venta === idVenta);

        const detalles = await (await fetch(`${API_URL}/detalles/${idVenta}`)).json();

        const idVisual = idVenta - 1;

        const win = window.open("", "_blank", "width=400,height=600");

        win.document.write("<html><head><title>Cargando...</title></head><body></body></html>");
        win.document.close();

        setTimeout(() => {

            let html = `
            <html>
            <head>
                <title>Ticket Venta #${idVisual}</title>
                <style>
                    @page { size: 80mm auto; margin: 4mm; }
                    body { font-family: Arial; width: 80mm; margin: 0 auto; font-size: 14px; }
                    h2 { text-align: center; margin-bottom: 10px; }
                    .item { display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding:5px 0; }
                    .total { text-align:right; font-size:18px; margin-top:10px; font-weight:bold; }
                    button { width:100%; padding:8px; margin-top:10px; font-size:16px; }
                </style>
            </head>

            <body>
                <h2>Tienda NATY</h2>
                <p>Venta #${idVisual}</p>
                <p>Fecha: ${new Date(venta.fecha).toLocaleString()}</p>
                <hr>
            `;

            detalles.forEach(d => {
                html += `
                    <div class="item">
                        <span>${d.producto} (${d.cantidad} x $${d.precio_unitario.toFixed(2)})</span>
                        <span>$${d.subtotal.toFixed(2)}</span>
                    </div>
                `;
            });

            html += `
                <hr>
                <p class="total">TOTAL: $${venta.venta_total.toFixed(2)}</p>

                <button onclick="window.print()">🖨 Imprimir Ticket</button>

                <button onclick="descargarTicket()">⬇ Descargar Ticket</button>

                <script>
                    function descargarTicket() {
                        const blob = new Blob([document.documentElement.outerHTML], { type: "text/html" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "ticket_${idVisual}.html";
                        a.click();
                    }
                </script>

            </body>
            </html>
            `;

            win.document.open();
            win.document.write(html);
            win.document.close();

        }, 150);

    } catch (e) {
        console.error("❌ Error generando ticket:", e);
    }
}


/* ============================================================
   📌 ANULAR VENTA
   ============================================================ */
async function anularVenta(idVenta) {
    const idVisual = idVenta - 1;

    const confirmar = confirm(`¿Seguro que deseas ANULAR la venta #${idVisual}? Esto regresará el stock.`);
    if (!confirmar) return;

    try {
        await fetch(`${API_URL}/anular/${idVenta}`, { method: "PUT" });

        alert(`Venta #${idVisual} anulada correctamente`);

        cargarVentas();

    } catch (e) {
        console.error("❌ Error al anular venta:", e);
        alert("Error al anular la venta");
    }
}
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html"; // 🔥 Ahora sí manda al login
});