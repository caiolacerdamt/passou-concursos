-- SPEC 12 · correções F-11 e F-12
--
-- F-11: a compra por cartão é criada como parcelamento de 12x, então o Asaas
-- devolve UMA parcela e o id do parcelamento no campo `installment`. O estorno
-- de parcelamento exige POST /v3/installments/{id}/refund; chamar
-- /payments/{id}/refund com o id da parcela é recusado pelo gateway. Sem
-- guardar o id do parcelamento não há como escolher o endereço certo.
--
-- F-12: `asaas_status` só era escrito na criação da cobrança e congelava em
-- PENDING mesmo depois da ativação. O webhook passa a atualizá-lo.

alter table public.pagamentos
  add column if not exists asaas_parcelamento_id text;

comment on column public.pagamentos.asaas_parcelamento_id is
  'Id do parcelamento no Asaas (campo `installment`), presente só na compra por cartão. Define o endpoint de estorno: /installments/{id}/refund em vez de /payments/{id}/refund.';

create index if not exists pagamentos_asaas_parcelamento_idx
  on public.pagamentos (asaas_parcelamento_id)
  where asaas_parcelamento_id is not null;
