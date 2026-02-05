// Formatação de CPF
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

// Formatação de Celular
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

let cruzadoId = null;
let cruzadoOriginal = null;

document.addEventListener('DOMContentLoaded', () => {
  const buscarBtn = document.getElementById('buscarBtn');
  const cancelarBtn = document.getElementById('cancelarBtn');
  const cpfBuscaInput = document.getElementById('cpfBusca');
  const cpfInput = document.getElementById('cpf');
  const celularInput = document.getElementById('celular');
  const vinculoSelect = document.getElementById('vinculoProfissional');
  const situacaoSelect = document.getElementById('situacaoProfissional');
  const desejaContribuirSelect = document.getElementById('desejaContribuir');

  // Formatação de CPF na busca
  cpfBuscaInput.addEventListener('input', (e) => {
    e.target.value = formatarCPF(e.target.value);
  });

  // Formatação de CPF no formulário
  cpfInput.addEventListener('input', (e) => {
    e.target.value = formatarCPF(e.target.value);
  });


  // Formatação de Celular
  celularInput.addEventListener('input', (e) => {
    e.target.value = formatarCelular(e.target.value);
  });

  // Buscar cadastro
  buscarBtn.addEventListener('click', buscarCadastro);

  // Cancelar edição
  cancelarBtn.addEventListener('click', () => {
    document.getElementById('edicaoForm').style.display = 'none';
    document.getElementById('buscaForm').style.display = 'block';
    limparFormulario();
  });

  // Campos condicionais - Vínculo
  vinculoSelect.addEventListener('change', () => {
    const container = document.getElementById('especificarVinculoContainer');
    if (vinculoSelect.value === 'Outros') {
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
      document.getElementById('especificarVinculo').value = '';
    }
  });

  // Campos condicionais - Situação
  situacaoSelect.addEventListener('change', () => {
    const container = document.getElementById('especificarSituacaoContainer');
    if (situacaoSelect.value === 'Outros') {
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
      document.getElementById('especificarSituacao').value = '';
    }
  });

  // Campos condicionais - Contribuição
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

  // Envio do formulário
  document.getElementById('formAtualizacao').addEventListener('submit', atualizarCadastro);
});

async function buscarCadastro() {
  const cpf = document.getElementById('cpfBusca').value.replace(/\D/g, '');
  const dataNascimento = document.getElementById('dataNascimentoBusca').value;

  if (!cpf || cpf.length !== 11) {
    alert('❌ CPF inválido: insira um CPF com 11 dígitos.');
    return;
  }

  if (!dataNascimento) {
    alert('❌ Data de Nascimento obrigatória para verificação.');
    return;
  }

  try {
    const response = await fetch(`/api/cruzados/buscar?cpf=${cpf}`);
    
    if (!response.ok) {
      alert('❌ Cadastro não encontrado. Verifique o CPF informado.');
      return;
    }

    const cruzado = await response.json();

    // Verificar data de nascimento
    const dataNascimentoBD = new Date(cruzado.dataNascimento).toISOString().split('T')[0];
    if (dataNascimentoBD !== dataNascimento) {
      alert('❌ Data de Nascimento não corresponde. Verifique os dados.');
      return;
    }

    // Armazenar dados originais
    cruzadoId = cruzado._id;
    cruzadoOriginal = JSON.parse(JSON.stringify(cruzado));

    // Preencher formulário
    preencherFormulario(cruzado);

    // Mostrar formulário de edição
    document.getElementById('buscaForm').style.display = 'none';
    document.getElementById('edicaoForm').style.display = 'block';

    alert('✅ Cadastro encontrado! Você pode atualizar suas informações.');
  } catch (error) {
    alert('❌ Erro ao buscar cadastro: ' + error.message);
  }
}

