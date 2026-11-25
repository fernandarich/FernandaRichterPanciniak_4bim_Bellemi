const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = 3000;

const origensPermitidas = (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(origem => origem.trim())
    .filter(Boolean);

app.use(cors({
    origin(origem, callback) {
        const origemLocal = process.env.NODE_ENV !== 'production' &&
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem || '');

        callback(null, !origem || origemLocal || origensPermitidas.includes(origem));
    },
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Bem-vinda à Bellemi! 🎀');
});

app.get('/teste-banco', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT current_database()');

        res.send(`Conectado ao banco: ${resultado.rows[0].current_database}`);
    } catch (erro) {
        console.error('Erro ao conectar ao banco:', erro.message);
        res.status(500).send('Não foi possível conectar ao banco.');
    }
});

// rotas da loja
app.use('/api/cabelos', require('./Client/Routes/cabelosRoutes'));
app.use('/api/perfumes', require('./Client/Routes/perfumesRoutes'));
app.use('/api/acessorios', require('./Client/Routes/acessoriosRoutes'));
app.use('/api/esmaltes', require('./Client/Routes/esmaltesRoutes'));
app.use('/api/pinceis', require('./Client/Routes/pinceisRoutes'));
app.use('/api/maquiagem-artistica', require('./Client/Routes/maquiagemArtisticaRoutes'));
app.use('/api/corpo-e-banho', require('./Client/Routes/corpoEBanhoRoutes'));
app.use('/api/kits-e-presentes', require('./Client/Routes/kitsEPresentesRoutes'));
app.use('/api/maquiagem-vegana', require('./Client/Routes/maquiagemVeganaRoutes'));
app.use('/api/pedidos', require('./Client/Routes/pedidosRoutes'));
app.use('/api/pix', require('./Client/Routes/pixRoutes'));
app.use('/api/admin/produtos', require('./Admin/Routes/produtosRoutes'));
app.use('/api/admin', require('./Admin/Routes/adminRoutes'));
app.use('/api/skincare', require('./Client/Routes/skincareRoutes'));
app.use('/api', require('./Client/Routes/maquiagemRoutes'));
app.use('/api', require('./Client/Routes/formaPagamentoRoutes'));
app.use('/api', require('./Login/loginRoutes'));

app.listen(PORT, () => {
    console.log(`Bellemi rodando alegremente na porta ${PORT}!`);
    console.log(`Boas compras! 🛍️`);
    console.log(`Obrigada por escolher a Bellemi! 💖`);
});
