
export interface ContestData {
  concurso: number;
  data: string;
  dezenas: number[];
  premio15: string;
  premio14: string;
  premio13: string;
  premio12: string;
  premio11: string;
  ganhadores15: number;
  acumulado: boolean;
  valorAcumulado?: string;
  sources?: { uri: string; title: string }[];
}

export interface PlayedGame {
  id: string;
  concurso: number;
  codBilhete: string;
  letra: string;
  dezenas: number[];
  acertos?: number;
  valorPremio?: number;
}

export interface ExtractedTicket {
  concurso: number;
  codBilhete: string;
  games: {
    letra: string;
    dezenas: number[];
  }[];
}

export interface OCRResponse {
  tickets: ExtractedTicket[];
}
