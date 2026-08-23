import { clienteDeServico } from "@/lib/db/servidor";

import {
  enviarConfirmacaoEsquecimento,
  type ResultadoDoEmail,
} from "./email";

export type UsuarioParaEsquecimento = {
  id: string;
  email: string;
};

export type DependenciasDoEsquecimento = {
  apagar: (userId: string) => Promise<unknown>;
  registrarFalha: (userId: string, codigo: string) => Promise<unknown>;
  registrarEmail: (userId: string) => Promise<unknown>;
  enviarEmail: (email: string) => Promise<ResultadoDoEmail>;
  excluirAuth: (userId: string) => Promise<void>;
  finalizar: (userId: string) => Promise<boolean>;
};

export type ResultadoDoEsquecimento = { estado: "concluido" };

export type MotivoDoEsquecimento =
  | "email_invalido"
  | "email_indisponivel"
  | "auth_indisponivel"
  | "fila_indisponivel";

export class EsquecimentoRecusado extends Error {
  readonly motivo: MotivoDoEsquecimento;

  constructor(motivo: MotivoDoEsquecimento) {
    super(motivo);
    this.name = "EsquecimentoRecusado";
    this.motivo = motivo;
  }
}

function dependenciasReais(): DependenciasDoEsquecimento {
  const servico = clienteDeServico();
  return {
    apagar: async (userId) => {
      const { data, error } = await servico.rpc("apagar_dados_do_usuario", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    registrarFalha: async (userId, codigo) => {
      const { data, error } = await servico.rpc("registrar_falha_esquecimento", {
        p_user_id: userId,
        p_codigo: codigo,
      });
      if (error) throw error;
      return data;
    },
    registrarEmail: async (userId) => {
      const { data, error } = await servico.rpc("registrar_email_esquecimento", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    enviarEmail: (email) => enviarConfirmacaoEsquecimento(email),
    excluirAuth: async (userId) => {
      const { error } = await servico.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
    finalizar: async (userId) => {
      const { data, error } = await servico.rpc("finalizar_esquecimento", {
        p_user_id: userId,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] === true : data === true;
    },
  };
}

function emailPareceValido(email: string): boolean {
  return email.length >= 3 && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function registrarFalhaSemMascarar(
  dependencias: DependenciasDoEsquecimento,
  userId: string,
  codigo: string,
): Promise<void> {
  try {
    await dependencias.registrarFalha(userId, codigo);
  } catch {
    // A falha primária continua sendo a resposta. O pedido no banco já fica
    // aberto mesmo se o registro operacional da falha também estiver fora do ar.
  }
}

/**
 * Orquestra o ritual irreversível em uma ordem que pode ser auditada:
 * apagamento → e-mail → Auth → remoção da fila. Cada etapa é injetável para
 * que o teste prove a ordem sem rede nem conta real.
 */
export async function executarEsquecimento(
  usuario: UsuarioParaEsquecimento,
  dependencias: DependenciasDoEsquecimento = dependenciasReais(),
): Promise<ResultadoDoEsquecimento> {
  if (!usuario.id || !emailPareceValido(usuario.email)) {
    throw new EsquecimentoRecusado("email_invalido");
  }

  await dependencias.apagar(usuario.id);

  const email = await dependencias.enviarEmail(usuario.email);
  if (!email.enviado) {
    await registrarFalhaSemMascarar(
      dependencias,
      usuario.id,
      `email_${email.motivo}`,
    );
    throw new EsquecimentoRecusado("email_indisponivel");
  }

  try {
    await dependencias.registrarEmail(usuario.id);
  } catch {
    await registrarFalhaSemMascarar(dependencias, usuario.id, "email_confirmacao_registro");
    throw new EsquecimentoRecusado("fila_indisponivel");
  }

  try {
    await dependencias.excluirAuth(usuario.id);
  } catch {
    await registrarFalhaSemMascarar(dependencias, usuario.id, "auth_exclusao");
    throw new EsquecimentoRecusado("auth_indisponivel");
  }

  try {
    const finalizado = await dependencias.finalizar(usuario.id);
    if (!finalizado) throw new Error("fila ainda aberta");
  } catch {
    throw new EsquecimentoRecusado("fila_indisponivel");
  }

  return { estado: "concluido" };
}

