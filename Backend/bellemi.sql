CREATE TABLE PESSOA(
	cpf_pessoa VARCHAR(11) PRIMARY KEY,
	nome_pessoa VARCHAR(100)NOT NULL,
	email VARCHAR(250) NOT NULL UNIQUE,
	senha VARCHAR(20) NOT NULL,
	telefone VARCHAR(20)
);

--DROP TABLE PESSOA;

CREATE TABLE FUNCIONARIO(
	cpf_pessoa VARCHAR(11) PRIMARY KEY,
	salario_funcionario INTEGER NOT NULL,
	cargo VARCHAR(50) NOT NULL,
	porcentagem_comissao INTEGER,
	FOREIGN KEY (cpf_pessoa) 
		REFERENCES PESSOA(cpf_pessoa)
);

--DROP TABLE FUNCIONARIO;

CREATE TABLE CLIENTE(
	cpf_pessoa VARCHAR(11) PRIMARY KEY,
	renda_cliente INTEGER NOT NULL,
	FOREIGN KEY (cpf_pessoa) 
		REFERENCES PESSOA(cpf_pessoa)
);

--DROP TABLE CLIENTE;

CREATE TABLE CATEGORIA(
	id_categoria SERIAL PRIMARY KEY,
	nome_categoria VARCHAR(50) NOT NULL UNIQUE,
	descricao VARCHAR(200)
);

--DROP TABLE CATEGORIA;

CREATE TABLE FORNECEDOR(
	id_fornecedor SERIAL PRIMARY KEY,
	nome_fornecedor VARCHAR(100) NOT NULL UNIQUE,
	telefone_forn VARCHAR(20),
	email VARCHAR(150)
);

--DROP TABLE FORNECEDOR;

CREATE TABLE FORMA_PAGAMENTO(
	id_formapag SERIAL PRIMARY KEY,
	forma_pag VARCHAR(20) NOT NULL UNIQUE
);

--DROP TABLE FORMA_PAGAMENTO;

CREATE TABLE FRETE_ESTADO(
	id_frete SERIAL PRIMARY KEY,
	estado VARCHAR(50) NOT NULL UNIQUE, 
	valor_frete NUMERIC(10,2) NOT NULL
);

--DROP TABLE FRETE_ESTADO;

CREATE TABLE PRODUTO(
	id_produto SERIAL PRIMARY KEY,
	nome_prod VARCHAR(30) NOT NULL,
	descricao_prod VARCHAR(100),
	preco NUMERIC(10,2) NOT NULL,
	quant_estoque INTEGER NOT NULL,
	imagem VARCHAR(255),
	id_categoria INTEGER NOT NULL,
	FOREIGN KEY (id_categoria)
		REFERENCES CATEGORIA (id_categoria)
);

--DROP TABLE PRODUTO;

CREATE TABLE PRODUTO_FORNECEDOR(
	id_produto INTEGER,
    id_fornecedor INTEGER,
	PRIMARY KEY (id_produto, id_fornecedor),
	FOREIGN KEY (id_produto)
		REFERENCES PRODUTO (id_produto),
	FOREIGN KEY (id_fornecedor)
		REFERENCES FORNECEDOR (id_fornecedor)
);

--DROP TABLE PRODUTO_FORNECEDOR;

CREATE TABLE PEDIDO(
	id_pedido SERIAL PRIMARY KEY,
	cpf_pessoa VARCHAR(11) NOT NULL,
	data_pedido DATE NOT NULL, 
	status_pedido VARCHAR(30) NOT NULL,
	id_frete INTEGER NOT NULL,
	FOREIGN KEY (cpf_pessoa)
		REFERENCES PESSOA(cpf_pessoa),
	FOREIGN KEY (id_frete)
		REFERENCES FRETE_ESTADO (id_frete)
);

--DROP TABLE PEDIDO;

CREATE TABLE ITEM_PEDIDO(
	id_pedido INTEGER,
	id_produto INTEGER,
	PRIMARY KEY (id_pedido, id_produto),
	quantidade INTEGER NOT NULL,
	preco_unitario NUMERIC(10,2) NOT NULL,
	FOREIGN KEY (id_produto)
		REFERENCES PRODUTO (id_produto),
	FOREIGN KEY (id_pedido)
		REFERENCES PEDIDO (id_pedido)
);

--DROP TABLE ITEM_PEDIDO;

CREATE TABLE PAGAMENTO(
	id_pagamento SERIAL PRIMARY KEY,
	id_pedido INTEGER NOT NULL UNIQUE,
	valor_pagamento NUMERIC(10,2) NOT NULL, 
	id_formapag INTEGER NOT NULL, 
	status_pagamento VARCHAR(30) NOT NULL,
	data_pagamento DATE,
	FOREIGN KEY (id_pedido)
    	REFERENCES PEDIDO(id_pedido),
	FOREIGN KEY (id_formapag)
    	REFERENCES FORMA_PAGAMENTO(id_formapag)
);

--DROP TABLE PAGAMENTO;

CREATE TABLE CARRINHO(
	id_carrinho SERIAL PRIMARY KEY,
	cpf_pessoa VARCHAR(11) NOT NULL UNIQUE,
	data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
	FOREIGN KEY (cpf_pessoa)
		REFERENCES CLIENTE(cpf_pessoa)
);

--DROP TABLE CARRINHO;

