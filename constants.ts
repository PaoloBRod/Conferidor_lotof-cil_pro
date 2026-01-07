
import { ContestData } from './types';

// Sample data extracted from the provided OCR for simulation/fallback
export const HISTORICAL_DATA: Record<number, ContestData> = {
  11: {
    concurso: 11,
    data: "08/12/2003",
    dezenas: [2, 6, 7, 8, 9, 10, 11, 12, 16, 19, 20, 22, 23, 24, 25],
    premio15: "R$ 0,00",
    premio14: "R$ 1.855,82",
    premio13: "R$ 35,00",
    premio12: "R$ 14,00",
    premio11: "R$ 7,00",
    ganhadores15: 0,
    acumulado: true,
    valorAcumulado: "R$ 2.351.000,93"
  },
  10: {
    concurso: 10,
    data: "01/12/2003",
    dezenas: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 19, 20, 23, 24],
    premio15: "R$ 0,00",
    premio14: "R$ 1.157,08",
    premio13: "R$ 35,00",
    premio12: "R$ 14,00",
    premio11: "R$ 7,00",
    ganhadores15: 0,
    acumulado: true,
    valorAcumulado: "R$ 1.025.945,00"
  }
};

/**
 * Prêmios Fixos Lotofácil:
 * 11 acertos: R$ 7,00
 * 12 acertos: R$ 14,00
 * 13 acertos: R$ 35,00
 */
export const PRIZE_VALUES: Record<number, number> = {
  11: 7.00,
  12: 14.00,
  13: 35.00
};
