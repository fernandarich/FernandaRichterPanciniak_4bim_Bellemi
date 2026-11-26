// WhatsApp: troque o número abaixo (55 + DDD + número, só dígitos)
const NUMERO_WHATSAPP = '5544998236318';
const API_URL = `http://${location.hostname || 'localhost'}:3000`;
const btnConta = document.getElementById('btnConta');

if (btnConta) {
  const rotuloConta = btnConta.querySelector('.rotulo');
  let usuarioAtual = null;

  function mostrarContaLogada(usuario) {
    usuarioAtual = usuario;
    btnConta.classList.add('logado');
    rotuloConta.textContent = `Olá, ${usuario.nome}`;
    btnConta.title = 'Ver informações da conta';
    btnConta.setAttribute('aria-label', `Logado como ${usuario.nome}. Ver informações da conta.`);
  }

  function criarCampo(rotulo, tipo, nome, atributos) {
    const label = document.createElement('label');
    label.textContent = rotulo;
    const input = document.createElement('input');
    input.type = tipo;
    input.name = nome;
    Object.entries(atributos || {}).forEach(([chave, valor]) => {
      input.setAttribute(chave, valor);
    });
    label.append(input);
    return { label, input };
  }

  const dialogoConta = document.createElement('dialog');
  dialogoConta.className = 'modal-conta';
  dialogoConta.setAttribute('aria-labelledby', 'tituloModalConta');

  const cabecalhoConta = document.createElement('header');
  cabecalhoConta.className = 'modal-conta-cabecalho';
  const tituloConta = document.createElement('h2');
  tituloConta.id = 'tituloModalConta';
  tituloConta.textContent = 'Minha conta';
  const fecharConta = document.createElement('button');
  fecharConta.type = 'button';
  fecharConta.className = 'modal-conta-fechar';
  fecharConta.setAttribute('aria-label', 'Fechar informações da conta');
  fecharConta.textContent = '×';
  cabecalhoConta.append(tituloConta, fecharConta);

  const dadosConta = document.createElement('div');
  dadosConta.className = 'modal-conta-dados';
  const nomeConta = document.createElement('p');
  const cpfConta = document.createElement('p');
  const emailConta = document.createElement('p');
  const telefoneConta = document.createElement('p');
  dadosConta.append(nomeConta, cpfConta, emailConta, telefoneConta);

  const formularioConta = document.createElement('form');
  formularioConta.className = 'modal-conta-form';
  const introducaoFormulario = document.createElement('div');
  introducaoFormulario.className = 'modal-conta-form-intro';
  const tituloFormulario = document.createElement('h3');
  tituloFormulario.textContent = 'Seus dados';
  const ajudaFormulario = document.createElement('p');
  ajudaFormulario.textContent = 'Atualize seu e-mail ou telefone. Confirme com sua senha atual para salvar.';
  introducaoFormulario.append(tituloFormulario, ajudaFormulario);
  const email = criarCampo('E-mail', 'email', 'email', {
    maxlength: '250',
    autocomplete: 'email',
    required: ''
  });
  const telefone = criarCampo('Telefone', 'tel', 'telefone', {
    maxlength: '20',
    autocomplete: 'tel'
  });
  const senhaAtual = criarCampo('Senha atual para confirmar as alterações', 'password', 'senhaAtual', {
    autocomplete: 'current-password',
    required: ''
  });
  const botoesFormulario = document.createElement('div');
  botoesFormulario.className = 'modal-conta-acoes';
  const salvarConta = document.createElement('button');
  salvarConta.type = 'submit';
  salvarConta.className = 'botao';
  salvarConta.textContent = 'Salvar alterações';
  const cancelarEdicao = document.createElement('button');
  cancelarEdicao.type = 'button';
  cancelarEdicao.className = 'botao suave';
  cancelarEdicao.textContent = 'Cancelar';
  botoesFormulario.append(salvarConta, cancelarEdicao);
  formularioConta.append(introducaoFormulario, email.label, telefone.label, senhaAtual.label, botoesFormulario);
  formularioConta.hidden = true;

  const mensagemConta = document.createElement('p');
  mensagemConta.className = 'modal-conta-mensagem';
  mensagemConta.setAttribute('role', 'status');
  mensagemConta.setAttribute('aria-live', 'polite');
  const acoesConta = document.createElement('div');
  acoesConta.className = 'modal-conta-acoes';
  const modificarConta = document.createElement('button');
  modificarConta.type = 'button';
  modificarConta.className = 'botao';
  modificarConta.textContent = 'Modificar informações';
  const sairConta = document.createElement('button');
  sairConta.type = 'button';
  sairConta.className = 'botao suave';
  sairConta.textContent = 'Sair da conta';
  acoesConta.append(modificarConta, sairConta);
  dialogoConta.append(cabecalhoConta, dadosConta, formularioConta, mensagemConta, acoesConta);
  document.body.append(dialogoConta);

  function preencherDadosConta(dados) {
    nomeConta.replaceChildren(document.createTextNode('Nome: '), document.createTextNode(dados.nome));
    cpfConta.replaceChildren(document.createTextNode('CPF: '), document.createTextNode(dados.cpf));
    emailConta.replaceChildren(document.createTextNode('E-mail: '), document.createTextNode(dados.email));
    telefoneConta.replaceChildren(
      document.createTextNode('Telefone: '),
      document.createTextNode(dados.telefone || 'Não informado')
    );
    email.input.value = dados.email;
    telefone.input.value = dados.telefone || '';
  }

  function mostrarModoEdicao(editar) {
    dadosConta.hidden = editar;
    formularioConta.hidden = !editar;
    acoesConta.hidden = editar;
    dialogoConta.classList.toggle('editando', editar);
    tituloConta.textContent = editar ? 'Editar informações' : 'Minha conta';
    mensagemConta.textContent = '';
    if (editar) {
      senhaAtual.input.value = '';
      senhaAtual.input.focus();
    } else {
      senhaAtual.input.value = '';
    }
  }

  async function abrirConta() {
    dialogoConta.showModal();
    dadosConta.hidden = true;
    formularioConta.hidden = true;
    acoesConta.hidden = true;
    mensagemConta.textContent = 'Carregando informações da conta...';
    modificarConta.disabled = true;
    let dadosCarregados = false;

    try {
      const resposta = await fetch(`${API_URL}/api/conta`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (resposta.status === 401) {
        dialogoConta.close();
        location.href = new URL('../../Login/login.html', location.href).href;
        return;
      }
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || `HTTP ${resposta.status}`);
      if (
        !dados ||
        typeof dados.cpf !== 'string' ||
        typeof dados.nome !== 'string' ||
        typeof dados.email !== 'string' ||
        (dados.telefone !== null && typeof dados.telefone !== 'string')
      ) {
        throw new Error('O servidor retornou informações de conta inválidas.');
      }

      preencherDadosConta(dados);
      dadosCarregados = true;
      dadosConta.hidden = false;
      acoesConta.hidden = false;
      mensagemConta.textContent = '';
    } catch (erro) {
      console.error('Erro ao carregar informações da conta:', erro);
      mensagemConta.textContent = erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Tente novamente.'
        : erro.message;
      acoesConta.hidden = false;
    } finally {
      modificarConta.disabled = !dadosCarregados;
    }
  }

  fecharConta.addEventListener('click', () => dialogoConta.close());
  dialogoConta.addEventListener('close', () => {
    senhaAtual.input.value = '';
    mostrarModoEdicao(false);
    btnConta.focus();
  });
  dialogoConta.addEventListener('click', event => {
    if (event.target === dialogoConta) dialogoConta.close();
  });
  modificarConta.addEventListener('click', () => mostrarModoEdicao(true));
  cancelarEdicao.addEventListener('click', () => dialogoConta.close());

  formularioConta.addEventListener('submit', async event => {
    event.preventDefault();
    salvarConta.disabled = true;
    mensagemConta.textContent = 'Salvando alterações...';

    try {
      const resposta = await fetch(`${API_URL}/api/conta`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.input.value,
          telefone: telefone.input.value,
          senhaAtual: senhaAtual.input.value
        })
      });
      const dados = await resposta.json();
      if (resposta.status === 401 && dados.codigo !== 'SENHA_INCORRETA') {
        dialogoConta.close();
        location.href = new URL('../../Login/login.html', location.href).href;
        return;
      }
      if (!resposta.ok) throw new Error(dados.erro || `HTTP ${resposta.status}`);

      preencherDadosConta(dados);
      mostrarModoEdicao(false);
      mensagemConta.textContent = 'Informações atualizadas com sucesso.';
    } catch (erro) {
      console.error('Erro ao atualizar informações da conta:', erro);
      mensagemConta.textContent = erro instanceof TypeError
        ? 'Não consegui acessar o servidor. Tente novamente.'
        : erro.message;
    } finally {
      salvarConta.disabled = false;
    }
  });

  sairConta.addEventListener('click', async () => {
    sairConta.disabled = true;
    try {
      const resposta = await fetch(`${API_URL}/api/sessao`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      dialogoConta.close();
      location.reload();
    } catch (erro) {
      console.error('Erro ao encerrar sessão:', erro);
      mensagemConta.textContent = 'Não foi possível sair da conta. Tente novamente.';
      sairConta.disabled = false;
    }
  });

  function adicionarLinkMeusPedidos() {
    const lista = document.querySelector('.menu ul');
    if (!lista || lista.querySelector('[data-link-pedidos]')) return;

    const item = document.createElement('li');
    const link = document.createElement('a');
    const icone = document.createElement('span');
    item.dataset.linkPedidos = '';
    link.className = 'item';
    link.href = '/FernandaRichterPanciniak_4bim_Bellemi/Frontend/Cliente/Pedidos/pedidos.html';
    link.textContent = 'Meus Pedidos';
    link.prepend(icone);
    if (location.pathname.toLowerCase().endsWith('/pedidos.html')) {
      link.setAttribute('aria-current', 'page');
    }
    item.append(link);

    const divisor = lista.querySelector('.divisor');
    lista.insertBefore(item, divisor || null);
  }

  fetch(`${API_URL}/api/sessao`, { credentials: 'include' })
    .then(async resposta => {
      if (!resposta.ok) return;
      const dados = await resposta.json();
      mostrarContaLogada(dados.usuario);
      if (dados.usuario.perfil === 'cliente') adicionarLinkMeusPedidos();
    })
    .catch(erro => {
      console.error('Erro ao verificar o estado do login:', erro);
    });

  btnConta.addEventListener('click', async () => {
    if (!usuarioAtual) {
      location.href = new URL('../../Login/login.html', location.href).href;
      return;
    }

    abrirConta();
  });
}

