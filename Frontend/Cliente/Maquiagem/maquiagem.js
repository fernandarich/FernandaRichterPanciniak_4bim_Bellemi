// Página de produtos: busca os produtos no servidor e cria um card para cada um.
(function () {
  // ---------- Ajuste aqui ----------
  const API_URL = 'http://localhost:3000';   // endereço do seu servidor (o da porta do server.js)
  const PASTA_IMAGENS = '/FernandaRichterPanciniak_4bim_Bellemi/Frontend/img/';    // onde ficam as fotos (o banco guarda só o nome do arquivo)
  // ---------------------------------

  // A categoria da página vem do <body data-categoria="Maquiagem">. Para criar outra página
  // (Skincare, Cabelo...), copie o HTML e troque só esse valor.
  const CATEGORIA = document.body.dataset.categoria || '';
  const TITULO_CATEGORIA = document.body.dataset.titulo || CATEGORIA;

  const grade = document.getElementById('grade');
  const campo = document.getElementById('campoBusca');
  const limpar = document.getElementById('limparBusca');
  const filtros = document.getElementById('filtros');
  const ordenar = document.getElementById('ordenar');
  const contagem = document.getElementById('contagem');
  const titulo = document.getElementById('tituloProdutos');

  const url = new URLSearchParams(location.search);
  const estado = { busca: url.get('busca') || '', tipo: url.get('tipo') || '', ordem: url.get('ordem') || 'nome' };

  const degrades = [
    ['#F4C9D2', '#E39AB0'], ['#F6DCC8', '#E8A88F'], ['#E4D2EC', '#B79AD0'], ['#D6E6DC', '#94BFA6'],
  ];
  const moeda = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mesmo = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

  function caminhoImagem(img) {
    if (!img) return '';
    return /^(https?:)?\/\//.test(img) || img.startsWith('/') ? img : PASTA_IMAGENS + img;
  }

  // ---------- cards ----------
  function criarCard(p, i) {
    const [c1, c2] = degrades[Number(p.id) % degrades.length || 0] || degrades[i % 4];
    const esgotado = p.estoque !== undefined && p.estoque !== null && Number(p.estoque) <= 0;
    const foto = caminhoImagem(p.imagem);
    return `
      <article class="card">
        <div class="foto" style="background: linear-gradient(135deg, ${c1}, ${c2})">
          ${foto ? `<img src="${esc(foto)}" alt="${esc(p.nome)}" loading="lazy" onerror="this.remove()">` : ''}
          <span class="foto-placeholder" aria-hidden="true">&#127800;</span>
          ${p.subcategoria ? `<span class="tag">${esc(p.subcategoria)}</span>` : ''}
          ${esgotado ? '<div class="esgotado">Esgotado</div>' : ''}
        </div>
        <div class="corpo">
          <h3>${esc(p.nome)}</h3>
          ${p.descricao ? `<p class="desc">${esc(p.descricao)}</p>` : ''}
          <p class="preco">${moeda(p.preco)}</p>
          <button class="botao" ${esgotado ? 'disabled' : ''} data-add data-id="${esc(p.id)}" data-nome="${esc(p.nome)}" data-preco="${Number(p.preco)}">
            ${esgotado ? 'Indisponível' : 'Adicionar ao carrinho'}
          </button>
        </div>
      </article>`;
  }

  function mostrarEsqueletos() {
    grade.setAttribute('aria-busy', 'true');
    grade.innerHTML = Array.from({ length: 8 }, () => `
      <div class="card esqueleto"><div class="foto"></div>
        <div class="corpo"><div class="linha"></div><div class="linha curta"></div></div></div>`).join('');
  }

  // ---------- busca no servidor ----------
  let controle;
  async function buscar() {
    if (controle) controle.abort();            // cancela a busca anterior, se ainda estiver rodando
    controle = new AbortController();
    mostrarEsqueletos();
    atualizarTela();

    const q = new URLSearchParams({ categoria: CATEGORIA, ordem: estado.ordem });
    if (estado.busca) q.set('busca', estado.busca);
    if (estado.tipo) q.set('subcategoria', estado.tipo);

    try {
      const resp = await fetch(`${API_URL}/api/produtos?${q}`, { signal: controle.signal });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const produtos = await resp.json();
      grade.setAttribute('aria-busy', 'false');
      contagem.textContent = produtos.length === 1 ? '1 produto' : produtos.length + ' produtos';
      grade.innerHTML = produtos.length
        ? produtos.map(criarCard).join('')
        : `<div class="estado"><p>Não encontramos nenhum produto${estado.busca ? ' para “' + esc(estado.busca) + '”' : ''}.</p>
             <p>Tente outra palavra ou veja tudo de ${esc(CATEGORIA.toLowerCase())}.</p>
             <button class="botao suave" id="verTodos">Ver tudo</button></div>`;
    } catch (erro) {
      if (erro.name === 'AbortError') return;
      grade.setAttribute('aria-busy', 'false');
      contagem.textContent = '';
      grade.innerHTML = `<div class="estado"><p>Ops, não consegui carregar os produtos agora.</p>
        <p>Confira se o servidor está ligado e tente de novo.</p>
        <button class="botao" id="tentarDeNovo">Tentar de novo</button></div>`;
    }
  }

  // ---------- tipos (os botões de filtro vêm do banco: Base, Sombra, Batom...) ----------
  async function carregarTipos() {
    try {
      const resp = await fetch(`${API_URL}/api/subcategorias?categoria=${encodeURIComponent(CATEGORIA)}`);
      if (!resp.ok) throw new Error();
      const lista = await resp.json();
      if (!lista.length) { filtros.hidden = true; return; }
      filtros.innerHTML = [{ nome: '' }, ...lista].map(c =>
        `<button class="chip" data-tipo="${esc(c.nome)}" aria-pressed="false">${c.nome ? esc(c.nome) : 'Tudo'}</button>`).join('');
      atualizarTela();
    } catch (e) { filtros.hidden = true; /* sem tipos, a busca continua funcionando */ }
  }

  // ---------- deixa a tela e o endereço coerentes com o filtro atual ----------
  function atualizarTela() {
    campo.value = estado.busca;
    limpar.hidden = !estado.busca;
    ordenar.value = estado.ordem;
    filtros.querySelectorAll('.chip').forEach(c =>
      c.setAttribute('aria-pressed', mesmo(c.dataset.tipo, estado.tipo)));
    const q = new URLSearchParams();
    if (estado.busca) q.set('busca', estado.busca);
    if (estado.tipo) q.set('tipo', estado.tipo);
    if (estado.ordem !== 'nome') q.set('ordem', estado.ordem);
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
  }

  // ---------- eventos ----------
  let espera;
  campo.addEventListener('input', () => {        // espera a pessoa parar de digitar
    estado.busca = campo.value.trim();
    limpar.hidden = !campo.value;
    clearTimeout(espera);
    espera = setTimeout(buscar, 300);
  });
  campo.closest('form').addEventListener('submit', e => { e.preventDefault(); clearTimeout(espera); buscar(); });
  limpar.addEventListener('click', () => { estado.busca = ''; buscar(); campo.focus(); });
  ordenar.addEventListener('change', () => { estado.ordem = ordenar.value; buscar(); });
  filtros.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    estado.tipo = c.dataset.tipo;
    buscar();
  });
  grade.addEventListener('click', e => {
    if (e.target.closest('#verTodos')) { estado.busca = ''; estado.tipo = ''; buscar(); }
    if (e.target.closest('#tentarDeNovo')) buscar();
  });

  // título, aba e menu seguem a categoria da página
  titulo.textContent = TITULO_CATEGORIA || 'Produtos';
  document.title = (TITULO_CATEGORIA || 'Produtos') + ' | Bellemi';
  campo.placeholder = 'Buscar em ' + TITULO_CATEGORIA.toLowerCase() + '...';
  const paginaAtual = location.pathname.split('/').pop();
  document.querySelectorAll('.menu a.item').forEach(a => {
    if (a.getAttribute('href').split('?')[0].split('/').pop() === paginaAtual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  carregarTipos();
  buscar();
})();