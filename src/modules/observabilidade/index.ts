export {
  CHAVES_SENSIVEIS,
  PROFUNDIDADE_MAXIMA,
  chaveEhSensivel,
  normalizarChave,
  sanearEventoSentry,
  sanitizar,
  sanitizarTexto,
} from "./saneamento.mjs";

export {
  DESTINO_CONSOLE,
  type ContextoDeErro,
  type DestinoDeErro,
  definirDestinoDeErro,
  descreverErro,
  reportarErro,
  restaurarDestinoPadrao,
} from "./reporte";
