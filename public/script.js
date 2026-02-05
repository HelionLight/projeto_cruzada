// Função para formatar CPF: XXX.XXX.XXX-XX
function formatarCPF(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length <= 3) {
    return cpfLimpo;
  } else if (cpfLimpo.length <= 6) {
    return cpfLimpo.slice(0, 3) + '.' + cpfLimpo.slice(3);
  } else if (cpfLimpo.length <= 9) {
    return cpfLimpo.slice(0, 3) + '.' + cpfLimpo.slice(3, 6) + '.' + cpfLimpo.slice(6);
  } else {
    return cpfLimpo.slice(0, 3) + '.' + cpfLimpo.slice(3, 6) + '.' + cpfLimpo.slice(6, 9) + '-' + cpfLimpo.slice(9, 11);
  }
}

// Função para formatar Celular: (XX) XXXXX-XXXX
function formatarCelular(celular) {
  const celularLimpo = celular.replace(/\D/g, '');
  if (celularLimpo.length <= 2) {
    return '(' + celularLimpo;
  } else if (celularLimpo.length <= 7) {
    return '(' + celularLimpo.slice(0, 2) + ') ' + celularLimpo.slice(2);
  } else {
    return '(' + celularLimpo.slice(0, 2) + ') ' + celularLimpo.slice(2, 7) + '-' + celularLimpo.slice(7, 11);
  }
}

// Event listener para CPF
document.addEventListener('DOMContentLoaded', () => {
  const cpfInput = document.getElementById('cpf');
  const celularInput = document.getElementById('celular');
  const cpfResponsavelInput = document.getElementById('cpfResponsavelIndicacao');
  const vinculoSelect = document.getElementById('vinculoProfissional');
  const situacaoSelect = document.getElementById('situacaoProfissional');
  const desejaContribuirSelect = document.getElementById('desejaContribuir');

  if (cpfInput) {
    cpfInput.addEventListener('input', (e) => {
      e.target.value = formatarCPF(e.target.value);
    });
  }

  if (cpfResponsavelInput) {
    cpfResponsavelInput.addEventListener('input', (e) => {
      e.target.value = formatarCPF(e.target.value);
    });
  }

  if (celularInput) {
    celularInput.addEventListener('input', (e) => {
      e.target.value = formatarCelular(e.target.value);
    });
  }

  // Event listeners para campos condicionais
  if (vinculoSelect) {
    vinculoSelect.addEventListener('change', () => {
      const container = document.getElementById('especificarVinculoContainer');
      if (vinculoSelect.value === 'Outros') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
        document.getElementById('especificarVinculo').value = '';
      }
    });
  }

  if (situacaoSelect) {
    situacaoSelect.addEventListener('change', () => {
      const container = document.getElementById('especificarSituacaoContainer');
      if (situacaoSelect.value === 'Outros') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
        document.getElementById('especificarSituacao').value = '';
      }
    });
  }

  if (desejaContribuirSelect) {
    desejaContribuirSelect.addEventListener('change', () => {
      const container = document.getElementById('contribuicaoContainer');
      if (desejaContribuirSelect.value === 'true') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
        document.getElementById('valorContribuicao').value = '';
        document.getElementById('consignacao').value = 'false';
      }
    });
  }
});

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
