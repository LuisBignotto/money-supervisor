# money-supervisor

Aplicação pessoal (um único usuário, uso próprio) para acompanhar meus investimentos. Importa os arquivos exportados da Área do Investidor da B3 e calcula/mostra preços, ganhos, lucros, dividendos, etc.

## Stack (decidida)

Somente front-end, sem back-end. Roda local (`npm run dev` / `npm run preview`).

- React + Vite + TypeScript
- Persistência: IndexedDB no navegador (backup via exportar/importar JSON)
- Cotações: brapi.dev, chamada direta do navegador; token em `.env.local` (`VITE_BRAPI_TOKEN`)
- Leitura de `.xlsx`: `read-excel-file` · Dinheiro: `decimal.js` · Gráficos: Recharts · UI: Tailwind (+ shadcn/ui só se necessário)
- Testes: Vitest, focado no domínio

## Arquitetura

```
src/
  domain/    # TS puro (sem React/IO): money, positions, dividends, events — testado
  import/    # xlsx -> registros normalizados, validação, id determinístico (hash)
  storage/   # IndexedDB, backup JSON
  prices/    # cliente brapi + cache com TTL
  ui/        # páginas: Carteira, Proventos, Evolução, Importar, Cotações
```

Fluxo: `import`/`prices` -> `storage` -> `domain` calcula -> `ui` exibe. **A UI nunca calcula dinheiro.** Posições e proventos são derivados dos registros (recalculados), não persistidos.

## Escopo

- Importar relatórios da B3 (`.xlsx`): negociações, movimentações, proventos, posição.
- Calcular: preço médio, posição atual, resultado realizado/não realizado, proventos recebidos (dividendos, JCP, rendimentos), rentabilidade.
- Visualizar: carteira, evolução, proventos por período/ativo, com gráficos interativos e simples de entender.

Fora de escopo (a menos que eu peça): multiusuário, login, back-end, deploy em nuvem, integração automática com a B3, cálculo/geração de DARF/IR.

## Princípios

- **Simples e local.** Sem autenticação nem infraestrutura.
- **Dinheiro nunca em float.** Usar `Decimal` em todo cálculo; armazenar como string/decimal.
- **Importação idempotente.** Id = hash dos campos do registro; reimportar não duplica.
- **Arquivos da B3 são entrada não confiável**: validar colunas/formatos e falhar com erro claro, nunca ignorar linhas silenciosamente. O layout da B3 muda com o tempo.
- **Falha de API não quebra o app**: cotações degradam para o último preço em cache ou entrada manual.
- **Dados financeiros pessoais são privados.** Arquivos reais da B3, `.env*` e backups ficam fora do git; testes usam dados fictícios.
- Cálculos financeiros (preço médio, proventos, lucro) têm testes com casos conhecidos — são o coração do app.

## Convenções de domínio

- Idioma: código e identificadores em inglês; textos de UI e documentação em português (pt-BR).
- Formatos BR: moeda `R$ 1.234,56`, datas `dd/mm/aaaa`, decimais com vírgula nos arquivos da B3 — converter na entrada, armazenar em formato neutro.
- Ticker é a chave do ativo; atenção a desdobramentos/grupamentos, bonificações e mudanças de ticker, que afetam quantidade e preço médio.
- Tipos de provento distintos: dividendo, JCP (tem IR retido), rendimento (FIIs). Não somar sem distinguir.

## Convenção de UI

- **Toda box/métrica nova leva um ícone ⓘ com tooltip** explicando em português simples o que é e como é calculada (componente `Info` em `src/ui/Carteira.tsx`; `Card` exige a prop `info`). O usuário não é da área financeira: evitar jargão sem explicar.

## Comandos

- `npm run dev` — servidor de desenvolvimento
- `npm test` — Vitest (uma execução; testes em `src/**/*.test.ts`)
- `npm run lint` — oxlint
- `npm run build` — typecheck (`tsc -b`) + build de produção
- `npm run preview` — serve o build

Leitura de xlsx: `read-excel-file` (no lugar de SheetJS). IndexedDB: `idb`.

