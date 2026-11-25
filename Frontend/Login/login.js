(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000`;
  const form = document.getElementById('formLogin');
  const mensagem = document.getElementById('mensagem');
  const botao = form.querySelector('button[type="submit"]');
  const destinosCliente = {
    pagamento: '../Cliente/Pagamento/pagamento.html',
    pedidos: '../Cliente/Pedidos/pedidos.html'
  };
  const destinoSolicitado = new URLSearchParams(location.search).get('proxima');
  const proxima = Object.hasOwn(destinosCliente, destinoSolicitado) ? destinoSolicitado : '';
  const linkCadastro = document.getElementById('linkCadastro');
  if (proxima) linkCadastro.href += `?proxima=${encodeURIComponent(proxima)}`;

  function irParaPerfil(usuario) {
    if (usuario.perfil === 'admin') {
      location.replace(new URL('../Admin/Menu/menu.html', location.href).href);
    } else if (usuario.perfil === 'cliente') {
      const destino = proxima
        ? destinosCliente[proxima]
        : '../Cliente/Menu/menu.html';
      location.replace(new URL(destino, location.href).href);
    }
  }

  async function validarSessaoAtual() {
    try {
      const resposta = await fetch(`${API_URL}/api/sessao`, {
        credentials: 'include'
      });
      if (!resposta.ok) return;
      const dados = await resposta.json();
      irParaPerfil(dados.usuario);
    } catch (erro) {
      console.error('Erro ao validar sessão:', erro);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    mensagem.textContent = '';
    mensagem.classList.remove('erro');
    botao.disabled = true;

    try {
      const resposta = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.elements.email.value,
          senha: form.elements.senha.value
        })
      });
      const dados = await resposta.json();

      if (resposta.status === 404 && dados.codigo === 'NAO_CADASTRADO') {
        const destino = new URL('../Cliente/Cadastro/cadastro.html', location.href);
        if (proxima) destino.searchParams.set('proxima', proxima);
        location.href = destino.href;
        return;
      }
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível fazer login.');

      irParaPerfil(dados.usuario);
    } catch (erro) {
      console.error('Erro ao fazer login:', erro);
      mensagem.textContent = erro.message === 'Failed to fetch'
        ? 'Não foi possível conectar ao servidor. Tente novamente.'
        : erro.message;
      mensagem.classList.add('erro');
    } finally {
      botao.disabled = false;
    }
  });

  validarSessaoAtual();
})();
