const adminToken = sessionStorage.getItem('adminAuthToken');
let cadastro = null;

const cpfInput = document.getElementById('cpfBuscaAdmin');
const cadastroEncontrado = document.getElementById('cadastroEncontrado');
const codigoAdminForm = document.getElementById('codigoAdminForm');
const statusAdmin = document.getElementById('statusAdmin');

function formatarCPF(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function setStatus(message) {
  if (statusAdmin) statusAdmin.textContent = message || '';
}

async function buscarCadastroAdmin() {
  if (!adminToken) {
    setStatus('Sessão administrativa expirada. Volte ao painel e faça login novamente.');
    return;
  }

  const cpf = String(cpfInput?.value || '').replace(/\D/g, '');
  if (cpf.length !== 11) {
    setStatus('Informe um CPF com 11 dígitos.');
    return;
  }

  setStatus('Pesquisando cadastro...');
  cadastroEncontrado.style.display = 'none';
  codigoAdminForm.style.display = 'none';

  try {
    const response = await fetch(`/api/cruzados/buscar?cpf=${encodeURIComponent(cpf)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Cadastro não encontrado.');

    cadastro = result;
    document.getElementById('nomeEncontrado').textContent = result.nome || 'Sem dados';
    document.getElementById('numeroEncontrado').textContent = result.numeroCruzado || 'Sem dados';
    cadastroEncontrado.style.display = 'block';
    setStatus('Cadastro encontrado. Solicite o código ao secretário.');
  } catch (error) {
    setStatus(`❌ ${error.message}`);
  }
}

async function solicitarCodigoAdmin() {
  if (!cadastro) return;
  setStatus('Enviando código ao secretário...');

  try {
    const response = await fetch('/api/auth/email-verification/admin-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ cpf: cpfInput.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Não foi possível enviar o código.');

    codigoAdminForm.style.display = 'block';
    setStatus('Código enviado ao e-mail do secretário.');
  } catch (error) {
    setStatus(`❌ ${error.message}`);
  }
}

async function validarCodigoAdmin() {
  if (!cadastro) return;
  const code = String(document.getElementById('codigoAdmin').value || '').replace(/\D/g, '');
  if (!code) {
    setStatus('Informe o código recebido pelo secretário.');
    return;
  }

  setStatus('Validando código...');
  try {
    const response = await fetch('/api/auth/email-verification/admin-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ cpf: cpfInput.value, code })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Código inválido.');

    sessionStorage.setItem('adminEditToken', result.token);
    sessionStorage.setItem('adminEditCruzadoId', result.cruzadoId);
    window.location.href = '/atualizar.html?admin=1';
  } catch (error) {
    setStatus(`❌ ${error.message}`);
  }
}

cpfInput.addEventListener('input', () => {
  cpfInput.value = formatarCPF(cpfInput.value);
});
document.getElementById('buscarAdminBtn').addEventListener('click', buscarCadastroAdmin);
document.getElementById('solicitarCodigoAdminBtn').addEventListener('click', solicitarCodigoAdmin);
document.getElementById('validarCodigoAdminBtn').addEventListener('click', validarCodigoAdmin);
