export type Raridade = "Comum" | "Rara" | "Épica" | string;

export interface Jogador {
  id: string | number;
  jogador_id?: string | number;
  nome: string;
  selecao: string;
  raridade: Raridade;
  fotoUrl: string;
  posicao: string;
  paisCodigo: string;
  idade: number;
}
