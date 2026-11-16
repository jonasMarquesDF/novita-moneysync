# Novitá MoneySync · primeira implementação

Base React 19 + Tailwind 4 + Vite + Dexie. Interface em português, com foco em celular, letras maiores e três abas. Esta entrega é um protótipo local executável, não um sistema financeiro pronto para produção.

## Executar

Requer Node 20.19+ ou 22.12+.

```sh
npm ci
npm run dev
```

Abra o endereço indicado pelo Vite. Para compilar: `npm run build`. Para testar o motor: `npm test`.

`dist/` já contém a versão compilada. Sirva esse diretório na raiz de um domínio HTTPS; não abra o HTML por file://. O service worker é gerado no build e guarda somente o shell estático. Depois do primeiro acesso online e da ativação do worker, o shell pode abrir offline. Esse comportamento e a instalação no iOS ainda precisam de teste em dispositivo. O modo dev não registra o worker.

## Implementado

- Visão geral com receita individual, obrigações por competência e capital livre previsto.
- Finanças individuais e lista de despesas compartilhadas.
- Inclusão manual com revisão antes de salvar, valores em reais, parcelas e mês inicial.
- Regra percentual ou cota fixa da Cris com resíduo para Jonas. A cota fixa informada é o total da compra e se distribui entre parcelas.
- Pagamento/recebimento por parcela, exclusão de parcela individual e exportação JSON.
- Persistência local IndexedDB com gravação em lote. Exemplos só entram na primeira abertura; os valores são demonstrativos.
- Motor de cálculo em centavos, com distribuição determinística do resto. Receitas alheias não entram no cálculo individual.
- Compensação somente de despesas pagas. Exemplo: Cris paga aluguel 1700; Jonas paga mercado 600; ambos 50%. Jonas reembolsa Cris em 550.
- Shell PWA compilado com manifesto e cache estático.

## Limites explícitos

Os perfis Jonas e Cris são participantes demonstrativos. Não há login, troca de perfil, PIN, biometria, criptografia local, compartilhamento real nem sincronização de dados. A aba individual é uma organização visual neste protótipo, não uma barreira de segurança. Não use dados reais sensíveis em dispositivo compartilhado. Exportação não é uma rotina automática de backup; a restauração por arquivo ainda não foi implementada.

Os dados locais podem ser removidos pelo navegador. Não há IA, OCR, voz, vídeo, importação XLSX/CSV/Sheets, empréstimos, notificações, descontos por antecipação ou envio pelo WhatsApp nesta fase. O fluxo manual funciona sem essas dependências.

## Fundação Supabase

`supabase/migrations/001_private_foundation.sql` é a primeira migração proposta, somente para lançamentos privados. Vincula propriedade ao Supabase Auth, usa RLS por proprietário, versão incremental e exclusão lógica. Ela não foi aplicada nem validada em PostgreSQL. Não execute sobre um banco de produção sem os testes abaixo. Não existe adaptador Supabase no frontend nesta entrega.

Antes de liberar: criar projeto de desenvolvimento; aplicar migração; autenticar usuários A e B; provar que B não lê/edita registros de A; provar rejeição para anônimo e para mudança de proprietário; verificar versão e tombstone. Usar somente chave publishable no cliente; nunca service_role. Documentação: https://supabase.com/docs/guides/database/postgres/row-level-security.

## Próximas etapas técnicas, em ordem

1. Auth e cofre local por usuário. PIN de 4 dígitos é trava de conveniência e não substitui autenticação; WebAuthn requer HTTPS, suporte do dispositivo e verificação do desafio no servidor. Não guardar PIN no perfil público.
2. Grupos, convites aceitos, membros por UUID, despesas compartilhadas separadas das privadas; cotas por parcela, pagamentos e reembolsos como registros próprios. Tornar o grupo imutável e validar participantes no servidor. Não usar nomes como identidade.
3. Fila de operações atômica com IndexedDB: alteração + outbox na mesma transação. Operação com UUID idempotente; atualizações condicionadas à versão; tombstones; pull paginado com cursor; conflitos visíveis. Não usar relógio do aparelho ou last-write-wins para sobrescrever pagamentos.
4. Ledger financeiro no servidor: total pago menos obrigação gera saldo; reembolso registrado zera posições sem virar despesa nova. Distinguir obrigação, desembolso, saldo bancário e valor já acertado. Não tratar sugestão de transferência como pagamento realizado.
5. IA em endpoint autenticado com chave no servidor, limites de tamanho/custo e validação de schema. Nunca enviar automaticamente fotos privadas. Modelo e cotas são configuráveis; não há garantia de gratuidade. Resultados sempre exigem revisão.
6. Importação com staging, confirmação de datas/decimais e deduplicação. Alertas por vencimento, empréstimos com amortizações parciais, antecipação com descontos reais.

Para mais de dois membros o motor produz uma solução válida de transferências entre saldos. Não promete o mínimo global de transações nem preserva dívidas bilaterais originais. O produto inicial limita a interface ao casal.

## Validação realizada

Build de produção e dez testes automatizados do motor aprovados. Cobrem crédito real, compensação, exclusão de pendências, cotas fixas, centavos, virada do ano, capital e entradas inválidas. A interface ainda requer verificação visual e de acessibilidade em navegador/celular; migração, autenticação e offline em dispositivo não foram validados.
