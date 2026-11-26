(() => {
  const COOKIE_NOME = 'bellemi_cookie_consent';
  const COOKIE_ACEITO = `${COOKIE_NOME}=accepted`;

  function cookiesAtivos() {
    return document.cookie.split(';').some(cookie => cookie.trim() === COOKIE_ACEITO);
  }

  function aceitarCookies() {
    const seguro = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_ACEITO}; Max-Age=15552000; Path=/; SameSite=Lax${seguro}`;
  }

  function mostrarAviso() {
    if (cookiesAtivos() || !document.body) return;

    const aviso = document.createElement('section');
    aviso.className = 'bellemi-cookies';
    aviso.setAttribute('role', 'region');
    aviso.setAttribute('aria-label', 'Aviso sobre cookies');

    const texto = document.createElement('div');
    texto.className = 'bellemi-cookies-texto';
    const titulo = document.createElement('strong');
    titulo.textContent = 'Sua experiência, com carinho';
    const descricao = document.createElement('p');
    descricao.textContent = 'Usamos um cookie essencial para manter sua sessão de login. Ele é necessário para acessar sua conta.';
    texto.append(titulo, descricao);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'bellemi-cookies-aceitar';
    botao.textContent = 'Aceitar cookies';
    botao.addEventListener('click', () => {
      aceitarCookies();
      aviso.remove();
    });

    aviso.append(texto, botao);
    document.body.append(aviso);
  }

  const scriptAtual = document.currentScript;
  if (scriptAtual) {
    const folha = document.createElement('link');
    folha.rel = 'stylesheet';
    folha.href = new URL('./cookies.css', scriptAtual.src).href;
    document.head.append(folha);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mostrarAviso, { once: true });
  } else {
    mostrarAviso();
  }
})();
