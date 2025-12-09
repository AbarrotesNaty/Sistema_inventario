console.log("📊 reportesEstadisticas.js cargado correctamente");

const API_URL = "http://localhost:3000/api/ventas";

// ==========================================================
//   ELEMENTOS DEL DOM
// ==========================================================

// Fechas (los dos <input date>)
const dateInputs = document.querySelectorAll(".date-input input[type='date']");
const dateDesde = dateInputs[0] || null;
const dateHasta = dateInputs[1] || null;

const btnAplicar = document.querySelector(".btn-apply");

// KPIs
const metricEls = document.querySelectorAll(".metric-value");
const metricVentasTotales     = metricEls[0] || null;
const metricProductosVendidos = metricEls[1] || null;
const metricMargenGanancia    = metricEls[2] || null;
const metricTicketPromedio    = metricEls[3] || null;

// Tabla Productos Más Vendidos
const tablaProductos = document.querySelector(".data-table tbody");

// Botones
const btnExport = document.querySelector(".btn-export");
const btnPrint  = document.querySelector(".btn-print");

// Gráficos
let chartCategorias = null;
let chartTendencia = null;


// ==========================================================
//   UTILIDADES
// ==========================================================
function formatoDinero(n) {
    return "$" + Number(n || 0).toFixed(2);
}

function restarFechas(venta, desde, hasta) {
    const f = new Date(venta.fecha);
    if (isNaN(f)) return false;

    if (desde && f < desde) return false;

    if (hasta) {
        const h = new Date(hasta);
        h.setHours(23, 59, 59, 999);
        if (f > h) return false;
    }

    return true;
}


// ==========================================================
//   OBTENER VENTAS
// ==========================================================
async function obtenerVentas() {
    try {
        const res = await fetch(`${API_URL}/lista`);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("❌ Error obteniendo ventas:", e);
        return [];
    }
}


// ==========================================================
//   KPI PRINCIPALES
// ==========================================================
async function actualizarKPIs(ventas) {
    if (!ventas.length) {
        metricVentasTotales.textContent     = "$0.00";
        metricProductosVendidos.textContent = "0";
        metricMargenGanancia.textContent    = "0%";
        metricTicketPromedio.textContent    = "$0.00";
        return;
    }

    let totalVenta = 0;
    let totalProductos = 0;
    let totalGanancia = 0;

    for (const v of ventas) {
        totalVenta     += parseFloat(v.venta_total || 0);
        totalProductos += parseInt(v.total_productos || 0);

        // Obtener detalles para margen real
        try {
            const det = await (await fetch(`${API_URL}/detalles/${v.id_venta}`)).json();

            det.forEach(d => {
                const pv = parseFloat(d.precio_unitario || 0);
                const pc = parseFloat(d.precio_compra || 0);
                const c  = parseFloat(d.cantidad || 0);
                totalGanancia += (pv - pc) * c;
            });
        } catch (e) {
            console.error("❌ Error detalles venta:", e);
        }
    }

    const margen = totalVenta > 0 ? (totalGanancia / totalVenta) * 100 : 0;
    const ticket = ventas.length > 0 ? totalVenta / ventas.length : 0;

    metricVentasTotales.textContent     = formatoDinero(totalVenta);
    metricProductosVendidos.textContent = totalProductos;
    metricMargenGanancia.textContent    = margen.toFixed(1) + "%";
    metricTicketPromedio.textContent    = formatoDinero(ticket);
}