CREATE TABLE ITEM_CARRINHO(
	id_carrinho INTEGER,
	id_produto INTEGER,
	quantidade INTEGER NOT NULL CHECK (quantidade > 0),
	data_adicao DATE NOT NULL DEFAULT CURRENT_DATE,
	PRIMARY KEY (id_carrinho, id_produto),
	FOREIGN KEY (id_carrinho)
		REFERENCES CARRINHO(id_carrinho),
	FOREIGN KEY (id_produto)
		REFERENCES PRODUTO(id_produto)
);

--DROP TABLE ITEM_CARRINHO;

CREATE TABLE CARTAO(
	id_cartao SERIAL PRIMARY KEY,
	cpf_pessoa VARCHAR(11) NOT NULL,
	nome_titular VARCHAR(100) NOT NULL,
	ultimos_digitos CHAR(4) NOT NULL,
	bandeira VARCHAR(20) NOT NULL,
	tipo_cartao VARCHAR(10) NOT NULL CHECK (tipo_cartao IN ('CREDITO', 'DEBITO')),
	mes_validade SMALLINT NOT NULL CHECK (mes_validade BETWEEN 1 AND 12),
	ano_validade SMALLINT NOT NULL,
	FOREIGN KEY (cpf_pessoa)
		REFERENCES CLIENTE(cpf_pessoa)
);

ALTER TABLE PAGAMENTO
	ADD COLUMN IF NOT EXISTS id_cartao INTEGER;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'pagamento_id_cartao_fkey'
		  AND conrelid = 'pagamento'::regclass
	) THEN
		ALTER TABLE PAGAMENTO
			ADD CONSTRAINT pagamento_id_cartao_fkey
			FOREIGN KEY (id_cartao) REFERENCES CARTAO(id_cartao);
	END IF;
END;
$$;

--DROP TABLE CARTAO;

CREATE TABLE IF NOT EXISTS DEVOLUCAO(
    id_devolucao SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL UNIQUE,
    motivo VARCHAR(500),
    status_devolucao VARCHAR(30) NOT NULL DEFAULT 'Pendente',
    data_solicitacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pedido) REFERENCES PEDIDO(id_pedido)
);

--DROP TABLE DEVOLUCAO;

--INSERTS GIGANTES TÁ?

INSERT INTO PESSOA (cpf_pessoa, nome_pessoa, email, senha, telefone) VALUES
('11122233301', 'Mariana Souza Lima',        'mariana.lima@email.com',       'Mari@2024',   '(44) 99811-2301'),
('11122233302', 'Beatriz Fernandes Costa',   'bia.costa@email.com',          'Bia#1234',    '(44) 99822-3402'),
('11122233303', 'Camila Rodrigues Alves',    'camila.alves@email.com',       'Cam!5678',    '(41) 99733-4503'),
('11122233304', 'Juliana Martins Rocha',     'ju.rocha@email.com',           'Ju@78901',    '(43) 99644-5604'),
('11122233305', 'Larissa Oliveira Santos',   'larissa.santos@email.com',     'Lari#2025',   '(11) 98555-6705'),
('11122233306', 'Fernanda Pereira Gomes',    'fer.gomes@email.com',          'Fer@3456',    '(21) 98466-7806'),
('11122233307', 'Amanda Ribeiro Dias',       'amanda.dias@email.com',        'Aman#9012',   '(44) 99377-8907'),
('11122233308', 'Gabriela Carvalho Mendes',  'gabi.mendes@email.com',        'Gabi@4321',   '(41) 99288-9008'),
('11122233309', 'Letícia Barbosa Nunes',     'leticia.nunes@email.com',      'Leti!6789',   NULL),
('11122233310', 'Isabela Teixeira Moreira',  'isa.moreira@email.com',        'Isa#0987',    '(31) 98199-0109'),
('11122233311', 'Rafaela Araújo Castro',     'rafa.castro@email.com',        'Rafa@5432',   '(44) 99100-1210'),
('11122233312', 'Natália Cardoso Freitas',   'nat.freitas@email.com',        'Nat#8765',    '(51) 99011-2311'),
('11122233313', 'Patrícia Gonçalves Pinto',  'patricia.pinto@email.com',     'Pati@1357',   '(43) 98922-3412'),
('11122233314', 'Carolina Lopes Batista',    'carol.batista@email.com',      'Carol!2468',  '(11) 98833-4513'),
('11122233315', 'Vanessa Monteiro Silva',    'vanessa.silva@email.com',      'Vane#9753',   '(44) 99744-5614'),
('11122233316', 'Tatiane Correia Machado',   'tati.machado@email.com',       'Tati@8642',   '(41) 99655-6715'),
('11122233317', 'Lucas Henrique Almeida',    'lucas.almeida@email.com',      'Lucas#1122',  '(44) 99566-7816'),
('11122233318', 'Rafael Augusto Campos',     'rafael.campos@email.com',      'Rafa!3344',   '(41) 99477-8917'),
('11122233319', 'Diego Nascimento Ramos',    'diego.ramos@email.com',        'Diego@5566',  NULL),
('11122233320', 'Bruno Vieira Cunha',        'bruno.cunha@email.com',        'Bruno#7788',  '(11) 98388-9018');

INSERT INTO PESSOA (cpf_pessoa, nome_pessoa, email, senha, telefone) VALUES
('12978223901', 'Fernanda Richter Panciniak', 'fefe@gmail.com', 'maioral1', '(44)998236318');