function preencherFormulario(cruzado) {
  document.getElementById('nome').value = cruzado.nome || '';
  document.getElementById('cpf').value = formatarCPF(cruzado.cpf) || '';
  document.getElementById('celular').value = cruzado.celular ? formatarCelular(cruzado.celular) : '';
  document.getElementById('email').value = cruzado.email || '';
  document.getElementById('estado').value = cruzado.estado || '';
  document.getElementById('cidade').value = cruzado.cidade || '';
  document.getElementById('endereco').value = cruzado.endereco || '';
  document.getElementById('cep').value = cruzado.cep || '';
  document.getElementById('sexo').value = cruzado.sexo || '';
  document.getElementById('dataNascimento').value = cruzado.dataNascimento ? cruzado.dataNascimento.split('T')[0] : '';
  document.getElementById('encarnado').value = cruzado.encarnado ? 'true' : 'false';
  document.getElementById('vinculoProfissional').value = cruzado.vinculoProfissional || '';
  document.getElementById('especificarVinculo').value = cruzado.especificarVinculo || '';
  document.getElementById('situacaoProfissional').value = cruzado.situacaoProfissional || '';
  document.getElementById('especificarSituacao').value = cruzado.especificarSituacao || '';
  document.getElementById('formacao').value = cruzado.formacao || '';
  document.getElementById('nucleoOuGede').value = cruzado.nucleoOuGede || '';
  // Campos do responsável removidos conforme solicitado
  document.getElementById('desejaContribuir').value = cruzado.desejaContribuir ? 'true' : 'false';
  document.getElementById('valorContribuicao').value = cruzado.valorContribuicao || '';
  document.getElementById('consignacao').value = cruzado.consignacao ? 'true' : 'false';

  // Mostrar informações de arquivos existentes
  if (cruzado.foto) {
    document.getElementById('fotoInfo').textContent = '📷 Foto já existente (deixe em branco para não alterar)';
  }
  // certificadoIndicacao removido das atualizações

  // Ativar campos condicionais
  if (cruzado.vinculoProfissional === 'Outros') {
    document.getElementById('especificarVinculoContainer').style.display = 'block';
  }
  if (cruzado.situacaoProfissional === 'Outros') {
    document.getElementById('especificarSituacaoContainer').style.display = 'block';
  }
  if (cruzado.desejaContribuir) {
    document.getElementById('contribuicaoContainer').style.display = 'block';
  }
}

async function atualizarCadastro(e) {
  e.preventDefault();

  const formData = new FormData(e.target);

  // Validar CPF
  const cpf = formData.get('cpf').replace(/\D/g, '');
  if (cpf.length !== 11) {
    alert('❌ CPF inválido: deve conter 11 dígitos.');
    return;
  }

  // Validar Celular
  const celular = formData.get('celular').replace(/\D/g, '');
  if (celular.length < 10) {
    alert('❌ Celular inválido: deve ter pelo menos 10 dígitos.');
    return;
  }

  try {
    const response = await fetch(`/api/cruzados/atualizar/${cruzadoId}`, {
      method: 'PUT',
      body: formData
    });

    const result = await response.json();
    if (response.ok) {
      alert('✅ Cadastro atualizado com sucesso!');
      // Resetar formulário
      document.getElementById('edicaoForm').style.display = 'none';
      document.getElementById('buscaForm').style.display = 'block';
      document.getElementById('buscaForm').reset();
      limparFormulario();
    } else {
      alert('❌ Erro ao atualizar: ' + (result.message || 'Tente novamente.'));
    }
  } catch (error) {
    alert('❌ Erro ao enviar: ' + error.message);
  }
}

function limparFormulario() {
  document.getElementById('formAtualizacao').reset();
  document.getElementById('fotoInfo').textContent = '';
  document.getElementById('especificarVinculoContainer').style.display = 'none';
  document.getElementById('especificarSituacaoContainer').style.display = 'none';
  document.getElementById('contribuicaoContainer').style.display = 'none';
  cruzadoId = null;
  cruzadoOriginal = null;
}
