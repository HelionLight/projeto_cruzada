// Painel Admin
let token = '';

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

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
      alert('Erro no login: ' + result.message);
    }
  } catch (error) {
    alert('Erro: ' + error.message);
  }
});

async function loadPending() {
  try {
    const response = await fetch('/api/cruzados/pending', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const pendentes = await response.json();
    const list = document.getElementById('pendingList');
    list.innerHTML = '';

    pendentes.forEach(cruzado => {
      const div = document.createElement('div');
      div.innerHTML = `
        <p><strong>${cruzado.nome}</strong> - ${cruzado.email}</p>
        <button onclick="approve('${cruzado._id}')">Aprovar</button>
        <button onclick="reject('${cruzado._id}')">Rejeitar</button>
      `;
      list.appendChild(div);
    });
  } catch (error) {
    alert('Erro ao carregar pendentes: ' + error.message);
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
      alert('Status atualizado!');
      loadPending();
    } else {
      alert('Erro ao atualizar status');
    }
  } catch (error) {
    alert('Erro: ' + error.message);
  }
}