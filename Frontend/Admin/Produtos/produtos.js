(function () {
    const API_URL = `http://${location.hostname || 'localhost'}:3000/api`;
    const PASTA_IMAGENS = '/Frontend/img/';
    const IMAGEM_PADRAO = '../../img/silhueta.png';
    const inputId = document.getElementById('inputId_produto');
    const inputNome = document.getElementById('inputNome_produto');
    const inputDescricao = document.getElementById('inputDescricao_produto');
    const inputPreco = document.getElementById('inputpreco_produto');
    const inputEstoque = document.getElementById('inputEstoque_produto');
    const selectCategoria = document.getElementById('selectCategoria_produto');
    const inputImagem = document.getElementById('inputImagem');
    const imagemProduto = document.getElementById('imgProduto');
    const aviso = document.getElementById('divAviso');
    const listaProdutos = document.getElementById('outputSaida');
    let modo = 'busca';
    let produtoSelecionado = null;
    let categoriasCarregadas = false;
    let urlImagemPreview = '';

    function mostrarAviso(mensagem, erro) {
        aviso.textContent = mensagem;
        aviso.classList.toggle('erro', Boolean(erro));
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

        const dados = await resposta.json().catch(() => null);
        if (!resposta.ok) {
            throw new Error(dados && dados.erro
                ? dados.erro
                : `Não foi possível concluir a operação (HTTP ${resposta.status}).`);
        }
        return dados;
    }

    function definirModo(novoModo) {
        modo = novoModo;
        const editando = modo === 'inserindo' || modo === 'alterando';
        const mostrandoProduto = modo === 'visualizando' && produtoSelecionado;

        inputId.readOnly = editando || modo === 'excluindo';
        inputNome.readOnly = !editando;
        inputDescricao.readOnly = !editando;
        inputPreco.readOnly = !editando;
        inputEstoque.readOnly = !editando;
        selectCategoria.disabled = !editando || !categoriasCarregadas;
        inputImagem.disabled = !editando;

        document.getElementById('btProcure').hidden = editando || modo === 'excluindo';
        document.getElementById('btNovo').hidden = editando || modo === 'excluindo';
        document.getElementById('btAlterar').hidden = !mostrandoProduto;
        document.getElementById('btExcluir').hidden = !mostrandoProduto;
        document.getElementById('btSalvar').hidden = !editando;
        document.getElementById('btCancelar').hidden = !editando;
        document.getElementById('btEscolherImagem').hidden = !editando;
    }

    function limparCampos() {
        if (urlImagemPreview) URL.revokeObjectURL(urlImagemPreview);
        urlImagemPreview = '';
        produtoSelecionado = null;
        inputNome.value = '';
        inputDescricao.value = '';
        inputPreco.value = '';
        inputEstoque.value = '';
        selectCategoria.value = '';
        inputImagem.value = '';
        carregarImagem('');
    }

    function carregarImagem(imagem) {
        imagemProduto.onerror = () => {
            imagemProduto.onerror = null;
            imagemProduto.src = IMAGEM_PADRAO;
        };
        if (!imagem) {
            imagemProduto.src = IMAGEM_PADRAO;
            return;
        }
        imagemProduto.src = /^(https?:)?\/\//.test(imagem) || imagem.startsWith('/')
            ? imagem
            : `${PASTA_IMAGENS}${encodeURIComponent(imagem)}`;
    }

    function carregarDadosProduto(produto) {
        produtoSelecionado = produto;
        inputId.value = produto.id;
        inputNome.value = produto.nome;
        inputDescricao.value = produto.descricao || '';
        inputPreco.value = Number(produto.preco).toFixed(2);
        inputEstoque.value = produto.estoque;
        selectCategoria.value = String(produto.categoria_id);
        carregarImagem(produto.imagem);
        definirModo('visualizando');
    }

    async function verificarAdministrador() {
        const dados = await requisicao(`${API_URL}/sessao`);
        if (!dados.usuario || dados.usuario.perfil !== 'admin') {
            location.replace(new URL('../../Cliente/Menu/menu.html', location.href).href);
            return false;
        }
        return true;
    }

    async function carregarCategorias() {
        const categorias = await requisicao(`${API_URL}/admin/produtos/categorias`);
        if (!Array.isArray(categorias)) {
            throw new Error('O servidor retornou uma lista de categorias inválida.');
        }

        selectCategoria.replaceChildren(new Option('Selecione uma categoria...', ''));
        for (const categoria of categorias) {
            if (!categoria || !Number.isInteger(categoria.id) || typeof categoria.nome !== 'string') {
                throw new Error('O servidor retornou uma categoria inválida.');
            }
            selectCategoria.add(new Option(categoria.nome, categoria.id));
        }
        categoriasCarregadas = true;
        selectCategoria.disabled = modo !== 'inserindo' && modo !== 'alterando';
    }

    function produtoValido(produto) {
        return produto &&
            Number.isInteger(produto.id) &&
            typeof produto.nome === 'string' &&
            Number.isFinite(produto.preco) &&
            Number.isInteger(produto.estoque) &&
            Number.isInteger(produto.categoria_id) &&
            typeof produto.categoria === 'string';
    }

    async function inicializar() {
        definirModo('busca');
        try {
            if (!await verificarAdministrador()) return;
            await carregarCategorias();
            await listar();
        } catch (erro) {
            console.error('Erro ao iniciar o CRUD de produtos:', erro);
            mostrarAviso(erro instanceof TypeError
                ? 'Não consegui acessar o servidor. Confira se ele está ativo.'
                : erro.message, true);
            listaProdutos.textContent = 'Não foi possível carregar os produtos.';
        }
    }

    async function listar() {
        listaProdutos.textContent = 'Carregando produtos...';
        try {
            const produtos = await requisicao(`${API_URL}/admin/produtos`);
            if (!Array.isArray(produtos) || produtos.some(produto => !produtoValido(produto))) {
                throw new Error('O servidor retornou uma lista de produtos inválida.');
            }
            if (!produtos.length) {
                listaProdutos.textContent = 'Nenhum produto cadastrado.';
                return;
            }

            listaProdutos.replaceChildren(...produtos.map(produto => {
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'produto-listado';
                botao.dataset.productId = String(produto.id);
                const identificacao = document.createElement('span');
                identificacao.textContent = `#${produto.id} · ${produto.nome}`;
                const detalhe = document.createElement('span');
                detalhe.textContent = `${produto.categoria} · R$ ${Number(produto.preco).toFixed(2)} · estoque ${produto.estoque}`;
                botao.append(identificacao, detalhe);
                return botao;
            }));
        } catch (erro) {
            console.error('Erro ao listar produtos:', erro);
            listaProdutos.textContent = erro instanceof TypeError
                ? 'Servidor offline ou erro de conexão.'
                : erro.message;
            return false;
        }
        return true;
    }

    async function procure() {
        const id = inputId.value.trim();
        if (!/^\d+$/.test(id) || Number(id) <= 0) {
            mostrarAviso('Digite um ID inteiro maior que zero para buscar.', true);
            inputId.focus();
            return;
        }

        try {
            const produto = await requisicao(`${API_URL}/admin/produtos/${id}`);
            if (!produtoValido(produto)) {
                throw new Error('O servidor retornou dados inválidos para este produto.');
            }
            carregarDadosProduto(produto);
            mostrarAviso(`Produto #${produto.id} carregado. Você pode alterar ou excluir.`);
        } catch (erro) {
            if (/HTTP 404/.test(erro.message)) {
                limparCampos();
                inputId.value = id;
                definirModo('busca');
                mostrarAviso(`Produto #${id} não encontrado. O próximo produto terá ID automático.`, true);
                return;
            }
            console.error('Erro ao buscar produto:', erro);
            mostrarAviso(erro instanceof TypeError
                ? 'Não consegui acessar o servidor.'
                : erro.message, true);
        }
    }

    function inserir() {
        limparCampos();
        definirModo('inserindo');
        mostrarAviso('Preencha os dados do produto. O ID será gerado automaticamente.');
        inputNome.focus();
    }

    function alterar() {
        if (!produtoSelecionado) {
            mostrarAviso('Busque um produto antes de alterá-lo.', true);
            return;
        }
        if (urlImagemPreview) URL.revokeObjectURL(urlImagemPreview);
        urlImagemPreview = '';
        inputImagem.value = '';
        definirModo('alterando');
        mostrarAviso('Edite os campos desejados e clique em Salvar.');
    }

    async function excluir() {
        if (!produtoSelecionado) {
            mostrarAviso('Busque um produto antes de excluí-lo.', true);
            return;
        }
        if (!window.confirm(`Deseja excluir o produto "${produtoSelecionado.nome}"?`)) return;

        try {
            const id = produtoSelecionado.id;
            await requisicao(`${API_URL}/admin/produtos/${id}`, { method: 'DELETE' });
            limparCampos();
            inputId.value = '';
            definirModo('busca');
            const carregouLista = await listar();
            mostrarAviso(carregouLista
                ? `Produto #${id} excluído com sucesso.`
                : `Produto #${id} excluído, mas não foi possível atualizar a lista.`, !carregouLista);
        } catch (erro) {
            console.error('Erro ao excluir produto:', erro);
            mostrarAviso(erro instanceof TypeError
                ? 'Não consegui acessar o servidor.'
                : erro.message, true);
        }
    }

    async function enviarImagem(id) {
        if (!inputImagem.files.length) return;
        const dados = new FormData();
        dados.append('imagem', inputImagem.files[0]);
        await requisicao(`${API_URL}/admin/produtos/${id}/imagem`, {
            method: 'POST',
            body: dados
        });
    }

    async function salvar() {
        if (!['inserindo', 'alterando'].includes(modo)) {
            mostrarAviso('Escolha Novo produto ou Alterar antes de salvar.', true);
            return;
        }
        const campos = [inputNome, inputPreco, inputEstoque, selectCategoria];
        const campoInvalido = campos.find(campo => !campo.checkValidity());
        if (campoInvalido) {
            campoInvalido.reportValidity();
            return;
        }

        const dadosProduto = {
            nome: inputNome.value.trim(),
            descricao: inputDescricao.value.trim(),
            preco: Number(inputPreco.value),
            estoque: Number(inputEstoque.value),
            categoriaId: Number(selectCategoria.value)
        };
        const estavaInserindo = modo === 'inserindo';
        const idAtual = produtoSelecionado && produtoSelecionado.id;
        const salvarBotao = document.getElementById('btSalvar');
        salvarBotao.disabled = true;

        try {
            const resultado = await requisicao(
                estavaInserindo ? `${API_URL}/admin/produtos` : `${API_URL}/admin/produtos/${idAtual}`,
                {
                    method: estavaInserindo ? 'POST' : 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dadosProduto)
                }
            );
            const idSalvo = Number(resultado.id || idAtual);

            try {
                await enviarImagem(idSalvo);
            } catch (erroImagem) {
                console.error('Dados do produto salvos, mas houve erro ao enviar a imagem:', erroImagem);
                limparCampos();
                inputId.value = String(idSalvo);
                definirModo('busca');
                mostrarAviso(`Produto #${idSalvo} salvo, mas a imagem não foi enviada: ${erroImagem.message}`, true);
                await listar();
                return;
            }

            limparCampos();
            inputId.value = String(idSalvo);
            definirModo('busca');
            const carregouLista = await listar();
            mostrarAviso(carregouLista
                ? estavaInserindo
                    ? `Produto #${idSalvo} cadastrado com sucesso.`
                    : `Produto #${idSalvo} atualizado com sucesso.`
                : `Produto #${idSalvo} foi salvo, mas não foi possível atualizar a lista.`, !carregouLista);
        } catch (erro) {
            console.error('Erro ao salvar produto:', erro);
            mostrarAviso(erro instanceof TypeError
                ? 'Não consegui acessar o servidor.'
                : erro.message, true);
        } finally {
            salvarBotao.disabled = false;
        }
    }

    function cancelarOperacao() {
        limparCampos();
        inputId.value = '';
        definirModo('busca');
        mostrarAviso('Operação cancelada.');
    }

    function acionarUpload() {
        if (modo !== 'inserindo' && modo !== 'alterando') {
            mostrarAviso('Clique em Novo produto ou Alterar antes de escolher uma imagem.', true);
            return;
        }
        inputImagem.click();
    }

    function previewImagem() {
        const arquivo = inputImagem.files[0];
        if (!arquivo) return;
        if (arquivo.size > 5 * 1024 * 1024) {
            inputImagem.value = '';
            mostrarAviso('A imagem deve ter no máximo 5 MB.', true);
            return;
        }
        if (urlImagemPreview) URL.revokeObjectURL(urlImagemPreview);
        urlImagemPreview = URL.createObjectURL(arquivo);
        imagemProduto.src = urlImagemPreview;
        mostrarAviso('Imagem selecionada. Clique em Salvar para enviar.');
    }

    listaProdutos.addEventListener('click', event => {
        const botao = event.target instanceof Element
            ? event.target.closest('button[data-product-id]')
            : null;
        if (!botao) return;
        inputId.value = botao.dataset.productId;
        procure();
    });

    document.getElementById('btProcure').addEventListener('click', procure);
    document.getElementById('btNovo').addEventListener('click', inserir);
    document.getElementById('btAlterar').addEventListener('click', alterar);
    document.getElementById('btExcluir').addEventListener('click', excluir);
    document.getElementById('btSalvar').addEventListener('click', salvar);
    document.getElementById('btCancelar').addEventListener('click', cancelarOperacao);
    document.getElementById('btEscolherImagem').addEventListener('click', acionarUpload);
    imagemProduto.addEventListener('click', acionarUpload);
    document.getElementById('btAtualizarLista').addEventListener('click', listar);
    inputImagem.addEventListener('change', previewImagem);
    inputId.addEventListener('keydown', event => {
        if (event.key === 'Enter') procure();
    });

    inicializar();
})();