INSERT INTO FUNCIONARIO (cpf_pessoa, salario_funcionario, cargo, porcentagem_comissao) VALUES
('11122233302', 6500, 'Gerente de Loja',              NULL),
('11122233305', 2800, 'Vendedora',                    5),
('11122233308', 2800, 'Vendedora',                    5),
('11122233313', 3200, 'Analista de Marketing',        NULL),
('11122233316', 2400, 'Atendente de Suporte',         2),
('11122233318', 2600, 'Estoquista',                   NULL),
('12978223901', 15000, 'Dona', NULL);

INSERT INTO CLIENTE (cpf_pessoa, renda_cliente) VALUES
('11122233301', 3500),
('11122233303', 5200),
('11122233304', 2800),
('11122233306', 7400),
('11122233307', 4100),
('11122233309', 2200),
('11122233310', 6000),
('11122233311', 3900),
('11122233312', 4800),
('11122233314', 8500),
('11122233315', 3100),
('11122233317', 4500),
('11122233319', 5800),
('11122233320', 6700);

INSERT INTO CATEGORIA (nome_categoria, descricao) VALUES
('Maquiagem',            'Bases, corretivos, batons, sombras, blushes e demais produtos para o rosto, olhos e lábios'),
('Skincare',             'Produtos de cuidado com a pele: limpeza, hidratação, proteção solar e tratamentos'),
('Cabelo',               'Shampoos, condicionadores, máscaras, finalizadores e tratamentos capilares'),
('Esmaltes',             'Esmaltes, bases, top coats e produtos para o cuidado das unhas'),
('Acessorios',           'Necessaires, espelhos, organizadores e outros acessórios de beleza'),
('Pinceis',              'Pincéis, esponjas e ferramentas de aplicação de maquiagem'),
('Perfumes',             'Perfumes, colônias e body splashes'),
('Maquiagem artistica',  'Tintas faciais, glitter, maquiagem para fantasia, teatro e caracterização'),
('Corpo e Banho',        'Hidratantes corporais, sabonetes, esfoliantes e óleos para o corpo'),
('Kits e Presentes',     'Kits promocionais, caixas de presente e coleções de edição limitada'),
('Maquiagem Vegana',     'Produtos veganos e livres de crueldade animal');

INSERT INTO FORNECEDOR (nome_fornecedor, telefone_forn, email) VALUES
('MAC Cosmetics',        '(11) 3000-1001', 'atendimento@mac.exemplo.com.br'),
('Maybelline',           '(11) 3000-1002', 'atendimento@maybelline.exemplo.com.br'),
('L''Oréal Paris',       '(11) 3000-1003', 'atendimento@loreal.exemplo.com.br'),
('Natura',               '(11) 3000-1004', 'atendimento@natura.exemplo.com.br'),
('O Boticário',          '(41) 3000-1005', 'atendimento@boticario.exemplo.com.br'),
('Eudora',               '(41) 3000-1006', 'atendimento@eudora.exemplo.com.br'),
('Avon',                 '(11) 3000-1007', 'atendimento@avon.exemplo.com.br'),
('Vult',                 '(11) 3000-1008', 'atendimento@vult.exemplo.com.br'),
('Ruby Rose',            '(11) 3000-1009', 'atendimento@rubyrose.exemplo.com.br'),
('Océane',               '(11) 3000-1010', 'atendimento@oceane.exemplo.com.br'),
('Quem Disse, Berenice?','(41) 3000-1011', 'atendimento@quemdisseberenice.exemplo.com.br'),
('Boca Rosa Beauty',     '(11) 3000-1012', 'atendimento@bocarosa.exemplo.com.br'),
('Risqué',               '(11) 3000-1013', 'atendimento@risque.exemplo.com.br'),
('Granado',              '(21) 3000-1014', 'atendimento@granado.exemplo.com.br'),
('La Roche-Posay',       '(11) 3000-1015', 'atendimento@larocheposay.exemplo.com.br'),
('CeraVe',               '(11) 3000-1016', 'atendimento@cerave.exemplo.com.br'),
('Nivea',                '(11) 3000-1017', 'atendimento@nivea.exemplo.com.br'),
('Klass Vough',          NULL,             'atendimento@klassvough.exemplo.com.br');

INSERT INTO FORMA_PAGAMENTO (forma_pag) VALUES
('Pix'),
('Cartão de Crédito'),
('Cartão de Débito'),
('Boleto Bancário');

INSERT INTO FRETE_ESTADO (estado, valor_frete) VALUES
('Acre',                 54.90),
('Alagoas',              32.90),
('Amapá',                52.90),
('Amazonas',             49.90),
('Bahia',                29.90),
('Ceará',                34.90),
('Distrito Federal',     24.90),
('Espírito Santo',       19.90),
('Goiás',                24.90),
('Maranhão',             37.90),
('Mato Grosso',          29.90),
('Mato Grosso do Sul',   27.90),
('Minas Gerais',         18.90),
('Pará',                 39.90),
('Paraíba',              33.90),
('Paraná',               15.90),
('Pernambuco',           32.90),
('Piauí',                36.90),
('Rio de Janeiro',       17.90),
('Rio Grande do Norte',  34.90),
('Rio Grande do Sul',    19.90),
('Rondônia',             44.90),
('Roraima',              54.90),
('Santa Catarina',       17.90),
('São Paulo',            14.90),
('Sergipe',              31.90),
('Tocantins',            36.90);

