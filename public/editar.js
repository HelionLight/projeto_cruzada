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
let editToken = null;

document.addEventListener('DOMContentLoaded', () => {
  const buscarBtn = document.getElementById('buscarBtn');
  const cancelarBtn = document.getElementById('cancelarBtn');
  const cpfBuscaInput = document.getElementById('cpfBusca');
  const cpfInput = document.getElementById('cpf');
  const celularInput = document.getElementById('celular');
  const vinculoSelect = document.getElementById('vinculoProfissional');
  const situacaoSelect = document.getElementById('situacaoProfissional');
  const desejaContribuirSelect = document.getElementById('desejaContribuir');

  const codigoForm = document.getElementById('codigoForm');
  const solicitarCodigoBtn = document.getElementById('solicitarCodigoBtn');
  const verificarCodigoBtn = document.getElementById('verificarCodigoBtn');
  const statusCodigo = document.getElementById('statusCodigo');
  const codigoInput = document.getElementById('codigo');

  const habilitarEdicao = (habilitar) => {
    const form = document.getElementById('formAtualizacao');
    if (!form) return;
    const elements = form.querySelectorAll('input, select, textarea, button');
    elements.forEach((el) => {
      // mantém o submit e cancelar conforme o modo
      if (el.id === 'salvarBtn' || el.id === 'cancelarBtn') {
        el.disabled = !habilitar;
      } else {
        el.disabled = !habilitar;
      }
    });

    // não desabilitar upload/campo cpf readonly etc. (input cpf é readonly no HTML)
    const salvarBtn = document.getElementById('salvarBtn');
    if (salvarBtn) salvarBtn.disabled = !habilitar;
  };

  const setStatusCodigo = (msg) => {
    if (!statusCodigo) return;
    statusCodigo.textContent = msg || '';
  };

  const mostrarEtapaCodigo = () => {
    const codigoFormEl = document.getElementById('codigoForm');
    const edicaoFormEl = document.getElementById('edicaoForm');
    const buscaFormEl = document.getElementById('buscaForm');
    if (codigoFormEl) codigoFormEl.style.display = 'block';
    if (edicaoFormEl) edicaoFormEl.style.display = 'none';
    if (buscaFormEl) buscaFormEl.style.display = 'block';
  };

  const solicitarCodigo = async () => {
    try {
      if (!cruzadoId) {
        alert('❌ Busque o cadastro antes de solicitar o código.');
        return;
      }

      const cpfRaw = document.getElementById('cpfBusca')?.value;
      const cpfNormalizado = cpfRaw ? cpfRaw.replace(/\D/g, '') : '';
      if (!cpfNormalizado || cpfNormalizado.length !== 11) {
        alert('❌ CPF inválido para solicitar código.');
        return;
      }

      setStatusCodigo('📨 Enviando código...');
      editToken = null;

      const resp = await fetch('/api/auth/email-verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfNormalizado })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || 'Erro ao solicitar código.');
      }

      setStatusCodigo('✅ Código enviado. Verifique seu e-mail e digite abaixo.');
      habilitarEdicao(false);
    } catch (e) {
      setStatusCodigo('❌ ' + e.message);
      alert('❌ ' + e.message);
    }
  };

  const verificarCodigo = async () => {
    try {
      if (!cruzadoId) {
        alert('❌ Busque o cadastro antes de verificar o código.');
        return;
      }

      const cpfRaw = document.getElementById('cpfBusca')?.value;
      const cpfNormalizado = cpfRaw ? cpfRaw.replace(/\D/g, '') : '';
      const code = (codigoInput?.value || '').replace(/\D/g, '');
      if (!cpfNormalizado || cpfNormalizado.length !== 11) {
        alert('❌ CPF inválido.');
        return;
      }
      if (!code) {
        alert('❌ Digite o código recebido.');
        return;
      }

      setStatusCodigo('🔎 Verificando código...');

      const resp = await fetch('/api/auth/email-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfNormalizado, code })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || 'Código inválido.');
      }

      editToken = data.token;
      setStatusCodigo('✅ Código validado. Você já pode editar e salvar.');
      habilitarEdicao(true);
      const edicaoForm = document.getElementById('edicaoForm');
      if (edicaoForm) edicaoForm.style.display = 'block';
    } catch (e) {
      editToken = null;
      habilitarEdicao(false);
      setStatusCodigo('❌ ' + e.message);
      alert('❌ ' + e.message);
    }
  };

  // inicialmente, edição desabilitada até validar código
  habilitarEdicao(false);

  if (solicitarCodigoBtn) solicitarCodigoBtn.addEventListener('click', solicitarCodigo);
  if (verificarCodigoBtn) verificarCodigoBtn.addEventListener('click', verificarCodigo);


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
      const codigoForm = document.getElementById('codigoForm');
      if (edicao) edicao.style.display = 'none';
      if (busca) busca.style.display = 'block';
      if (codigoForm) codigoForm.style.display = 'none';
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
        const docContainer = document.getElementById('consignacaoDocumentoContainer');
        const docInput = document.getElementById('documentoConsignacao');
        if (val) val.value = '';
        if (cons) cons.value = 'false';
        if (docContainer) docContainer.style.display = 'none';
        if (docInput) docInput.value = '';
      }
    });
  }

  const consignacaoSelect = document.getElementById('consignacao');
  if (consignacaoSelect) {
    consignacaoSelect.addEventListener('change', () => {
      const container = document.getElementById('consignacaoDocumentoContainer');
      if (consignacaoSelect.value === 'true') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
        const docInput = document.getElementById('documentoConsignacao');
        if (docInput) docInput.value = '';
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

    // Mostrar etapa de validação por e-mail antes de liberar a edição
    mostrarEtapaCodigo();
    if (codigoInput) codigoInput.value = '';
    if (statusCodigo) statusCodigo.textContent = '📩 Envie o código para liberar a edição.';

    alert('✅ Cadastro encontrado! Envie o código recebido por e-mail para liberar a edição.');
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
  if (cruzado.consignacao) {
    document.getElementById('consignacaoDocumentoContainer').style.display = 'block';
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

  if (!editToken) {
    alert('❌ Você precisa validar o código por e-mail antes de salvar.');
    return;
  }

  try {
    const response = await fetch(`/api/cruzados/atualizar/${cruzadoId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${editToken}`
      },
      body: formData
    });


    const result = await response.json();
    if (response.ok) {
      alert('✅ Cadastro atualizado com sucesso!');
      // Resetar formulário
      document.getElementById('edicaoForm').style.display = 'none';
      document.getElementById('buscaForm').style.display = 'block';
      // Limpar inputs de busca
      const cpfBusca = document.getElementById('cpfBusca');
      const dataBusca = document.getElementById('dataNascimentoBusca');
      if (cpfBusca) cpfBusca.value = '';
      if (dataBusca) dataBusca.value = '';
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
  const codigoInput = document.getElementById('codigo');
  const statusCodigo = document.getElementById('statusCodigo');
  if (codigoInput) codigoInput.value = '';
  if (statusCodigo) statusCodigo.textContent = '';
  editToken = null;
  cruzadoId = null;
  cruzadoOriginal = null;
}
