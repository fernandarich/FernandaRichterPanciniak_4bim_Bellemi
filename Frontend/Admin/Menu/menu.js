(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000/api`;
  const adminApp = document.getElementById('adminApp');
  const estadoInicial = document.getElementById('estadoInicial');
  const tituloEstado = document.getElementById('tituloEstado');
  const textoEstado = document.getElementById('textoEstado');
  const tentarConectar = document.getElementById('tentarConectar');
  const mensagem = document.getElementById('mensagemDashboard');
  const botaoAtualizar = document.getElementById('atualizarDashboard');
  const listaPendentes = document.getElementById('listaPendentes');
  const listaRecentes = document.getElementById('listaRecentes');
  const moeda = valor => Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  function criarTexto(tag, texto, classe) {
    const elemento = document.createElement(tag);
    elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function mostrarErro(texto) {
    adminApp.hidden = true;
    estadoInicial.hidden = false;
    tituloEstado.textContent = 'Painel indisponível';
    textoEstado.textContent = texto;
    tentarConectar.hidden = false;
  }

  function validarDashboard(dados) {
    const resumo = dados && dados.resumo;
    const contadoresValidos = resumo && [
      resumo.totalPedidos,
      resumo.totalProdutos,
      resumo.categoriasComProdutos,
      resumo.totalClientes,
      resumo.pedidosPendentes
    ].every(valor => Number.isInteger(valor) && valor >= 0);

    return contadoresValidos &&
      Array.isArray(dados.maisVendidos) &&
      Array.isArray(dados.pendentes) &&
      Array.isArray(dados.recentes);
  }

  function renderizarResumo(dados) {
    document.getElementById('totalPedidos').textContent =
      dados.resumo.totalPedidos.toLocaleString('pt-BR');
    document.getElementById('totalProdutos').textContent =
      dados.resumo.totalProdutos.toLocaleString('pt-BR');
    document.getElementById('categoriasComProdutos').textContent =
      `${dados.resumo.categoriasComProdutos.toLocaleString('pt-BR')} categorias com produtos`;
    document.getElementById('totalClientes').textContent =
      dados.resumo.totalClientes.toLocaleString('pt-BR');

    const listaMaisVendidos = document.getElementById('listaMaisVendidos');
    if (!dados.maisVendidos.length) {
      const vazio = criarTexto('li', 'Ainda não há vendas registradas.', 'ranking-vazio');
      listaMaisVendidos.replaceChildren(vazio);
      return;
    }

    const maiorQuantidade = Math.max(...dados.maisVendidos.map(produto => produto.quantidade), 1);
    listaMaisVendidos.replaceChildren(...dados.maisVendidos.map((produto, indice) => {
      const item = document.createElement('li');
      item.className = 'produto-ranking';

      const posicao = criarTexto('span', String(indice + 1).padStart(2, '0'), 'ranking-posicao');
      posicao.setAttribute('aria-hidden', 'true');

      const nome = criarTexto('span', produto.nome, 'produto-ranking-nome');
      const quantidade = criarTexto(
        'strong',
        `${produto.quantidade.toLocaleString('pt-BR')} un.`,
        'quantidade-vendida'
      );

      const barra = document.createElement('div');
      barra.className = 'barra-vendas';
      barra.setAttribute('role', 'meter');
      barra.setAttribute('aria-valuemin', '0');
      barra.setAttribute('aria-valuemax', String(maiorQuantidade));
      barra.setAttribute('aria-valuenow', String(produto.quantidade));
      barra.setAttribute('aria-label', `${produto.nome}: ${produto.quantidade} unidades vendidas`);

      const preenchimento = document.createElement('span');
      preenchimento.style.width = `${Math.max(5, Math.round(produto.quantidade / maiorQuantidade * 100))}%`;
      barra.append(preenchimento);
      item.append(posicao, nome, quantidade, barra);
      return item;
    }));
  }

  function renderizarPendentes(dados) {
    document.getElementById('quantidadePendentes').textContent =
      `${dados.resumo.pedidosPendentes.toLocaleString('pt-BR')} ${
        dados.resumo.pedidosPendentes === 1 ? 'pendente' : 'pendentes'
      }`;

    if (!dados.pendentes.length) {
      listaPendentes.replaceChildren(
        criarTexto('li', 'Não há pedidos aguardando confirmação.')
      );
      return;
    }

    listaPendentes.replaceChildren(...dados.pendentes.map(pedido => {
      const item = document.createElement('li');
      const detalhes = document.createElement('div');
      const identificacao = criarTexto('strong', `Pedido #${pedido.id}`, 'pedido-identificacao');
      detalhes.append(
        identificacao,
        criarTexto('span', ` — ${pedido.cliente}`),
        criarTexto('p', `${pedido.itens} • ${moeda(pedido.total)}`, 'pedido-detalhes'),
        criarTexto('p', `${pedido.data} • ${pedido.forma_pagamento} • ${pedido.status_pagamento}`, 'pedido-data')
      );

      const acoes = document.createElement('div');
      acoes.className = 'acoes-pedido';
      const confirmar = criarTexto('button', 'Confirmar pagamento');
      confirmar.type = 'button';
      confirmar.dataset.orderId = String(pedido.id);
      confirmar.dataset.status = 'Aprovado';
      const cancelar = criarTexto('button', 'Cancelar pedido');
      cancelar.type = 'button';
      cancelar.dataset.orderId = String(pedido.id);
      cancelar.dataset.status = 'Cancelado';
      acoes.append(confirmar, cancelar);
      item.append(detalhes, acoes);
      return item;
    }));
  }

  function renderizarRecentes(pedidos) {
    if (!pedidos.length) {
      listaRecentes.replaceChildren();
      const linha = document.createElement('tr');
      linha.append(criarTexto('td', 'Ainda não há pedidos registrados.'));
      linha.firstElementChild.colSpan = 5;
      listaRecentes.append(linha);
      return;
    }

    listaRecentes.replaceChildren(...pedidos.map(pedido => {
      const linha = document.createElement('tr');
      const status = pedido.status_pagamento !== 'Não informado' &&
        pedido.status_pagamento.toLowerCase() === 'pendente'
        ? `${pedido.status} — pagamento pendente`
        : pedido.status;
      linha.append(
        criarTexto('td', `#${pedido.id}`),
        criarTexto('td', pedido.cliente),
        criarTexto('td', pedido.data),
        criarTexto('td', moeda(pedido.total)),
        criarTexto('td', status)
      );
      return linha;
    }));
  }

  async function verificarAdministrador() {
    const resposta = await fetch(`${API_URL}/sessao`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (resposta.status === 401) {
      location.replace(new URL('../../Login/login.html', location.href).href);
      return false;
    }
    if (!resposta.ok) throw new Error(`Não foi possível verificar a sessão (HTTP ${resposta.status}).`);

    const dados = await resposta.json();
    if (!dados.usuario || dados.usuario.perfil !== 'admin') {
      location.replace(new URL('../../Cliente/Menu/menu.html', location.href).href);
      return false;
    }
    document.getElementById('nomeAdministrador').textContent = dados.usuario.nome;
    return true;
  }

  async function carregarDashboard() {
    botaoAtualizar.disabled = true;
    adminApp.hidden = true;
    estadoInicial.hidden = false;
    tituloEstado.textContent = 'Conectando ao servidor...';
    textoEstado.textContent = 'Validando a sessão e carregando os dados do painel.';
    tentarConectar.hidden = true;
    mensagem.classList.remove('erro');
    mensagem.textContent = 'Carregando dados do banco...';
    try {
      if (!await verificarAdministrador()) return;

      const resposta = await fetch(`${API_URL}/admin/dashboard`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (resposta.status === 401) {
        location.replace(new URL('../../Login/login.html', location.href).href);
        return;
      }
      if (resposta.status === 403) {
        location.replace(new URL('../../Cliente/Menu/menu.html', location.href).href);
        return;
      }

      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(dados && dados.erro
          ? dados.erro
          : `Não foi possível carregar o painel (HTTP ${resposta.status}).`);
      }
      if (!validarDashboard(dados)) {
        throw new Error('O servidor retornou dados inválidos para o painel.');
      }

      renderizarResumo(dados);
      renderizarPendentes(dados);
      renderizarRecentes(dados.recentes);
      estadoInicial.hidden = true;
      adminApp.hidden = false;
      mensagem.textContent = '';
    } catch (erro) {
      console.error('Erro ao carregar o painel administrativo:', erro);
      mostrarErro(erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se ele está ativo.'
        : erro.message);
    } finally {
      botaoAtualizar.disabled = false;
    }
  }

  async function atualizarPedido(botao) {
    const textoConfirmacao = botao.dataset.status === 'Aprovado'
      ? 'Confirme somente depois de verificar que o pagamento foi recebido. Continuar?'
      : 'Deseja cancelar este pedido?';
    if (!window.confirm(textoConfirmacao)) return;

    const botoes = botao.closest('li').querySelectorAll('button');
    botoes.forEach(item => { item.disabled = true; });
    mensagem.classList.remove('erro');
    mensagem.textContent = 'Atualizando pedido...';

    try {
      const resposta = await fetch(
        `${API_URL}/admin/pedidos/${botao.dataset.orderId}/status`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: botao.dataset.status })
        }
      );
      const resultado = await resposta.json().catch(() => null);
      if (resposta.status === 401) {
        location.replace(new URL('../../Login/login.html', location.href).href);
        return;
      }
      if (!resposta.ok) {
        throw new Error(resultado && resultado.erro
          ? resultado.erro
          : `Não foi possível atualizar o pedido (HTTP ${resposta.status}).`);
      }

      await carregarDashboard();
      mensagem.classList.remove('erro');
      mensagem.textContent = botao.dataset.status === 'Aprovado'
        ? `Pagamento do pedido #${resultado.id} confirmado.`
        : `Pedido #${resultado.id} cancelado.`;
    } catch (erro) {
      console.error('Erro ao atualizar pedido no painel:', erro);
      if (erro instanceof TypeError) {
        mostrarErro('Não consegui acessar o servidor. Confira se ele está ativo.');
      } else {
        mensagem.textContent = erro.message;
        botoes.forEach(item => { item.disabled = false; });
      }
    }
  }

  document.getElementById('sair').addEventListener('click', async event => {
    const botao = event.currentTarget;
    botao.disabled = true;
    try {
      const resposta = await fetch(`${API_URL}/sessao`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!resposta.ok) throw new Error(`Não foi possível encerrar a sessão (HTTP ${resposta.status}).`);
      location.replace(new URL('../../Login/login.html', location.href).href);
    } catch (erro) {
      console.error('Erro ao encerrar sessão administrativa:', erro);
      mostrarErro(erro.message);
      botao.disabled = false;
    }
  });

  botaoAtualizar.addEventListener('click', carregarDashboard);
  tentarConectar.addEventListener('click', carregarDashboard);
  listaPendentes.addEventListener('click', event => {
    const botao = event.target instanceof Element
      ? event.target.closest('button[data-order-id]')
      : null;
    if (botao) atualizarPedido(botao);
  });

  carregarDashboard();
})();
