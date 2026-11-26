(() => {
  const API_URL = `http://${location.hostname || 'localhost'}:3000/api`;
  const tabela = document.getElementById('tabelaClientes');
  const modal = document.getElementById('modalCliente');
  const formulario = document.getElementById('formCliente');
  const busca = document.getElementById('buscarCliente');
  const mensagem = document.getElementById('mensagem');
  const mensagemModal = document.getElementById('mensagemModal');
  let botaoAnterior = null;
  let clientes = [];
  let modoModal = 'editar';

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, { credentials: 'include', cache: 'no-store', ...opcoes });
    if (resposta.status === 401) {
      location.replace(new URL('../../Login/login.html', location.href).href);
      throw new Error('Sua sessão expirou. Entre novamente.');
    }
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(dados?.erro || `Não foi possível concluir (HTTP ${resposta.status}).`);
    return dados;
  }

  function mostrarVazio(texto) {
    tabela.replaceChildren();
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.colSpan = 5;
    celula.textContent = texto;
    linha.append(celula);
    tabela.append(linha);
  }

  function clientesFiltrados() {
    const termo = busca.value.trim().toLocaleLowerCase('pt-BR');
    return clientes.filter(cliente => [cliente.nome, cliente.cpf, cliente.email, cliente.telefone]
      .some(valor => String(valor || '').toLocaleLowerCase('pt-BR').includes(termo)));
  }

  function desenharClientes(lista = clientesFiltrados()) {
    tabela.replaceChildren();
    if (!lista.length) {
      mostrarVazio(clientes.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.');
      return;
    }
    for (const cliente of lista) {
      const linha = document.createElement('tr');
      for (const valor of [cliente.nome, cliente.cpf, cliente.email, cliente.telefone || '—']) {
        const celula = document.createElement('td');
        celula.textContent = valor;
        linha.append(celula);
      }
      const acoes = document.createElement('td');
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.className = 'btn-modificar';
      editar.textContent = 'Modificar detalhes';
      editar.dataset.cpf = cliente.cpf;
      const excluir = document.createElement('button');
      excluir.type = 'button';
      excluir.className = 'btn-secondary btn-excluir';
      excluir.textContent = 'Excluir';
      excluir.dataset.cpf = cliente.cpf;
      acoes.append(editar, excluir);
      linha.append(acoes);
      tabela.append(linha);
    }
  }

  async function carregarClientes() {
    mensagem.textContent = 'Carregando clientes...';
    try {
      clientes = await requisicao(`${API_URL}/admin/clientes`);
      desenharClientes();
      mensagem.textContent = `${clientes.length} cliente(s) cadastrado(s).`;
    } catch (erro) {
      mostrarVazio('Não foi possível carregar os clientes.');
      mensagem.textContent = erro.message;
    }
  }

  function abrirModal(modo, cliente = null, disparador = null) {
    modoModal = modo;
    botaoAnterior = disparador;
    formulario.reset();
    formulario.elements.cpf.readOnly = modo === 'editar';
    document.getElementById('avisoCpf').hidden = modo === 'novo';
    document.getElementById('campoSenhaCliente').hidden = modo !== 'novo';
    document.getElementById('campoRendaCliente').hidden = modo !== 'novo';
    formulario.elements.senha.required = modo === 'novo';
    formulario.elements.renda.required = modo === 'novo';
    document.getElementById('tituloModalCliente').textContent = modo === 'novo' ? 'Novo cliente' : 'Modificar detalhes';
    document.getElementById('subtituloModalCliente').textContent = modo === 'novo'
      ? 'Preencha os dados para cadastrar um cliente.'
      : 'Atualize as informações do cliente.';
    document.getElementById('btnSalvarCliente').textContent = modo === 'novo' ? 'Cadastrar cliente' : 'Salvar alterações';
    if (cliente) {
      formulario.elements.nome.value = cliente.nome || '';
      formulario.elements.cpf.value = cliente.cpf || '';
      formulario.elements.email.value = cliente.email || '';
      formulario.elements.telefone.value = cliente.telefone || '';
    }
    mensagemModal.textContent = '';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    formulario.elements.nome.focus();
  }

  function fecharModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    botaoAnterior?.focus();
  }

  async function excluirCliente(cpf, botao) {
    const cliente = clientes.find(item => item.cpf === cpf);
    if (!window.confirm(`Deseja excluir o cadastro de ${cliente?.nome || 'este cliente'}?`)) return;
    botao.disabled = true;
    try {
      await requisicao(`${API_URL}/admin/clientes/${encodeURIComponent(cpf)}`, { method: 'DELETE' });
      clientes = clientes.filter(item => item.cpf !== cpf);
      desenharClientes();
      mensagem.textContent = 'Cadastro do cliente excluído.';
    } catch (erro) {
      mensagem.textContent = erro.message;
      botao.disabled = false;
    }
  }

  document.getElementById('btnNovoCliente').addEventListener('click', evento => abrirModal('novo', null, evento.currentTarget));
  tabela.addEventListener('click', evento => {
    const editar = evento.target.closest('.btn-modificar');
    if (editar) {
      abrirModal('editar', clientes.find(item => item.cpf === editar.dataset.cpf), editar);
      return;
    }
    const excluir = evento.target.closest('.btn-excluir');
    if (excluir) excluirCliente(excluir.dataset.cpf, excluir);
  });

  document.getElementById('btnFecharModal').addEventListener('click', fecharModal);
  document.getElementById('btnCancelar').addEventListener('click', fecharModal);
  modal.addEventListener('click', evento => { if (evento.target === modal) fecharModal(); });
  document.addEventListener('keydown', evento => { if (evento.key === 'Escape' && !modal.hidden) fecharModal(); });
  document.getElementById('btnLimpar').addEventListener('click', () => {
    busca.value = '';
    desenharClientes();
    mensagem.textContent = `${clientes.length} cliente(s) cadastrado(s).`;
    busca.focus();
  });
  busca.addEventListener('input', () => {
    const encontrados = clientesFiltrados();
    desenharClientes(encontrados);
    mensagem.textContent = `${encontrados.length} cliente(s) encontrado(s).`;
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const botaoSalvar = formulario.querySelector('[type="submit"]');
    botaoSalvar.disabled = true;
    mensagemModal.textContent = modoModal === 'novo' ? 'Cadastrando cliente...' : 'Salvando alterações...';
    try {
      if (modoModal === 'novo') {
        const criado = await requisicao(`${API_URL}/admin/clientes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        clientes.push(criado);
      } else {
        const atualizado = await requisicao(`${API_URL}/admin/clientes/${encodeURIComponent(dados.cpf)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: dados.nome, email: dados.email, telefone: dados.telefone })
        });
        clientes = clientes.map(cliente => cliente.cpf === atualizado.cpf ? atualizado : cliente);
      }
      desenharClientes();
      mensagem.textContent = modoModal === 'novo' ? 'Cliente cadastrado.' : 'Dados do cliente atualizados.';
      fecharModal();
    } catch (erro) {
      mensagemModal.textContent = erro.message;
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  carregarClientes();
})();
