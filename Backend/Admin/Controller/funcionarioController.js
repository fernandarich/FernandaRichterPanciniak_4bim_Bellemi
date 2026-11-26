const pool = require('../../db');

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function jsonErro(res, erro, mensagemPadrao) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message });
    if (erro.code === '23505') {
        return res.status(409).json({ erro: 'Já existe uma conta cadastrada com esse e-mail.' });
    }
    if (erro.code === '23503') {
        return res.status(409).json({ erro: 'Este funcionário está ligado a pedidos ou outros registros e não pode ser excluído.' });
    }
    console.error(mensagemPadrao, erro);
    return res.status(500).json({ erro: mensagemPadrao });
}

async function criarFuncionario(req, res) {
    const body = req.body || {};
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const senha = typeof body.senha === 'string' ? body.senha : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const cargo = typeof body.cargo === 'string' ? body.cargo.trim() : '';
    const salario = typeof body.salario === 'string' && /^\d+$/.test(body.salario.trim())
        ? Number(body.salario)
        : body.salario;
    const comissao = body.comissao === '' || body.comissao === null || body.comissao === undefined
        ? null
        : Number(body.comissao);

    if (!/^\d{11}$/.test(cpf) || !nome || nome.length > 100 ||
        !email || email.length > 250 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !senha || senha.length > 20 || telefone.length > 20 ||
        !cargo || cargo.length > 50 ||
        !Number.isSafeInteger(salario) || salario < 0 || salario > 2147483647 ||
        (comissao !== null && (!Number.isSafeInteger(comissao) || comissao < 0 || comissao > 100))) {
        return res.status(400).json({ erro: 'Confira os dados pessoais e profissionais informados.' });
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
        await client.query(
            `INSERT INTO funcionario (cpf_pessoa, salario_funcionario, cargo, porcentagem_comissao)
             VALUES ($1, $2, $3, $4)`,
            [cpf, salario, cargo, comissao]
        );
        await client.query('COMMIT');
        return res.status(201).json({ cpf, nome, email, telefone: telefone || null, cargo, salario, comissao });
    } catch (erro) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer cadastro de funcionário:', erroRollback);
            }
        }
        return jsonErro(res, erro, 'Não foi possível cadastrar o funcionário.');
    } finally {
        if (client) client.release();
    }
}

async function listarFuncionarios(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT p.cpf_pessoa AS cpf,
                    p.nome_pessoa AS nome,
                    p.email,
                    p.telefone,
                    f.cargo,
                    f.salario_funcionario AS salario,
                    f.porcentagem_comissao AS comissao
             FROM pessoa p
             INNER JOIN funcionario f ON f.cpf_pessoa = p.cpf_pessoa
             ORDER BY p.nome_pessoa, p.cpf_pessoa`
        );
        res.json(rows);
    } catch (erro) {
        jsonErro(res, erro, 'Não foi possível carregar os funcionários.');
    }
}

async function atualizarFuncionario(req, res) {
    const cpf = String(req.params.cpf || '');
    const body = req.body || {};
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const cargo = typeof body.cargo === 'string' ? body.cargo.trim() : '';
    const salario = typeof body.salario === 'number'
        ? body.salario
        : typeof body.salario === 'string' && /^\d+$/.test(body.salario.trim())
            ? Number(body.salario)
            : NaN;
    const comissao = body.comissao === '' || body.comissao === null || body.comissao === undefined
        ? null
        : Number(body.comissao);

    if (!/^\d{11}$/.test(cpf)) return res.status(400).json({ erro: 'Informe um CPF válido.' });
    if (!nome || nome.length > 100) {
        return res.status(400).json({ erro: 'O nome é obrigatório e deve ter até 100 caracteres.' });
    }
    if (!email || email.length > 250 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }
    if (telefone.length > 20) return res.status(400).json({ erro: 'O telefone deve ter até 20 caracteres.' });
    if (!cargo || cargo.length > 50) {
        return res.status(400).json({ erro: 'O cargo é obrigatório e deve ter até 50 caracteres.' });
    }
    if (!Number.isSafeInteger(salario) || salario < 0 || salario > 2147483647) {
        return res.status(400).json({ erro: 'Informe um salário válido em reais inteiros.' });
    }
    if (comissao !== null && (!Number.isSafeInteger(comissao) || comissao < 0 || comissao > 100)) {
        return res.status(400).json({ erro: 'A comissão deve ser um número inteiro entre 0 e 100.' });
    }

    let client;
    let transacaoIniciada = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transacaoIniciada = true;
        const pessoa = await client.query(
            `UPDATE pessoa p
             SET nome_pessoa = $2, email = $3, telefone = $4
             WHERE p.cpf_pessoa = $1
               AND EXISTS (SELECT 1 FROM funcionario f WHERE f.cpf_pessoa = p.cpf_pessoa)
             RETURNING p.cpf_pessoa AS cpf, p.nome_pessoa AS nome, p.email, p.telefone`,
            [cpf, nome, email, telefone || null]
        );
        if (!pessoa.rows.length) throw erroHttp(404, 'Funcionário não encontrado.');

        const profissional = await client.query(
            `UPDATE funcionario
             SET cargo = $2, salario_funcionario = $3, porcentagem_comissao = $4
             WHERE cpf_pessoa = $1
             RETURNING cargo, salario_funcionario AS salario, porcentagem_comissao AS comissao`,
            [cpf, cargo, salario, comissao]
        );
        await client.query('COMMIT');
        transacaoIniciada = false;
        return res.json({ ...pessoa.rows[0], ...profissional.rows[0] });
    } catch (erro) {
        if (client && transacaoIniciada) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer atualização do funcionário:', erroRollback);
            }
        }
        return jsonErro(res, erro, 'Não foi possível atualizar o funcionário.');
    } finally {
        if (client) client.release();
    }
}

async function excluirFuncionario(req, res) {
    const cpf = String(req.params.cpf || '');
    if (!/^\d{11}$/.test(cpf)) return res.status(400).json({ erro: 'Informe um CPF válido.' });
    if (req.usuario?.id === cpf) return res.status(409).json({ erro: 'Não é possível excluir seu próprio cadastro enquanto estiver conectado.' });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const removido = await client.query('DELETE FROM funcionario WHERE cpf_pessoa = $1 RETURNING cpf_pessoa', [cpf]);
        if (!removido.rowCount) throw erroHttp(404, 'Funcionário não encontrado.');
        await client.query(
            `DELETE FROM pessoa p
             WHERE p.cpf_pessoa = $1
               AND NOT EXISTS (SELECT 1 FROM cliente c WHERE c.cpf_pessoa = p.cpf_pessoa)`,
            [cpf]
        );
        await client.query('COMMIT');
        return res.status(204).end();
    } catch (erro) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (erroRollback) {
                console.error('Erro ao desfazer exclusão de funcionário:', erroRollback);
            }
        }
        return jsonErro(res, erro, 'Não foi possível excluir o funcionário.');
    } finally {
        if (client) client.release();
    }
}

module.exports = { listarFuncionarios, criarFuncionario, atualizarFuncionario, excluirFuncionario };
