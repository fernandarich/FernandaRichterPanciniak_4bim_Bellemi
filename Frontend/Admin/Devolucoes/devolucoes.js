(() => {
  const API_URL = `http://${location.hostname || 'localhost'}:3000/api`;
  const tabela = document.getElementById('tabelaDevolucoes');
  const mensagem = document.getElementById('mensagemDevolucoes');

  function mostrarLinhas(devolucoes) {
    tabela.replaceChildren();
    if (!devolucoes.length) {
      const linha = document.createElement('tr');
      const celula = document.createElement('td');
      celula.colSpan = 8;
      celula.textContent = 'Ainda não há solicitações de devolução.';
      linha.append(celula);
      tabela.append(linha);
      mensagem.textContent = '0 solicitações.';
      return;
    }

    for (const devolucao of devolucoes) {
      const linha = document.createElement('tr');
      const valores = [
        devolucao.id,
        `#${devolucao.pedido}`,
        devolucao.cliente,
        devolucao.data_solicitacao,
        devolucao.motivo || 'Não informado',
        devolucao.status || 'Pendente',
        devolucao.status_pedido || 'Indisponível'
      ];
      for (const valor of valores) {
        const celula = document.createElement('td');
        celula.textContent = valor;
        linha.append(celula);
      }
      const celulaAcao = document.createElement('td');
      if (String(devolucao.status || 'Pendente').toLocaleLowerCase('pt-BR') === 'pendente') {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'dv-aceitar';
        botao.dataset.aceitarDevolucao = devolucao.id;
        botao.textContent = 'Aceitar devolução';
        celulaAcao.append(botao);
      } else {
        celulaAcao.textContent = '—';
      }
      linha.append(celulaAcao);
      tabela.append(linha);
    }
    mensagem.textContent = `${devolucoes.length} solicitação(ões) de devolução.`;
  }

  async function carregarDevolucoes() {
    mensagem.textContent = 'Carregando devoluções...';
    try {
      const resposta = await fetch(`${API_URL}/admin/devolucoes`, {
        credentials: 'include',
        cache: 'no-store'
      });
      if (resposta.status === 401) {
        location.replace(new URL('../../Login/login.html', location.href).href);
        return;
      }
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(dados?.erro || `Não foi possível carregar as devoluções (HTTP ${resposta.status}).`);
      mostrarLinhas(dados);
    } catch (erro) {
      const linha = document.createElement('tr');
      const celula = document.createElement('td');
      celula.colSpan = 8;
      celula.textContent = 'Não foi possível carregar as devoluções.';
      linha.append(celula);
      tabela.replaceChildren(linha);
      mensagem.textContent = erro.message;
    }
  }

  tabela.addEventListener('click', async (evento) => {
    const botao = evento.target.closest('[data-aceitar-devolucao]');
    if (!botao) return;
    botao.disabled = true;
    mensagem.textContent = 'Atualizando solicitação...';
    try {
      const resposta = await fetch(`${API_URL}/admin/devolucoes/${encodeURIComponent(botao.dataset.aceitarDevolucao)}/aceitar`, {
        method: 'PATCH',
        credentials: 'include',
        cache: 'no-store'
      });
      if (resposta.status === 401) {
        location.replace(new URL('../../Login/login.html', location.href).href);
        return;
      }
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(dados?.erro || `Não foi possível aceitar a devolução (HTTP ${resposta.status}).`);
      await carregarDevolucoes();
      mensagem.textContent = `A devolução do pedido #${dados.pedido} foi aceita.`;
    } catch (erro) {
      mensagem.textContent = erro.message;
      botao.disabled = false;
    }
  });

  carregarDevolucoes();
})();
