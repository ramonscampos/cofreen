# Cartões via Meu Pluggy + correção de parcelas

Data: 2026-10-25

## Intenção

O cofreen é um app pessoal de controle financeiro mensal, com um único usuário (o dono). Hoje as faturas de cartão são lançadas à mão, mês a mês. O objetivo é que os cartões **se atualizem sozinhos**: o valor da fatura já está certo ao abrir o app e, ao expandir um cartão, aparecem um **mini gráfico de gastos por categoria** e a **lista de todas as compras** daquela fatura.

Lançar compra em cartão perde o propósito e deixa de existir.

Junto com isso, o dono quer que **daqui pra frente os números estejam certos**: contas fixas, salário e parcelamentos (ex.: contrato do carro) contando o valor correto todo mês. O histórico pode ser descartado.

## Contexto atual (levantado no código e no banco)

- Stack: Next.js 16 (App Router), Auth.js com Google (restrito a `ALLOWED_EMAIL`), Drizzle + Neon, deploy na Vercel (push na `main`). Sem CI, sem testes, sem Sentry.
- Tabelas: `cards`, `card_transactions` (vazia), `transactions` (lançamentos reais por mês, incluindo "faturas manuais": linhas com `card_id`), `recurring_templates` (contas fixas, salário e parcelamentos).
- Cartões cadastrados: 2× "NuBank" (PF e PJ, vencimento dia 23) e "Bradesco" (empresarial Elo, vencimento dia 15).
- Templates: 12 contas fixas e um salário ("Dasa") sem cartão, 1 parcelamento (Fastback: total 50.400, 18x a partir de 2026-02) e **11 assinaturas ligadas a cartão** (Adobe, ChatGPT, Claude, iCloud+, etc.).
- O dashboard mostra uma lista mensal onde cada cartão é um item de fatura (virtual = soma dos lançamentos, ou manual = valor digitado).

### Bug encontrado: parcelamento pago conta o contrato inteiro

Ao marcar como pago um item projetado de um template parcelado, `handleMarkAsPaid` (`src/app/(dashboard)/dashboard-view.tsx`) cria uma `transaction` com `amount` = valor total do template (50.400) **sem** copiar `installmentCurrent`/`installmentTotal`. Como a regra do app é "valor guardado = total, divide pelo nº de parcelas na exibição", esse lançamento passa a contar R$ 50.400 no mês em vez de R$ 2.800. Isso aparece em todos os meses de 2026-03 a 2026-10.

## Pluggy: o que a integração oferece (docs.pluggy.ai, out/2026)

- **Meu Pluggy, uso pessoal:** grátis, sem expirar, até 5 conexões, sem uso comercial. O dono já conectou as três instituições no meu.pluggy.ai (Nubank, Nubank Empresas, Bradesco Empresas), todas ativas.
- Para o app ler os dados: criar uma aplicação no dashboard.pluggy.ai e autorizar o conector **MeuPluggy** pelo widget "Demo → Connect Account". Cada banco vira um **item** (`itemId`) na aplicação. Credenciais: `clientId` + `clientSecret` → `POST /auth` → `apiKey` (header `X-API-KEY`).
- **Atualização:** os itens do Meu Pluggy atualizam sozinhos a cada 24h. Não dá pra forçar atualização pela API. "Valor atualizado" significa "dados de até ~1 dia".
- **Autorização vale 1 ano** (`consentExpiresAt` em `GET /items/{id}`). Depois disso as leituras vêm vazias e é preciso reautorizar pelo widget. `GET /v2/items` não funciona para Meu Pluggy, então os `itemId` precisam ser guardados.
- **Dados de cartão:**
  - `GET /accounts?itemId=` → contas. Cartão de crédito = `type: CREDIT`.
  - `GET /bills?accountId=` → faturas: `id`, `dueDate`, `billClosingDate`, `totalAmount`, `payments[]`.
  - `GET /transactions?accountId=` (paginado, com filtro de data) → compras: `id`, `description`, `amount` (valor **da parcela**), `date`, `category`, `categoryId`, `type` (DEBIT/CREDIT), e `creditCardMetadata` com `installmentNumber`, `totalInstallments`, `billId` (ausente se a fatura ainda não fechou), `billForecastDate` (YYYY-MM, só Open Finance) e `purchaseDate`.