## Importação B3 (layout verificado com arquivos reais, nov/2026)

Três arquivos, todos de uma instituição só por enquanto:
- **Negociação** (`negociacao-*.xlsx`): fonte das compras/vendas de ações, FIIs e ETFs. Ticker fracionário (ex.: `ABCD3F`) = `ABCD3`.
- **Movimentação** (`movimentacao-*.xlsx`): fonte de proventos (Rendimento, Dividendo, JCP), Desdobro (vem como quantidade creditada, não fator) e Tesouro Direto (Compra/Resgate; só existe aqui). "Transferência - Liquidação" é o mesmo negócio já em Negociação: guardar, mas não contar. O valor do JCP vem líquido.
- **Posição** (`posicao-*.xlsx`): foto do dia, várias abas, sem data na planilha (usar a do nome do arquivo). Serve para conferir o cálculo e para preço de fechamento; não é fonte de eventos.

**Sem duplicar e sem perder dados** (exports futuros terão períodos sobrepostos): as planilhas não têm id. Cada linha crua é guardada (`src/import/records.ts`) com `id = campos + "#n"`, onde `n` é a ocorrência da linha idêntica no arquivo. Há linhas idênticas legítimas (ex.: pares de Transferência), então hash simples perderia dados. Gravar é upsert por id (`src/storage/db.ts`): reimportar não duplica e nada é apagado. Só vale porque a granularidade é diária e um arquivo traz todos os dias do seu período; não importar arquivo cortado no meio de um dia. O que entra nas contas é derivado dos registros crus (`src/import/normalize.ts`), então mudar a interpretação não exige reimportar.

Verificado: as quantidades calculadas batem com a Posição em todos os ativos (inclusive Tesouro). Exceção esperada: tickers de direito de subscrição (final `12`, ex.: `ABCD12`) aparecem só no cálculo e deve ser sinalizado/ignorado na tela de conferência.

## Métricas de retorno (`src/domain/returns.ts`)

- **Ganho** (por ativo e total) = valor atual + vendas + proventos − compras. Conta de caixa: já inclui o lucro de vendas sem contar duas vezes (≡ não realizado + realizado + proventos). Ativo aberto sem preço na Posição fica de fora e é listado.
- **Rentabilidade a.a.** = XIRR (datas e valores de cada fluxo). Posições muito recentes podem dar `null` (fora de −99%…+1000%).
- Valores monetários em `Decimal`; só a taxa do XIRR usa `number`.

## Cotações (brapi) — verificado em 23/11/2026

- Token em `.env` (`VITE_BRAPI_TOKEN`; `.env*` está no `.gitignore`). Vai para o bundle do front: aceitável só porque o app é local.
- Plano gratuito: **1 ativo por requisição e 1 requisição simultânea** → `src/prices/brapi.ts` busca um por vez. Cobre ações, FIIs e ETFs da B3. Tesouro Direto não tem cotação (usa preço da Posição). CORS liberado.
- Atualização é manual (aba Cotações), para não gastar cota. Última cotação por ticker fica no IndexedDB (`quotes`). Cotação só vale se for do dia da Posição ou mais nova.
- Direitos de subscrição (final `12`) também retornam cotação na brapi, então entra nas contas com esse preço.

## Pendências

- Lucro líquido: corretagem/taxas/IR não vêm nos arquivos da B3 — precisa de entrada manual ou outra fonte.
- Evolução do patrimônio é **estimada** (`src/domain/evolution.ts`): qtd no fim do mês × último preço conhecido (negócios, Posições, cotações). O plano gratuito da brapi só dá 3 meses de histórico (`range` até `3mo`). Importar uma Posição por mês melhora a série.

- Todas as telas do plano existem: Carteira, Evolução, Proventos, Cotações e Importar em `src/ui/` (componentes compartilhados em `parts.tsx`); a Carteira sinaliza ativos que não batem com a Posição (ex.: direitos de subscrição `*12`).
- Alerta quando uma importação não traz linhas que já existem dentro do seu período (correção da B3), sem apagar.
- Taxas não entram no preço médio; IR do JCP não é separado.
