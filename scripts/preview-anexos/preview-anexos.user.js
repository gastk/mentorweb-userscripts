// ==UserScript==
// @name         (Mentor Web) Preview de anexos
// @namespace    local.preview-anexos
// @version      2.4
// @description  Pré-visualização de anexos em modal (Shift+clique abre direto em nova aba)
// @match        https://*.mentorweb.ws/*/documentoentregueman.do*
// @updateURL    https://raw.githubusercontent.com/gastk/mentorweb-userscripts/main/scripts/preview-anexos/preview-anexos.user.js
// @downloadURL  https://raw.githubusercontent.com/gastk/mentorweb-userscripts/main/scripts/preview-anexos/preview-anexos.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const RE_DOWNLOAD = /^javascript:download\('([^']*)',\s*'([^']*)'\)/;
  const PREVIEWAVEL = /^(image\/|application\/pdf|text\/plain)/i;
  // Imagens que o navegador não consegue exibir: caem no download original
  const NAO_RENDERIZAVEL = /^image\/(heic|heif|tiff)/i;

  const ICONE =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a56db" ' +
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

  const ESTILO_BTN =
    'display:inline-flex;align-items:center;justify-content:center;' +
    'width:22px;height:22px;box-sizing:border-box;' +
    'border:1px solid #b5bcc7;border-radius:4px;' +
    'background:linear-gradient(#ffffff,#e9edf2);' +
    'cursor:pointer;text-decoration:none;';
  const ESTILO_BTN_HOVER = 'background:linear-gradient(#ffffff,#dbe7fb);border-color:#1a56db;';

  const ESTILO_ACAO =
    'font:13px/1 Verdana,Arial,sans-serif;padding:7px 12px;margin:0 0 0 6px;' +
    'border:1px solid #b5bcc7;border-radius:4px;background:linear-gradient(#fff,#e9edf2);' +
    'color:#222;cursor:pointer;';

  // ---------- Utilidades ----------

  function baseAction() {
    let action = location.pathname;
    try { if (typeof getForm === 'function') action = getForm().action; } catch (e) {}
    const i = action.indexOf('.do?');
    if (i >= 0) action = action.substring(0, i + 3);
    return action;
  }

  function montaUrl(id, propriedade) {
    return baseAction() + '?evento=download' +
      '&IDUpload=' + encodeURIComponent(id) +
      '&propriedadeEntidadeAnexo=' + encodeURIComponent(propriedade);
  }

  function nomeDoArquivo(resp, id) {
    const cd = resp.headers.get('content-disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
    return 'anexo-' + id;
  }

  // Identifica o tipo real pelos primeiros bytes do arquivo. O servidor às vezes informa um
  // Content-Type errado (ex.: PDF rotulado como image/png), então o header é só o plano B.
  function detectaTipo(bytes, tipoHeader) {
    const ascii = (ini, fim) => String.fromCharCode.apply(null, bytes.subarray(ini, fim));

    // PDF: "%PDF-" nos primeiros 1024 bytes (alguns geradores põem lixo antes do cabeçalho)
    if (ascii(0, Math.min(1024, bytes.length)).indexOf('%PDF-') >= 0) return 'application/pdf';

    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
    if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
    if (ascii(0, 4) === 'GIF8') return 'image/gif';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';

    // TIFF (o navegador não exibe)
    if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
        (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)) return 'image/tiff';

    // Contêiner ISO (HEIC/HEIF de iPhone e AVIF): "ftyp" na posição 4, marca logo depois
    if (ascii(4, 8) === 'ftyp') {
      const marca = ascii(8, 12);
      if (marca === 'avif') return 'image/avif';
      if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(marca)) return 'image/heic';
    }

    return tipoHeader;
  }

  // Busca o arquivo e devolve { blobUrl, tipo, nome }, ou null se não for previsualizável
  async function buscaArquivo(id, propriedade) {
    const resp = await fetch(montaUrl(id, propriedade), { credentials: 'same-origin' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const tipoHeader = (resp.headers.get('content-type') || '').split(';')[0].trim();
    const buffer = await resp.arrayBuffer();
    const tipo = detectaTipo(new Uint8Array(buffer), tipoHeader);
    if (!PREVIEWAVEL.test(tipo) || NAO_RENDERIZAVEL.test(tipo)) return null;
    const blob = new Blob([buffer], { type: tipo });
    return { blobUrl: URL.createObjectURL(blob), tipo, nome: nomeDoArquivo(resp, id) };
  }

  // Janela onde a modal será desenhada: a principal, se acessível; senão o próprio iframe
  function alvoDaModal() {
    try {
      void window.top.document.body; // lança exceção se for outro domínio
      return window.top;
    } catch (e) {
      return window;
    }
  }

  // ---------- Shift+clique: abre direto em nova aba ----------

  async function abrirDireto(id, propriedade) {
    const janela = window.open('', '_blank'); // síncrono, para evitar bloqueio de pop-up
    if (janela) janela.document.write('<p style="font-family:sans-serif">Carregando documento...</p>');
    try {
      const arq = await buscaArquivo(id, propriedade);
      if (!arq) { if (janela) janela.close(); window.download(id, propriedade); return; }
      if (janela) janela.location.href = arq.blobUrl; else window.open(arq.blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(arq.blobUrl), 10 * 60 * 1000);
    } catch (err) {
      console.error('[Preview anexos] falha, usando download original:', err);
      if (janela) janela.close();
      window.download(id, propriedade);
    }
  }

  // ---------- Clique normal: modal ----------

  async function abrirModal(id, propriedade) {
    const alvo = alvoDaModal();
    const doc = alvo.document;

    const antiga = doc.getElementById('pv-overlay');
    if (antiga) antiga.remove();

    const el = (tag, css, html) => {
      const n = doc.createElement(tag);
      if (css) n.style.cssText = css;
      if (html != null) n.innerHTML = html;
      return n;
    };
    const botao = (texto) => {
      const b = el('button', ESTILO_ACAO, texto);
      b.type = 'button';
      return b;
    };

    const overlay = el('div',
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);' +
      'display:flex;align-items:center;justify-content:center;z-index:2147483647;');
    overlay.id = 'pv-overlay';

    const caixa = el('div',
      'width:92%;height:92%;max-width:1200px;background:#fff;border-radius:6px;' +
      'display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.4);');

    const topo = el('div',
      'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;' +
      'background:#c9dbe9;border-bottom:1px solid #9fb6c9;flex:0 0 auto;');
    const titulo = el('div',
      'font:bold 13px Verdana,Arial,sans-serif;color:#1c3d5a;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap;', 'Carregando...');
    const acoes = el('div', 'display:flex;flex:0 0 auto;');

    const bAba = botao('Nova aba');
    const bPopup = botao('Popup');
    const bBaixar = botao('Baixar');
    const bFechar = botao('Fechar');
    [bAba, bPopup, bBaixar].forEach(b => { b.disabled = true; b.style.opacity = '.5'; });
    acoes.append(bAba, bPopup, bBaixar, bFechar);
    topo.append(titulo, acoes);

    const corpo = el('div',
      'flex:1 1 auto;min-height:0;background:#e8e8e8;display:flex;align-items:center;justify-content:center;' +
      'font:14px Verdana,Arial,sans-serif;color:#444;', 'Carregando documento...');

    caixa.append(topo, corpo);
    overlay.appendChild(caixa);
    doc.body.appendChild(overlay);

    let blobUrl = null;

    function fechar() {
      overlay.remove();
      doc.removeEventListener('keydown', onKey, true);
      if (alvo !== window) document.removeEventListener('keydown', onKey, true);
      if (blobUrl) { const u = blobUrl; setTimeout(() => URL.revokeObjectURL(u), 60 * 1000); }
    }
    function onKey(e) { if (e.key === 'Escape') fechar(); }

    bFechar.addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
    doc.addEventListener('keydown', onKey, true);
    if (alvo !== window) document.addEventListener('keydown', onKey, true);

    try {
      const arq = await buscaArquivo(id, propriedade);
      if (!doc.body.contains(overlay)) {
        if (arq) URL.revokeObjectURL(arq.blobUrl); // modal fechada durante o carregamento
        return;
      }
      if (!arq) { fechar(); window.download(id, propriedade); return; } // tipo sem preview

      blobUrl = arq.blobUrl;
      titulo.textContent = arq.nome;
      titulo.title = arq.nome;

      corpo.innerHTML = '';

      if (/^image\//i.test(arq.tipo)) {
        // Imagem: cabe inteira na modal; clique alterna entre ajustada e tamanho real
        corpo.style.cssText =
          'flex:1 1 auto;min-height:0;background:#e8e8e8;display:flex;overflow:hidden;';
        const img = el('img',
          'margin:auto;display:block;max-width:100%;max-height:100%;min-width:0;' +
          'object-fit:contain;cursor:zoom-in;');
        img.src = blobUrl;
        img.title = 'Clique para ampliar';
        img.addEventListener('error', () => {
          // Evita o ícone de imagem quebrada: avisa e deixa o botão Baixar à mão
          corpo.style.cssText =
            'flex:1 1 auto;min-height:0;background:#e8e8e8;display:flex;align-items:center;' +
            'justify-content:center;font:14px Verdana,Arial,sans-serif;color:#444;text-align:center;padding:20px;';
          corpo.textContent = 'Não foi possível exibir este arquivo. Use o botão Baixar.';
        });

        let ampliado = false;
        img.addEventListener('click', () => {
          ampliado = !ampliado;
          if (ampliado) {
            corpo.style.overflow = 'auto';
            img.style.maxWidth = 'none';
            img.style.maxHeight = 'none';
            img.style.flexShrink = '0';
            img.style.cursor = 'zoom-out';
            img.title = 'Clique para ajustar à tela';
            // centraliza a rolagem ao ampliar
            corpo.scrollLeft = (corpo.scrollWidth - corpo.clientWidth) / 2;
            corpo.scrollTop = (corpo.scrollHeight - corpo.clientHeight) / 2;
          } else {
            corpo.style.overflow = 'hidden';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.flexShrink = '';
            img.style.cursor = 'zoom-in';
            img.title = 'Clique para ampliar';
          }
        });
        corpo.appendChild(img);
      } else {
        // PDF / texto: visualizador nativo
        corpo.style.display = 'block';
        const frame = el('iframe', 'width:100%;height:100%;border:0;background:#fff;');
        frame.src = blobUrl;
        corpo.appendChild(frame);
      }

      [bAba, bPopup, bBaixar].forEach(b => { b.disabled = false; b.style.opacity = '1'; });
      bAba.addEventListener('click', () => window.open(blobUrl, '_blank'));
      bPopup.addEventListener('click', () =>
        window.open(blobUrl, 'previewAnexo', 'width=1000,height=750,resizable=yes,scrollbars=yes'));
      bBaixar.addEventListener('click', () => {
        const a = doc.createElement('a');
        a.href = blobUrl;
        a.download = arq.nome;
        doc.body.appendChild(a);
        a.click();
        a.remove();
      });
    } catch (err) {
      console.error('[Preview anexos] falha:', err);
      titulo.textContent = 'Erro ao carregar o documento';
      corpo.textContent = 'Não foi possível carregar a pré-visualização. Use o download original.';
    }
  }

  // ---------- Injeção do botão ----------

  function injetaBotao(link) {
    if (link.dataset.pvOk) return;
    const m = RE_DOWNLOAD.exec(link.getAttribute('href') || '');
    if (!m) return; // assinatura eletrônica, +info etc. ficam de fora
    link.dataset.pvOk = '1';

    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;white-space:nowrap;';
    link.parentNode.insertBefore(wrap, link);
    wrap.appendChild(link);
    link.style.cssText += ';display:inline-flex;align-items:center;';

    const btn = document.createElement('a');
    btn.href = '#';
    btn.className = 'pv-btn';
    btn.title = 'Pré-visualizar (Shift+clique: abrir direto em nova aba)';
    btn.style.cssText = ESTILO_BTN;
    btn.innerHTML = ICONE;

    btn.addEventListener('mouseenter', () => { btn.style.cssText = ESTILO_BTN + ESTILO_BTN_HOVER; });
    btn.addEventListener('mouseleave', () => { btn.style.cssText = ESTILO_BTN; });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (e.shiftKey) abrirDireto(m[1], m[2]);
      else abrirModal(m[1], m[2]);
    });

    wrap.appendChild(btn);
  }

  function varre(raiz) {
    (raiz || document).querySelectorAll('a[href^="javascript:download("]').forEach(injetaBotao);
  }

  varre();
  new MutationObserver(() => varre()).observe(document.body, { childList: true, subtree: true });
})();