const pool = require('../db');
const { randomBytes } = require('crypto');

const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;
const COOKIE_SESSAO = 'bellemi_sessao';
const sessoes = new Map();

function definirCookieSessao(res, token) {
    const maxAge = Math.floor(DURACAO_SESSAO_MS / 1000);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
        'Set-Cookie',
        `${COOKIE_SESSAO}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
    );
}

function limparCookieSessao(res) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
        'Set-Cookie',
        `${COOKIE_SESSAO}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
    );
}

function obterTokenSessao(req) {
    const cookie = (req.headers.cookie || '')
        .split(';')
        .map(parte => parte.trim())
        .find(parte => parte.startsWith(`${COOKIE_SESSAO}=`));

    return cookie ? cookie.slice(COOKIE_SESSAO.length + 1) : '';
}

function criarSessao(usuario, res, perfisDisponiveis = []) {
    const token = randomBytes(32).toString('hex');
    sessoes.set(token, {
        usuario,
        perfisDisponiveis,
        expiraEm: Date.now() + DURACAO_SESSAO_MS
    });
    definirCookieSessao(res, token);
    return { usuario };
}

async function login(req, res) {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const senha = typeof body.senha === 'string' ? body.senha : '';

    if (!email || !senha) {
        return res.status(400).json({ erro: 'Informe e-mail e senha.' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT
                p.cpf_pessoa AS id,
                p.nome_pessoa AS nome,
                p.senha,
                (f.cpf_pessoa IS NOT NULL) AS eh_funcionario,
                (c.cpf_pessoa IS NOT NULL) AS eh_cliente
             FROM PESSOA p
             LEFT JOIN FUNCIONARIO f ON f.cpf_pessoa = p.cpf_pessoa
             LEFT JOIN CLIENTE c ON c.cpf_pessoa = p.cpf_pessoa
             WHERE LOWER(p.email) = LOWER($1)`,
            [email]
        );

        if (!rows.length) {
            return res.status(404).json({
                codigo: 'NAO_CADASTRADO',
                erro: 'Não encontramos uma conta com esse e-mail.'
            });
        }

        const pessoa = rows[0];
        if (pessoa.senha !== senha) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        if (!pessoa.eh_funcionario && !pessoa.eh_cliente) {
            return res.status(403).json({
                erro: 'Esta conta não está cadastrada como cliente ou funcionário.'
            });
        }

        if (pessoa.eh_funcionario) {
            const perfisDisponiveis = ['cliente', 'funcionario'];
            const sessao = criarSessao({
                id: pessoa.id,
                nome: pessoa.nome,
                perfil: 'selecao'
            }, res, perfisDisponiveis);
            return res.json({ ...sessao, escolherPerfil: true, perfisDisponiveis });
        }

        return res.json(criarSessao({
            id: pessoa.id,
            nome: pessoa.nome,
            perfil: 'cliente'
        }, res));
    } catch (erro) {
        console.error('Erro ao autenticar usuário:', erro);
        res.status(500).json({ erro: 'Não foi possível fazer login.' });
    }
}

async function cadastrarCliente(req, res) {
    const body = req.body || {};
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const senha = typeof body.senha === 'string' ? body.senha : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const renda = Number(body.renda);

    if (
        !nome || nome.length > 100 ||
        !/^\d{11}$/.test(cpf) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 250 ||
        !senha || senha.length > 20 ||
        telefone.length > 20 ||
        !Number.isInteger(renda) || renda < 0 || renda > 2147483647
    ) {
        return res.status(400).json({ erro: 'Confira os dados informados e tente novamente.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO PESSOA (cpf_pessoa, nome_pessoa, email, senha, telefone)
             VALUES ($1, $2, $3, $4, $5)`,
            [cpf, nome, email, senha, telefone || null]
        );
        await client.query(
            'INSERT INTO CLIENTE (cpf_pessoa, renda_cliente) VALUES ($1, $2)',
            [cpf, renda]
        );
        await client.query('COMMIT');

        res.status(201).json(criarSessao({ id: cpf, nome, perfil: 'cliente' }, res));
    } catch (erro) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer cadastro de cliente:', erroRollback);
            }
        }

        if (erro.code === '23505') {
            return res.status(409).json({ erro: 'Este CPF ou e-mail já está cadastrado.' });
        }

        console.error('Erro ao cadastrar cliente:', erro);
        res.status(500).json({ erro: 'Não foi possível concluir o cadastro.' });
    } finally {
        if (client) client.release();
    }
}

