(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000/api`;
  const mensagem = document.getElementById('mensagemPedidos');
  const lista = document.getElementById('listaPedidos');
  const moedas = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function formatarData(valor) {
    const [ano, mes, dia] = String(valor).slice(0, 10).split('-').map(Number);
    if (!ano || !mes || !dia) return 'Data indisponível';
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR');
  }

  function criarTexto(tag, texto, classe) {
    const elemento = document.createElement(tag);
    elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function renderizarPedido(pedido) {
    const artigo = document.createElement('article');
    artigo.className = 'pedido';

    const topo = document.createElement('header');
    topo.className = 'pedido-topo';
    const identificacao = document.createElement('div');
    identificacao.append(
      criarTexto('h2', `Pedido #${pedido.id}`),
      criarTexto('p', formatarData(pedido.data), 'pedido-data')
    );
    topo.append(identificacao, criarTexto('span', pedido.status || 'Status indisponível', 'status'));
    artigo.append(topo);

    const itens = document.createElement('ul');
    itens.className = 'itens-pedido';
    pedido.itens.forEach(item => {
      const linha = document.createElement('li');
      linha.className = 'item-pedido';
      linha.append(
        criarTexto('span', `${item.quantidade}x ${item.nome}`),
        criarTexto('strong', moedas(item.subtotal))
      );
      itens.append(linha);
    });
    artigo.append(itens);

    const detalhes = document.createElement('div');
    detalhes.className = 'detalhes-pedido';
    if (pedido.forma_pagamento) {
      detalhes.append(criarTexto('span', `Pagamento: ${pedido.forma_pagamento}`));
    }
    if (pedido.status_pagamento) {
      detalhes.append(criarTexto('span', `Status do pagamento: ${pedido.status_pagamento}`));
    }
    if (pedido.estado_entrega) {
      detalhes.append(criarTexto('span', `Entrega: ${pedido.estado_entrega}`));
    }
    artigo.append(detalhes);

    const total = document.createElement('div');
    total.className = 'total-pedido';
    total.append(criarTexto('span', 'Total do pedido'), criarTexto('strong', moedas(pedido.total)));
    artigo.append(total);
    return artigo;
  }

  function mostrarErro(texto) {
    mensagem.classList.add('erro-pedidos');
    mensagem.replaceChildren(
      criarTexto('p', texto),
      Object.assign(document.createElement('button'), {
        className: 'botao',
        type: 'button',
        textContent: 'Tentar novamente'
      })
    );
    mensagem.querySelector('button').addEventListener('click', carregarPedidos);
  }

  async function carregarPedidos() {
    mensagem.classList.remove('erro-pedidos');
    mensagem.textContent = 'Carregando seus pedidos...';
    mensagem.hidden = false;
    lista.hidden = true;

    try {
      const sessao = await fetch(`${API_URL}/sessao`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (!sessao.ok) {
        location.replace(new URL('../../Login/login.html?proxima=pedidos', location.href).href);
        return;
      }

      const dadosSessao = await sessao.json();
      if (dadosSessao.usuario.perfil !== 'cliente') {
        location.replace(new URL('../../Admin/index.html', location.href).href);
        return;
      }

      const resposta = await fetch(`${API_URL}/pedidos`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (resposta.status === 401) {
        location.replace(new URL('../../Login/login.html?proxima=pedidos', location.href).href);
        return;
      }
      if (!resposta.ok) {
        const erro = await resposta.json();
        throw new Error(erro.erro || `HTTP ${resposta.status}`);
      }

      const pedidos = await resposta.json();
      if (!Array.isArray(pedidos)) throw new Error('O servidor retornou uma lista de pedidos inválida.');
      if (!pedidos.length) {
        mensagem.textContent = 'Você ainda não tem pedidos.';
        return;
      }

      lista.replaceChildren(...pedidos.map(renderizarPedido));
      lista.hidden = false;
      mensagem.hidden = true;
    } catch (erro) {
      console.error('Erro ao carregar seus pedidos:', erro);
      mostrarErro(erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se ele está ligado e tente novamente.'
        : erro.message);
    }
  }

  carregarPedidos();
})();