document.querySelectorAll('.zap').forEach(a => {
  a.href = 'https://wa.me/' + NUMERO_WHATSAPP + '?text=' + encodeURIComponent(a.dataset.msg);
  a.target = '_blank';
  a.rel = 'noopener';
});

// Carrossel: 3 cartões, o do meio fica em destaque
const palco = document.getElementById('palco');
if (palco) {
  const slides = [...palco.children];
  const pontos = document.getElementById('pontos');
  const n = slides.length;
  let atual = 0;

  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Ver o produto ' + (i + 1));
    b.addEventListener('click', () => ir(i));
    pontos.appendChild(b);
  });

  function ir(i) {
    atual = (i + n) % n;
    desenhar();
  }
  function desenhar() {
    slides.forEach((s, i) => {
      const d = (i - atual + n) % n;
      const pos = d === 0 ? 'centro' : d === 1 ? 'dir' : d === n - 1 ? 'esq' : 'fora';
      s.dataset.pos = pos;
      s.setAttribute('aria-hidden', pos !== 'centro');
      // só os botões do cartão do meio entram na navegação por teclado
      s.querySelectorAll('a, button').forEach(el => el.tabIndex = pos === 'centro' ? 0 : -1);
      // clicar em um cartão lateral traz ele para o meio
      s.onclick = pos === 'centro' || pos === 'fora' ? null : () => ir(i);
    });
    [...pontos.children].forEach((b, i) => b.setAttribute('aria-current', i === atual));
  }
  document.getElementById('anterior').addEventListener('click', () => ir(atual - 1));
  document.getElementById('proximo').addEventListener('click', () => ir(atual + 1));

  // deslizar com o dedo
  let x0 = null;
  palco.addEventListener('pointerdown', e => { x0 = e.clientX; });
  palco.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 50) ir(atual + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  palco.addEventListener('pointercancel', () => { x0 = null; });

  // setas do teclado
  document.querySelector('.carrossel').addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') ir(atual - 1);
    if (e.key === 'ArrowRight') ir(atual + 1);
  });
  desenhar();
}


