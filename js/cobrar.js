// ===============================
// Módulo COBRAR – Tienda NATY  (SIN IVA y con id_usuario)
// ===============================

// Obtener elementos de la UI
const inputCodigo = document.getElementById("barcode");
const saleItems = document.getElementById("sale-items");

const subtotalLabel = document.getElementById("subtotal");
const totalLabel = document.getElementById("total");

const inputEfectivo = document.getElementById("cash-received");
const cambioLabel = document.getElementById("cambio");

const btnCobrar = document.querySelector(".complete-sale");

// Lista interna de productos
let lista = [];

// 🔥 ID DEL USUARIO LOGUEADO
let idUsuario = localStorage.getItem("id_usuario");

// ====================================
// Escaneo con ENTER
// ====================================
inputCodigo.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
        const codigo = inputCodigo.value.trim();
        if (codigo === "") return;

        try {
            const res = await fetch(`http://localhost:3000/api/ventas/producto/${codigo}`);

            if (!res.ok) {
                alert("Producto no encontrado o sin stock.");
                inputCodigo.value = "";
                return;
            }

            const data = await res.json();

            agregarProductoLista({
                codigo_producto: data.producto.codigo_producto,
                nombre: data.producto.nombre,
                precio: parseFloat(data.producto.precio_venta)
            });

            inputCodigo.value = "";
        } catch (err) {
            console.error("Error consultando producto:", err);
            alert("Error al conectar con el servidor.");
        }
    }
});

// ====================================
// Agregar producto
// ====================================
function agregarProductoLista(item) {
    const existe = lista.find(p => p.codigo_producto === item.codigo_producto);

    if (existe) {
        existe.cantidad++;
        existe.subtotal = existe.cantidad * existe.precio;
    } else {
        lista.push({
            ...item,
            cantidad: 1,
            precio: parseFloat(item.precio),
            subtotal: parseFloat(item.precio)
        });
    }

    renderLista();
}

// ====================================
// Renderizar lista en la tabla
// ====================================
function renderLista() {
    saleItems.innerHTML = "";

    lista.forEach(p => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${p.nombre}</td>
            <td>
                <div class="quantity-control">
                    <button class="qty-btn" onclick="cambiarCantidad(${p.codigo_producto}, -1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span>${p.cantidad}</span>
                    <button class="qty-btn" onclick="cambiarCantidad(${p.codigo_producto}, 1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </td>
            <td>$${p.precio.toFixed(2)}</td>
            <td>$${p.subtotal.toFixed(2)}</td>
            <td>
                <button class="remove-item" onclick="quitar(${p.codigo_producto})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        saleItems.appendChild(tr);
    });

    actualizarTotales();
}

window.cambiarCantidad = (codigo, delta) => {
    const prod = lista.find(p => p.codigo_producto === codigo);
    if (!prod) return;

    prod.cantidad += delta;

    if (prod.cantidad <= 0) {
        lista = lista.filter(p => p.codigo_producto !== codigo);
    } else {
        prod.subtotal = prod.cantidad * prod.precio;
    }

    renderLista();
};

window.quitar = (codigo) => {
    lista = lista.filter(p => p.codigo_producto !== codigo);
    renderLista();
};

// ====================================
// Calcular totales SIN IVA
// ====================================
function actualizarTotales() {
    const subtotal = lista.reduce((sum, p) => sum + p.subtotal, 0);

    subtotalLabel.textContent = "$" + subtotal.toFixed(2);
    totalLabel.textContent = "$" + subtotal.toFixed(2); // total = subtotal

    actualizarCambio();
}

// ====================================
// Calcular cambio
// ====================================
function actualizarCambio() {
    const efectivo = parseFloat(inputEfectivo.value) || 0;
    const subtotal = lista.reduce((sum, p) => sum + p.subtotal, 0);
    const cambio = efectivo - subtotal;

    cambioLabel.textContent = "$" + (cambio >= 0 ? cambio.toFixed(2) : "0.00");
}

inputEfectivo.addEventListener("input", actualizarCambio);

// ====================================
// Registrar venta Y generar ticket
// ====================================
btnCobrar.addEventListener("click", async () => {
    if (lista.length === 0) return alert("No hay productos en la venta.");

    const subtotal = lista.reduce((sum, p) => sum + p.subtotal, 0);
    const efectivo = parseFloat(inputEfectivo.value);

    if (efectivo < subtotal) return alert("Efectivo insuficiente.");

    const body = {
        id_usuario: idUsuario,
        items: lista.map(p => ({
            codigo_producto: p.codigo_producto,
            cantidad: p.cantidad
        }))
    };

    try {
        const res = await fetch("http://localhost:3000/api/ventas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            alert("Error al registrar la venta.");
            return;
        }

        const data = await res.json();

        // ✔ Construir ticket
        localStorage.setItem("ticket_venta", JSON.stringify({
            id_venta: data.id_venta,
            fecha: new Date().toLocaleString(),
            usuario: JSON.parse(localStorage.getItem("usuario")).nombre_usuario,
            items: lista,
            total: subtotal,
            efectivo: efectivo,
            cambio: efectivo - subtotal
        }));

        // ✔ Abrir ticket
        window.open("ticket.html", "_blank");

        // ✔ Reset carrito
        lista = [];
        renderLista();
        inputEfectivo.value = "";
        cambioLabel.textContent = "$0.00";

    } catch (err) {
        console.error("Error registrando venta:", err);
        alert("Error al conectar con el servidor.");
    }
});
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "index.html"; // 🔥 Ahora sí manda al login
});