- Não confirmado nas docs: cobertura de PJ no Meu Pluggy (na prática conectou), profundidade do histórico e formato exato da fatura aberta.

## Objetivos

1. Os três cartões são alimentados pela Pluggy. Cada fatura aparece **no mês do vencimento**.
2. Valor da fatura:
   - **fatura fechada:** `totalAmount` da Pluggy;
   - **fatura aberta:** soma das compras previstas para aquele mês (`billForecastDate`, ou derivado da data quando faltar), com estornos/créditos abatendo.
3. **Paga** quando a Pluggy informar pagamento na fatura (`payments` cobrindo o total). Sem marcação manual.
4. Ao expandir um cartão:
   - mini gráfico de gastos por categoria;
   - lista de todas as compras da fatura (descrição, data, valor, categoria, "3/10" quando parcelado).
5. **Cartões ficam fora da lista principal**, numa seção própria. O total de despesas do mês continua incluindo as faturas.
6. Sincronização automática diária, sem ação do dono.
7. Contas fixas, salário e parcelamentos contam o valor correto todo mês. O bug do pagamento de parcelamento está corrigido.
8. **Meses futuros (além da fatura aberta) mostram uma previsão** de cada cartão:
   - as **parcelas restantes** das compras parceladas (a compra 3/10 de hoje aparece como 4/10 no mês seguinte, e assim por diante até 10/10);
   - as **assinaturas recorrentes** estimadas a partir do histórico da Pluggy.

   Quando a fatura real daquele mês chega pela Pluggy, a previsão é substituída pelos dados reais, sem somar os dois. Itens previstos aparecem diferenciados dos reais na lista (ex.: "previsto").

## Não-objetivos

- Lançar compras em cartão manualmente (o recurso sai).
- Contas correntes/saldos bancários, Pix, extrato da conta: só cartões nesta entrega.
- Multiusuário, ou fluxo de conexão de banco dentro do app. A conexão é feita uma vez nos painéis da Pluggy.
- Editar/recategorizar compras dentro do app.
- Preservar o histórico antigo de faturas manuais.

## Anti-objetivos (seria falha mesmo funcionando)

- Contar algo em dobro: assinatura que vem na fatura **e** como template, fatura manual antiga **e** fatura Pluggy no mesmo mês.
- Parcelamento contando o total em vez da parcela, em qualquer caminho (projeção, pago, cartão).
- Falha silenciosa: se a sincronização quebrar ou a autorização expirar, o dono precisa perceber no app (data da última sincronização visível e aviso quando falhar ou estiver perto de expirar).
- Expor `clientSecret`/`apiKey` ao navegador ou no repositório (que é **público**).

## Decisões tomadas pelo dono

- Fonte da verdade dos cartões: só a Pluggy. Nada de lançamento manual em cartão.
- Histórico pode ser limpo. O que importa é daqui pra frente.
- Contas fixas e salário continuam cadastrados como templates e precisam estar certos.
- Parcelamentos (ex.: carro) contam a parcela correta.
- Cartões saem da lista principal e ficam numa seção separada.
- Fatura aparece no mês do vencimento. O valor vem da Pluggy, e o status "paga" vem do pagamento informado pela Pluggy.
- As 11 assinaturas ligadas a cartão deixam de contar nesses cartões (a cobrança real vem na fatura).
- Sincronização diária automática.
- Meses futuros mostram previsão: parcelas restantes + assinaturas recorrentes estimadas (opção "c").
- `vitest` aprovado como dependência de desenvolvimento para os testes da lógica.

## Limpeza de dados (uma vez, na entrega)

- Apagar todas as linhas de `transactions` (histórico, incluindo faturas manuais e os lançamentos de R$ 50.400). Os templates projetam os meses de novo, sem nada pago. *Decisão do builder: apagar tudo de uma vez é mais simples e seguro do que filtrar. O dono autorizou limpar o histórico.*
- Apagar as 11 assinaturas ligadas a cartão (`recurring_templates.card_id is not null`).
- Os 3 cartões existentes passam a ser vinculados às contas Pluggy correspondentes (ou recriados a partir delas). O que sobrar sem vínculo é removido.
- Manter as 12 contas fixas, o salário e o Fastback. Conferir que o Fastback, começando em 2026-02 com 1/18, projeta **2.800/mês** e está na parcela 10/18 em 2026-11.
- Antes de apagar, salvar um dump das tabelas afetadas no scratchpad (rede de segurança).

