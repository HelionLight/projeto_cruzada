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
let numeroCruzadoBusca = '';

// Normaliza nome para comparação (ignora acentos/caixa/duplos espaços)
function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function mostrarSemEmailForm(show) {
  const semEmailForm = document.getElementById('semEmailForm');
  if (semEmailForm) semEmailForm.style.display = show ? 'block' : 'none';
}

function mostrarCodigoForm(show) {
  const codigoFormEl = document.getElementById('codigoForm');
  if (codigoFormEl) codigoFormEl.style.display = show ? 'block' : 'none';
}

function mostrarEtapaCodigo() {
  const codigoFormEl = document.getElementById('codigoForm');
  const edicaoFormEl = document.getElementById('edicaoForm');
  const buscaFormEl = document.getElementById('buscaForm');
  if (codigoFormEl) codigoFormEl.style.display = 'block';
  if (edicaoFormEl) edicaoFormEl.style.display = 'none';
  if (buscaFormEl) buscaFormEl.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  const buscarBtn = document.getElementById('buscarBtn');
  const cancelarBtn = document.getElementById('cancelarBtn');
  const cpfBuscaInput = document.getElementById('cpfBusca');
  const cpfInput = document.getElementById('cpf');
  const celularInput = document.getElementById('celular');
  const vinculoSelect = document.getElementById('vinculoProfissional');
  const situacaoSelect = document.getElementById('situacaoProfissional');
  const desejaContribuirSelect = document.getElementById('desejaContribuir');

  // Alternância de abas (CPF / Número Cruzado)
  const tabCpf = document.getElementById('tabCpf');
  const tabNumero = document.getElementById('tabNumero');
  const cpfPanel = document.getElementById('buscaCpfPanel');
  const numeroPanel = document.getElementById('buscaNumeroPanel');

  const ativarAbaCpf = () => {
    if (tabCpf) tabCpf.classList.add('ativa');
    if (tabNumero) tabNumero.classList.remove('ativa');
    if (cpfPanel) cpfPanel.style.display = 'block';
    if (numeroPanel) numeroPanel.style.display = 'none';
  };

  const ativarAbaNumero = () => {
    if (tabNumero) tabNumero.classList.add('ativa');
    if (tabCpf) tabCpf.classList.remove('ativa');
    if (numeroPanel) numeroPanel.style.display = 'block';
    if (cpfPanel) cpfPanel.style.display = 'none';
  };

  if (tabCpf) tabCpf.addEventListener('click', ativarAbaCpf);
  if (tabNumero) tabNumero.addEventListener('click', ativarAbaNumero);

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
      const payload = {};
      if (cpfNormalizado && cpfNormalizado.length === 11) {
        payload.cpf = cpfNormalizado;
      } else if (numeroCruzadoBusca) {
        payload.numeroCruzado = numeroCruzadoBusca;
      }
      if (!payload.cpf && !payload.numeroCruzado) {
        alert('❌ Informe um CPF válido (11 dígitos) ou busque pelo Número Cruzado.');
        return;
      }

      setStatusCodigo('📨 Enviando código...');
      editToken = null;

      const resp = await fetch('/api/auth/email-verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      if (!resp.ok) {
        // Se o cadastro não tem e-mail, oferecer o fluxo alternativo (nome + número)
        if (data && data.code === 'NO_EMAIL') {
          mostrarSemEmailForm(true);
          mostrarCodigoForm(false);
          const numeroSemEmail = document.getElementById('numeroSemEmail');
          if (numeroSemEmail) numeroSemEmail.value = cruzadoOriginal?.numeroCruzado || numeroCruzadoBusca || '';
          const statusSemEmail = document.getElementById('statusSemEmail');
          if (statusSemEmail) statusSemEmail.textContent = data.message || 'Este cadastro não possui e-mail. Valide por nome e número.';
          return;
        }
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
      if (!code) {
        alert('❌ Digite o código recebido.');
        return;
      }

      const payload = {};
      if (cpfNormalizado && cpfNormalizado.length === 11) {
        payload.cpf = cpfNormalizado;
      } else if (numeroCruzadoBusca) {
        payload.numeroCruzado = numeroCruzadoBusca;
      }
      if (!payload.cpf && !payload.numeroCruzado) {
        alert('❌ Informe um CPF válido (11 dígitos) ou busque pelo Número Cruzado.');
        return;
      }

      setStatusCodigo('🔎 Verificando código...');

      const resp = await fetch('/api/auth/email-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, code })
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

  const validarSemEmail = async () => {
    try {
      if (!cruzadoId) {
        alert('❌ Busque o cadastro antes de validar.');
        return;
      }

      const nomeSemEmail = document.getElementById('nomeSemEmail')?.value || '';
      const numeroSemEmailRaw = document.getElementById('numeroSemEmail')?.value || '';
      const numeroSemEmail = numeroSemEmailRaw.replace(/\D/g, '');

      if (!normalizarNome(nomeSemEmail)) {
        alert('❌ Informe seu nome completo.');
        return;
      }
      if (!numeroSemEmail) {
        alert('❌ Informe o Número Cruzado.');
        return;
      }

      const statusSemEmail = document.getElementById('statusSemEmail');
      if (statusSemEmail) statusSemEmail.textContent = '🔎 Validando identidade...';

      const resp = await fetch('/api/auth/email-verification/request-sem-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeSemEmail, numeroCruzado: numeroSemEmail })
      });

      const data = await resp.json();
      if (!resp.ok) {
        if (statusSemEmail) statusSemEmail.textContent = '❌ ' + (data.message || 'Falha na validação.');
        alert('❌ ' + (data.message || 'Falha na validação.'));
        return;
      }

      editToken = data.token;
      if (statusSemEmail) statusSemEmail.textContent = '✅ Identidade validada. Você já pode editar e salvar.';
      habilitarEdicao(true);
      const edicaoForm = document.getElementById('edicaoForm');
      if (edicaoForm) edicaoForm.style.display = 'block';
    } catch (e) {
      const statusSemEmail = document.getElementById('statusSemEmail');
      if (statusSemEmail) statusSemEmail.textContent = '❌ ' + e.message;
      alert('❌ ' + e.message);
    }
  };

  // inicialmente, edição desabilitada até validar código
  habilitarEdicao(false);

  if (solicitarCodigoBtn) solicitarCodigoBtn.addEventListener('click', solicitarCodigo);
  if (verificarCodigoBtn) verificarCodigoBtn.addEventListener('click', verificarCodigo);

  const validarSemEmailBtn = document.getElementById('validarSemEmailBtn');
  if (validarSemEmailBtn) validarSemEmailBtn.addEventListener('click', validarSemEmail);


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
  // Lê o campo da aba ativa (CPF ou Número Cruzado)
  const tabNumeroAtiva = document.getElementById('tabNumero')?.classList.contains('ativa');
  const cpfValue = document.getElementById('cpfBusca').value.trim();
  const numeroValue = document.getElementById('numeroBusca').value.trim();

  const valorBusca = tabNumeroAtiva ? numeroValue : cpfValue;
  const apenasDigitos = valorBusca.replace(/\D/g, '');

  if (!valorBusca) {
    alert('❌ Informe o CPF ou o Número Cruzado.');
    return;
  }

  numeroCruzadoBusca = '';
  mostrarSemEmailForm(false);
  mostrarCodigoForm(false);

  if (tabNumeroAtiva) {
    // Aba Número Cruzado ativa: busca pelo número
    try {
      url = `/api/cruzados/buscar?numeroCruzado=${encodeURIComponent(apenasDigitos)}`;
      numeroCruzadoBusca = apenasDigitos;
      await executarBusca(url);
    } catch (error) {
      alert('❌ Erro ao buscar cadastro: ' + error.message);
    }
    return;
  }

  // Aba CPF ativa
  const isCpf = apenasDigitos.length === 11;
  if (!isCpf) {
    alert('❌ CPF inválido: insira um CPF com 11 dígitos.');
    return;
  }

  try {
    const url = `/api/cruzados/buscar?cpf=${encodeURIComponent(valorBusca)}`;
    await executarBusca(url);
  } catch (error) {
    alert('❌ Erro ao buscar cadastro: ' + error.message);
  }
}

async function executarBusca(url) {
  const response = await fetch(url);

  if (!response.ok) {
    alert('❌ Cadastro não encontrado. Verifique o CPF ou o Número Cruzado informado.');
    return;
  }

  const cruzado = await response.json();

  // Armazenar dados originais
  cruzadoId = cruzado._id;
  cruzadoOriginal = JSON.parse(JSON.stringify(cruzado));

  // Preencher formulário
  preencherFormulario(cruzado);

  // Se não tiver e-mail, mostrar fluxo alternativo (nome + número)
  if (!cruzado.email) {
    mostrarSemEmailForm(true);
    mostrarCodigoForm(false);
    const numeroSemEmail = document.getElementById('numeroSemEmail');
    if (numeroSemEmail) numeroSemEmail.value = cruzado.numeroCruzado || numeroCruzadoBusca || '';
    const statusSemEmail = document.getElementById('statusSemEmail');
    if (statusSemEmail) statusSemEmail.textContent = 'Cadastro localizado. Valide abaixo para liberar a edição.';
    return;
  }

  // Com e-mail: mostrar etapa de validação por e-mail antes de liberar a edição
  mostrarCodigoForm(true);
  const codigoInputEl = document.getElementById('codigo');
  if (codigoInputEl) codigoInputEl.value = '';
  const statusCodigoEl = document.getElementById('statusCodigo');
  if (statusCodigoEl) statusCodigoEl.textContent = '📩 Envie o código para liberar a edição.';

  alert('✅ Cadastro encontrado! Envie o código recebido por e-mail para liberar a edição.');
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

  // CPF: validar somente se o registro possui CPF (registros legados podem não ter)
  const cpfRaw = formData.get('cpf');
  const cpf = cpfRaw ? cpfRaw.replace(/\D/g, '') : '';
  const temCpfOriginal = Boolean(cruzadoOriginal?.cpf);
  if (temCpfOriginal && (!cpf || cpf.length !== 11)) {
    alert('❌ CPF inválido: deve conter 11 dígitos.');
    return;
  }
  if (cpf) {
    formData.set('cpf', cpf);
  }

  // Celular: validar somente se o registro possui celular
  const celularRaw = formData.get('celular');
  const celular = celularRaw ? celularRaw.replace(/\D/g, '') : '';
  const temCelularOriginal = Boolean(cruzadoOriginal?.celular);
  if (temCelularOriginal && (!celular || celular.length < 10)) {
    alert('❌ Celular inválido: deve ter pelo menos 10 dígitos.');
    return;
  }
  if (celular) {
    formData.set('celular', celular);
  }

  if (!editToken) {
    alert('❌ Você precisa validar o código ou identidade antes de salvar.');
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
  const cd = document.getElementById('consignacaoDocumentoContainer'); if (cd) cd.style.display = 'none';
  const codigoInput = document.getElementById('codigo');
  const statusCodigo = document.getElementById('statusCodigo');
  if (codigoInput) codigoInput.value = '';
  if (statusCodigo) statusCodigo.textContent = '';
  // Resetar fluxo sem e-mail
  mostrarSemEmailForm(false);
  const nomeSemEmail = document.getElementById('nomeSemEmail');
  const numeroSemEmail = document.getElementById('numeroSemEmail');
  const statusSemEmail = document.getElementById('statusSemEmail');
  if (nomeSemEmail) nomeSemEmail.value = '';
  if (numeroSemEmail) numeroSemEmail.value = '';
  if (statusSemEmail) statusSemEmail.textContent = '';
  editToken = null;
  cruzadoId = null;
  cruzadoOriginal = null;
  numeroCruzadoBusca = '';
}