// ---------- Carrinho ----------
const CHAVE = 'bellemi_carrinho';
let carrinho = [];
try { carrinho = (JSON.parse(localStorage.getItem(CHAVE)) || []).filter(p => p && p.id && p.preco >= 0 && p.qtd > 0); } catch (e) { carrinho = []; }

const reais = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gaveta = document.getElementById('carrinho');
const fundoCarrinho = document.getElementById('fundoCarrinho');
const listaCarrinho = document.getElementById('carrinhoLista');
const btnCarrinho = document.getElementById('btnCarrinho');
const contador = document.getElementById('contador');

function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(carrinho)); } catch (e) { } }

function desenharCarrinho() {
  const total = carrinho.reduce((s, p) => s + p.preco * p.qtd, 0);
  const qtd = carrinho.reduce((s, p) => s + p.qtd, 0);
  contador.textContent = qtd;
  contador.hidden = qtd === 0;
  document.getElementById('carrinhoTotal').textContent = reais(total);
  document.getElementById('finalizar').disabled = qtd === 0;
  listaCarrinho.innerHTML = qtd === 0
    ? '<li class="vazio">Seu carrinho está vazio.<br><a class="botao suave" href="#categorias" data-fechar>Ver categorias</a></li>'
    : carrinho.map(p => `
      <li class="item-carrinho">
        <div class="info"><strong>${esc(p.nome)}</strong><span>${reais(p.preco)}</span></div>
        <div class="qtd">
          <button data-acao="menos" data-id="${esc(p.id)}" aria-label="Diminuir quantidade">&minus;</button>
          <span>${p.qtd}</span>
          <button data-acao="mais" data-id="${esc(p.id)}" aria-label="Aumentar quantidade">+</button>
        </div>
        <button class="remover" data-acao="remover" data-id="${esc(p.id)}" aria-label="Remover ${esc(p.nome)}">&times;</button>
      </li>`).join('');
}

