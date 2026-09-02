import { Bloco, Carregando } from "@/modules/ui/esqueleto";

/**
 * A sessão vive na coluna de leitura, não na largura do painel: o esqueleto
 * repete `max-w-2xl` + `max-w-leitura` para o cartão não pular de largura
 * quando a questão chegar.
 */
export default function CarregandoSessao() {
  return (
    <Carregando rotulo="Carregando a sessão de questões">
      <div className="mx-auto max-w-2xl">
        <div className="mx-auto max-w-leitura">
          <Bloco className="h-3 w-40" />

          <div aria-hidden="true" className="mt-5 flex gap-1.5">
            {Array.from({ length: 10 }, (_, indice) => (
              <Bloco key={indice} className="h-1.5 flex-1 rounded-full" />
            ))}
          </div>

          <div
            aria-hidden="true"
            className="mt-5 rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5 sm:px-8"
          >
            <Bloco className="h-3 w-28" />
            <Bloco className="mt-4 h-4 w-full" />
            <Bloco className="mt-2.5 h-4 w-11/12" />
            <Bloco className="mt-2.5 h-4 w-3/5" />

            <div className="mt-6 grid gap-2">
              {Array.from({ length: 4 }, (_, indice) => (
                <Bloco key={indice} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Carregando>
  );
}
