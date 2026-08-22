'use client';

import { useEffect } from "react";

import type { EventoDoFunil } from "./funil";
import { enviarEventoDoFunilNoNavegador } from "./navegador";

export function EventoDoFunilNaEntrada({ evento }: { evento: EventoDoFunil }) {
  useEffect(() => {
    enviarEventoDoFunilNoNavegador(evento);
  }, [evento]);

  return null;
}
