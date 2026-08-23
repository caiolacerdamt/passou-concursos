import Link from "next/link";

import {
  CANAL_PRIVACIDADE_PADRAO,
  IDENTIFICACAO_PUBLICA_PADRAO,
  VERSAO_ATUAL_DOS_TERMOS,
} from "@/modules/pagamentos/contratos";
import { Shell } from "@/modules/ui/shell";

export default function Privacidade() {
  return (
    <Shell acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}>
      <p className="text-sm font-semibold uppercase tracking-wide text-marca">Documento inicial</p>
      <h1 className="mt-2 text-3xl font-semibold">Política de privacidade</h1>
      <p className="mt-2 text-sm text-suave">
        Versão {VERSAO_ATUAL_DOS_TERMOS} · identificação operacional: {IDENTIFICACAO_PUBLICA_PADRAO}
      </p>
      <p className="mt-4 rounded-lg border border-aviso bg-fundo-suave p-4 text-sm leading-6" role="note">
        Este texto é uma versão inicial e ainda precisa de revisão jurídica. A
        redação final deve confirmar bases legais, prazos, identidade/CNPJ e canais
        do titular. Antes da publicação comercial, substitua a identificação e o
        canal provisórios abaixo pelos dados reais do controlador e do encarregado.
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
            Quando o titular pede o apagamento, o sistema usa o Resend para enviar
            uma confirmação mínima ao endereço da conta antes de invalidar o acesso.
          </p>
        </section>
        <section aria-labelledby="retencao">
          <h2 id="retencao" className="text-xl font-semibold">3. Retenção e segurança</h2>
          <p className="mt-2 text-suave">
            Respostas, sessões, plano, progresso, caderno de erros, sequência,
            folgas, matrícula e dados operacionais são apagados pela rotina do
            produto. Faturas, aceite e o mínimo de registros financeiros e fiscais
            necessários permanecem pelo prazo aplicável. A solicitação de
            apagamento é tratada pelo fluxo autenticado e, para outros direitos,
            pelo procedimento manual disponível no lançamento.
          </p>
        </section>
        <section aria-labelledby="sem-consentimento-nucleo">
          <h2 id="sem-consentimento-nucleo" className="text-xl font-semibold">4. Operação e comunicações</h2>
          <p className="mt-2 text-suave">
            O funcionamento contratado do produto não depende de um checkbox de
            consentimento. Eventuais comunicações de marketing ou notificações
            externas terão consentimento separado; isso não é necessário para
            estudar, acessar a conta ou receber mensagens transacionais.
          </p>
        </section>
        <section aria-labelledby="revisao-privacidade">
          <h2 id="revisao-privacidade" className="text-xl font-semibold">5. Canal provisório do titular</h2>
          <p className="mt-2 text-suave">
            Para este lançamento, o canal documentado para pedidos de privacidade
            é <a className="text-marca underline" href={`mailto:${CANAL_PRIVACIDADE_PADRAO}`}>
              {CANAL_PRIVACIDADE_PADRAO}
            </a>. Ele é um default operacional e deve ser substituído pelo canal
            ativo do controlador/encarregado antes da publicação comercial.
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm">
        <Link href="/termos" className="text-marca underline">Ler os termos de uso</Link>
      </p>
    </Shell>
  );
}
