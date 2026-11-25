(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000`;
  const form = document.getElementById('formCadastro');
  const mensagem = document.getElementById('mensagem');
  const botao = form.querySelector('button[type="submit"]');
  const destinosCliente = {
    pagamento: '../../Cliente/Pagamento/pagamento.html',
    pedidos: '../../Cliente/Pedidos/pedidos.html'
  };
  const destinoSolicitado = new URLSearchParams(location.search).get('proxima');
  const proxima = Object.hasOwn(destinosCliente, destinoSolicitado) ? destinoSolicitado : '';
  if (proxima) {
    document.getElementById('linkLogin').href += `?proxima=${encodeURIComponent(proxima)}`;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    mensagem.textContent = '';
    mensagem.classList.remove('erro');
    botao.disabled = true;

    try {
      const resposta = await fetch(`${API_URL}/api/clientes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.elements.nome.value,
          cpf: form.elements.cpf.value,
          email: form.elements.email.value,
          telefone: form.elements.telefone.value,
          renda: form.elements.renda.value,
          senha: form.elements.senha.value
        })
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir o cadastro.');

      const destino = proxima
        ? destinosCliente[proxima]
        : '../Menu/menu.html';
      location.replace(new URL(destino, location.href).href);
    } catch (erro) {
      console.error('Erro ao cadastrar cliente:', erro);
      mensagem.textContent = erro.message === 'Failed to fetch'
        ? 'Não foi possível conectar ao servidor. Tente novamente.'
        : erro.message;
      mensagem.classList.add('erro');
    } finally {
      botao.disabled = false;
    }
  });
})();
