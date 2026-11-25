(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000`;
  const boasVindas = document.getElementById('boasVindas');
  const mensagem = document.getElementById('mensagem');
  const sair = document.getElementById('sair');

  async function iniciar() {
    try {
      const resposta = await fetch(`${API_URL}/api/sessao`, {
        credentials: 'include'
      });
      if (!resposta.ok) {
        irParaLogin();
        return;
      }
      const dados = await resposta.json();
      if (dados.usuario.perfil !== 'admin') {
        location.replace(new URL('../Cliente/Menu/menu.html', location.href).href);
        return;
      }

      boasVindas.textContent = `Olá, ${dados.usuario.nome}. Você entrou como administrador.`;
      sair.hidden = false;
    } catch (erro) {
      console.error('Erro ao verificar acesso administrativo:', erro);
      mensagem.textContent = 'Não foi possível verificar seu acesso. Confira se o servidor está ativo.';
    }
  }

  function irParaLogin() {
    location.replace(new URL('../Login/login.html', location.href).href);
  }

  sair.addEventListener('click', async () => {
    try {
      const resposta = await fetch(`${API_URL}/api/sessao`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    } catch (erro) {
      console.error('Erro ao encerrar sessão no servidor:', erro);
      mensagem.textContent = 'Não foi possível encerrar sua sessão. Tente novamente.';
      sair.disabled = false;
      return;
    }
    location.replace(new URL('../Cliente/Menu/menu.html', location.href).href);
  });

  iniciar();
})();
