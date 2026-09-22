# Roleta do Perguntados

Roleta para partidas de Perguntados (Trivia Crack): toque no tabuleiro e o ponteiro gira até parar numa categoria.

**Ao vivo:** https://www.victornogueira.app/roleta-perguntados/

| Claro | Escuro |
| --- | --- |
| <img src="screenshots/light.png" alt="Roleta no tema claro, com o ponteiro parado em Ciências" width="100%"> | <img src="screenshots/dark.png" alt="Roleta no tema escuro, com o ponteiro parado em Entretenimento" width="100%"> |

## O que faz

- Sete setores: Geografia, História, Ciências, Arte, Esportes, Entretenimento e Coroa. O botão **Coroa** reduz a roleta para seis setores reais, em vez de pular um setor desenhado.
- O ponteiro gira sobre um disco fixo, igual à roleta de papelão do jogo.
- Um tique a cada setor que o ponteiro cruza, desacelerando junto com ele. **Som** desliga o áudio.
- As últimas oito rodadas ficam na tela.
- A barra de espaço também gira. Respeita `prefers-reduced-motion` (vai direto para o resultado) e segue o tema claro/escuro do sistema.
- A tela fica acesa enquanto a aba está visível, para o celular passado na mesa não dormir entre o giro e o anúncio da categoria. Usa a [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API): Baseline desde março de 2025, precisa de contexto seguro, e navegadores sem a API ficam sem o lock e sem erro. A plataforma libera o lock quando a aba vai para segundo plano, e a página pede um novo quando ela volta.
- As escolhas de Coroa e Som ficam salvas no `localStorage`.

## Sorteio justo

O setor do resultado é sorteado primeiro, com distribuição uniforme, e o ângulo final é derivado dele (nunca o contrário). O ponto de parada fica sempre a pelo menos 9,77° da borda de um setor, então o ponteiro nunca para numa posição ambígua.

Verificado de duas formas: 600.000 giros simulados ficam dentro da faixa esperada de um sorteio uniforme (χ² = 6,4 com 6 graus de liberdade para sete setores, e 8,5 com 5 graus de liberdade para seis), e 48 giros num navegador sem interface testam o pixel sob a ponta do ponteiro contra a categoria anunciada, e coincidem em todas, nos dois modos.

## Como rodar

Um arquivo só, sem build, sem dependências:

```sh
python3 -m http.server
```

Depois abra `http://localhost:8000`. Abrir o `index.html` direto do sistema de arquivos também funciona.

A única requisição externa é a folha de estilos do Google Fonts (Baloo 2 e Archivo). Offline, entram as fontes do sistema.

## Verificação

Os checks de cor e de parada estão em `verify/check.mjs`. É ferramenta de desenvolvimento: a página continua sendo um arquivo único, sem dependências.

```sh
npm install
npm run verify   # checks da paleta e da parada forçada
npm run shots    # os mesmos checks, e regrava screenshots/{light,dark}.png
```

Ela serve o repositório numa porta local descartável e controla um Chromium sem interface:

- O preenchimento de cada fatia, o ponto da legenda e o traço dos ícones, com Coroa ligada (sete setores) e desligada (seis).
- Uma parada forçada em cada uma das sete categorias, conferindo se o cartão de resultado traz a cor daquela categoria e se o texto tem pelo menos 3:1 de contraste contra ela. A paleta tem um amarelo claro, então a cor do texto é derivada por categoria, em vez de ser branco fixo.
- O wake lock, com `navigator.wakeLock` e `document.visibilityState` simulados, para nenhum celular de verdade precisar dormir: pedido no carregamento, nunca duplicado enquanto um lock está ativo ou em andamento, repetido a cada retorno à visibilidade, e inerte onde a API não existe.
- Ao regerar as capturas de tela: a categoria anunciada, os chips do histórico e a contagem de setores.

A simulação do sorteio justo acima foi rodada à parte e não faz parte desse script.

## Notas

Perguntados e Trivia Crack são marcas registradas da Etermax. Esta é uma roleta não oficial, com ícones próprios, sem afiliação com a Etermax e sem endosso dela.

## Licença

MIT
