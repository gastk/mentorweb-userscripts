# mentorweb-userscripts

Userscripts (Tampermonkey) que ajustam telas do sistema Mentor Web, mantidos para uso interno de TI.

Cada script fica em sua própria pasta dentro de [`scripts/`](scripts/), com README próprio (uso, funcionamento, limitações e histórico de versões) e atualização automática pelo Tampermonkey.

## Scripts

| Script | O que faz |
|---|---|
| [preview-anexos](scripts/preview-anexos/) | Pré-visualização de anexos em modal, ao lado do botão de download |

O link de instalação de cada script está no README da respectiva pasta.

## Requisitos

[Tampermonkey](https://www.tampermonkey.net/) instalado no navegador. Instale cada script pelo link do seu README, e não colando o código manualmente, para que o Tampermonkey registre a URL de atualização.

## Convenções

- Uma pasta por script em `scripts/`, com o mesmo nome do arquivo `.user.js`.
- Cada script tem seu próprio `@version`, `@updateURL` e `@downloadURL`, apontando para o próprio arquivo.
- Incremente o `@version` a cada alteração publicada. Sem isso, o Tampermonkey não atualiza.
- Os caminhos dos arquivos são parte do mecanismo de atualização. Não mover nem renomear arquivos já publicados sem antes publicar uma versão final no caminho antigo apontando para o novo.
- Agrupamento por assunto é feito apenas neste README, nunca em pastas, para não alterar caminhos.

## Aviso

Os scripts rodam dentro da sessão logada do sistema, com acesso ao que o usuário vê. Mantenha a conta do GitHub com autenticação em dois fatores e limite quem tem permissão de escrita neste repositório.