(function () {
  const API_URL = `http://${location.hostname || 'localhost'}:3000/api/maquiagem-vegana/produtos`;
  const PASTA_IMAGENS = '/Frontend/img/';
  const grade = document.getElementById('grade');
  const campo = document.getElementById('campoBusca');
  const limpar = document.getElementById('limparBusca');
  const ordenar = document.getElementById('ordenar');
  const contagem = document.getElementById('contagem');

  const params = new URLSearchParams(location.search);
  const ordensPermitidas = ['nome', 'menor_preco', 'maior_preco'];
  const estado = {
    busca: (params.get('busca') || '').slice(0, 80),
    ordem: ordensPermitidas.includes(params.get('ordem')) ? params.get('ordem') : 'nome'
  };
  const degrades = [
    ['#D6E6DC', '#94BFA6'], ['#E4D2EC', '#B79AD0'], ['#F4C9D2', '#E39AB0'], ['#F6DCC8', '#E8A88F']
  ];
  const moeda = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = valor => String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caractere]));

  function caminhoImagem(imagem) {
    if (!imagem) return '';
    return /^(https?:)?\/\//.test(imagem) || imagem.startsWith('/')
      ? imagem
      : PASTA_IMAGENS + imagem;
  }

  function criarCard(produto, indice) {
    const cores = degrades[(Number(produto.id) || indice) % degrades.length];
    const esgotado = produto.estoque !== undefined && produto.estoque !== null && Number(produto.estoque) <= 0;
    const foto = caminhoImagem(produto.imagem);

    return `
      <article class="card">
        <div class="foto" style="background: linear-gradient(135deg, ${cores[0]}, ${cores[1]})">
          ${foto ? `<img src="${esc(foto)}" alt="${esc(produto.nome)}" loading="lazy" onerror="this.remove()">` : ''}
          <span aria-hidden="true">&#127804;</span>
          ${esgotado ? '<div class="esgotado">Esgotado</div>' : ''}
        </div>
        <div class="corpo">
          <h3>${esc(produto.nome)}</h3>
          ${produto.descricao ? `<p class="desc">${esc(produto.descricao)}</p>` : ''}
          <p class="preco">${moeda(produto.preco)}</p>
          <button class="botao" ${esgotado ? 'disabled' : ''} data-add data-id="${esc(produto.id)}"
            data-nome="${esc(produto.nome)}" data-preco="${Number(produto.preco)}">
            ${esgotado ? 'Indisponível' : 'Adicionar ao carrinho'}
          </button>
        </div>
      </article>`;
  }

  function mostrarCarregamento() {
    grade.setAttribute('aria-busy', 'true');
    grade.innerHTML = Array.from({ length: 8 }, () => `
      <div class="card esqueleto"><div class="foto"></div>
        <div class="corpo"><div class="linha"></div><div class="linha curta"></div></div></div>`).join('');
  }

  function atualizarEndereco() {
    const query = new URLSearchParams();
    if (estado.busca) query.set('busca', estado.busca);
    if (estado.ordem !== 'nome') query.set('ordem', estado.ordem);
    history.replaceState(null, '', location.pathname + (query.toString() ? `?${query}` : ''));
  }

  let controle;
  async function carregarProdutos() {
    if (controle) controle.abort();
    controle = new AbortController();
    mostrarCarregamento();
    atualizarEndereco();

    const query = new URLSearchParams({ ordem: estado.ordem });
    if (estado.busca) query.set('busca', estado.busca);

    try {
      const resposta = await fetch(`${API_URL}?${query}`, { signal: controle.signal });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const produtos = await resposta.json();
      if (!Array.isArray(produtos)) throw new Error('Resposta inválida do servidor');

      grade.setAttribute('aria-busy', 'false');
      contagem.textContent = produtos.length === 1 ? '1 produto' : `${produtos.length} produtos`;
      grade.innerHTML = produtos.length
        ? produtos.map(criarCard).join('')
        : `<div class="estado"><p>Não encontramos produtos veganos${estado.busca ? ` para “${esc(estado.busca)}”` : ''}.</p>
             <p>Tente outro nome ou limpe a busca para ver todos os produtos.</p>
             <button class="botao suave" id="verTodos">Ver todos</button></div>`;
    } catch (erro) {
      if (erro.name === 'AbortError') return;
      console.error('Erro ao carregar maquiagem vegana:', erro);
      grade.setAttribute('aria-busy', 'false');
      contagem.textContent = '';
      grade.innerHTML = `<div class="estado"><p>Não foi possível carregar os produtos agora.</p>
        <p>Confira se o servidor está ligado e tente novamente.</p>
        <button class="botao" id="tentarDeNovo">Tentar de novo</button></div>`;
    }
  }

  let espera;
  campo.value = estado.busca;
  limpar.hidden = !estado.busca;
  ordenar.value = estado.ordem;

  campo.addEventListener('input', () => {
    estado.busca = campo.value.trim().slice(0, 80);
    limpar.hidden = !estado.busca;
    clearTimeout(espera);
    espera = setTimeout(carregarProdutos, 300);
  });
  campo.closest('form').addEventListener('submit', evento => {
    evento.preventDefault();
    clearTimeout(espera);
    carregarProdutos();
  });
  limpar.addEventListener('click', () => {
    estado.busca = '';
    campo.value = '';
    limpar.hidden = true;
    carregarProdutos();
    campo.focus();
  });
  ordenar.addEventListener('change', () => {
    estado.ordem = ordenar.value;
    carregarProdutos();
  });
  grade.addEventListener('click', evento => {
    if (evento.target.closest('#verTodos')) {
      estado.busca = '';
      campo.value = '';
      limpar.hidden = true;
      carregarProdutos();
    }
    if (evento.target.closest('#tentarDeNovo')) carregarProdutos();
  });

  const paginaAtual = location.pathname.split('/').pop();
  document.querySelectorAll('.menu a.item').forEach(link => {
    if (link.getAttribute('href').split('?')[0].split('/').pop() === paginaAtual) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  carregarProdutos();
})();
