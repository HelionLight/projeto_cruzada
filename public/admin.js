// Painel Admin
let token = '';
let pendingRefreshTimer = null;

function refreshPendingLists() {
  loadPending();
  loadPendingVoluntarios();
  loadPendingConsignacao();
}

function startPendingAutoRefresh() {
  if (pendingRefreshTimer) {
    clearInterval(pendingRefreshTimer);
  }

  pendingRefreshTimer = setInterval(() => {
    refreshPendingLists();
  }, 10000);
}

// Event listener para botão de exportação
document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportarExcel);
  }

  const importBtn = document.getElementById('importBtn');
  if (importBtn) {
    importBtn.addEventListener('click', importarPlanilhaExcel);
  }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('❌ Campos vazios: insira usuário e senha.');
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (response.ok) {
      token = result.token;
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
      refreshPendingLists();
      startPendingAutoRefresh();
    } else {
      alert('❌ Erro no login: ' + (result.message || 'Usuário ou senha incorretos.'));
    }
  } catch (error) {
    alert('❌ Erro de conexão: ' + error.message);
  }
});

async function loadPending() {
  try {
    const response = await fetch('/api/cruzados/pending', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Não foi possível carregar os registros pendentes.');
    }

    const pendentes = await response.json();
    const tbody = document.getElementById('pendingTableBody');
    tbody.innerHTML = '';

    if (pendentes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">✅ Nenhum registro pendente.</td></tr>';
      return;
    }

    pendentes.forEach(cruzado => {
      const row = document.createElement('tr');
      
      // Construir URL da foto
      const fotoUrl = cruzado.foto ? `/api/cruzados/image/${cruzado.foto}` : null;
      const certificadoUrl = cruzado.certificadoIndicacao ? `/api/cruzados/image/${cruzado.certificadoIndicacao}` : null;
      
      row.innerHTML = `
        <td>${cruzado.nome}</td>
        <td>${cruzado.email}</td>
        <td>${cruzado.cpf}</td>
        <td>
          ${fotoUrl ? `<a href="${fotoUrl}" target="_blank"><button class="btnView">Ver Foto</button></a>` : 'Sem foto'}
        </td>
        <td>
          ${certificadoUrl ? `<a href="${certificadoUrl}" target="_blank"><button class="btnView">Ver PDF</button></a>` : 'Sem PDF'}
        </td>
        <td>
          <button class="btnApprove" onclick="approve('${cruzado._id}')">Aprovar</button>
          <button class="btnReject" onclick="reject('${cruzado._id}')">Rejeitar</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    alert('❌ Erro ao carregar pendentes: ' + error.message);
  }
}

async function approve(id) {
  await updateStatus(id, 'aprovado');
}

async function reject(id) {
  await updateStatus(id, 'rejeitado');
}

async function updateStatus(id, status) {
  try {
    const response = await fetch(`/api/cruzados/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      const statusText = status === 'aprovado' ? 'aprovado' : 'rejeitado';
      alert(`✅ Registro ${statusText} com sucesso!`);
      refreshPendingLists();
    } else {
      const error = await response.json();
      alert('❌ Erro ao atualizar: ' + (error.message || 'Tente novamente.'));
    }
  } catch (error) {
    alert('❌ Erro de conexão: ' + error.message);
  }
}

// Função para exportar para Excel
async function exportarExcel() {
  try {
    const response = await fetch('/api/cruzados/export/excel', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.json();
      alert('❌ Erro ao exportar: ' + (error.message || 'Tente novamente.'));
      return;
    }

    // Obter o blob e fazer download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cruzados_Aprovados_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    alert('✅ Excel exportado com sucesso!');
  } catch (error) {
    alert('❌ Erro ao exportar: ' + error.message);
  }
}

async function importarPlanilhaExcel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';

  input.onchange = async () => {
    const arquivo = input.files && input.files[0];
    if (!arquivo) return;

    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('target', 'permanent');

    try {
      const response = await fetch('/api/cruzados/import/excel', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const result = await response.json();
      if (!response.ok) {
        alert('❌ Erro ao importar: ' + (result.message || 'Tente novamente.'));
        return;
      }

      const summary = result.summary || {};
      alert(`✅ ${result.message}\nImportadas: ${summary.imported || 0}\nAtualizadas: ${summary.updated || 0}\nVálidas: ${summary.valid || 0}\nIgnoradas: ${summary.skipped || 0}\nErros: ${summary.errors || 0}`);
      refreshPendingLists();
    } catch (error) {
      alert('❌ Erro de conexão: ' + error.message);
    }
  };

  input.click();
}

// Carregar voluntários pendentes
async function loadPendingVoluntarios() {
  try {
    const response = await fetch('/api/cruzados/pending/voluntarios', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Não foi possível carregar os registros de voluntários.');
    }

    const voluntarios = await response.json();
    const tbody = document.getElementById('pendingVoluntariosTableBody');
    tbody.innerHTML = '';

    if (voluntarios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">✅ Nenhum registro de voluntário pendente.</td></tr>';
      return;
    }

    voluntarios.forEach(voluntario => {
      const row = document.createElement('tr');
      
      // Construir URL da foto
      const fotoUrl = voluntario.foto ? `/api/cruzados/image/${voluntario.foto}` : null;
      // URL do documento de voluntário (termo assinado)
      const documentoUrl = voluntario.documentoVoluntario ? `/api/cruzados/image/${voluntario.documentoVoluntario}` : null;
      
      row.innerHTML = `
        <td>${voluntario.nome}</td>
        <td>${voluntario.email}</td>
        <td>${voluntario.numeroCruzado || '-'}</td>
        <td>
          ${fotoUrl ? `<a href="${fotoUrl}" target="_blank"><button class="btnView">Ver Foto</button></a>` : 'Sem foto'}
        </td>
        <td>
          ${documentoUrl ? `<a href="${documentoUrl}" target="_blank"><button class="btnView">Ver Termo</button></a>` : 'Sem termo'}
        </td>
        <td>
          <button class="btnApprove" onclick="approveVoluntario('${voluntario._id}')">Aprovar</button>
          <button class="btnReject" onclick="rejectVoluntario('${voluntario._id}')">Rejeitar</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    alert('❌ Erro ao carregar voluntários: ' + error.message);
  }
}

async function approveVoluntario(id) {
  await updateStatusVoluntario(id, 'aprovado');
}

async function rejectVoluntario(id) {
  await updateStatusVoluntario(id, 'rejeitado');
}

async function loadPendingConsignacao() {
  try {
    const response = await fetch('/api/cruzados/consignacao', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Não foi possível carregar os documentos de consignação.');
    }

    const registros = await response.json();
    const tbody = document.getElementById('pendingConsignacaoTableBody');
    tbody.innerHTML = '';

    if (registros.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">✅ Nenhum documento de consignação pendente.</td></tr>';
      return;
    }

    registros.forEach(registro => {
      const row = document.createElement('tr');
      const documentoUrl = registro.documentoConsignacao ? `/api/cruzados/image/${registro.documentoConsignacao}` : null;

      row.innerHTML = `
        <td>${registro.nome}</td>
        <td>${registro.email}</td>
        <td>${registro.numeroCruzado || '-'}</td>
        <td>
          ${documentoUrl ? `<a href="${documentoUrl}" target="_blank"><button class="btnView">Baixar PDF</button></a>` : 'Sem PDF'}
        </td>
        <td>
          <button class="btnApprove" onclick="approveConsignacao('${registro._id}')">Aprovar</button>
          <button class="btnReject" onclick="rejectConsignacao('${registro._id}')">Rejeitar</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    alert('❌ Erro ao carregar consignações: ' + error.message);
  }
}

async function updateStatusVoluntario(id, status) {
  try {
    const response = await fetch(`/api/cruzados/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      const statusText = status === 'aprovado' ? 'aprovado' : 'rejeitado';
      alert(`✅ Voluntário ${statusText} com sucesso!`);
      loadPendingVoluntarios();
      loadPendingConsignacao();
    } else {
      const error = await response.json();
      alert('❌ Erro ao atualizar: ' + (error.message || 'Tente novamente.'));
    }
  } catch (error) {
    alert('❌ Erro de conexão: ' + error.message);
  }
}

async function approveConsignacao(id) {
  await updateStatusConsignacao(id, 'aprovado');
}

async function rejectConsignacao(id) {
  await updateStatusConsignacao(id, 'rejeitado');
}

async function updateStatusConsignacao(id, status) {
  try {
    const response = await fetch(`/api/cruzados/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      const statusText = status === 'aprovado' ? 'aprovado' : 'rejeitado';
      alert(`✅ Consignação ${statusText} com sucesso!`);
      loadPendingConsignacao();
    } else {
      const error = await response.json();
      alert('❌ Erro ao atualizar: ' + (error.message || 'Tente novamente.'));
    }
  } catch (error) {
    alert('❌ Erro de conexão: ' + error.message);
  }
}
