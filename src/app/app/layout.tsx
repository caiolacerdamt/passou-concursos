import { FaixaDoTrial } from "@/modules/conta/faixa-do-trial";
import { AppShell } from "@/modules/ui/app-shell";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <AppShell faixa={<FaixaDoTrial />}>{children}</AppShell>;
}
