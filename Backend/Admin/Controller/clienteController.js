const pool = require('../../db');

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function validarCpf(cpf) {
    return /^\d{11}$/.test(String(cpf || ''));
}

function jsonErro(res, erro, mensagemPadrao) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message });
    if (erro.code === '23505') {
        return res.status(409).json({ erro: 'Já existe uma conta cadastrada com esse e-mail.' });
    }
    if (erro.code === '23503') {
        return res.status(409).json({ erro: 'Este cliente está ligado a pedidos ou outros registros e não pode ser excluído.' });
    }
    console.error(mensagemPadrao, erro);
    return res.status(500).json({ erro: mensagemPadrao });
}

async function criarCliente(req, res) {
    const body = req.body || {};
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const senha = typeof body.senha === 'string' ? body.senha : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const renda = typeof body.renda === 'string' && /^\d+$/.test(body.renda.trim())
        ? Number(body.renda)
        : body.renda;

    if (!validarCpf(cpf) || !nome || nome.length > 100 ||
        !email || email.length > 250 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !senha || senha.length > 20 || telefone.length > 20 ||
        !Number.isSafeInteger(renda) || renda < 0 || renda > 2147483647) {
        return res.status(400).json({ erro: 'Confira nome, CPF, e-mail, senha, telefone e renda informados.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO pessoa (cpf_pessoa, nome_pessoa, email, senha, telefone)
             VALUES ($1, $2, $3, $4, $5)`,
            [cpf, nome, email, senha, telefone || null]
        );
        await client.query('INSERT INTO cliente (cpf_pessoa, renda_cliente) VALUES ($1, $2)', [cpf, renda]);
        await client.query('COMMIT');
        return res.status(201).json({ cpf, nome, email, telefone: telefone || null });
    } catch (erro) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer cadastro de cliente:', erroRollback);
            }
        }
        return jsonErro(res, erro, 'Não foi possível cadastrar o cliente.');
    } finally {
        if (client) client.release();
    }
}

async function listarClientes(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT p.cpf_pessoa AS cpf,
                    p.nome_pessoa AS nome,
                    p.email,
                    p.telefone
             FROM pessoa p
             INNER JOIN cliente c ON c.cpf_pessoa = p.cpf_pessoa
             ORDER BY p.nome_pessoa, p.cpf_pessoa`
        );
        res.json(rows);
    } catch (erro) {
        jsonErro(res, erro, 'Não foi possível carregar os clientes.');
    }
}

async function atualizarCliente(req, res) {
    const cpf = String(req.params.cpf || '');
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const telefone = typeof req.body?.telefone === 'string' ? req.body.telefone.trim() : '';

    if (!validarCpf(cpf)) return res.status(400).json({ erro: 'Informe um CPF válido.' });
    if (!nome || nome.length > 100) {
        return res.status(400).json({ erro: 'O nome é obrigatório e deve ter até 100 caracteres.' });
    }
    if (!email || email.length > 250 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }
    if (telefone.length > 20) {
        return res.status(400).json({ erro: 'O telefone deve ter até 20 caracteres.' });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE pessoa p
             SET nome_pessoa = $2, email = $3, telefone = $4
             WHERE p.cpf_pessoa = $1
               AND EXISTS (SELECT 1 FROM cliente c WHERE c.cpf_pessoa = p.cpf_pessoa)
             RETURNING p.cpf_pessoa AS cpf, p.nome_pessoa AS nome, p.email, p.telefone`,
            [cpf, nome, email, telefone || null]
        );
        if (!rows.length) return res.status(404).json({ erro: 'Cliente não encontrado.' });
        return res.json(rows[0]);
    } catch (erro) {
        return jsonErro(res, erro, 'Não foi possível atualizar o cliente.');
    }
}

async function excluirCliente(req, res) {
    const cpf = String(req.params.cpf || '');
    if (!validarCpf(cpf)) return res.status(400).json({ erro: 'Informe um CPF válido.' });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const removido = await client.query('DELETE FROM cliente WHERE cpf_pessoa = $1 RETURNING cpf_pessoa', [cpf]);
        if (!removido.rowCount) throw erroHttp(404, 'Cliente não encontrado.');
        await client.query(
            `DELETE FROM pessoa p
             WHERE p.cpf_pessoa = $1
               AND NOT EXISTS (SELECT 1 FROM funcionario f WHERE f.cpf_pessoa = p.cpf_pessoa)`,
            [cpf]
        );
        await client.query('COMMIT');
        return res.status(204).end();
    } catch (erro) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer exclusão de cliente:', erroRollback);
            }
        }
        return jsonErro(res, erro, 'Não foi possível excluir o cliente.');
    } finally {
        if (client) client.release();
    }
}

module.exports = { listarClientes, criarCliente, atualizarCliente, excluirCliente };
