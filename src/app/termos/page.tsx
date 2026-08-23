import Link from "next/link";

import {
  IDENTIFICACAO_PUBLICA_PADRAO,
  VERSAO_ATUAL_DOS_TERMOS,
} from "@/modules/pagamentos/contratos";
import { Shell } from "@/modules/ui/shell";

export default function Termos() {
  return (
    <Shell acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}>
      <p className="text-sm font-semibold uppercase tracking-wide text-marca">Documento inicial</p>
      <h1 className="mt-2 text-3xl font-semibold">Termos de uso</h1>
      <p className="mt-2 text-sm text-suave">
        Versão {VERSAO_ATUAL_DOS_TERMOS} · identificação operacional: {IDENTIFICACAO_PUBLICA_PADRAO}
      </p>
      <p className="mt-4 rounded-lg border border-aviso bg-fundo-suave p-4 text-sm leading-6" role="note">
        Este texto é uma versão inicial do produto e ainda precisa de revisão jurídica.
        A versão e a data apresentadas no checkout serão registradas junto ao aceite.
      </p>

      <div className="mt-8 space-y-7 leading-7">
        <section aria-labelledby="oferta-e-acesso">
          <h2 id="oferta-e-acesso" className="text-xl font-semibold">1. Oferta e acesso</h2>
          <p className="mt-2 text-suave">
            A matrícula anual dá acesso às superfícies liberadas no produto durante
            o período informado na compra. O acesso depende de uma conta individual
            e não deve ser compartilhado. A operação do núcleo é baseada no contrato,
            não em um consentimento geral; marketing e comunicações externas, se
            oferecidos, terão opção separada.
          </p>
        </section>
        <section aria-labelledby="pagamento-e-garantia">
          <h2 id="pagamento-e-garantia" className="text-xl font-semibold">2. Pagamento e garantia</h2>
          <p className="mt-2 text-suave">
            O pagamento é processado pelo Asaas. A garantia de sete dias corridos
            começa na confirmação do pagamento; o pedido e a resposta do reembolso
            ficam registrados no histórico financeiro.
          </p>
        </section>
        <section aria-labelledby="conteudo">
          <h2 id="conteudo" className="text-xl font-semibold">3. Conteúdo</h2>
          <p className="mt-2 text-suave">
            As questões são obtidas de fontes oficiais e mantêm sua proveniência.
            Explicações podem passar por atualização e conferência sem alterar o
            gabarito oficial da prova.
          </p>
        </section>
        <section aria-labelledby="contato-termos">
          <h2 id="contato-termos" className="text-xl font-semibold">4. Contato</h2>
          <p className="mt-2 text-suave">
            O canal de suporte, a identidade/CNPJ e os dados do responsável serão
            publicados com a versão jurídica revisada antes da operação comercial.
            Para privacidade, consulte o canal indicado na política.
          </p>
        </section>
      </div>

      <p className="mt-8 text-sm">
        <Link href="/privacidade" className="text-marca underline">Ler a política de privacidade</Link>
      </p>
    </Shell>
  );
}