async function consultarConta(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT
                cpf_pessoa AS cpf,
                nome_pessoa AS nome,
                email,
                telefone
             FROM PESSOA
             WHERE cpf_pessoa = $1`,
            [req.usuario.id]
        );

        if (!rows.length) {
            return res.status(404).json({ erro: 'Não foi possível encontrar sua conta.' });
        }

        res.json(rows[0]);
    } catch (erro) {
        console.error('Erro ao consultar dados da conta:', erro);
        res.status(500).json({ erro: 'Não foi possível carregar os dados da conta.' });
    }
}

function erroConta(status, codigo, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    erro.codigo = codigo;
    return erro;
}

async function atualizarConta(req, res) {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const senhaAtual = typeof body.senhaAtual === 'string' ? body.senhaAtual : '';

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 250 ||
        typeof body.telefone !== 'string' ||
        telefone.length > 20 ||
        !senhaAtual
    ) {
        return res.status(400).json({ erro: 'Confira o e-mail, o telefone e a senha atual.' });
    }

    let client;
    let transacaoIniciada = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transacaoIniciada = true;

        const { rows: pessoas } = await client.query(
            'SELECT senha FROM PESSOA WHERE cpf_pessoa = $1 FOR UPDATE',
            [req.usuario.id]
        );
        if (!pessoas.length) {
            throw erroConta(404, 'CONTA_NAO_ENCONTRADA', 'Não foi possível encontrar sua conta.');
        }
        if (pessoas[0].senha !== senhaAtual) {
            throw erroConta(401, 'SENHA_INCORRETA', 'A senha atual está incorreta.');
        }

        const { rows } = await client.query(
            `UPDATE PESSOA
             SET email = $2, telefone = $3
             WHERE cpf_pessoa = $1
             RETURNING cpf_pessoa AS cpf, nome_pessoa AS nome, email, telefone`,
            [req.usuario.id, email, telefone || null]
        );

        await client.query('COMMIT');
        transacaoIniciada = false;
        res.json(rows[0]);
    } catch (erro) {
        if (client && transacaoIniciada) {
            try {
                await client.query('ROLLBACK');
            } catch (erroRollback) {
                console.error('Erro ao desfazer atualização da conta:', erroRollback);
            }
        }

        if (erro.status) {
            return res.status(erro.status).json({ codigo: erro.codigo, erro: erro.message });
        }
        if (erro.code === '23505') {
            return res.status(409).json({ erro: 'Este e-mail já está sendo usado por outra conta.' });
        }

        console.error('Erro ao atualizar dados da conta:', erro);
        res.status(500).json({ erro: 'Não foi possível atualizar os dados da conta.' });
    } finally {
        if (client) client.release();
    }
}

function verificarSessao(req, res) {
    const token = obterTokenSessao(req);
    const sessao = token && sessoes.get(token);

    if (!sessao || sessao.expiraEm <= Date.now()) {
        if (token) sessoes.delete(token);
        limparCookieSessao(res);
        return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' });
    }

    res.json({
        usuario: sessao.usuario,
        escolherPerfil: sessao.usuario.perfil === 'selecao',
        perfisDisponiveis: sessao.usuario.perfil === 'selecao' ? sessao.perfisDisponiveis : []
    });
}

function selecionarPerfil(req, res) {
    const token = obterTokenSessao(req);
    const sessao = token && sessoes.get(token);

    if (!sessao || sessao.expiraEm <= Date.now()) {
        if (token) sessoes.delete(token);
        limparCookieSessao(res);
        return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' });
    }

    const perfilSolicitado = req.body?.perfil;
    if (sessao.usuario.perfil !== 'selecao' || !sessao.perfisDisponiveis.includes(perfilSolicitado)) {
        return res.status(400).json({ erro: 'Escolha uma forma de acesso válida.' });
    }

    sessao.usuario.perfil = perfilSolicitado === 'funcionario' ? 'admin' : 'cliente';
    sessao.perfisDisponiveis = [];
    return res.json({ usuario: sessao.usuario });
}

function exigirCliente(req, res, next) {
    const token = obterTokenSessao(req);
      const sessao = token && sessoes.get(token);

      if (!sessao || sessao.expiraEm <= Date.now()) {
          if (token) sessoes.delete(token);
          limparCookieSessao(res);
          return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' });
      }

      if (sessao.usuario.perfil !== 'cliente') {
          return res.status(403).json({ erro: 'Apenas clientes podem consultar seus pedidos.' });
      }

      req.usuario = sessao.usuario;
      next();
}

function exigirAdmin(req, res, next) {
    const token = obterTokenSessao(req);
    const sessao = token && sessoes.get(token);

    if (!sessao || sessao.expiraEm <= Date.now()) {
        if (token) sessoes.delete(token);
        limparCookieSessao(res);
        return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' });
    }

    if (sessao.usuario.perfil !== 'admin') {
        return res.status(403).json({ erro: 'Apenas administradores podem acessar o painel.' });
    }

    req.usuario = sessao.usuario;
    next();
}

function encerrarSessao(req, res) {
      const token = obterTokenSessao(req);
      if (token) sessoes.delete(token);
    limparCookieSessao(res);
    res.status(204).end();
}

module.exports = {
    login,
    selecionarPerfil,
    cadastrarCliente,
    consultarConta,
    atualizarConta,
    verificarSessao,
    exigirCliente,
    exigirAdmin,
    encerrarSessao
};
