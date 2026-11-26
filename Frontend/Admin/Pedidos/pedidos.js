(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000/api`;
  const mensagem = document.getElementById('mensagem');
  const corpoTabela = document.getElementById('tabelaCorpo');
  const campoBusca = document.getElementById('buscar');
  const filtroStatus = document.getElementById('filtroStatus');
  const campoFiltroStatus = document.getElementById('campoFiltroStatus');
  const modal = document.getElementById('modalDetalhes');
  const detalhes = document.getElementById('detalhesPedido');
  const botaoFecharModal = document.getElementById('btnFecharModal');
  const abas = [...document.querySelectorAll('.gp-aba[data-aba]')];
  let pedidos = [];
  let abaAtiva = 'nao_confirmado';
  let focoAnterior = null;

  const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  function texto(elemento, valor) {
    elemento.textContent = valor == null ? '' : String(valor);
    return elemento;
  }

  function normalizar(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function formatarData(valor) {
    const partes = String(valor || '').slice(0, 10).split('-').map(Number);
    if (partes.length !== 3 || partes.some(numero => !numero)) return 'Data indisponível';
    return new Date(partes[0], partes[1] - 1, partes[2]).toLocaleDateString('pt-BR');
  }

  function pagamentoPendente(pedido) {
    return normalizar(pedido.status_pagamento) === 'pendente' ||
      ['pendente', 'aguardando pagamento'].includes(normalizar(pedido.status));
  }

  function mostrarMensagem(valor, erro) {
    mensagem.textContent = valor;
    mensagem.hidden = !valor;
    mensagem.setAttribute('aria-live', erro ? 'assertive' : 'polite');
    mensagem.classList.toggle('erro', Boolean(erro));
  }

  async function requisicao(url, opcoes) {
    const resposta = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...opcoes
    });
    if (resposta.status === 401) {
      location.replace(new URL('../../Login/login.html', location.href).href);
      throw new Error('Sua sessão expirou. Entre novamente.');
    }
    if (resposta.status === 403) {
      location.replace(new URL('../../Cliente/Menu/menu.html', location.href).href);
      throw new Error('Apenas administradores podem acessar os pedidos.');
    }
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(dados?.erro || `Não foi possível concluir a operação (HTTP ${resposta.status}).`);
    }
    return dados;
  }

  function proximoStatus(pedido) {
    const atual = normalizar(pedido.status);
    if (['pago', 'aprovado'].includes(atual)) return ['Em Separação'];
    if (atual === 'em separacao') return ['Enviado'];
    if (atual === 'enviado') return ['Entregue'];
    return [];
  }

  function criarBotao(rotulo, acao, classe) {
    const botao = texto(document.createElement('button'), rotulo);
    botao.type = 'button';
    botao.dataset.acao = acao;
    if (classe) botao.className = classe;
    return botao;
  }

  function abrirDetalhes(pedido) {
    document.getElementById('tituloDetalhes').textContent = `Pedido #${pedido.id}`;
    const lista = document.createElement('ul');
    lista.className = 'gp-detalhes-lista';
    let itens = pedido.itens;
    if (typeof itens === 'string') {
      try {
        itens = JSON.parse(itens);
      } catch {
        itens = itens === 'Nenhum item'
          ? []
          : itens.split(' • ').map(textoItem => {
              const correspondencia = textoItem.match(/^(\d+)\s*x\s*(.+)$/i);
              return correspondencia
                ? {
                    quantidade: Number(correspondencia[1]),
                    nome: correspondencia[2].trim()
                  }
                : { quantidade: 1, nome: textoItem.trim() };
            }).filter(item => item.nome);
      }
    }
    if (!Array.isArray(itens)) itens = [];
    if (!itens.length) {
      lista.append(texto(document.createElement('li'), 'Nenhum item informado para este pedido.'));
      lista.firstElementChild.className = 'gp-detalhes-vazio';
    }
    itens.forEach(item => {
      const linha = document.createElement('li');
      const quantidade = Number(item.quantidade) || 0;
      const nome = item.nome || item.nome_prod || item.produto || 'Produto';
      const precoUnitario = Number(item.precoUnitario || item.preco_unitario || 0);
      const subtotal = item.subtotal == null
        ? quantidade * precoUnitario
        : Number(item.subtotal);
      linha.append(texto(document.createElement('span'), `${quantidade}x ${nome}`));
      if (subtotal > 0) {
        linha.append(texto(document.createElement('strong'), moeda(subtotal)));
      }
      lista.append(linha);
    });

    const resumo = document.createElement('dl');
    resumo.className = 'gp-detalhes-resumo';
    const campos = [
      ['Cliente', pedido.cliente],
      ['Data', formatarData(pedido.data)],
      ['Pagamento', pedido.forma_pagamento],
      ['Status do pagamento', pedido.status_pagamento],
      ['Entrega', pedido.estado_entrega],
      ['Status do pedido', pedido.status],
      ['Total', moeda(pedido.total)]
    ];
    campos.forEach(([rotulo, valor]) => {
      const termo = texto(document.createElement('dt'), rotulo);
      const definicao = texto(document.createElement('dd'), valor || 'Não informado');
      resumo.append(termo, definicao);
    });

    detalhes.replaceChildren(texto(document.createElement('h3'), 'Itens do pedido'), lista, resumo);
    focoAnterior = document.activeElement;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gp-modal-aberto');
    botaoFecharModal.focus();
  }

  function fecharDetalhes() {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gp-modal-aberto');
    detalhes.replaceChildren();
    if (focoAnterior instanceof HTMLElement) focoAnterior.focus();
  }

  function filtrarPedidos() {
    const busca = normalizar(campoBusca.value.trim());
    const status = normalizar(filtroStatus.value);
    return pedidos.filter(pedido => {
      const pendente = pagamentoPendente(pedido);
      if (abaAtiva === 'nao_confirmado' && !pendente) return false;
      if (abaAtiva === 'confirmado' && pendente) return false;
      if (status && normalizar(pedido.status) !== status) return false;
      if (!busca) return true;
      return [pedido.id, pedido.cliente, formatarData(pedido.data)]
        .some(valor => normalizar(valor).includes(busca));
    });
  }

  function renderizarTabela() {
    document.getElementById('painelPedidos').setAttribute(
      'aria-labelledby', abaAtiva === 'nao_confirmado' ? 'abaNaoConfirmado' : 'abaConfirmado'
    );
    const filtrados = filtrarPedidos();
    if (!filtrados.length) {
      const linha = document.createElement('tr');
      linha.append(texto(document.createElement('td'), 'Nenhum pedido encontrado.'));
      linha.firstElementChild.colSpan = 7;
      corpoTabela.replaceChildren(linha);
      return;
    }

    corpoTabela.replaceChildren(...filtrados.map(pedido => {
      const linha = document.createElement('tr');
      const colunas = [
        `#${pedido.id}`,
        pedido.cliente,
        formatarData(pedido.data),
        moeda(pedido.total),
        `${pedido.forma_pagamento} · ${pedido.status_pagamento}`,
        pedido.status
      ];
      colunas.forEach(valor => linha.append(texto(document.createElement('td'), valor || 'Não informado')));

      const acoes = document.createElement('td');
      acoes.className = 'gp-acoes';
      const detalhesBotao = criarBotao('Detalhes', 'detalhes', 'btn-secondary');
      detalhesBotao.dataset.id = String(pedido.id);
      acoes.append(detalhesBotao);

      if (pagamentoPendente(pedido)) {
        const aprovar = criarBotao('Confirmar pagamento', 'Aprovado');
        const cancelar = criarBotao('Cancelar pedido', 'Cancelado', 'btn-secondary');
        acoes.append(aprovar, cancelar);
      } else {
        const proximos = proximoStatus(pedido);
        if (proximos.length) {
          const seletor = document.createElement('select');
          seletor.setAttribute('aria-label', `Próximo status do pedido ${pedido.id}`);
          proximos.forEach(status => {
            const opcao = texto(document.createElement('option'), status);
            opcao.value = status;
            seletor.append(opcao);
          });
          const atualizar = criarBotao('Atualizar status', 'atualizar');
          acoes.append(seletor, atualizar);
        }
      }

      linha.append(acoes);
      return linha;
    }));
  }

  async function carregarPedidos() {
    mostrarMensagem('Carregando pedidos...');
    corpoTabela.replaceChildren();
    try {
      const dados = await requisicao(`${API_URL}/admin/pedidos`);
      if (!Array.isArray(dados)) throw new Error('O servidor retornou uma lista inválida.');
      pedidos = dados;
      const pendentes = pedidos.filter(pagamentoPendente).length;
      document.getElementById('contNaoConfirmado').textContent = String(pendentes);
      document.getElementById('contConfirmado').textContent = String(pedidos.length - pendentes);
      mostrarMensagem(pedidos.length ? '' : 'Ainda não há pedidos cadastrados.');
      renderizarTabela();
    } catch (erro) {
      console.error('Erro ao carregar pedidos do painel:', erro);
      mostrarMensagem(erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se ele está ligado.'
        : erro.message, true);
      corpoTabela.replaceChildren();
    }
  }

  async function atualizarStatus(botao, pedido) {
    let status = botao.dataset.acao;
    if (status === 'atualizar') {
      status = botao.parentElement.querySelector('select')?.value;
    }
    if (!status) return;
    if (status === 'Cancelado' && !window.confirm(`Deseja cancelar o pedido #${pedido.id}?`)) return;
    if (status === 'Aprovado' && !window.confirm(`Confirme que recebeu o pagamento do pedido #${pedido.id}.`)) return;

    botao.disabled = true;
    mostrarMensagem('Atualizando pedido...');
    try {
      await requisicao(`${API_URL}/admin/pedidos/${pedido.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      await carregarPedidos();
      mostrarMensagem(`Pedido #${pedido.id} atualizado.`);
    } catch (erro) {
      console.error('Erro ao atualizar pedido:', erro);
      mostrarMensagem(erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se ele está ligado.'
        : erro.message, true);
      botao.disabled = false;
    }
  }

  abas.forEach(aba => {
    aba.addEventListener('click', () => {
      abaAtiva = aba.dataset.aba;
      abas.forEach(item => {
        const ativa = item === aba;
        item.classList.toggle('gp-ativa', ativa);
        item.setAttribute('aria-selected', String(ativa));
        item.tabIndex = ativa ? 0 : -1;
      });
      campoFiltroStatus.hidden = abaAtiva !== 'confirmado';
      renderizarTabela();
    });
  });

  campoBusca.addEventListener('input', renderizarTabela);
  filtroStatus.addEventListener('change', renderizarTabela);
  document.getElementById('btnLimpar').addEventListener('click', () => {
    campoBusca.value = '';
    filtroStatus.value = '';
    renderizarTabela();
    campoBusca.focus();
  });

  corpoTabela.addEventListener('click', event => {
    const botao = event.target instanceof Element ? event.target.closest('button[data-acao]') : null;
    if (!botao) return;
    const pedido = pedidos.find(item => String(item.id) === String(
      botao.dataset.id || botao.closest('tr')?.firstElementChild?.textContent?.replace('#', '')
    ));
    if (!pedido) return;
    if (botao.dataset.acao === 'detalhes') abrirDetalhes(pedido);
    else atualizarStatus(botao, pedido);
  });

  botaoFecharModal.addEventListener('click', fecharDetalhes);
  modal.addEventListener('click', event => {
    if (event.target === modal) fecharDetalhes();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) fecharDetalhes();
    if (event.key === 'Tab' && !modal.hidden) {
      const elementos = [...modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(elemento => !elemento.hidden);
      if (!elementos.length) return;
      const primeiro = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    }
  });

  carregarPedidos();
})();
