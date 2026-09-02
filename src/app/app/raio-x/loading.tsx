import { Bloco, CartaoEsqueleto, Carregando } from "@/modules/ui/esqueleto";

/** Cabeçalho do concurso, o maior ganho em destaque e a grade de matérias. */
export default function CarregandoRaioX() {
  return (
    <Carregando rotulo="Carregando o Raio-X da banca">
      <div className="space-y-10">
        <div aria-hidden="true" className="max-w-3xl">
          <Bloco className="h-2.5 w-24" />
          <Bloco className="mt-3.5 h-10 w-4/5 max-w-[24rem]" />
          <Bloco className="mt-3.5 h-4 w-full max-w-[30rem]" />
        </div>

        <CartaoEsqueleto linhas={3} />

        <div aria-hidden="true" className="grid gap-3">
          {Array.from({ length: 6 }, (_, indice) => (
            <div key={indice} className="grid gap-2">
              <Bloco className="h-3.5 w-48" />
              <Bloco className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Carregando>
  );
}
