const form = document.getElementById('resetForm');
const msg = document.getElementById('msg');

// Obtener token de la URL
const params = new URLSearchParams(window.location.search);
const token = params.get('token');


form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = document.getElementById('password').value.trim();
    const confirm = document.getElementById('confirm').value.trim();

    if (password !== confirm) {
        msg.style.color = 'red';
        msg.textContent = 'Las contraseñas no coinciden';
        return;
    }

    try {
        const resp = await fetch(`https://backend-naty.onrender.com/api/auth/reset-password/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevaPassword: password })
        });

        const data = await resp.json();

        if (resp.ok) {
            msg.style.color = 'green';
            msg.textContent = 'Tu contraseña ha sido actualizada. Ahora puedes iniciar sesión.';

            // Redirigir al login después de 2 segundos
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } else {
            msg.style.color = 'red';
            msg.textContent = data.error || 'No se pudo restablecer la contraseña.';
        }

    } catch (error) {
        msg.style.color = 'red';
        msg.textContent = 'Error de conexión con el servidor.';
    }
});
