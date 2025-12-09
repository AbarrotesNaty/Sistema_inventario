const form = document.getElementById('recuperarForm');
const msg = document.getElementById('msg');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const correo = document.getElementById('correo').value.trim();

    try {
        const resp = await fetch('http://localhost:3000/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo })
        });

        const data = await resp.json();

        if (resp.ok) {
            msg.style.color = 'green';
            msg.textContent = 'Se ha enviado un enlace a tu correo.';
        } else {
            msg.style.color = 'red';
            msg.textContent = data.error || 'Error al enviar el enlace.';
        }

    } catch (error) {
        msg.style.color = 'red';
        msg.textContent = 'No se pudo conectar al servidor.';
    }
});
