document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validações básicas no frontend
  const email = document.getElementById('email').value;
  const cpf = document.getElementById('cpf').value;
  const celular = document.getElementById('celular').value;

  if (!email.includes('@')) {
    alert('Por favor, insira um e-mail válido.');
    return;
  }

  if (cpf.length < 11) {
    alert('CPF deve ter pelo menos 11 dígitos.');
    return;
  }

  if (celular.length < 10) {
    alert('Celular deve ter pelo menos 10 dígitos.');
    return;
  }

  const formData = new FormData(e.target);

  try {
    const response = await fetch('/api/cruzados/register', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (response.ok) {
      alert('Registro enviado com sucesso! Aguarde aprovação.');
      e.target.reset();
    } else {
      alert('Erro: ' + result.message);
    }
  } catch (error) {
    alert('Erro ao enviar: ' + error.message);
  }
});
