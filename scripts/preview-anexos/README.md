# preview-anexos

Adiciona um botão de pré-visualização ao lado do download de cada anexo na relação de documentos entregues, para ver o arquivo sem baixá-lo.

## Instalação

[Instalar via Tampermonkey](https://raw.githubusercontent.com/gastk/mentorweb-userscripts/main/scripts/preview-anexos/preview-anexos.user.js)

## Uso

- **Clique no botão (olho)**: abre o documento em uma janela modal sobre a página.
- **Shift + clique**: abre o documento direto em uma nova aba.
- Na modal: botões **Nova aba**, **Popup**, **Baixar** e **Fechar**. A tecla ESC e o clique fora da janela também fecham.
- **Imagens** aparecem inteiras, sem barras de rolagem. Clicar na imagem alterna entre ajustada à tela e tamanho real.
- **PDF e texto** usam o visualizador nativo do navegador.
- Tipos sem pré-visualização (por exemplo, documentos do Word) caem no download original do sistema.

O botão original de download é mantido. Links que não são de download (assinatura eletrônica, "+info") não são alterados.

## Como funciona

1. O script procura links `javascript:download('<id>', '<propriedade>')` na tela e adiciona o botão ao lado.
2. Ao clicar, busca o arquivo com `fetch` na mesma URL que o botão de download do sistema usa.
3. O servidor responde com `Content-Disposition: attachment`, o que forçaria o download. Por isso o conteúdo é convertido em um `Blob` com o tipo correto e exibido por uma URL local, ignorando esse cabeçalho.
4. Como a tela do sistema roda em um iframe, a modal é desenhada na janela principal quando o navegador permite. Se a página pai for de outro domínio, ela aparece dentro do próprio iframe.
5. As linhas de anexos são inseridas via AJAX, então um `MutationObserver` cuida dos botões de linhas carregadas depois.

## Limitações conhecidas

- Depende da estrutura atual do HTML do sistema (`javascript:download(...)`). Uma mudança no sistema pode exigir ajuste.
- Se o iframe do sistema tiver `sandbox` sem `allow-popups`, os botões "Nova aba" e "Popup" podem ser bloqueados.
- O `@match` é genérico quanto ao caminho (`https://*.mentorweb.ws/*/documentoentregueman.do*`). Para restringir a um domínio específico, use a aba Configurações do script no Tampermonkey, em "Corresponder ao usuário".

## Versões

| Versão | Mudanças |
|---|---|
| 2.4 | Tipo do arquivo identificado pelos primeiros bytes (corrige PDF rotulado como imagem); HEIC/TIFF caem no download; aviso no lugar do ícone de imagem quebrada |
| 2.3 | Cabeçalho neutro, URLs de atualização automática |
| 2.1 | Imagens inteiras na modal, com zoom por clique |
| 2.0 | Modal de pré-visualização, Shift+clique abre em nova aba |
| 1.x | Botão de pré-visualização ao lado do download |