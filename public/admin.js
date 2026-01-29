// Painel Admin
let token = '';

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
      loadPending();
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
      loadPending();
    } else {
      const error = await response.json();
      alert('❌ Erro ao atualizar: ' + (error.message || 'Tente novamente.'));
    }
  } catch (error) {
    alert('❌ Erro de conexão: ' + error.message);
  }
}