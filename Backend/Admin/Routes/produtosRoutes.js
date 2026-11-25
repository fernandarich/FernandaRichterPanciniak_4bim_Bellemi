const express = require('express');
const multer = require('multer');
const { exigirAdmin } = require('../../Login/loginController');
const produtosController = require('../Controller/produtosController');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, callback) {
        if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) {
            return callback(new Error('Envie uma imagem JPG, PNG, WebP, GIF ou AVIF.'));
        }
        callback(null, true);
    }
});

function receberImagem(req, res, next) {
    upload.single('imagem')(req, res, erro => {
        if (!erro) return next();
        return res.status(400).json({
            erro: erro.code === 'LIMIT_FILE_SIZE'
                ? 'A imagem deve ter no máximo 5 MB.'
                : erro.message
        });
    });
}

router.use(exigirAdmin);
router.get('/categorias', produtosController.listarCategorias);
router.get('/', produtosController.listarProdutos);
router.post('/', produtosController.inserirProduto);
router.post('/:id/imagem', receberImagem, produtosController.atualizarImagem);
router.get('/:id', produtosController.buscarProduto);
router.put('/:id', produtosController.alterarProduto);
router.delete('/:id', produtosController.excluirProduto);

module.exports = router;
