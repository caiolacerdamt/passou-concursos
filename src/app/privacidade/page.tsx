import Link from "next/link";

import { Shell } from "@/modules/ui/shell";

export default function Privacidade() {
  return (
    <Shell acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}>
      <p className="text-sm font-semibold uppercase tracking-wide text-marca">Documento inicial</p>
      <h1 className="mt-2 text-3xl font-semibold">Política de privacidade</h1>
      <p className="mt-4 rounded-lg border border-aviso bg-fundo-suave p-4 text-sm leading-6" role="note">
        Este texto é uma versão inicial e ainda precisa de revisão jurídica. A
        redação final deve confirmar bases legais, prazos e canais do titular.
      </p>

      <div className="mt-8 space-y-7 leading-7">
        <section aria-labelledby="dados-coletados">
          <h2 id="dados-coletados" className="text-xl font-semibold">1. Dados usados no produto</h2>
          <p className="mt-2 text-suave">
            A conta usa dados necessários para autenticação e acesso. A compra
            registra e-mail, valor, meio, aceite e referências financeiras para
            ativar a matrícula e cumprir obrigações fiscais. Não coletamos data de
            nascimento para declarar maioridade.
          </p>
        </section>
        <section aria-labelledby="provedores">
          <h2 id="provedores" className="text-xl font-semibold">2. Provedores</h2>
          <p className="mt-2 text-suave">
            O Asaas processa a cobrança. O funil pré-login pode enviar eventos
            anônimos ao PostHog por um proxy próprio; e-mail, nome, CPF, telefone,
            identificadores de usuário e pagamento não entram nesses eventos.
          </p>
        </section>
        <section aria-labelledby="retencao">
          <h2 id="retencao" className="text-xl font-semibold">3. Retenção e segurança</h2>
          <p className="mt-2 text-suave">
            Registros financeiros e fiscais permanecem pelo prazo aplicável. A
            solicitação de apagamento de dados pessoais é tratada pelo procedimento
            manual disponível no lançamento, sem apagar o histórico financeiro que
            a lei exige conservar.
          </p>
        </section>
        <section aria-labelledby="revisao-privacidade">
          <h2 id="revisao-privacidade" className="text-xl font-semibold">4. Revisão</h2>
          <p className="mt-2 text-suave">
            Esta página será atualizada quando a revisão jurídica e os canais
            oficiais de atendimento estiverem definidos.
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm">
        <Link href="/termos" className="text-marca underline">Ler os termos de uso</Link>
      </p>
    </Shell>
  );
}
