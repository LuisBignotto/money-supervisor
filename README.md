# money-supervisor

Aplicação pessoal para acompanhar investimentos a partir dos arquivos exportados da **Área do Investidor da B3**. Roda inteira no navegador: sem back-end, sem conta, sem enviar seus dados para lugar nenhum.

## O que faz

- **Importar** os `.xlsx` da B3 (Negociação, Movimentação e Posição), sem duplicar nem perder dados quando os períodos se sobrepõem.
- **Carteira:** valor atual, custo, resultado não realizado, ganho total, rentabilidade anualizada, evolução do dinheiro aportado e rentabilidade por ativo.
- **Proventos:** dividendos, JCP e rendimentos por mês, por tipo e por ativo.
- **Cotações:** preços de mercado via [brapi.dev](https://brapi.dev), que substituem o preço da Posição quando são mais novos.

Toda métrica tem um ícone ⓘ explicando o que ela é e como é calculada.

## Como rodar

Precisa de Node 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que o terminal mostrar (normalmente `http://localhost:5173`).

### Cotações (opcional)

Crie um token gratuito em [brapi.dev](https://brapi.dev) e coloque num arquivo `.env` na raiz:

```
VITE_BRAPI_TOKEN=seu_token
```

Sem o token, o app funciona normalmente usando os preços da Posição. O plano gratuito busca um ativo por vez, então atualizar leva alguns segundos.

## Como usar

1. Na Área do Investidor da B3, exporte **Negociação**, **Movimentação** e **Posição** (`.xlsx`). Não renomeie os arquivos: o tipo e a data da Posição vêm do nome (`negociacao-…`, `movimentacao-…`, `posicao-aaaa-mm-dd-…`).
2. Na aba **Importar**, solte os arquivos. Pode reimportar períodos que se sobrepõem: o que já existe é reconhecido e nada é duplicado nem apagado.
3. Veja os resultados nas outras abas. Para atualizar preços, use **Cotações**.

## Privacidade

- Os dados importados ficam só no **IndexedDB do seu navegador**. Limpar os dados do site apaga tudo, e então é só importar de novo.
- Planilhas, backups e `.env` estão no `.gitignore`. Não commite arquivos reais da B3; os testes usam dados fictícios.
- O token da brapi vai junto no código que o navegador baixa. Tudo bem rodando localmente; **não publique o app num site** com o seu token.

## Limitações conhecidas

- Resultado **bruto**: corretagem, taxas e IR não vêm nos arquivos da B3 e não entram nas contas.
- Eventos corporativos: só desdobro/grupamento (lançados como quantidade). Bonificação com custo e mudança de ticker não são tratados.
- Direitos de subscrição (tickers terminados em `12`) aparecem avisando que não constam na Posição.

## Desenvolvimento

```bash
npm test        # testes (Vitest)
npm run lint    # oxlint
npm run build   # typecheck + build de produção
```

Stack: React, Vite, TypeScript, Tailwind, Recharts, `decimal.js` (dinheiro nunca em float), `read-excel-file` e `idb`.

```
src/
  domain/    # cálculos puros e testados (preço médio, proventos, retorno)
  import/    # leitura e validação dos .xlsx da B3
  storage/   # IndexedDB
  prices/    # cliente da brapi
  ui/        # telas
```

Detalhes de decisões e do layout da B3 em [`CLAUDE.md`](CLAUDE.md).
