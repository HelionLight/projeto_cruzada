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
  if (cpfBuscaInput) {
    cpfBuscaInput.addEventListener('input', (e) => {
      e.target.value = formatarCPF(e.target.value);
    });
  }

  // Formatação de CPF no formulário
  if (cpfInput) {
    cpfInput.addEventListener('input', (e) => {
      e.target.value = formatarCPF(e.target.value);
    });
  }

  // Formatação de Celular
  if (celularInput) {
    celularInput.addEventListener('input', (e) => {
      e.target.value = formatarCelular(e.target.value);
    });
  }

  // Buscar cadastro
  if (buscarBtn) buscarBtn.addEventListener('click', buscarCadastro);

  // Cancelar edição
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      const edicao = document.getElementById('edicaoForm');
      const busca = document.getElementById('buscaForm');
      if (edicao) edicao.style.display = 'none';
      if (busca) busca.style.display = 'block';
      limparFormulario();
    });
  }

  // Campos condicionais - Vínculo
  if (vinculoSelect) {
    vinculoSelect.addEventListener('change', () => {
      const container = document.getElementById('especificarVinculoContainer');
      if (vinculoSelect.value === 'Outros') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
        const esp = document.getElementById('especificarVinculo');
        if (esp) esp.value = '';
      }
    });
  }

  // Campos condicionais - Situação
  if (situacaoSelect) {
    situacaoSelect.addEventListener('change', () => {
      const container = document.getElementById('especificarSituacaoContainer');
      if (situacaoSelect.value === 'Outros') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
        const espSit = document.getElementById('especificarSituacao');
        if (espSit) espSit.value = '';
      }
    });
  }

  // Campos condicionais - Contribuição
  if (desejaContribuirSelect) {
    desejaContribuirSelect.addEventListener('change', () => {
      const container = document.getElementById('contribuicaoContainer');
      if (desejaContribuirSelect.value === 'true') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
        const val = document.getElementById('valorContribuicao');
        const cons = document.getElementById('consignacao');
        if (val) val.value = '';
        if (cons) cons.value = 'false';
      }
    });
  }

  // Envio do formulário (registrar de forma defensiva)
  const formAtualizacao = document.getElementById('formAtualizacao');
  if (formAtualizacao) {
    formAtualizacao.addEventListener('submit', atualizarCadastro);
  } else {
    console.warn('formAtualizacao não encontrado — submit não será registrado.');
  }
});

async function buscarCadastro() {
  const cpfRaw = document.getElementById('cpfBusca').value;
  const dataNascimento = document.getElementById('dataNascimentoBusca').value;

  // Validar presença de 11 dígitos, mas enviar o CPF exatamente como o usuário digitou
  const cpf = cpfRaw.replace(/\D/g, '');
  if (!cpf || cpf.length !== 11) {
    alert('❌ CPF inválido: insira um CPF com 11 dígitos.');
    return;
  }

  if (!dataNascimento) {
    alert('❌ Data de Nascimento obrigatória para verificação.');
    return;
  }

  try {
    const response = await fetch(`/api/cruzados/buscar?cpf=${encodeURIComponent(cpfRaw)}`);
    
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
  // Campos do responsável preenchidos como hidden (não aparecem na interface)
  document.getElementById('nomeResponsavelIndicacao').value = cruzado.nomeResponsavelIndicacao || '';
  document.getElementById('cpfResponsavelIndicacao').value = cruzado.cpfResponsavelIndicacao || '';
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

  console.log('atualizarCadastro chamado', { cruzadoId });
  if (!cruzadoId) {
    alert('❌ Erro: ID do cadastro não definido. Busque o cadastro antes de salvar.');
    return;
  }

  const formData = new FormData(e.target);

  // Validar CPF (remover formatação, se houver, e contar dígitos)
  const cpfRaw = formData.get('cpf');
  const cpf = cpfRaw ? cpfRaw.replace(/\D/g, '') : '';
  if (!cpf || cpf.length !== 11) {
    alert('❌ CPF inválido: deve conter 11 dígitos.');
    return;
  }

  // Validar Celular (remover formatação, se houver, e contar dígitos)
  const celularRaw = formData.get('celular');
  const celular = celularRaw ? celularRaw.replace(/\D/g, '') : '';
  if (!celular || celular.length < 10) {
    alert('❌ Celular inválido: deve ter pelo menos 10 dígitos.');
    return;
  }

  // Remover formatação antes de enviar (enviar CPF e celular sem caracteres especiais)
  formData.set('cpf', cpf);
  formData.set('celular', celular);

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
  const form = document.getElementById('formAtualizacao');
  if (form) form.reset();
  const fotoInfo = document.getElementById('fotoInfo'); if (fotoInfo) fotoInfo.textContent = '';
  const ev = document.getElementById('especificarVinculoContainer'); if (ev) ev.style.display = 'none';
  const es = document.getElementById('especificarSituacaoContainer'); if (es) es.style.display = 'none';
  const cc = document.getElementById('contribuicaoContainer'); if (cc) cc.style.display = 'none';
  cruzadoId = null;
  cruzadoOriginal = null;
}