INSERT INTO PRODUTO (nome_prod, descricao_prod, preco, quant_estoque, id_categoria)
SELECT v.nome, v.descr, v.preco, v.qtd, c.id_categoria
FROM (VALUES
  ('Base Líquida Matte Nude',        'Base de alta cobertura com acabamento matte e longa duração',        59.90, 120, 'Maquiagem'),
  ('Corretivo Alta Cobertura',       'Corretivo para olheiras e imperfeições, não craquela',               34.90, 150, 'Maquiagem'),
  ('Pó Compacto Translúcido',        'Controla a oleosidade e fixa a make sem pesar',                      29.90, 200, 'Maquiagem'),
  ('Batom Matte Vermelho',           'Batom líquido matte de alta pigmentação',                            27.90, 180, 'Maquiagem'),
  ('Batom Cremoso Rosa Nude',        'Batom cremoso hidratante em tom rosado natural',                     24.90, 160, 'Maquiagem'),
  ('Máscara de Cílios Volume',       'Máscara à prova d''água que dá volume e alonga os cílios',           32.90, 140, 'Maquiagem'),
  ('Paleta de Sombras 12 Cores',     'Paleta com tons foscos e cintilantes para o dia a dia',              49.90,  90, 'Maquiagem'),
  ('Blush Compacto Pêssego',         'Blush em pó de textura sedosa e acabamento natural',                 26.90, 130, 'Maquiagem'),
  ('Iluminador em Pó Dourado',       'Iluminador de brilho sutil para rosto e colo',                       31.90, 110, 'Maquiagem'),
  ('Delineador Líquido Preto',       'Delineador com ponta fina e secagem rápida',                         19.90, 220, 'Maquiagem'),
  ('Lápis de Olho Preto',            'Lápis macio e de longa duração',                                     12.90, 300, 'Maquiagem'),
  ('Gloss Labial Transparente',      'Gloss com brilho intenso e efeito volumizador',                      18.90, 170, 'Maquiagem'),
  ('Primer Facial Matificante',      'Prepara a pele e prolonga a duração da maquiagem',                   44.90,  95, 'Maquiagem'),
  ('Spray Fixador de Make',          'Fixa a maquiagem por até 16 horas',                                  39.90, 105, 'Maquiagem'),
  ('Gel para Sobrancelhas',          'Fixa e define os fios com acabamento natural',                       21.90, 125, 'Maquiagem'),
  ('Contorno em Bastão',             'Bastão cremoso para esculpir e contornar o rosto',                   36.90,  85, 'Maquiagem'),
  ('Sabonete Facial Gel',            'Limpeza profunda para pele mista a oleosa',                          29.90, 140, 'Skincare'),
  ('Água Micelar 200ml',             'Remove maquiagem e impurezas sem agredir a pele',                    34.90, 180, 'Skincare'),
  ('Hidratante Ácido Hialurônico',   'Hidratação intensa com efeito preenchedor',                          69.90,  80, 'Skincare'),
  ('Protetor Solar FPS 50',          'Protetor facial de toque seco e alta proteção UVA/UVB',              54.90, 160, 'Skincare'),
  ('Sérum Vitamina C 30ml',          'Antioxidante que uniformiza o tom e ilumina a pele',                 79.90,  70, 'Skincare'),
  ('Máscara Facial de Argila',       'Purifica os poros e controla a oleosidade',                          27.90, 100, 'Skincare'),
  ('Tônico Facial Calmante',         'Tônico sem álcool que equilibra e refresca a pele',                  32.90,  90, 'Skincare'),
  ('Esfoliante Facial Suave',        'Remove células mortas e deixa a pele macia',                         28.90, 110, 'Skincare'),
  ('Creme para Área dos Olhos',      'Reduz sinais de cansaço, olheiras e linhas finas',                   59.90,  65, 'Skincare'),
  ('Shampoo Hidratação Profunda',    'Limpa e hidrata fios secos e opacos',                                29.90, 150, 'Cabelo'),
  ('Condicionador Reparador',        'Desembaraça e repara pontas ressecadas',                             29.90, 150, 'Cabelo'),
  ('Máscara Capilar Nutritiva',      'Nutrição profunda para cabelos danificados',                         49.90,  95, 'Cabelo'),
  ('Óleo Reparador de Pontas',       'Sela as pontas e dá brilho sem pesar',                               34.90, 120, 'Cabelo'),
  ('Leave-in Protetor Térmico',      'Protege os fios do calor de secador e chapinha',                     37.90, 130, 'Cabelo'),
  ('Creme para Pentear Cachos',      'Define e controla o frizz dos cachos',                               32.90, 110, 'Cabelo'),
  ('Ampola de Reconstrução',         'Tratamento intensivo de reconstrução capilar',                       14.90, 250, 'Cabelo'),
  ('Esmalte Vermelho Clássico',      'Esmalte cremoso de alta cobertura',                                   8.90, 300, 'Esmaltes'),
  ('Esmalte Rosa Nude',              'Tom rosado discreto, acabamento cremoso',                             8.90, 320, 'Esmaltes'),
  ('Esmalte Cremoso Branco',         'Branco opaco para unhas e nail art',                                  8.90, 200, 'Esmaltes'),
  ('Base Fortalecedora Unhas',       'Base que fortalece e protege unhas fracas',                          12.90, 180, 'Esmaltes'),
  ('Top Coat Brilho Gel',            'Finalizador com efeito gel e secagem rápida',                        13.90, 190, 'Esmaltes'),
  ('Removedor de Esmalte',           'Removedor suave, sem acetona',                                        9.90, 210, 'Esmaltes'),
  ('Esmalte Glitter Dourado',        'Esmalte com glitter fino de alta fixação',                           10.90, 150, 'Esmaltes'),
  ('Necessaire Floral',              'Necessaire impermeável com estampa floral',                          24.90,  90, 'Acessorios'),
  ('Espelho de Mão Rosa',            'Espelho compacto de mão com acabamento rosado',                      14.90, 120, 'Acessorios'),
  ('Organizador de Maquiagem',       'Organizador acrílico com vários compartimentos',                     89.90,  45, 'Acessorios'),
  ('Faixa de Cabelo Spa',            'Faixa macia para prender o cabelo na hora da skincare',              12.90, 200, 'Acessorios'),
  ('Scrunchie de Cetim',             'Xuxinha de cetim que não marca nem quebra os fios',                   9.90, 250, 'Acessorios'),
  ('Espelho com LED',                'Espelho de mesa com luz LED e regulagem de brilho',                  79.90,  50, 'Acessorios'),
  ('Cílios Postiços Naturais',       'Par de cílios postiços de efeito natural, reutilizável',             16.90, 140, 'Acessorios'),
  ('Curvador de Cílios',             'Curvador de aço com almofada de silicone',                           19.90, 130, 'Acessorios'),
  ('Pincel para Base',               'Pincel de cerdas sintéticas para aplicação de base líquida',         22.90, 140, 'Pinceis'),
  ('Pincel para Pó',                 'Pincel macio e volumoso para pó compacto e solto',                   24.90, 130, 'Pinceis'),
  ('Pincel de Blush',                'Pincel angulado para blush e contorno',                              21.90, 130, 'Pinceis'),
  ('Pincel para Esfumar Sombra',     'Pincel de cerdas macias para esfumar sombras',                       16.90, 160, 'Pinceis'),
  ('Esponja Blender Rosa',           'Esponja que não absorve produto e dá acabamento uniforme',           15.90, 220, 'Pinceis'),
  ('Kit 12 Pincéis Profissional',    'Kit completo com 12 pincéis e estojo',                              119.90,  40, 'Pinceis'),
  ('Limpador de Pincéis',            'Limpador líquido de secagem rápida para pincéis e esponjas',         22.90, 100, 'Pinceis'),
  ('Eau de Parfum Floral 50ml',      'Fragrância floral delicada e de longa fixação',                     149.90,  60, 'Perfumes'),
  ('Colônia Cítrica 100ml',          'Colônia fresca com notas de limão e bergamota',                      89.90,  80, 'Perfumes'),
  ('Body Splash Frutas Vermelhas',   'Body splash refrescante com notas de frutas vermelhas, 200ml',       39.90, 140, 'Perfumes'),
  ('Perfume Doce Gourmand 50ml',     'Perfume doce com notas de caramelo e baunilha',                     139.90,  55, 'Perfumes'),
  ('Tinta Facial Branca',            'Tinta à base de água para pintura facial e caracterização',          16.90,  90, 'Maquiagem artistica'),
  ('Kit Tintas Faciais 6 Cores',     'Kit com seis cores vibrantes e pincel',                              49.90,  60, 'Maquiagem artistica'),
  ('Glitter Corporal Prata',         'Glitter cosmético para rosto e corpo',                               14.90, 110, 'Maquiagem artistica'),
  ('Lápis Dermatográfico Preto',     'Lápis de alta pigmentação para efeitos e fantasias',                 11.90, 130, 'Maquiagem artistica'),
  ('Sangue Artificial Cênico',       'Gel de sangue falso para teatro e Halloween',                        19.90,  70, 'Maquiagem artistica'),
  ('Cola para Glitter',              'Cola cosmética para fixar glitter na pele',                          13.90,  95, 'Maquiagem artistica'),
  ('Hidratante Corporal Manteiga',   'Hidratação intensa com manteiga de karité',                          39.90, 130, 'Corpo e Banho'),
  ('Sabonete Líquido Floral',        'Sabonete líquido perfumado com notas florais',                       19.90, 160, 'Corpo e Banho'),
  ('Esfoliante Corporal Açúcar',     'Esfoliante de açúcar que renova e suaviza a pele',                   34.90, 100, 'Corpo e Banho'),
  ('Óleo Corporal Amêndoas',         'Óleo de rápida absorção com óleo de amêndoas',                       44.90,  85, 'Corpo e Banho'),
  ('Sais de Banho Lavanda',          'Sais relaxantes com aroma de lavanda',                               27.90,  90, 'Corpo e Banho'),
  ('Kit Presente Maquiagem',         'Kit com batom, máscara de cílios e paleta em caixa de presente',     99.90,  50, 'Kits e Presentes'),
  ('Kit Skincare Completo',          'Sabonete, tônico, sérum e hidratante facial',                       159.90,  40, 'Kits e Presentes'),
  ('Kit Perfume e Hidratante',       'Perfume 50ml com hidratante corporal combinando',                   169.90,  35, 'Kits e Presentes'),
  ('Box Dia das Mães',               'Caixa especial com itens de cuidado e perfumaria',                  129.90,  30, 'Kits e Presentes'),
  ('Kit Natal Beleza',               'Kit de edição limitada com mimos de maquiagem e corpo',             109.90,  45, 'Kits e Presentes'),
  ('Batom Vegano Cereja',            'Batom vegano e cruelty free em tom cereja',                          29.90, 120, 'Maquiagem Vegana'),
  ('Base Vegana Tom Médio',          'Base vegana de cobertura média e acabamento natural',                64.90,  80, 'Maquiagem Vegana'),
  ('Máscara de Cílios Vegana',       'Máscara cruelty free que alonga e define',                           34.90, 100, 'Maquiagem Vegana'),
  ('Blush Vegano Rosé',              'Blush vegano de textura sedosa em tom rosé',                         28.90,  95, 'Maquiagem Vegana'),
  ('Paleta Vegana 9 Cores',          'Paleta de sombras veganas com tons terrosos',                        52.90,  70, 'Maquiagem Vegana')
) AS v(nome, descr, preco, qtd, categoria)
JOIN CATEGORIA c ON c.nome_categoria = v.categoria;

