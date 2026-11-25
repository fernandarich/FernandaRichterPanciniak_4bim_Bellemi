(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000`;
  async function iniciar() {
    try {
      const resposta = await fetch(`${API_URL}/api/sessao`, {
        credentials: 'include'
      });
      if (!resposta.ok) {
        location.replace(new URL('../../Login/login.html?proxima=pagamento', location.href).href);
        return;
      }

      const dados = await resposta.json();
      if (dados.usuario.perfil !== 'cliente') {
        const destino = dados.usuario.perfil === 'admin'
          ? '../../Admin/index.html'
          : '../../Login/login.html?proxima=pagamento';
        location.replace(new URL(destino, location.href).href);
        return;
      }
    } catch (erro) {
      console.error('Erro ao verificar a sessão para pagamento:', erro);
      location.replace(new URL('../../Login/login.html?proxima=pagamento', location.href).href);
      return;
    }

  const CHAVE_CARRINHO = 'bellemi_carrinho';
  const itensPedido = document.getElementById('itensPedido');
  const totalPedido = document.getElementById('totalPedido');
  const formPagamento = document.getElementById('formPagamento');
  const estadoEntrega = document.getElementById('estadoEntrega');
  const tentarCarregarFretes = document.getElementById('tentarCarregarFretes');
  const campoFormasPagamento = document.getElementById('campoFormasPagamento');
  const formasPagamento = document.getElementById('formasPagamento');
  const tentarCarregarFormas = document.getElementById('tentarCarregarFormas');
  const continuarPagamento = document.getElementById('continuarPagamento');
  const telaCheckout = document.getElementById('telaCheckout');
  const telaPix = document.getElementById('telaPix');
  const telaCartao = document.getElementById('telaCartao');
  const telaBoleto = document.getElementById('telaBoleto');
  const qrcodePix = document.getElementById('qrcodePix');
  const valorPix = document.getElementById('valorPix');
  const valorBoleto = document.getElementById('valorBoleto');
  const vencimentoBoleto = document.getElementById('vencimentoBoleto');
  const cartaoSalvo = document.getElementById('cartaoSalvo');
  const formDadosCartao = document.getElementById('formDadosCartao');
  const valorCartao = document.getElementById('valorCartao');
  const confirmarPagamento = document.getElementById('confirmarPagamento');
  const confirmarPagamentoCartao = document.getElementById('confirmarPagamentoCartao');
  const confirmarBoleto = document.getElementById('confirmarBoleto');
  const mensagem = document.getElementById('mensagem');
  const mensagemPix = document.getElementById('mensagemPix');
  const mensagemCartao = document.getElementById('mensagemCartao');
  const mensagemBoleto = document.getElementById('mensagemBoleto');
  const moeda = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let carrinho = [];
  let totalProdutos = 0;
  let valorFrete = 0;
  let cartaoSalvoSelecionado = null;

  const anoValidade = document.getElementById('anoValidade');
  anoValidade.min = String(new Date().getFullYear());
  anoValidade.max = String(new Date().getFullYear() + 30);

  function atualizarTotalPedido() {
    const opcaoEstado = estadoEntrega.selectedOptions[0];
    valorFrete = opcaoEstado ? Number(opcaoEstado.dataset.valorFrete || 0) : 0;
    totalPedido.textContent = moeda(totalProdutos + valorFrete);
    continuarPagamento.disabled = !carrinho.length || !estadoEntrega.value || campoFormasPagamento.disabled;
  }

  function criarQrCodeIlustrativo() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '-2 -2 33 33');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const fundo = document.createElementNS(namespace, 'rect');
    fundo.setAttribute('x', '-2');
    fundo.setAttribute('y', '-2');
    fundo.setAttribute('width', '33');
    fundo.setAttribute('height', '33');
    fundo.setAttribute('fill', '#fff');
    svg.append(fundo);

    function fazParteDoLocalizador(x, y, inicioX, inicioY) {
      const localX = x - inicioX;
      const localY = y - inicioY;
      if (localX < 0 || localX > 6 || localY < 0 || localY > 6) return false;
      return localX === 0 || localX === 6 || localY === 0 || localY === 6 ||
        (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4);
    }

    const quadrados = [];
    for (let y = 0; y < 29; y += 1) {
      for (let x = 0; x < 29; x += 1) {
        const localizador = fazParteDoLocalizador(x, y, 0, 0) ||
          fazParteDoLocalizador(x, y, 22, 0) ||
          fazParteDoLocalizador(x, y, 0, 22);
        const reservado = (x <= 7 && y <= 7) || (x >= 21 && y <= 7) || (x <= 7 && y >= 21);
        const preenchido = localizador || (!reservado && ((x * 17 + y * 31 + x * y * 7) % 11 < 5));

        if (preenchido) {
          quadrados.push(`M${x} ${y}h1v1h-1z`);
        }
      }
    }

    const desenho = document.createElementNS(namespace, 'path');
    desenho.setAttribute('d', quadrados.join(''));
    desenho.setAttribute('fill', '#24151e');
    svg.append(desenho);
    qrcodePix.replaceChildren(svg);
  }

  async function carregarFormasPagamento() {
    campoFormasPagamento.disabled = true;
    tentarCarregarFormas.hidden = true;
    continuarPagamento.disabled = true;
    formasPagamento.textContent = 'Carregando formas de pagamento...';

    try {
      const resposta = await fetch(`${API_URL}/api/formas-pagamento`, { cache: 'no-store' });
      if (!resposta.ok) {
        const detalhe = await resposta.json().catch(() => null);
        throw new Error(detalhe && detalhe.erro
          ? `HTTP ${resposta.status}: ${detalhe.erro}`
          : `HTTP ${resposta.status}`);
      }

      const lista = await resposta.json();
      if (!Array.isArray(lista) || lista.some(forma =>
        !forma || !Number.isInteger(forma.id) || forma.id <= 0 || typeof forma.nome !== 'string'
      )) {
        throw new Error('O servidor retornou uma lista de formas de pagamento inválida.');
      }

      formasPagamento.replaceChildren();
      if (!lista.length) {
        formasPagamento.textContent = 'Nenhuma forma de pagamento está cadastrada.';
        return;
      }

      lista.forEach(forma => {
        const label = document.createElement('label');
        label.className = 'opcao';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'formaPagamento';
        input.value = forma.id;
        input.required = true;

        const nome = document.createElement('span');
        nome.textContent = forma.nome;

        label.append(input, nome);
        formasPagamento.append(label);
      });

      campoFormasPagamento.disabled = !carrinho.length;
      atualizarTotalPedido();
    } catch (erro) {
      console.error('Erro ao carregar formas de pagamento:', erro);
      formasPagamento.textContent = erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se a página está em http://localhost e tente novamente.'
        : `Não foi possível carregar as formas de pagamento. ${erro.message}`;
      tentarCarregarFormas.hidden = false;
    }
  }

  async function carregarFretes() {
    estadoEntrega.disabled = true;
    tentarCarregarFretes.hidden = true;
    estadoEntrega.replaceChildren(new Option('Carregando estados...', ''));

    try {
      const resposta = await fetch(`${API_URL}/api/pedidos/fretes`, { cache: 'no-store' });
      if (!resposta.ok) {
        const detalhe = await resposta.json().catch(() => null);
        throw new Error(detalhe && detalhe.erro
          ? `HTTP ${resposta.status}: ${detalhe.erro}`
          : `HTTP ${resposta.status}`);
      }

      const lista = await resposta.json();
      if (!Array.isArray(lista) || lista.some(frete =>
        !frete || !Number.isInteger(frete.id) || frete.id <= 0 ||
        typeof frete.estado !== 'string' || !Number.isFinite(Number(frete.valor_frete)) ||
        Number(frete.valor_frete) < 0
      )) {
        throw new Error('O servidor retornou uma lista de estados de entrega inválida.');
      }
      if (!lista.length) {
        throw new Error('Nenhum estado de entrega está cadastrado.');
      }

      const placeholder = new Option('Selecione seu estado...', '');
      const opcoes = lista.map(frete => {
        const opcao = new Option(`${frete.estado} — ${moeda(frete.valor_frete)}`, frete.id);
        opcao.dataset.valorFrete = frete.valor_frete;
        return opcao;
      });
      estadoEntrega.replaceChildren(placeholder, ...opcoes);
      estadoEntrega.disabled = !carrinho.length;
      mensagem.textContent = '';
      atualizarTotalPedido();
    } catch (erro) {
      console.error('Erro ao carregar estados de entrega:', erro);
      estadoEntrega.replaceChildren(new Option('Não foi possível carregar os estados.', ''));
      tentarCarregarFretes.hidden = false;
      mensagem.textContent = erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se ele está ligado e tente novamente.'
        : erro.message;
    }
  }

  async function prepararTelaCartao(nomeForma) {
    mensagem.textContent = 'Verificando se você já tem um cartão salvo...';
    const nomeNormalizado = nomeForma.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const tipoCartao = nomeNormalizado === 'cartao de credito' ? 'CREDITO' : 'DEBITO';

    try {
      const resposta = await fetch(`${API_URL}/api/pedidos/cartoes`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (resposta.status === 401) {
        location.replace(new URL('../../Login/login.html?proxima=pagamento', location.href).href);
        return;
      }
      if (!resposta.ok) {
        const detalhe = await resposta.json().catch(() => null);
        throw new Error(detalhe && detalhe.erro
          ? detalhe.erro
          : `Não foi possível consultar os cartões salvos (HTTP ${resposta.status}).`);
      }

      const lista = await resposta.json();
      if (!Array.isArray(lista) || lista.some(cartao =>
        !cartao ||
        !Number.isInteger(cartao.id) ||
        typeof cartao.nome_titular !== 'string' ||
        typeof cartao.ultimos_digitos !== 'string' ||
        !/^\d{4}$/.test(cartao.ultimos_digitos) ||
        typeof cartao.bandeira !== 'string' ||
        !['CREDITO', 'DEBITO'].includes(cartao.tipo_cartao) ||
        !Number.isInteger(cartao.mes_validade) ||
        !Number.isInteger(cartao.ano_validade)
      )) {
        throw new Error('O servidor retornou dados de cartão inválidos.');
      }

      const agora = new Date();
      const cartaoExistente = lista.find(cartao =>
        cartao.tipo_cartao === tipoCartao &&
        (cartao.ano_validade > agora.getFullYear() ||
          (cartao.ano_validade === agora.getFullYear() && cartao.mes_validade >= agora.getMonth() + 1))
      );
      cartaoSalvoSelecionado = cartaoExistente || null;
      document.getElementById('tituloCartao').textContent = nomeForma;
      valorCartao.textContent = moeda(totalProdutos + valorFrete);
      cartaoSalvo.replaceChildren();

      if (cartaoExistente) {
        const resumo = document.createElement('p');
        resumo.textContent = `${cartaoExistente.bandeira} •••• ${cartaoExistente.ultimos_digitos} — validade ${String(cartaoExistente.mes_validade).padStart(2, '0')}/${cartaoExistente.ano_validade}`;
        cartaoSalvo.append(resumo);
        cartaoSalvo.hidden = false;
        formDadosCartao.hidden = true;
      } else {
        cartaoSalvo.hidden = true;
        formDadosCartao.hidden = false;
      }

      mensagem.textContent = '';
      mensagemCartao.textContent = '';
      telaCheckout.hidden = true;
      telaPix.hidden = true;
      telaCartao.hidden = false;
    } catch (erro) {
      console.error('Erro ao preparar pagamento com cartão:', erro);
      mensagem.textContent = erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se ele está ligado e tente novamente.'
        : erro.message;
    }
  }

  tentarCarregarFormas.addEventListener('click', carregarFormasPagamento);
  tentarCarregarFretes.addEventListener('click', carregarFretes);
  estadoEntrega.addEventListener('change', atualizarTotalPedido);

  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '[]');
    if (Array.isArray(salvo)) {
      carrinho = salvo.filter(item =>
        item && item.id != null && typeof item.nome === 'string' &&
        Number.isFinite(Number(item.preco)) && Number(item.preco) >= 0 &&
        Number.isInteger(Number(item.qtd)) && Number(item.qtd) > 0
      );
    }
  } catch (erro) {
    mensagem.textContent = 'Não foi possível ler seu carrinho. Volte à loja e tente novamente.';
    carrinho = [];
  }

  totalProdutos = carrinho.reduce((soma, item) => soma + Number(item.preco) * Number(item.qtd), 0);
  if (!carrinho.length) {
    itensPedido.innerHTML = '<li class="vazio">Seu carrinho está vazio. Volte à loja para escolher seus produtos.</li>';
    formPagamento.querySelector('button[type="submit"]').disabled = true;
    formPagamento.querySelectorAll('input').forEach(input => { input.disabled = true; });
  } else {
    itensPedido.innerHTML = carrinho.map(item => {
      const linha = document.createElement('li');
      linha.className = 'item-pedido';
      const nome = document.createElement('span');
      nome.textContent = `${item.qtd}x ${item.nome}`;
      const preco = document.createElement('strong');
      preco.textContent = moeda(Number(item.preco) * Number(item.qtd));
      linha.append(nome, preco);
      return linha.outerHTML;
    }).join('');
  }
  atualizarTotalPedido();

  formPagamento.addEventListener('submit', async event => {
    event.preventDefault();
    const forma = formasPagamento.querySelector('input[name="formaPagamento"]:checked');
    if (!forma || !carrinho.length) return;

    const nomeForma = forma.nextElementSibling.textContent.trim();
    const dadosEtapa = {
      formaId: Number(forma.value),
      formaNome: nomeForma,
      freteId: Number(estadoEntrega.value),
      total: totalProdutos + valorFrete
    };
    sessionStorage.setItem('bellemi_pagamento_etapa', JSON.stringify(dadosEtapa));

    if (nomeForma.toLocaleLowerCase('pt-BR') === 'pix') {
      location.href = new URL('pix.html', location.href).href;
      return;
    }

    const nomeNormalizado = nomeForma.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (nomeNormalizado === 'cartao de credito' || nomeNormalizado === 'cartao de debito') {
      location.href = new URL('cartao.html', location.href).href;
      return;
    }
    if (nomeNormalizado === 'boleto bancario') {
      location.href = new URL('boleto.html', location.href).href;
      return;
    }

    mensagem.textContent = `Forma escolhida: ${nomeForma}. Esta é apenas uma demonstração; nenhum pagamento foi realizado.`;
  });

  async function registrarPedido(botao, mensagemDestino, dadosCartao) {
    const formaSelecionada = formasPagamento.querySelector('input[name="formaPagamento"]:checked');
    const idFormaPagamento = formaSelecionada ? Number(formaSelecionada.value) : NaN;
    if (!Number.isInteger(idFormaPagamento) || idFormaPagamento <= 0) {
      mensagemDestino.textContent = 'Selecione novamente a forma de pagamento para continuar.';
      return;
    }

    botao.disabled = true;
    mensagemDestino.textContent = 'Registrando seu pedido de demonstração...';

    try {
      const resposta = await fetch(`${API_URL}/api/pedidos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idFormaPagamento,
          idFrete: Number(estadoEntrega.value),
          itens: carrinho.map(item => ({
            id: Number(item.id),
            quantidade: Number(item.qtd)
          })),
          ...dadosCartao
        })
      });

      if (resposta.status === 401) {
        location.replace(new URL('../../Login/login.html?proxima=pagamento', location.href).href);
        return;
      }

      const resultado = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(resultado && resultado.erro
          ? resultado.erro
          : `Não foi possível registrar o pedido (HTTP ${resposta.status}).`);
      }

      try {
        localStorage.removeItem(CHAVE_CARRINHO);
      } catch (erro) {
        console.error('Não foi possível limpar o carrinho após registrar o pedido:', erro);
      }
      mensagemDestino.textContent = `Pedido #${resultado.id} registrado. Abrindo seus pedidos...`;
      setTimeout(() => {
        location.replace(new URL('../Pedidos/pedidos.html', location.href).href);
      }, 1000);
    } catch (erro) {
      console.error('Erro ao confirmar o pedido de demonstração:', erro);
      mensagemDestino.textContent = erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Confira se ele está ligado e tente novamente.'
        : erro.message;
      botao.disabled = false;
    }
  }

  confirmarPagamento.addEventListener('click', () => {
    registrarPedido(confirmarPagamento, mensagemPix, {});
  });

  confirmarPagamentoCartao.addEventListener('click', () => {
    if (cartaoSalvoSelecionado) {
      registrarPedido(confirmarPagamentoCartao, mensagemCartao, {
        idCartao: cartaoSalvoSelecionado.id
      });
      return;
    }

    if (!formDadosCartao.reportValidity()) return;
    registrarPedido(confirmarPagamentoCartao, mensagemCartao, {
      cartao: {
        nomeTitular: document.getElementById('nomeTitular').value.trim(),
        ultimosDigitos: document.getElementById('ultimosDigitos').value,
        bandeira: document.getElementById('bandeiraCartao').value,
        mesValidade: Number(document.getElementById('mesValidade').value),
        anoValidade: Number(anoValidade.value)
      }
    });
  });

  confirmarBoleto.addEventListener('click', () => {
    registrarPedido(confirmarBoleto, mensagemBoleto, {});
  });

  carregarFormasPagamento();
  carregarFretes();
  }

  iniciar();
})();
