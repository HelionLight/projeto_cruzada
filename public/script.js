document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validações básicas no frontend
  const nome = document.getElementById('nome').value;
  const email = document.getElementById('email').value;
  const cpf = document.getElementById('cpf').value;
  const celular = document.getElementById('celular').value;
  const cep = document.getElementById('cep').value;

  // Validar nome
  if (!nome || nome.trim().length < 3) {
    alert('❌ Nome inválido: insira um nome com pelo menos 3 caracteres.');
    return;
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('❌ Email inválido: insira um email válido (ex: usuario@dominio.com).');
    return;
  }

  // Validar CPF (11 dígitos)
  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) {
    alert('❌ CPF inválido: o CPF deve conter exatamente 11 dígitos.');
    return;
  }

  // Validar Celular (10 ou 11 dígitos)
  const celularLimpo = celular.replace(/\D/g, '');
  if (celularLimpo.length < 10) {
    alert('❌ Celular inválido: o celular deve ter pelo menos 10 dígitos.');
    return;
  }

  // Validar CEP
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) {
    alert('❌ CEP inválido: o CEP deve conter exatamente 8 dígitos.');
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
      alert('✅ Registro enviado com sucesso! Aguarde aprovação por email.');
      e.target.reset();
    } else {
      // Mensagens de erro mais específicas
      const mensagem = result.message;
      if (mensagem.includes('CPF')) {
        alert('❌ ' + mensagem + '\nCertifique-se de usar um CPF único.');
      } else if (mensagem.includes('email')) {
        alert('❌ ' + mensagem + '\nCertifique-se de usar um email único.');
      } else if (mensagem.includes('Campo inválido')) {
        alert('❌ ' + mensagem + '\nVerifique seus dados e tente novamente.');
      } else {
        alert('❌ Erro ao registrar: ' + mensagem);
      }
    }
  } catch (error) {
    alert('❌ Erro de conexão: ' + error.message + '\nVerifique sua conexão com a internet.');
  }
});
