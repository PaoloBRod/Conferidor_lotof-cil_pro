
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResponse } from "../types";

export async function extractTicketsFromImage(base64Image: string): Promise<OCRResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = base64Image.split(",")[1] || base64Image;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: data
          }
        },
        {
          text: "Você é um especialista em OCR de bilhetes da Lotofácil da Caixa Econômica Federal. Identifique CADA bilhete separadamente. Para cada bilhete, extraia o número EXATO do CONCURSO, o CÓDIGO DO BILHETE e as dezenas de cada jogo (A, B, C). Seja extremamente rigoroso com o número do CONCURSO. Retorne todos os bilhetes encontrados no array 'tickets'."
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tickets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                concurso: { type: Type.INTEGER },
                codBilhete: { type: Type.STRING },
                games: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      letra: { type: Type.STRING },
                      dezenas: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER }
                      }
                    },
                    required: ["letra", "dezenas"]
                  }
                }
              },
              required: ["concurso", "codBilhete", "games"]
            }
          }
        },
        required: ["tickets"]
      }
    }
  });

  const text = response.text || '{"tickets": []}';
  return JSON.parse(text);
}

export async function fetchOfficialResult(concurso: number) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Use a pesquisa do Google para encontrar os resultados REAIS e OFICIAIS do concurso número ${concurso} da Lotofácil da Caixa Econômica Federal.
  Eu preciso das seguintes informações exatas: 
  1. Data do sorteio.
  2. As 15 dezenas sorteadas.
  3. Valor TOTAL do prêmio principal (15 acertos).
  4. Valor individual do prêmio para 15, 14, 13, 12 e 11 acertos.
  5. Quantidade de ganhadores para 15 acertos.
  6. Se acumulou e qual o valor acumulado para o próximo concurso.
  7. Identifique quais são as dezenas sorteadas NESTE concurso que possuem a maior frequência histórica em todos os sorteios que já tiveram ganhadores de 15 acertos na Lotofácil. Forneça uma lista de até 15 dezenas desse concurso classificadas por relevância histórica (Dezenas Elite).
  
  Retorne EXCLUSIVAMENTE em formato JSON.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          concurso: { type: Type.INTEGER },
          data: { type: Type.STRING },
          dezenas: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          premioTotalOficial: { type: Type.STRING },
          premio15: { type: Type.STRING },
          premio14: { type: Type.STRING },
          premio13: { type: Type.STRING },
          premio12: { type: Type.STRING },
          premio11: { type: Type.STRING },
          ganhadores15: { type: Type.INTEGER },
          acumulado: { type: Type.BOOLEAN },
          valorAcumulado: { type: Type.STRING },
          dezenasElite: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "Lista das dezenas sorteadas neste concurso (até 15) que possuem maior frequência histórica em jogos de 15 pontos." }
        },
        required: ["concurso", "data", "dezenas", "premioTotalOficial", "premio15", "premio14", "premio13", "premio12", "premio11", "ganhadores15", "acumulado"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const sources = groundingChunks?.map((chunk: any) => ({
    uri: chunk.web?.uri,
    title: chunk.web?.title
  })).filter((s: any) => s.uri) || [];

  return { ...result, sources };
}
