import { describe, expect, it, vi } from "vitest";

import {
  executarEsquecimento,
  EsquecimentoRecusado,
  type DependenciasDoEsquecimento,
} from "./esquecimento";

function dependenciasBase(): DependenciasDoEsquecimento & { ordem: string[] } {
  const ordem: string[] = [];
  return {
    ordem,
    apagar: vi.fn(async () => { ordem.push("apagar"); }),
    registrarFalha: vi.fn(async () => { ordem.push("falha"); }),
    registrarEmail: vi.fn(async () => { ordem.push("email_registrado"); }),
    enviarEmail: vi.fn(async () => { ordem.push("enviar"); return { enviado: true as const }; }),
    excluirAuth: vi.fn(async () => { ordem.push("auth"); }),
    finalizar: vi.fn(async () => { ordem.push("finalizar"); return true; }),
  };
}

describe("orquestração do esquecimento", () => {
  it("cumpre a ordem apagamento → e-mail → Auth → fila", async () => {
    const dependencias = dependenciasBase();

    await expect(
      executarEsquecimento({ id: "aluno-1", email: "aluno@exemplo.com" }, dependencias),
    ).resolves.toEqual({ estado: "concluido" });

    expect(dependencias.ordem).toEqual(["apagar", "enviar", "email_registrado", "auth", "finalizar"]);
    expect(dependencias.apagar).toHaveBeenCalledWith("aluno-1");
    expect(dependencias.enviarEmail).toHaveBeenCalledWith("aluno@exemplo.com");
    expect(dependencias.excluirAuth).toHaveBeenCalledWith("aluno-1");
  });

  it("não invalida Auth quando o provedor de e-mail falha", async () => {
    const dependencias = dependenciasBase();
    dependencias.enviarEmail = vi.fn(async () => {
      dependencias.ordem.push("enviar");
      return { enviado: false as const, motivo: "indisponivel" as const };
    });

    await expect(
      executarEsquecimento({ id: "aluno-1", email: "aluno@exemplo.com" }, dependencias),
    ).rejects.toMatchObject({ motivo: "email_indisponivel" });
    expect(dependencias.ordem).toEqual(["apagar", "enviar", "falha"]);
    expect(dependencias.excluirAuth).not.toHaveBeenCalled();
    expect(dependencias.finalizar).not.toHaveBeenCalled();
    expect(dependencias.registrarFalha).toHaveBeenCalledWith("aluno-1", "email_indisponivel");
  });

  it("mantém a fila recuperável quando Auth falha depois do e-mail", async () => {
    const dependencias = dependenciasBase();
    dependencias.excluirAuth = vi.fn(async () => {
      dependencias.ordem.push("auth");
      throw new Error("falha técnica");
    });

    await expect(
      executarEsquecimento({ id: "aluno-1", email: "aluno@exemplo.com" }, dependencias),
    ).rejects.toMatchObject({ motivo: "auth_indisponivel" });
    expect(dependencias.ordem).toEqual(["apagar", "enviar", "email_registrado", "auth", "falha"]);
    expect(dependencias.finalizar).not.toHaveBeenCalled();
  });

  it("não apaga nada quando a conta não tem e-mail utilizável", async () => {
    const dependencias = dependenciasBase();

    await expect(
      executarEsquecimento({ id: "aluno-1", email: "sem-email" }, dependencias),
    ).rejects.toBeInstanceOf(EsquecimentoRecusado);
    expect(dependencias.apagar).not.toHaveBeenCalled();
  });

  it("não afirma conclusão se a fila não puder ser finalizada", async () => {
    const dependencias = dependenciasBase();
    dependencias.finalizar = vi.fn(async () => {
      dependencias.ordem.push("finalizar");
      return false;
    });

    await expect(
      executarEsquecimento({ id: "aluno-1", email: "aluno@exemplo.com" }, dependencias),
    ).rejects.toMatchObject({ motivo: "fila_indisponivel" });
    expect(dependencias.ordem).toEqual(["apagar", "enviar", "email_registrado", "auth", "finalizar"]);
  });
});
