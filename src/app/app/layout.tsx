import { FaixaDoTrial } from "@/modules/conta/faixa-do-trial";
import { AppShell } from "@/modules/ui/app-shell";
import { temaDoAluno } from "@/modules/ui/tema-do-aluno";

/**
 * O layout resolve o tema e o shell pinta (AD-149).
 *
 * A resolução mora aqui e não no shell pelo mesmo motivo da faixa do trial: o
 * shell é moldura e não consulta banco. Esta rota já consulta — é ela que sabe
 * do trial — então o aparelho sem cookie custa uma consulta que já estava sendo
 * feita, e não uma nova ida ao Postgres em cada navegação.
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const tema = await temaDoAluno();

  return (
    <AppShell tema={tema} faixa={<FaixaDoTrial />}>
      {children}
    </AppShell>
  );
}