function abrirCarrinho() {
  gaveta.inert = false;
  gaveta.setAttribute('aria-hidden', 'false');
  gaveta.classList.add('aberto');
  fundoCarrinho.classList.add('aberto');
  btnCarrinho.setAttribute('aria-expanded', 'true');
  document.getElementById('fecharCarrinho').focus();
}
function fecharCarrinho() {
  gaveta.classList.remove('aberto');
  fundoCarrinho.classList.remove('aberto');
  gaveta.setAttribute('aria-hidden', 'true');
  gaveta.inert = true;
  btnCarrinho.setAttribute('aria-expanded', 'false');
}

btnCarrinho.addEventListener('click', abrirCarrinho);
document.getElementById('fecharCarrinho').addEventListener('click', () => { fecharCarrinho(); btnCarrinho.focus(); });
fundoCarrinho.addEventListener('click', fecharCarrinho);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && gaveta.classList.contains('aberto')) { fecharCarrinho(); btnCarrinho.focus(); } });

// Delegação também atende aos produtos inseridos depois do carregamento da página.
document.addEventListener('click', e => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  const { id, nome, preco } = b.dataset;
  const existente = carrinho.find(p => p.id === id);
  if (existente) existente.qtd++;
  else carrinho.push({ id, nome, preco: parseFloat(preco), qtd: 1 });
  salvar(); desenharCarrinho();
});

// mais, menos e remover dentro do carrinho
listaCarrinho.addEventListener('click', e => {
  if (e.target.closest('[data-fechar]')) { fecharCarrinho(); return; }
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const p = carrinho.find(x => x.id === b.dataset.id);
  if (!p) return;
  if (b.dataset.acao === 'mais') p.qtd++;
  if (b.dataset.acao === 'menos') p.qtd--;
  if (b.dataset.acao === 'remover') p.qtd = 0;
  carrinho = carrinho.filter(x => x.qtd > 0);
  salvar(); desenharCarrinho();
});

document.getElementById('finalizar').addEventListener('click', () => {
  location.href = new URL('../../Login/login.html?proxima=pagamento', location.href).href;
});
const botaoFinalizar = document.getElementById('finalizar');
botaoFinalizar.classList.add('botao');
desenharCarrinho();

// Menu lateral em telas pequenas e grandes
const menu = document.getElementById('menu');
const botao = document.getElementById('menuBotao');
const botaoFecharMenu = document.getElementById('menuFechar');
const menuEmTelaPequena = window.matchMedia('(max-width: 800px)');

function definirMenuAberto(aberto) {
  menu.classList.toggle('aberto', aberto);
  document.body.classList.toggle('menu-fechado', !aberto);
  botao.setAttribute('aria-expanded', String(aberto));
  botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  menu.setAttribute('aria-hidden', String(!aberto));
  menu.inert = !aberto;
}

definirMenuAberto(!menuEmTelaPequena.matches);
botao.addEventListener('click', () => {
  const aberto = !menu.classList.contains('aberto');
  definirMenuAberto(aberto);
  if (aberto) botaoFecharMenu.focus();
});
botaoFecharMenu.addEventListener('click', () => {
  definirMenuAberto(false);
  botao.focus();
});
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  if (menuEmTelaPequena.matches) definirMenuAberto(false);
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuEmTelaPequena.matches && menu.classList.contains('aberto')) {
    definirMenuAberto(false);
    botao.focus();
  }
});
menuEmTelaPequena.addEventListener('change', () => {
  definirMenuAberto(!menuEmTelaPequena.matches);
});