INSERT INTO PRODUTO_FORNECEDOR (id_produto, id_fornecedor)
SELECT p.id_produto, f.id_fornecedor
FROM (VALUES
  ('Base Líquida Matte Nude',        'MAC Cosmetics'),
  ('Corretivo Alta Cobertura',       'Maybelline'),
  ('Pó Compacto Translúcido',        'Vult'),
  ('Batom Matte Vermelho',           'MAC Cosmetics'),
  ('Batom Cremoso Rosa Nude',        'Avon'),
  ('Máscara de Cílios Volume',       'Maybelline'),
  ('Paleta de Sombras 12 Cores',     'Ruby Rose'),
  ('Blush Compacto Pêssego',         'Vult'),
  ('Iluminador em Pó Dourado',       'Boca Rosa Beauty'),
  ('Delineador Líquido Preto',       'Quem Disse, Berenice?'),
  ('Lápis de Olho Preto',            'Vult'),
  ('Gloss Labial Transparente',      'Ruby Rose'),
  ('Primer Facial Matificante',      'L''Oréal Paris'),
  ('Spray Fixador de Make',          'Eudora'),
  ('Gel para Sobrancelhas',          'Quem Disse, Berenice?'),
  ('Contorno em Bastão',             'Boca Rosa Beauty'),
  ('Sabonete Facial Gel',            'CeraVe'),
  ('Água Micelar 200ml',             'L''Oréal Paris'),
  ('Hidratante Ácido Hialurônico',   'La Roche-Posay'),
  ('Protetor Solar FPS 50',          'La Roche-Posay'),
  ('Sérum Vitamina C 30ml',          'L''Oréal Paris'),
  ('Máscara Facial de Argila',       'Natura'),
  ('Tônico Facial Calmante',         'CeraVe'),
  ('Esfoliante Facial Suave',        'Nivea'),
  ('Creme para Área dos Olhos',      'La Roche-Posay'),
  ('Shampoo Hidratação Profunda',    'Natura'),
  ('Condicionador Reparador',        'Natura'),
  ('Máscara Capilar Nutritiva',      'L''Oréal Paris'),
  ('Óleo Reparador de Pontas',       'O Boticário'),
  ('Leave-in Protetor Térmico',      'Eudora'),
  ('Creme para Pentear Cachos',      'Natura'),
  ('Ampola de Reconstrução',         'L''Oréal Paris'),
  ('Esmalte Vermelho Clássico',      'Risqué'),
  ('Esmalte Rosa Nude',              'Risqué'),
  ('Esmalte Cremoso Branco',         'Risqué'),
  ('Base Fortalecedora Unhas',       'Risqué'),
  ('Top Coat Brilho Gel',            'Risqué'),
  ('Removedor de Esmalte',           'Risqué'),
  ('Esmalte Glitter Dourado',        'Ruby Rose'),
  ('Necessaire Floral',              'O Boticário'),
  ('Espelho de Mão Rosa',            'Ruby Rose'),
  ('Organizador de Maquiagem',       'Klass Vough'),
  ('Faixa de Cabelo Spa',            'Eudora'),
  ('Scrunchie de Cetim',             'Océane'),
  ('Espelho com LED',                'Klass Vough'),
  ('Cílios Postiços Naturais',       'Ruby Rose'),
  ('Curvador de Cílios',             'Océane'),
  ('Pincel para Base',               'Klass Vough'),
  ('Pincel para Pó',                 'Klass Vough'),
  ('Pincel de Blush',                'Océane'),
  ('Pincel para Esfumar Sombra',     'Océane'),
  ('Esponja Blender Rosa',           'Klass Vough'),
  ('Kit 12 Pincéis Profissional',    'Klass Vough'),
  ('Limpador de Pincéis',            'Océane'),
  ('Eau de Parfum Floral 50ml',      'O Boticário'),
  ('Colônia Cítrica 100ml',          'Natura'),
  ('Body Splash Baunilha',           'O Boticário'),
  ('Perfume Amadeirado 75ml',        'Natura'),
  ('Body Splash Frutas Vermelhas',   'Eudora'),
  ('Perfume Doce Gourmand 50ml',     'O Boticário'),
  ('Tinta Facial Branca',            'Ruby Rose'),
  ('Kit Tintas Faciais 6 Cores',     'Ruby Rose'),
  ('Glitter Corporal Prata',         'Océane'),
  ('Lápis Dermatográfico Preto',     'Quem Disse, Berenice?'),
  ('Sangue Artificial Cênico',       'Ruby Rose'),
  ('Cola para Glitter',              'Océane'),
  ('Hidratante Corporal Manteiga',   'Granado'),
  ('Hidratante Corporal Manteiga',   'Nivea'),
  ('Sabonete Líquido Floral',        'Granado'),
  ('Esfoliante Corporal Açúcar',     'Natura'),
  ('Óleo Corporal Amêndoas',         'Granado'),
  ('Sais de Banho Lavanda',          'Granado'),
  ('Kit Presente Maquiagem',         'Avon'),
  ('Kit Skincare Completo',          'CeraVe'),
  ('Kit Skincare Completo',          'La Roche-Posay'),
  ('Kit Perfume e Hidratante',       'O Boticário'),
  ('Box Dia das Mães',               'Natura'),
  ('Box Dia das Mães',               'Eudora'),
  ('Kit Natal Beleza',               'Avon'),
  ('Batom Vegano Cereja',            'Vult'),
  ('Base Vegana Tom Médio',          'Natura'),
  ('Máscara de Cílios Vegana',       'Vult'),
  ('Blush Vegano Rosé',              'Quem Disse, Berenice?'),
  ('Paleta Vegana 9 Cores',          'Natura')
) AS v(produto, fornecedor)
JOIN PRODUTO p    ON p.nome_prod = v.produto
JOIN FORNECEDOR f ON f.nome_fornecedor = v.fornecedor;