// ==========================================================
//   PRODUCTOS MÁS VENDIDOS
// ==========================================================
async function cargarProductosMasVendidos(ventas) {
    tablaProductos.innerHTML = `<tr><td colspan="4">Cargando...</td></tr>`;

    const mapa = {};

    for (const v of ventas) {
        try {
            const detalles = await (await fetch(`${API_URL}/detalles/${v.id_venta}`)).json();

            detalles.forEach(d => {
                const nombre = d.producto || "Producto";
                const cant   = parseFloat(d.cantidad || 0);
                const ingreso = parseFloat(d.subtotal || 0);

                if (!mapa[nombre]) {
                    mapa[nombre] = { nombre, unidades: 0, ingresos: 0 };
                }

                mapa[nombre].unidades += cant;
                mapa[nombre].ingresos += ingreso;
            });
        } catch (e) {
            console.error("❌ Error detalles:", e);
        }
    }

    const lista = Object.values(mapa).sort((a, b) => b.unidades - a.unidades);

    if (!lista.length) {
        tablaProductos.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; opacity:.7">No hay productos vendidos.</td>
            </tr>
        `;
        return;
    }

    tablaProductos.innerHTML = "";
    lista.forEach(p => {
        tablaProductos.innerHTML += `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.unidades}</td>
                <td>${formatoDinero(p.ingresos)}</td>
                <td class="trend-cell">
                    <span class="trend-indicator positive"><i class="fas fa-arrow-up"></i></span>
                </td>
            </tr>
        `;
    });
}


// ==========================================================
//   GRÁFICO: VENTAS POR CATEGORÍA
// ==========================================================
async function cargarGraficoCategorias(ventas) {
    const canvas = document.getElementById("graficoCategorias");
    if (!canvas) return;

    const categorias = {};

    for (const v of ventas) {
        const detalles = await (await fetch(`${API_URL}/detalles/${v.id_venta}`)).json();

        detalles.forEach(d => {
            // Si no hay categoría en BD, usamos primera palabra del nombre
            const categoria = d.producto ? d.producto.split(" ")[0] : "Otros";
            const cantidad = parseFloat(d.cantidad || 0);

            if (!categorias[categoria]) categorias[categoria] = 0;
            categorias[categoria] += cantidad;
        });
    }

    const labels = Object.keys(categorias);
    const data   = Object.values(categorias);

    if (chartCategorias) chartCategorias.destroy();

    chartCategorias = new Chart(canvas, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: [
                    "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51",
                    "#264653", "#9b5de5", "#f15bb5"
                ]
            }]
        },
        options: {
            plugins: {
                legend: { position: "bottom" }
            }
        }
    });
}


// ==========================================================
//   GRÁFICO: TENDENCIA DE VENTAS
// ==========================================================
async function cargarGraficoTendencia(ventas) {
    const canvas = document.getElementById("graficoTendencia");
    if (!canvas) return;

    const dias = {};

    ventas.forEach(v => {
        const fecha = new Date(v.fecha).toLocaleDateString();
        const total = parseFloat(v.venta_total || 0);
        if (!dias[fecha]) dias[fecha] = 0;
        dias[fecha] += total;
    });

    const labels = Object.keys(dias);
    const data   = Object.values(dias);

    if (chartTendencia) chartTendencia.destroy();

    chartTendencia = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Ventas por día",
                data,
                borderColor: "#2A9D8F",
                backgroundColor: "rgba(42,157,143,0.25)",
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
}


// ==========================================================
//   FUNCIÓN PRINCIPAL
// ==========================================================
async function aplicarFiltros() {
    console.log("📆 Aplicando filtros...");

    let ventas = await obtenerVentas();
    if (!ventas.length) return;

    // Fechas
    const desde = dateDesde?.value ? new Date(dateDesde.value) : null;
    const hasta = dateHasta?.value ? new Date(dateHasta.value) : null;

    if (desde || hasta) {
        ventas = ventas.filter(v => restarFechas(v, desde, hasta));
    }

    await actualizarKPIs(ventas);
    await cargarProductosMasVendidos(ventas);
    await cargarGraficoCategorias(ventas);
    await cargarGraficoTendencia(ventas);
}


// ==========================================================
//   EXPORTAR CSV
// ==========================================================
async function exportarCSV() {
    const ventas = await obtenerVentas();
    if (!ventas.length) return alert("No hay ventas para exportar");

    let csv = "ID,Fecha,Total,Productos\n";

    ventas.forEach(v => {
        csv += `${v.id_venta},${v.fecha},${v.venta_total},${v.total_productos}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte_ventas.csv";
    a.click();

    URL.revokeObjectURL(url);
}


// ==========================================================
//   IMPRESIÓN
// ==========================================================
function imprimirPagina() {
    window.print();
}


// ==========================================================
//   EVENTOS E INICIO
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
    aplicarFiltros();

    if (btnAplicar)
        btnAplicar.addEventListener("click", aplicarFiltros);

    if (btnExport)
        btnExport.addEventListener("click", exportarCSV);

    if (btnPrint)
        btnPrint.addEventListener("click", imprimirPagina);
});
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "index.html"; // 🔥 Ahora sí manda al login
});
