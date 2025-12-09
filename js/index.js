// js/login.js

const form =
  document.getElementById('loginForm') ||
  document.querySelector('form[data-form="login"]') ||
  document.querySelector('form');

function getCorreoInput() {
  return (
    document.getElementById('correo') ||
    document.getElementById('email') ||
    document.querySelector('input[type="email"]') ||
    document.querySelector('input[name="correo"]') ||
    document.querySelector('input[name="email"]')
  );
}

function getPasswordInput() {
  return (
    document.getElementById('password') ||
    document.getElementById('contrasena') ||
    document.querySelector('input[type="password"]') ||
    document.querySelector('input[name="password"]') ||
    document.querySelector('input[name="contrasena"]')
  );
}

const errorMsg =
  document.getElementById('errorMsg') ||
  document.querySelector('.error-msg') ||
  null;

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const correoInput = getCorreoInput();
    const passInput = getPasswordInput();

    if (!correoInput || !passInput) {
      if (errorMsg) {
        errorMsg.textContent = 'Faltan campos en el formulario';
        errorMsg.style.display = 'block';
      } else {
        alert('Faltan campos en el formulario');
      }
      return;
    }

    const correo = correoInput.value.trim();
    const password = passInput.value.trim();

    try {
      const resp = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password })
      });

      const data = await resp.json();

      if (resp.ok) {
        // guardar sesión
        localStorage.setItem('token', data.token);
        localStorage.setItem('usuario', JSON.stringify(data.usuario));

        // 🔥 ID DEL USUARIO (EL BUENO)
        localStorage.setItem('id_usuario', data.usuario.id_usuario);

        const rol = data.usuario.tipo_usuario;

        if (rol === 'Administrador') {
          window.location.href = 'gestionProductos.html';
        } else {
          alert('Inicio de sesión correcto, pero tu rol no es Administrador.');
        }
      } else {
        const msg = data.error || 'No se pudo iniciar sesión';
        if (errorMsg) {
          errorMsg.textContent = msg;
          errorMsg.style.display = 'block';
        } else {
          alert(msg);
        }
      }
    } catch (err) {
      console.error(err);
      if (errorMsg) {
        errorMsg.textContent = 'No se pudo conectar con el servidor';
        errorMsg.style.display = 'block';
      } else {
        alert('No se pudo conectar con el servidor');
      }
    }
  });
}
