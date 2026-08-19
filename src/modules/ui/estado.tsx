import type { ReactNode } from "react";

/**
 * Os quatro estados de tela, num componente so (UI-02 AC1).
 *
 * O contrato da SPEC 07 diz: "tela posterior que inventar o seu proprio
 * reprova". Nao e regra de estilo — e o que faz o aluno reconhecer "carregando"
 * e "deu erro" sem reaprender em cada tela.
 *
 * O tipo e uma **uniao discriminada** de proposito, e nao um objeto com tudo
 * opcional:
 *
 *   - `vazio` **exige** `acao`. UI-02 AC2 proibe zero solto: o compilador cobra.
 *   - `degradado` **exige** `oQueCaiu`. UI-02 AC3 exige nomear o que faltou.
 *   - `erro` **nao tem** campo de mensagem. UI-02 AC4 proibe imprimir mensagem
 *     tecnica ou dado pessoal, e a forma mais forte de proibir e nao existir
 *     onde escrever. Nao ha o que um `error.tsx` distraido possa passar.
 */
export type EstadoProps =
  | { tipo: "carga"; rotulo?: string }
  | { tipo: "erro" }
  | { tipo: "vazio"; titulo: string; acao: ReactNode }
  | { tipo: "degradado"; oQueCaiu: string };

const caixa =
  "rounded-lg border border-linha bg-fundo-suave px-4 py-5 text-sm sm:px-6";

export function Estado(props: EstadoProps) {
  switch (props.tipo) {
    /*
     * `role="status"` + `aria-live="polite"` fazem o leitor de tela anunciar a
     * espera. `aria-busy` diz que a regiao ainda vai mudar.
     */
    case "carga":
      return (
        <div
          className={caixa}
          role="status"
          aria-live="polite"
          aria-busy="true"
          data-estado="carga"
        >
          <p className="text-suave">{props.rotulo ?? "Carregando…"}</p>
        </div>
      );

    /*
     * `role="alert"` porque o aluno precisa saber agora. O texto e fixo: diz o
     * que aconteceu, que o time ja sabe, e o que ele pode fazer. Nada vem de
     * fora — ver o comentario do tipo.
     */
    case "erro":
      return (
        <div className={caixa} role="alert" data-estado="erro">
          <p className="font-semibold text-erro">Algo deu errado</p>
          <p className="mt-1 text-suave">
            Já fomos avisados e estamos olhando. Tente recarregar a página em
            alguns instantes.
          </p>
        </div>
      );

    /*
     * Vazio nao e erro: e o comeco. Por isso tem titulo proprio e a acao vem em
     * destaque — e a unica saida do estado.
     */
    case "vazio":
      return (
        <div className={caixa} data-estado="vazio">
          <p className="font-semibold">{props.titulo}</p>
          <div className="mt-1 text-suave" data-acao="">
            {props.acao}
          </div>
        </div>
      );

    /*
     * Degradado e o estado que a IA-01 AC3 pede: uma parte caiu, o resto anda.
     * Nomeia o que faltou e afirma a continuidade na mesma frase — sem isso o
     * aluno assume que a tela inteira esta quebrada e vai embora.
     */
    case "degradado":
      return (
        <div className={caixa} role="status" data-estado="degradado">
          <p className="font-semibold text-aviso">
            {props.oQueCaiu} está indisponível agora
          </p>
          <p className="mt-1 text-suave">
            O restante da página continua funcionando normalmente.
          </p>
        </div>
      );
  }
}
