const pool = require('../../db');
const QRCode = require('qrcode');

function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function campoPix(id, valor) {
    const tamanho = Buffer.byteLength(valor, 'utf8');
    if (tamanho > 99) throw erroHttp(500, 'A configuração Pix da loja é inválida.');
    return `${id}${String(tamanho).padStart(2, '0')}${valor}`;
}

function textoRecebedor(valor, tamanhoMaximo) {
    return valor
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9 $%*+\-./:]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, tamanhoMaximo);
}

function calcularCRC16(texto) {
    let crc = 0xffff;
    for (const caractere of texto) {
        crc ^= caractere.charCodeAt(0) << 8;
        for (let bit = 0; bit < 8; bit++) {
            crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xffff;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function criarPayloadPix(valorCentavos) {
    const chave = (process.env.PIX_CHAVE || '').trim();
    const nome = textoRecebedor(process.env.PIX_NOME_RECEBEDOR || '', 25);
    const cidade = textoRecebedor(process.env.PIX_CIDADE_RECEBEDOR || '', 15);

    if (
        !chave ||
        !/^[\x20-\x7E]{1,77}$/.test(chave) ||
        !nome ||
        !cidade
    ) {
        throw erroHttp(503, 'O Pix da loja ainda não está configurado corretamente.');
    }

    const valor = (valorCentavos / 100).toFixed(2);
    const conta = campoPix('00', 'BR.GOV.BCB.PIX') + campoPix('01', chave);
    const campos = [
        campoPix('00', '01'),
        campoPix('01', '11'),
        campoPix('26', conta),
        campoPix('52', '0000'),
        campoPix('53', '986'),
        campoPix('54', valor),
        campoPix('58', 'BR'),
        campoPix('59', nome),
        campoPix('60', cidade),
        campoPix('62', campoPix('05', '***')),
        '6304'
    ].join('');

    return `${campos}${calcularCRC16(campos)}`;
}

async function gerarQrCode(req, res) {
    const corpo = req.body && typeof req.body === 'object' ? req.body : {};
    const { itens, idFrete, idFormaPagamento } = corpo;
    if (
        !Array.isArray(itens) ||
        itens.length === 0 ||
        itens.length > 100 ||
        itens.some(item =>
            !item ||
            !Number.isInteger(item.id) ||
            item.id <= 0 ||
            !Number.isInteger(item.quantidade) ||
            item.quantidade <= 0
        ) ||
        new Set(itens.map(item => item.id)).size !== itens.length ||
        !Number.isInteger(idFrete) ||
        idFrete <= 0 ||
        !Number.isInteger(idFormaPagamento) ||
        idFormaPagamento <= 0
    ) {
        return res.status(400).json({ erro: 'Os dados do pedido para gerar o Pix são inválidos.' });
    }

    try {
        const [fretes, formas, produtos] = await Promise.all([
            pool.query('SELECT valor_frete FROM frete_estado WHERE id_frete = $1', [idFrete]),
            pool.query('SELECT forma_pag FROM forma_pagamento WHERE id_formapag = $1', [idFormaPagamento]),
            pool.query(
                `SELECT id_produto AS id, preco
                 FROM produto
                 WHERE id_produto = ANY($1::integer[])`,
                [itens.map(item => item.id)]
            )
        ]);

        if (!fretes.rows.length) throw erroHttp(400, 'O estado de entrega selecionado não é válido.');
        if (!formas.rows.length || formas.rows[0].forma_pag.trim().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').toLowerCase() !== 'pix') {
            throw erroHttp(400, 'Selecione Pix como forma de pagamento.');
        }
        if (produtos.rows.length !== itens.length) {
            throw erroHttp(400, 'Um ou mais produtos não estão mais disponíveis.');
        }

        const produtosPorId = new Map(produtos.rows.map(produto => [
            Number(produto.id),
            Math.round(Number(produto.preco) * 100)
        ]));
        const totalCentavos = itens.reduce(
            (total, item) => total + produtosPorId.get(item.id) * item.quantidade,
            Math.round(Number(fretes.rows[0].valor_frete) * 100)
        );
        if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0) {
            throw erroHttp(400, 'Não foi possível calcular o total do pedido.');
        }

        const pixCopiaECola = criarPayloadPix(totalCentavos);
        const imagem = await QRCode.toDataURL(pixCopiaECola, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320
        });
        res.json({
            qrCode: imagem,
            pixCopiaECola,
            total: totalCentavos / 100
        });
    } catch (erro) {
        if (erro.status) return res.status(erro.status).json({ erro: erro.message });
        console.error('Erro ao gerar QR Code Pix:', erro);
        res.status(500).json({ erro: 'Não foi possível gerar o QR Code Pix.' });
    }
}

module.exports = { gerarQrCode, criarPayloadPix, calcularCRC16 };