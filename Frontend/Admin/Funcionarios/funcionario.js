(() => {
  const API_URL = `http://${location.hostname || 'localhost'}:3000/api`;
  const tabela = document.getElementById('tabelaFuncionarios');
  const modal = document.getElementById('modalFuncionario');
  const formulario = document.getElementById('formFuncionario');
  const busca = document.getElementById('buscarFuncionario');
  const mensagem = document.getElementById('mensagem');
  const mensagemModal = document.getElementById('mensagemModal');
  let funcionarios = [];
  let botaoAnterior = null;
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

  function formatarSalario(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function mostrarVazio(texto) {
    tabela.replaceChildren();
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.colSpan = 8;
    celula.textContent = texto;
    linha.append(celula);
    tabela.append(linha);
  }

  function funcionariosFiltrados() {
    const termo = busca.value.trim().toLocaleLowerCase('pt-BR');
    return funcionarios.filter(funcionario =>
      [funcionario.nome, funcionario.cpf, funcionario.email, funcionario.telefone, funcionario.cargo]
        .some(valor => String(valor || '').toLocaleLowerCase('pt-BR').includes(termo)));
  }

  function desenharFuncionarios(lista = funcionariosFiltrados()) {
    tabela.replaceChildren();
    if (!lista.length) {
      mostrarVazio(funcionarios.length ? 'Nenhum funcionário encontrado.' : 'Nenhum funcionário cadastrado.');
      return;
    }
    for (const funcionario of lista) {
      const linha = document.createElement('tr');
      const valores = [
        funcionario.nome,
        funcionario.cpf,
        funcionario.email,
        funcionario.telefone || '—',
        funcionario.cargo,
        formatarSalario(funcionario.salario),
        funcionario.comissao == null ? '—' : `${funcionario.comissao}%`
      ];
      for (const valor of valores) {
        const celula = document.createElement('td');
        celula.textContent = valor;
        linha.append(celula);
      }
      const acoes = document.createElement('td');
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.className = 'btn-modificar';
      editar.textContent = 'Modificar detalhes';
      editar.dataset.cpf = funcionario.cpf;
      const excluir = document.createElement('button');
      excluir.type = 'button';
      excluir.className = 'btn-secondary btn-excluir';
      excluir.textContent = 'Excluir';
      excluir.dataset.cpf = funcionario.cpf;
      acoes.append(editar, excluir);
      linha.append(acoes);
      tabela.append(linha);
    }
  }

  async function carregarFuncionarios() {
    mensagem.textContent = 'Carregando funcionários...';
    try {
      funcionarios = await requisicao(`${API_URL}/admin/funcionarios`);
      desenharFuncionarios();
      mensagem.textContent = `${funcionarios.length} funcionário(s) cadastrado(s).`;
    } catch (erro) {
      mostrarVazio('Não foi possível carregar os funcionários.');
      mensagem.textContent = erro.message;
    }
  }

  function abrirModal(modo, funcionario = null, disparador = null) {
    modoModal = modo;
    botaoAnterior = disparador;
    formulario.reset();
    formulario.elements.cpf.readOnly = modo === 'editar';
    document.getElementById('avisoCpf').hidden = modo === 'novo';
    document.getElementById('campoSenhaFuncionario').hidden = modo !== 'novo';
    formulario.elements.senha.required = modo === 'novo';
    document.getElementById('tituloModalFuncionario').textContent = modo === 'novo' ? 'Novo funcionário' : 'Modificar detalhes';
    document.getElementById('subtituloModalFuncionario').textContent = modo === 'novo'
      ? 'Preencha os dados pessoais e profissionais.'
      : 'Atualize as informações do funcionário.';
    document.getElementById('btnSalvarFuncionario').textContent = modo === 'novo' ? 'Cadastrar funcionário' : 'Salvar alterações';
    if (funcionario) {
      for (const campo of ['nome', 'cpf', 'email', 'telefone', 'cargo', 'salario', 'comissao']) {
        formulario.elements[campo].value = funcionario[campo] ?? '';
      }
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

  async function excluirFuncionario(cpf, botao) {
    const funcionario = funcionarios.find(item => item.cpf === cpf);
    if (!window.confirm(`Deseja excluir o cadastro de ${funcionario?.nome || 'este funcionário'}?`)) return;
    botao.disabled = true;
    try {
      await requisicao(`${API_URL}/admin/funcionarios/${encodeURIComponent(cpf)}`, { method: 'DELETE' });
      funcionarios = funcionarios.filter(item => item.cpf !== cpf);
      desenharFuncionarios();
      mensagem.textContent = 'Cadastro do funcionário excluído.';
    } catch (erro) {
      mensagem.textContent = erro.message;
      botao.disabled = false;
    }
  }

  document.getElementById('btnNovoFuncionario').addEventListener('click', evento => abrirModal('novo', null, evento.currentTarget));
  tabela.addEventListener('click', evento => {
    const editar = evento.target.closest('.btn-modificar');
    if (editar) {
      abrirModal('editar', funcionarios.find(item => item.cpf === editar.dataset.cpf), editar);
      return;
    }
    const excluir = evento.target.closest('.btn-excluir');
    if (excluir) excluirFuncionario(excluir.dataset.cpf, excluir);
  });

  document.getElementById('btnFecharModal').addEventListener('click', fecharModal);
  document.getElementById('btnCancelar').addEventListener('click', fecharModal);
  modal.addEventListener('click', evento => { if (evento.target === modal) fecharModal(); });
  document.addEventListener('keydown', evento => { if (evento.key === 'Escape' && !modal.hidden) fecharModal(); });
  busca.addEventListener('input', () => {
    const encontrados = funcionariosFiltrados();
    desenharFuncionarios(encontrados);
    mensagem.textContent = `${encontrados.length} funcionário(s) encontrado(s).`;
  });
  document.getElementById('btnLimpar').addEventListener('click', () => {
    busca.value = '';
    desenharFuncionarios();
    mensagem.textContent = `${funcionarios.length} funcionário(s) cadastrado(s).`;
    busca.focus();
  });

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const botaoSalvar = formulario.querySelector('[type="submit"]');
    botaoSalvar.disabled = true;
    mensagemModal.textContent = modoModal === 'novo' ? 'Cadastrando funcionário...' : 'Salvando alterações...';
    try {
      const corpo = {
        nome: dados.nome,
        cpf: dados.cpf,
        email: dados.email,
        telefone: dados.telefone,
        cargo: dados.cargo,
        salario: dados.salario,
        comissao: dados.comissao === '' ? null : dados.comissao
      };
      let resultado;
      if (modoModal === 'novo') {
        resultado = await requisicao(`${API_URL}/admin/funcionarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...corpo, senha: dados.senha })
        });
        funcionarios.push(resultado);
      } else {
        resultado = await requisicao(`${API_URL}/admin/funcionarios/${encodeURIComponent(dados.cpf)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo)
        });
        funcionarios = funcionarios.map(funcionario => funcionario.cpf === resultado.cpf ? resultado : funcionario);
      }
      desenharFuncionarios();
      mensagem.textContent = modoModal === 'novo' ? 'Funcionário cadastrado.' : 'Dados do funcionário atualizados.';
      fecharModal();
    } catch (erro) {
      mensagemModal.textContent = erro.message;
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  carregarFuncionarios();
})();