## Restrições

- Segredos (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `itemId`s) só no servidor: `.env` local e envs da Vercel.
- Vercel Hobby: cron diário é suficiente (o dado da Pluggy também é diário).
- Valores em dinheiro: a Pluggy entrega valor por parcela. A conversão para o modelo do app não pode reintroduzir o problema "total vs. parcela".
- Seguir o estilo do projeto: server actions em `src/app/actions`, lógica pura em `src/lib`, Tailwind, componentes próprios em `src/components/ui`, textos de UI em português.
- Pacotes novos só com aprovação do dono (ex.: `pluggy-sdk`, lib de gráfico). Preferir `fetch` direto na API e um gráfico simples sem dependência, a menos que o dono aprove.

## Decisões do builder (o dono pode revisar)

- **Cartões vêm da Pluggy:** o sync cria/atualiza um cartão para cada conta `type: CREDIT` encontrada nos itens configurados (incluindo cartões virtuais/adicionais que a Pluggy expuser como conta separada). O dono não cria nem apaga cartão na mão. Pode só editar **nome e cor**. O dia de vencimento vem da Pluggy (da fatura mais recente). A página `/cards` vira só essa lista editável, sem formulário de criação.
- **Status "paga":** paga quando `payments[]` cobre o `totalAmount`. Se esses bancos não informarem pagamentos, fatura **fechada com vencimento já passado** conta como paga, e a UI indica que é inferido. Pagamento parcial ou mínimo: a fatura fica como "parcialmente paga". O saldo rolado já vem no `totalAmount` da próxima fatura e não é somado de novo.
- **Detecção de assinatura recorrente:** compra não parcelada com descrição/estabelecimento equivalente presente nas **2 últimas faturas fechadas** daquele cartão, com valor parecido (tolerância pequena, ex.: ±10%). Projeta com o valor da ocorrência mais recente. A heurística exata fica a cargo do builder, mas precisa ser testada.
- **Previsão vs. real:** a fatura do mês é real quando a Pluggy tem fatura (fechada ou aberta) para aquele vencimento. Senão, é prevista. Previsões são calculadas na hora a partir dos dados sincronizados, não gravadas no banco (evita linha órfã).

## Deixado para o builder

- Esquema de dados: como guardar faturas e compras da Pluggy (novas colunas em `cards`/`card_transactions`, ou tabelas novas), com `externalId` único para o sync ser idempotente (upsert), e como apagar compras que sumirem na Pluggy.
- Como resolver o bug do parcelamento: copiar os campos de parcela ao pagar, ou passar a guardar o valor da parcela em vez do total. Precisa ser coerente com a projeção e com os totais.
- Mecanismo do sync: rota protegida chamada pelo Vercel Cron (com segredo), e opcionalmente um botão "Sincronizar agora" que relê a Pluggy. Webhook é opcional.
- Como mapear fatura aberta vs. fechada para o mês do vencimento quando `billForecastDate` faltar (usar o dia de vencimento do cartão).
- Como identificar qual conta Pluggy é qual cartão (nome/número final) e onde guardar os `itemId`s.
- Visual da seção de cartões e do mini gráfico (donut ou barras por categoria), seguindo o visual escuro atual. Estados vazio, carregando e erro.
- Remover do código o fluxo de lançamento de compra em cartão (modal de despesa com cartão, fatura manual, `EditBillModal`) e o que ficar órfão.
- Testes da lógica pura (mapeamento de faturas, parcelas, totais do mês).

## Passos manuais do dono (fora do código)

1. Criar a aplicação em dashboard.pluggy.ai e autorizar o conector MeuPluggy (Demo → Connect Account) para os três bancos.
2. Passar `clientId`, `clientSecret` e os três `itemId`s. O builder coloca no `.env` e na Vercel.
