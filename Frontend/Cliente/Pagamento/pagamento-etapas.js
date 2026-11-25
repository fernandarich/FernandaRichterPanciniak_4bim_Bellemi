(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000`;
  const CHAVE_CARRINHO = 'bellemi_carrinho';
  let etapa = null;
  try {
    etapa = JSON.parse(sessionStorage.getItem('bellemi_pagamento_etapa') || 'null');
  } catch (erro) {
    sessionStorage.removeItem('bellemi_pagamento_etapa');
  }
  const botao = document.getElementById('confirmar');
  const mensagem = document.getElementById('mensagem');
  const reais = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (
    !etapa ||
    !Number.isInteger(Number(etapa.formaId)) ||
    Number(etapa.formaId) <= 0 ||
    !Number.isInteger(Number(etapa.freteId)) ||
    Number(etapa.freteId) <= 0 ||
    typeof etapa.formaNome !== 'string' ||
    !Number.isFinite(Number(etapa.total))
  ) {
    location.replace(new URL('pagamento.html', location.href).href);
    return;
  }

  async function registrarPedido(dadosCartao) {
    botao.disabled = true;
    mensagem.textContent = 'Registrando seu pedido de demonstração...';

    let carrinho;
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '[]');
      carrinho = Array.isArray(salvo) ? salvo.filter(item =>
        item && item.id != null &&
        Number.isFinite(Number(item.preco)) && Number(item.preco) >= 0 &&
        Number.isInteger(Number(item.qtd)) && Number(item.qtd) > 0
      ) : [];
    } catch (erro) {
      carrinho = [];
    }

    if (!carrinho.length) {
      mensagem.textContent = 'Seu carrinho está vazio.';
      botao.disabled = false;
      return;
    }

    try {
      const resposta = await fetch(`${API_URL}/api/pedidos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idFormaPagamento: etapa.formaId,
          idFrete: etapa.freteId,
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
      if (!resposta.ok) throw new Error(resultado && resultado.erro
        ? resultado.erro
        : `Não foi possível registrar o pedido (HTTP ${resposta.status}).`);

      localStorage.removeItem(CHAVE_CARRINHO);
      sessionStorage.removeItem('bellemi_pagamento_etapa');
      mensagem.textContent = nomePagina.endsWith('/pix.html')
        ? `Pedido #${resultado.id} registrado e aguardando confirmação do Pix. Abrindo seus pedidos...`
        : `Pedido #${resultado.id} registrado. Abrindo seus pedidos...`;
      setTimeout(() => location.replace(new URL('../Pedidos/pedidos.html', location.href).href), 1000);
    } catch (erro) {
      console.error('Erro ao finalizar pedido:', erro);
      mensagem.textContent = erro instanceof TypeError
        ? 'Não consegui acessar o servidor.'
        : erro.message;
      botao.disabled = false;
    }
  }

  const nomePagina = location.pathname.toLowerCase();

  if (nomePagina.endsWith('/pix.html')) {
    const imagemPix = document.createElement('img');
    const codigoPix = document.getElementById('pixCopiaECola');
    const botaoCopiar = document.getElementById('copiarPix');
    const areaQrCode = document.getElementById('qrcodePix');

    async function carregarPix() {
      botao.disabled = true;
      mensagem.textContent = 'Gerando seu QR Code Pix...';
      try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '[]');
        const carrinho = Array.isArray(salvo) ? salvo.filter(item =>
          item && Number.isInteger(Number(item.id)) && Number(item.id) > 0 &&
          Number.isInteger(Number(item.qtd)) && Number(item.qtd) > 0
        ) : [];
        if (!carrinho.length) throw new Error('Seu carrinho está vazio.');

        const resposta = await fetch(`${API_URL}/api/pix/qrcode`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idFrete: Number(etapa.freteId),
            idFormaPagamento: Number(etapa.formaId),
            itens: carrinho.map(item => ({ id: Number(item.id), quantidade: Number(item.qtd) }))
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
            : `Não foi possível gerar o Pix (HTTP ${resposta.status}).`);
        }
        if (
          !resultado ||
          typeof resultado.qrCode !== 'string' ||
          !resultado.qrCode.startsWith('data:image/png;base64,') ||
          typeof resultado.pixCopiaECola !== 'string' ||
          !Number.isFinite(Number(resultado.total))
        ) {
          throw new Error('O servidor retornou dados Pix inválidos.');
        }

        const totalPix = Number(resultado.total);
        imagemPix.src = resultado.qrCode;
        imagemPix.alt = `QR Code Pix no valor de ${reais(totalPix)}`;
        areaQrCode.replaceChildren(imagemPix);
        codigoPix.value = resultado.pixCopiaECola;
        codigoPix.hidden = false;
        botaoCopiar.hidden = false;
        document.getElementById('valorPix').textContent = reais(totalPix);
        mensagem.textContent = '';
        botao.disabled = false;
      } catch (erro) {
        console.error('Erro ao gerar QR Code Pix:', erro);
        mensagem.textContent = erro instanceof TypeError
          ? 'Não consegui acessar o servidor.'
          : erro.message;
      }
    }

    botaoCopiar.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codigoPix.value);
        mensagem.textContent = 'Código Pix copiado.';
      } catch (erro) {
        codigoPix.focus();
        codigoPix.select();
        mensagem.textContent = 'Selecione o código acima e copie para usar no app do seu banco.';
      }
    });

    carregarPix();
    botao.addEventListener('click', () => registrarPedido({}));
  }

  if (nomePagina.endsWith('/boleto.html')) {
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 3);
    document.getElementById('valorBoleto').textContent = reais(etapa.total);
    document.getElementById('vencimentoBoleto').textContent = vencimento.toLocaleDateString('pt-BR');
    botao.addEventListener('click', () => registrarPedido({}));
  }

  if (nomePagina.endsWith('/cartao.html')) {
    document.getElementById('tituloCartao').textContent = etapa.formaNome;
    document.getElementById('valorCartao').textContent = reais(etapa.total);
    const ano = document.getElementById('ano');
    ano.min = String(new Date().getFullYear());
    ano.max = String(new Date().getFullYear() + 30);

    let cartaoSalvo = null;
    async function consultarCartao() {
      try {
        const resposta = await fetch(`${API_URL}/api/pedidos/cartoes`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (!resposta.ok) return;
        const lista = await resposta.json();
        if (!Array.isArray(lista)) return;
        const tipo = etapa.formaNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('credito')
          ? 'CREDITO'
          : 'DEBITO';
        const agora = new Date();
        cartaoSalvo = lista.find(cartao =>
          cartao.tipo_cartao === tipo &&
          (cartao.ano_validade > agora.getFullYear() ||
            (cartao.ano_validade === agora.getFullYear() && cartao.mes_validade >= agora.getMonth() + 1))
        ) || null;

        if (cartaoSalvo) {
          const resumo = document.getElementById('cartaoSalvo');
          resumo.textContent = `${cartaoSalvo.bandeira} •••• ${cartaoSalvo.ultimos_digitos} — validade ${String(cartaoSalvo.mes_validade).padStart(2, '0')}/${cartaoSalvo.ano_validade}`;
          resumo.hidden = false;
        } else {
          document.getElementById('formCartao').hidden = false;
        }
      } catch (erro) {
        document.getElementById('formCartao').hidden = false;
      }
    }

    consultarCartao();
    botao.addEventListener('click', () => {
      if (cartaoSalvo) {
        registrarPedido({ idCartao: cartaoSalvo.id });
        return;
      }

      const form = document.getElementById('formCartao');
      if (!form.reportValidity()) return;
      registrarPedido({
        cartao: {
          nomeTitular: document.getElementById('nomeTitular').value.trim(),
          ultimosDigitos: document.getElementById('ultimosDigitos').value,
          bandeira: document.getElementById('bandeira').value,
          mesValidade: Number(document.getElementById('mes').value),
          anoValidade: Number(document.getElementById('ano').value)
        }
      });
    });
  }
})();
