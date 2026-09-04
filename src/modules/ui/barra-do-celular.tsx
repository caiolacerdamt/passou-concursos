"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { sair } from "@/app/entrar/acoes";

import { PontoDeCarga } from "./ponto-de-carga";
import {
  ITENS_DE_ACOMPANHAMENTO,
  ITENS_DE_CONTA,
  ITENS_DE_ESTUDO,
  IconeDeConta,
  IconeDeMarca,
  IconeDeSair,
} from "./navegacao";

const ABAS = [...ITENS_DE_ESTUDO, ...ITENS_DE_ACOMPANHAMENTO];

function estaAtivo(caminho: string, href: string): boolean {
  if (href === "/app") return caminho === "/app";
  return caminho === href || caminho.startsWith(`${href}/`);
}

/**
 * A navegação do celular, em duas peças.
 *
 * Embaixo, a mesma pílula escura do rail, deitada: as cinco superfícies de
 * estudo mais a Conta, no alcance do polegar. Em cima, só a marca.
 *
 * O topo carregava os três itens de conta com os nomes inteiros ("Preferências
 * de estudo" e "Conta") e mais o botão de sair. Em 375px isso não
 * cabe: os itens se espremem, o texto corta e a marca perde espaço. Conta é
 * assunto ocasional, não tarefa diária — por isso vira uma aba que abre uma
 * folha de baixo para cima, e o topo volta a ser só a marca.
 *
 * Nenhuma das duas peças desenha status bar nem teclado falso: no aparelho o
 * sistema pinta isso por cima, e um desenho nosso apareceria dobrado.
 */
export function BarraDoCelular() {
  const caminho = usePathname();
  const idDaFolha = useId();
  const botaoDaConta = useRef<HTMLButtonElement>(null);
  const primeiroDaFolha = useRef<HTMLAnchorElement>(null);
  const contaAtiva = ITENS_DE_CONTA.some((item) => estaAtivo(caminho, item.href));

  // Mudar de rota fecha a folha — inclusive pelo botão "voltar" do navegador.
  // Sem isto ela sobreviveria ao clique que levou o aluno embora e cobriria a
  // tela nova. O ajuste é feito **durante o render** e não num efeito: o efeito
  // renderizaria a folha aberta sobre a tela nova por um quadro antes de
  // fechar, e é o padrão que o React documenta para estado derivado de prop.
  const [folha, setFolha] = useState({ aberta: false, rota: caminho });
  if (folha.rota !== caminho) setFolha({ aberta: false, rota: caminho });
  const folhaAberta = folha.aberta;

  function setFolhaAberta(aberta: boolean) {
    setFolha({ aberta, rota: caminho });
  }

  useEffect(() => {
    if (!folhaAberta) return;

    primeiroDaFolha.current?.focus();

    // Trava o scroll do corpo: sem isto a página rola atrás da folha e o dedo
    // que tentava fechá-la arrasta o conteúdo de baixo.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setFolha({ aberta: false, rota: caminho });
    }
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [folhaAberta, caminho]);

  function fecharEDevolverOFoco() {
    setFolhaAberta(false);
    botaoDaConta.current?.focus();
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center border-b border-linha bg-painel px-4 py-3 lg:hidden">
        <Link
          href="/app"
          className="inline-flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em] text-texto"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-lg bg-marca text-painel"
          >
            {IconeDeMarca}
          </span>
          Passou
        </Link>
      </header>

      {folhaAberta ? (
        <>
          <button
            type="button"
            aria-label="Fechar o menu da conta"
            onClick={fecharEDevolverOFoco}
            className="fixed inset-0 z-40 bg-breu/45 lg:hidden"
          />
          <div
            id={idDaFolha}
            role="dialog"
            aria-modal="true"
            aria-label="Conta"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[22px] border-t border-linha bg-painel px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-24px_48px_-24px_rgb(27_29_26/0.45)] lg:hidden"
          >
            <span
              aria-hidden="true"
              className="mx-auto mb-3 block h-1 w-10 rounded-full bg-linha"
            />
            <nav aria-label="Conta" className="grid gap-0.5">
              {ITENS_DE_CONTA.map((item, indice) => (
                <Link
                  key={item.href}
                  ref={indice === 0 ? primeiroDaFolha : undefined}
                  href={item.href}
                  aria-current={estaAtivo(caminho, item.href) ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] ${
                    estaAtivo(caminho, item.href)
                      ? "bg-marca-suave font-medium text-marca"
                      : "text-texto"
                  }`}
                >
                  {item.icone}
                  <span className="min-w-0 flex-1 truncate">{item.nome}</span>
                  <PontoDeCarga />
                </Link>
              ))}

              <form action={sair} className="mt-1 border-t border-linha pt-1">
                <button
                  type="submit"
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[0.9375rem] text-suave"
                >
                  {IconeDeSair}
                  <span>Sair da conta</span>
                </button>
              </form>
            </nav>
          </div>
        </>
      ) : null}

      {/*
        A barra flutua a 1rem do pé, então a área segura do aparelho vira
        margem e não preenchimento: com `pb-` a pílula continuaria colada
        embaixo e seu terço inferior ficaria atrás do indicador de home.
      */}
      <nav
        aria-label="Navegação principal no celular"
        className="fixed inset-x-4 bottom-4 z-30 mb-[env(safe-area-inset-bottom)] flex items-center rounded-[20px] bg-breu px-1.5 py-1 shadow-[0_2px_4px_rgb(27_29_26/0.08),0_24px_48px_-20px_rgb(27_29_26/0.55)] lg:hidden"
      >
        {ABAS.map((item) => {
          const ativo = estaAtivo(caminho, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`relative flex min-h-12 flex-1 flex-col items-center gap-1 rounded-2xl px-0.5 py-2 text-[0.5625rem] leading-tight transition-colors duration-150 ${
                ativo ? "text-breu-verde" : "text-breu-suave"
              }`}
            >
              {item.icone}
              <span className="w-full truncate text-center">
                {item.nomeCurto ?? item.nome}
              </span>
              <PontoDeCarga className="absolute right-1.5 top-1.5" />
            </Link>
          );
        })}

        {/*
          Conta é `<button>` e não `<Link>`: ela não leva a uma rota, abre a
          folha com as três telas de conta e o sair. Um link que não navega
          mentiria para o teclado e para o leitor de tela.
        */}
        <button
          ref={botaoDaConta}
          type="button"
          aria-expanded={folhaAberta}
          aria-controls={idDaFolha}
          aria-current={contaAtiva ? "page" : undefined}
          onClick={() => setFolhaAberta(!folhaAberta)}
          className={`flex min-h-12 flex-1 flex-col items-center gap-1 rounded-2xl px-0.5 py-2 text-[0.5625rem] leading-tight transition-colors duration-150 ${
            contaAtiva || folhaAberta ? "text-breu-verde" : "text-breu-suave"
          }`}
        >
          {IconeDeConta}
          <span className="w-full truncate text-center">Conta</span>
        </button>
      </nav>
    </>
  );
}