INSERT INTO PEDIDO (cpf_pessoa, data_pedido, status_pedido, id_frete) VALUES
('11122233301', '2026-08-05', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233303', '2026-08-09', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'São Paulo')),
('11122233304', '2026-08-14', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233306', '2026-08-20', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Rio de Janeiro')),
('11122233307', '2026-08-25', 'Cancelado',            (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233309', '2026-08-30', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Minas Gerais')),
('11122233310', '2026-09-02', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Bahia')),
('11122233311', '2026-09-06', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233312', '2026-09-10', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Rio Grande do Sul')),
('11122233314', '2026-09-13', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'São Paulo')),
('11122233315', '2026-09-18', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233317', '2026-09-21', 'Cancelado',            (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Santa Catarina')),
('11122233319', '2026-09-25', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Goiás')),
('11122233320', '2026-09-28', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'São Paulo')),
('11122233301', '2026-10-03', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233303', '2026-10-07', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'São Paulo')),
('11122233306', '2026-10-10', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Rio de Janeiro')),
('11122233310', '2026-10-14', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Bahia')),
('11122233314', '2026-10-17', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'São Paulo')),
('11122233304', '2026-10-20', 'Entregue',             (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233307', '2026-10-24', 'Enviado',              (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233312', '2026-10-26', 'Enviado',              (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Rio Grande do Sul')),
('11122233311', '2026-10-28', 'Enviado',              (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Pernambuco')),
('11122233309', '2026-10-29', 'Em Separação',         (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Minas Gerais')),
('11122233315', '2026-10-30', 'Em Separação',         (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233320', '2026-10-31', 'Pago',                 (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Distrito Federal')),
('11122233303', '2026-11-01', 'Pago',                 (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'São Paulo')),
('11122233301', '2026-11-02', 'Pago',                 (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Paraná')),
('11122233319', '2026-11-02', 'Aguardando Pagamento', (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Mato Grosso do Sul')),
('11122233310', '2026-11-03', 'Aguardando Pagamento', (SELECT id_frete FROM FRETE_ESTADO WHERE estado = 'Bahia'));

INSERT INTO ITEM_PEDIDO (id_pedido, id_produto, quantidade, preco_unitario)
SELECT v.pedido, p.id_produto, v.qtd, p.preco
FROM (VALUES
  (1,  'Base Líquida Matte Nude',        1),
  (1,  'Batom Matte Vermelho',           1),
  (1,  'Pincel para Base',               1),
  (2,  'Sabonete Facial Gel',            1),
  (2,  'Hidratante Ácido Hialurônico',   1),
  (2,  'Protetor Solar FPS 50',          1),
  (3,  'Esmalte Rosa Nude',              2),
  (3,  'Base Fortalecedora Unhas',       1),
  (3,  'Top Coat Brilho Gel',            1),
  (4,  'Eau de Parfum Floral 50ml',      1),
  (4,  'Body Splash Baunilha',           1),
  (5,  'Kit Presente Maquiagem',         1),
  (6,  'Shampoo Hidratação Profunda',    1),
  (6,  'Condicionador Reparador',        1),
  (6,  'Máscara Capilar Nutritiva',      1),
  (7,  'Paleta de Sombras 12 Cores',     1),
  (7,  'Delineador Líquido Preto',       1),
  (7,  'Máscara de Cílios Volume',       1),
  (7,  'Lápis de Olho Preto',            2),
  (8,  'Kit 12 Pincéis Profissional',    1),
  (8,  'Esponja Blender Rosa',           2),
  (9,  'Sérum Vitamina C 30ml',          1),
  (9,  'Creme para Área dos Olhos',      1),
  (10, 'Perfume Amadeirado 75ml',        1),
  (11, 'Batom Cremoso Rosa Nude',        2),
  (11, 'Gloss Labial Transparente',      1),
  (12, 'Kit Skincare Completo',          1),
  (13, 'Hidratante Corporal Manteiga',   1),
  (13, 'Sabonete Líquido Floral',        2),
  (13, 'Esfoliante Corporal Açúcar',     1),
  (14, 'Base Vegana Tom Médio',          1),
  (14, 'Batom Vegano Cereja',            1),
  (14, 'Blush Vegano Rosé',              1),
  (15, 'Primer Facial Matificante',      1),
  (15, 'Spray Fixador de Make',          1),
  (15, 'Pó Compacto Translúcido',        1),
  (16, 'Corretivo Alta Cobertura',       2),
  (16, 'Iluminador em Pó Dourado',       1),
  (17, 'Box Dia das Mães',               1),
  (18, 'Água Micelar 200ml',             2),
  (18, 'Tônico Facial Calmante',         1),
  (18, 'Máscara Facial de Argila',       1),
  (19, 'Necessaire Floral',              1),
  (19, 'Espelho com LED',                1),
  (19, 'Curvador de Cílios',             1),
  (20, 'Leave-in Protetor Térmico',      1),
  (20, 'Óleo Reparador de Pontas',       1),
  (20, 'Creme para Pentear Cachos',      1),
  (21, 'Kit Perfume e Hidratante',       1),
  (22, 'Tinta Facial Branca',            2),
  (22, 'Glitter Corporal Prata',         1),
  (22, 'Cola para Glitter',              1),
  (23, 'Blush Compacto Pêssego',         1),
  (23, 'Contorno em Bastão',             1),
  (23, 'Pincel de Blush',                1),
  (24, 'Esmalte Vermelho Clássico',      3),
  (24, 'Removedor de Esmalte',           1),
  (25, 'Perfume Doce Gourmand 50ml',     1),
  (25, 'Body Splash Frutas Vermelhas',   1),
  (26, 'Kit Natal Beleza',               2),
  (27, 'Paleta Vegana 9 Cores',          1),
  (27, 'Máscara de Cílios Vegana',       1),
  (28, 'Scrunchie de Cetim',             3),
  (28, 'Faixa de Cabelo Spa',            2),
  (29, 'Óleo Corporal Amêndoas',         1),
  (29, 'Sais de Banho Lavanda',          1),
  (30, 'Gel para Sobrancelhas',          1),
  (30, 'Cílios Postiços Naturais',       2),
  (30, 'Limpador de Pincéis',            1)
) AS v(pedido, produto, qtd)
JOIN PRODUTO p ON p.nome_prod = v.produto;

INSERT INTO PAGAMENTO (id_pedido, valor_pagamento, id_formapag, status_pagamento, data_pagamento)
SELECT ped.id_pedido,
       t.total + fr.valor_frete,
       fp.id_formapag,
       v.status,
       v.data_pag
FROM (VALUES
  (1,  'Pix',               'Aprovado',  DATE '2026-08-05'),
  (2,  'Cartão de Crédito', 'Aprovado',  DATE '2026-08-09'),
  (3,  'Cartão de Débito',  'Aprovado',  DATE '2026-08-14'),
  (4,  'Boleto Bancário',   'Aprovado',  DATE '2026-08-22'),
  (5,  'Cartão de Crédito', 'Estornado', DATE '2026-08-25'),
  (6,  'Pix',               'Aprovado',  DATE '2026-08-30'),
  (7,  'Cartão de Crédito', 'Aprovado',  DATE '2026-09-02'),
  (8,  'Pix',               'Aprovado',  DATE '2026-09-06'),
  (9,  'Boleto Bancário',   'Aprovado',  DATE '2026-09-12'),
  (10, 'Cartão de Crédito', 'Aprovado',  DATE '2026-09-13'),
  (11, 'Cartão de Débito',  'Aprovado',  DATE '2026-09-18'),
  (12, 'Pix',               'Cancelado', NULL),
  (13, 'Pix',               'Aprovado',  DATE '2026-09-25'),
  (14, 'Cartão de Crédito', 'Aprovado',  DATE '2026-09-28'),
  (15, 'Pix',               'Aprovado',  DATE '2026-10-03'),
  (16, 'Cartão de Crédito', 'Aprovado',  DATE '2026-10-07'),
  (17, 'Boleto Bancário',   'Aprovado',  DATE '2026-10-12'),
  (18, 'Pix',               'Aprovado',  DATE '2026-10-14'),
  (19, 'Cartão de Crédito', 'Aprovado',  DATE '2026-10-17'),
  (20, 'Cartão de Débito',  'Aprovado',  DATE '2026-10-20'),
  (21, 'Pix',               'Aprovado',  DATE '2026-10-24'),
  (22, 'Cartão de Crédito', 'Aprovado',  DATE '2026-10-26'),
  (23, 'Pix',               'Aprovado',  DATE '2026-10-28'),
  (24, 'Cartão de Débito',  'Aprovado',  DATE '2026-10-29'),
  (25, 'Cartão de Crédito', 'Aprovado',  DATE '2026-10-30'),
  (26, 'Pix',               'Aprovado',  DATE '2026-10-31'),
  (27, 'Boleto Bancário',   'Aprovado',  DATE '2026-11-03'),
  (28, 'Cartão de Crédito', 'Aprovado',  DATE '2026-11-02'),
  (29, 'Boleto Bancário',   'Pendente',  NULL),
  (30, 'Pix',               'Pendente',  NULL)
) AS v(pedido, forma, status, data_pag)
JOIN PEDIDO ped        ON ped.id_pedido = v.pedido
JOIN FRETE_ESTADO fr   ON fr.id_frete = ped.id_frete
JOIN FORMA_PAGAMENTO fp ON fp.forma_pag = v.forma
JOIN (
  SELECT id_pedido, SUM(quantidade * preco_unitario) AS total
  FROM ITEM_PEDIDO
  GROUP BY id_pedido
) t ON t.id_pedido = ped.id_pedido;

-- Tipos de produto dentro de cada categoria (Maquiagem -> Base, Sombra, Batom...)
-- Rode no seu banco (PostgreSQL) e depois cadastre/atualize os produtos com o id_subcategoria certo.
-- Confira se os nomes das tabelas e colunas batem com o seu bellemi.sql.
