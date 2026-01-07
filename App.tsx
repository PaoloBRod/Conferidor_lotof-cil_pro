
import React, { useState, useCallback, useMemo } from 'react';
import { Upload, Clipboard, CheckCircle, Trophy, BarChart3, AlertCircle, Loader2, History, Trash2, Coins, ExternalLink, Calculator, Target, Star } from 'lucide-react';
import { extractTicketsFromImage, fetchOfficialResult } from './services/geminiService';
import { ContestData, PlayedGame } from './types';
import { PRIZE_VALUES } from './constants';

interface ExtendedContestData extends ContestData {
  premioTotalOficial?: string;
  dezenasElite?: number[];
}

const App: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [playedGames, setPlayedGames] = useState<PlayedGame[]>([]);
  const [contests, setContests] = useState<Record<number, ExtendedContestData>>({});
  const [checked, setChecked] = useState(false);

  const readImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 10);
    setLoading(true);
    try {
      const b64s = await Promise.all(files.map(readImage));
      setImages(prev => [...prev, ...b64s].slice(0, 10));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setLoading(true);
          const b64 = await readImage(file);
          setImages(prev => [...prev, b64].slice(0, 10));
          setLoading(false);
        }
      }
    }
  }, []);

  const analyzeImages = async () => {
    if (images.length === 0) return;
    setAnalyzing(true);
    setChecked(false);
    try {
      const allGames: PlayedGame[] = [];
      const drawNumbersFound = new Set<number>();

      for (const img of images) {
        const result = await extractTicketsFromImage(img);
        result.tickets.forEach(ticket => {
          drawNumbersFound.add(ticket.concurso);
          ticket.games.forEach((game, idx) => {
            allGames.push({
              id: `${ticket.codBilhete}-${game.letra}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
              concurso: ticket.concurso,
              codBilhete: ticket.codBilhete,
              letra: game.letra,
              dezenas: game.dezenas
            });
          });
        });
      }

      setPlayedGames(allGames);

      const contestPromises = Array.from(drawNumbersFound).map(num => fetchOfficialResult(num));
      const contestResults = await Promise.all(contestPromises);
      
      const contestMap: Record<number, ExtendedContestData> = {};
      contestResults.forEach(c => {
        if (c.concurso) contestMap[c.concurso] = c;
      });
      setContests(contestMap);

    } catch (err) {
      console.error("Erro na análise:", err);
      alert("Erro ao ler bilhetes. Verifique a qualidade da imagem.");
    } finally {
      setAnalyzing(false);
    }
  };

  const conferir = () => {
    const updatedGames = playedGames.map(game => {
      const contest = contests[game.concurso];
      if (!contest) return game;
      
      const hits = game.dezenas.filter(d => contest.dezenas.includes(d)).length;
      let prize = 0;
      if (hits === 15) prize = parseFloat(contest.premio15.replace(/[^\d,]/g, '').replace(',', '.'));
      else if (hits === 14) prize = parseFloat(contest.premio14.replace(/[^\d,]/g, '').replace(',', '.'));
      else if (hits >= 11) prize = PRIZE_VALUES[hits] || 0;

      return { ...game, acertos: hits, valorPremio: prize };
    });
    setPlayedGames(updatedGames);
    setChecked(true);
  };

  const stats = useMemo(() => {
    if (!checked) return null;
    const winners = playedGames.filter(g => (g.acertos || 0) >= 11);
    const totalPrize = winners.reduce((acc, g) => acc + (g.valorPremio || 0), 0);
    return { count: winners.length, total: totalPrize };
  }, [playedGames, checked]);

  const prizeBreakdown = useMemo(() => {
    if (!checked) return [];
    const breakdown: Record<number, { count: number; value: number }> = {};
    playedGames.forEach(game => {
      const acertos = game.acertos || 0;
      if (acertos >= 11) {
        if (!breakdown[acertos]) {
          breakdown[acertos] = { count: 0, value: game.valorPremio || 0 };
        }
        breakdown[acertos].count++;
      }
    });
    return Object.entries(breakdown)
      .map(([hits, data]) => ({ hits: Number(hits), ...data }))
      .sort((a, b) => b.hits - a.hits);
  }, [playedGames, checked]);

  // Insight de elite: Dezenas do usuário que coincidem com as dezenas de alta frequência em sorteios com 15 acertos
  const eliteStats = useMemo(() => {
    if (!checked) return [];
    const counts: Record<number, number> = {};
    playedGames.forEach(game => {
      const contest = contests[game.concurso];
      if (!contest) return;
      
      // Consideramos as dezenas de elite identificadas ou o conjunto total sorteado como referência de elite
      const dezenasElite = (contest.dezenasElite && contest.dezenasElite.length > 0) 
        ? contest.dezenasElite 
        : contest.dezenas;

      game.dezenas.forEach(d => {
        if (dezenasElite.includes(d)) {
          counts[d] = (counts[d] || 0) + 1;
        }
      });
    });
    
    // Agora retornamos o Top 15, que é o número máximo de dezenas da Lotofácil
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([num, count]) => ({ num: parseInt(num), count }));
  }, [playedGames, contests, checked]);

  const clearAll = () => {
    setImages([]);
    setPlayedGames([]);
    setContests({});
    setChecked(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50" onPaste={onPaste}>
      {/* Header */}
      <header className="bg-purple-800 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-2xl font-bold tracking-tight">Lotofácil <span className="font-light">Conferidor Pro</span></h1>
          </div>
          <div className="flex items-center gap-4">
             {images.length > 0 && (
               <button onClick={clearAll} className="text-white/70 hover:text-white transition-colors">
                 <Trash2 className="w-5 h-5" />
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Upload Area */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100">
              <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" /> Upload de Comprovantes
              </h2>
              <div 
                className="border-2 border-dashed border-purple-200 rounded-xl p-8 flex flex-col items-center justify-center bg-purple-50 transition-colors hover:border-purple-400 relative"
              >
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={onFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  id="file-upload"
                />
                <div className="text-center pointer-events-none">
                  <div className="bg-purple-100 p-4 rounded-full mb-4 inline-block text-purple-600">
                    <Clipboard className="w-8 h-8" />
                  </div>
                  <p className="text-purple-700 font-medium">Clique para selecionar ou Cole aqui (Ctrl+V)</p>
                  <p className="text-gray-400 text-sm mt-1">Lê múltiplos bilhetes por imagem</p>
                </div>
              </div>

              {images.length > 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-3 mb-6">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} className="w-20 h-24 object-cover rounded-lg border border-purple-200 shadow-sm" alt={`ticket-${idx}`} />
                        <button 
                          onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={analyzeImages}
                    disabled={analyzing || images.length === 0}
                    className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl hover:bg-purple-700 transition-all disabled:bg-purple-300 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {analyzing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <CheckCircle className="w-6 h-6" />
                    )}
                    {analyzing ? 'Pesquisando Resultados na Internet...' : 'Processar e Buscar Resultados'}
                  </button>
                </div>
              )}
            </section>

            {/* Official Draws */}
            {(Object.values(contests) as ExtendedContestData[]).sort((a,b)=>b.concurso-a.concurso).map((contest: ExtendedContestData) => (
              <section key={contest.concurso} className="bg-white rounded-2xl p-6 shadow-sm border-l-8 border-l-purple-600 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-1">
                      <h3 className="text-2xl font-black text-purple-900">Resultado Oficial #{contest.concurso}</h3>
                      {contest.premioTotalOficial && (
                        <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-lg border border-green-200">
                          <Coins className="w-4 h-4" />
                          <span className="text-xs font-black uppercase">Prêmio Total: {contest.premioTotalOficial}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-500 flex items-center gap-1 font-medium"><History className="w-4 h-4" /> Sorteio em {contest.data}</p>
                  </div>
                  {contest.acumulado && (
                    <div className="bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                      Acumulado! {contest.valorAcumulado}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 mb-8">
                  {contest.dezenas.length > 0 ? contest.dezenas.map(d => (
                    <span key={d} className="w-11 h-11 flex items-center justify-center bg-purple-700 text-white rounded-full font-black text-lg shadow-inner ring-2 ring-purple-100">
                      {d.toString().padStart(2, '0')}
                    </span>
                  )) : (
                    <div className="w-full p-4 bg-gray-50 border border-dashed rounded-xl text-center text-gray-400 text-sm italic">
                      Dezenas ainda não encontradas para este concurso.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-t border-purple-50 pt-6">
                  <div className="text-center p-3 rounded-xl bg-purple-50 border border-purple-100">
                    <p className="text-[10px] text-purple-400 uppercase font-black mb-1 tracking-tighter">15 Acertos</p>
                    <p className="font-black text-purple-900 leading-tight">{contest.ganhadores15} ganh.</p>
                    <p className="text-[10px] text-purple-600 font-bold">{contest.premio15}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-black mb-1 tracking-tighter">14 Acertos</p>
                    <p className="font-black text-gray-700 truncate">{contest.premio14}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-black mb-1 tracking-tighter">13 Acertos</p>
                    <p className="font-black text-gray-700">{contest.premio13}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-black mb-1 tracking-tighter">12 Acertos</p>
                    <p className="font-black text-gray-700">{contest.premio12}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-black mb-1 tracking-tighter">11 Acertos</p>
                    <p className="font-black text-gray-700">{contest.premio11}</p>
                  </div>
                </div>

                {/* Grounding Sources */}
                {contest.sources && contest.sources.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Fontes Oficiais Encontradas:</p>
                    <div className="flex flex-wrap gap-2">
                      {contest.sources.map((source, idx) => (
                        <a 
                          key={idx} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gray-50 hover:bg-purple-50 text-gray-500 hover:text-purple-600 px-3 py-1.5 rounded-lg border border-gray-100 transition-colors text-xs font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {source.title || 'Ver Resultado'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))}

            {/* Conference Control Bar */}
            {playedGames.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 flex justify-center animate-in fade-in duration-500">
                 <button 
                  onClick={conferir}
                  className="bg-yellow-500 hover:bg-yellow-400 text-purple-900 font-black py-4 px-12 rounded-2xl transition-all shadow-xl flex items-center gap-3 uppercase text-lg tracking-widest ring-4 ring-yellow-100"
                 >
                   <CheckCircle className="w-6 h-6" />
                   Conferir Jogos
                 </button>
              </div>
            )}

            {/* Transcription Table */}
            {playedGames.length > 0 && (
              <section className="bg-white rounded-2xl p-6 shadow-sm overflow-hidden border border-gray-100">
                <h2 className="text-lg font-semibold text-purple-900 mb-6 flex items-center gap-2">
                  <History className="w-5 h-5" /> Jogos Lidos e Transcritos
                </h2>
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-purple-50/50">
                      <tr className="text-[10px] text-purple-400 uppercase tracking-widest border-b border-purple-100">
                        <th className="px-6 py-4">Concurso</th>
                        <th className="px-6 py-4">Cód. Bilhete</th>
                        <th className="px-6 py-4 text-center">Jogo</th>
                        <th className="px-6 py-4">Dezenas Jogadas</th>
                        {checked && <th className="px-6 py-4 text-center">Desempenho</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {playedGames.map((game, i) => {
                        const contest = contests[game.concurso];
                        const hits = game.acertos || 0;
                        const isSpecialPrize = hits >= 14;

                        return (
                          <tr key={game.id + i} className={`group transition-colors ${checked && hits >= 11 ? 'bg-green-50/50 hover:bg-green-100/50' : 'hover:bg-purple-50/30'}`}>
                            <td className="px-6 py-5 font-bold text-purple-900 text-sm">#{game.concurso}</td>
                            <td className="px-6 py-5 font-mono text-[10px] text-gray-400 group-hover:text-gray-600 truncate max-w-[120px]">{game.codBilhete}</td>
                            <td className="px-6 py-5 text-center font-black text-purple-700 text-lg">{game.letra}</td>
                            <td className="px-6 py-5">
                              <div className="flex flex-wrap gap-1 max-w-[280px]">
                                {game.dezenas.slice().sort((a,b)=>a-b).map(d => {
                                  const isHit = checked && contest?.dezenas.includes(d);
                                  return (
                                    <span 
                                      key={d} 
                                      className={`w-7 h-7 flex items-center justify-center text-xs rounded-full border transition-all ${isHit ? 'bg-purple-600 text-white border-purple-600 font-black scale-110 shadow-sm' : 'border-gray-200 text-gray-500 bg-white'}`}
                                    >
                                      {d.toString().padStart(2, '0')}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            {checked && (
                              <td className="px-6 py-5 text-center">
                                <div className={`inline-flex flex-col items-center justify-center min-w-[80px] py-1.5 px-3 rounded-lg shadow-md transition-all ${isSpecialPrize ? 'bg-yellow-400 text-black scale-110 ring-2 ring-yellow-500' : hits >= 11 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500 shadow-none'}`}>
                                  <span className="text-sm font-black uppercase leading-none">{hits}</span>
                                  <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Acertos</span>
                                </div>
                                {game.valorPremio! > 0 && (
                                  <div className={`mt-2 text-[10px] font-black animate-bounce ${isSpecialPrize ? 'text-yellow-600' : 'text-green-600'}`}>
                                    + R$ {game.valorPremio?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Prize Dashboard */}
            {checked && stats && (
              <section className="bg-purple-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden ring-4 ring-purple-100">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Trophy className="w-48 h-48 -rotate-12" />
                </div>
                <h2 className="text-xl font-black mb-8 flex items-center gap-3 uppercase tracking-widest border-b border-white/10 pb-4">
                  <BarChart3 className="w-6 h-6 text-yellow-400" /> Resumo de Acertos
                </h2>
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                    <p className="text-purple-300 text-[10px] font-black uppercase tracking-widest mb-2">Tickets Premiados</p>
                    <p className="text-5xl font-black flex items-baseline gap-2">
                      {stats.count} <span className="text-sm font-medium text-purple-400">jogos</span>
                    </p>
                  </div>

                  {/* Memory Calculation Section */}
                  <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 space-y-3">
                    <p className="text-[10px] font-black text-purple-300 uppercase tracking-widest flex items-center gap-2">
                      <Calculator className="w-3 h-3" /> Memória de Cálculo
                    </p>
                    <div className="space-y-2">
                      {prizeBreakdown.map(item => (
                        <div key={item.hits} className="flex justify-between items-center text-xs">
                          <span className="text-purple-100 font-medium">
                            {item.count}x {item.hits} acertos
                          </span>
                          <span className="font-mono text-purple-200">
                            {item.count} x R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      {prizeBreakdown.length === 0 && (
                        <p className="text-purple-400 text-[10px] italic">Nenhuma premiação encontrada.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-2xl text-purple-950 shadow-xl">
                    <p className="text-purple-900/60 text-[10px] font-black uppercase tracking-widest mb-2">Total Ganho</p>
                    <p className="text-4xl font-black leading-tight">
                      <span className="text-xl opacity-60">R$</span> {stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Dezenas de Elite - Insights baseados em 15 acertos */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-purple-900 mb-8 flex flex-col gap-1 uppercase tracking-wide">
                <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span>Dezenas de Elite</span>
                </div>
                <span className="text-[9px] text-gray-400 font-medium normal-case">(Top 15 acertos seus em dezenas com alta frequência em prêmios máximos)</span>
              </h2>
              <div className="space-y-5">
                {checked ? (
                  eliteStats.length > 0 ? eliteStats.map((item, idx) => (
                    <div key={item.num} className="flex items-center gap-4 animate-in slide-in-from-right duration-500" style={{ animationDelay: `${idx * 40}ms` }}>
                      <span className={`w-9 h-9 flex items-center justify-center rounded-xl font-black text-xs transition-all ${idx < 3 ? 'bg-yellow-500 text-purple-900 shadow-md scale-110' : idx < 7 ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-500'}`}>
                        {item.num.toString().padStart(2, '0')}
                      </span>
                      <div className="flex-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${idx < 3 ? 'bg-gradient-to-r from-yellow-500 to-yellow-300' : 'bg-purple-300'}`}
                            style={{ width: `${(item.count / playedGames.length) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-purple-900 font-black uppercase w-10 text-right">
                        {item.count}<span className="text-[8px] opacity-60 ml-0.5">X</span>
                      </span>
                    </div>
                  )) : (
                    <div className="text-center py-10 px-4">
                       <Target className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                       <p className="text-gray-400 text-xs italic font-medium">Nenhum acerto "Elite" registrado.</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-10 px-4 border-2 border-dashed border-gray-50 rounded-2xl">
                     <AlertCircle className="w-10 h-10 text-purple-100 mx-auto mb-4" />
                     <p className="text-purple-300 text-[10px] uppercase font-black tracking-widest">Aguardando conferência</p>
                     <p className="text-gray-400 text-[10px] mt-2 leading-relaxed">Exibiremos as 15 dezenas com melhor desempenho histórico em relação aos seus jogos.</p>
                  </div>
                )}
              </div>
            </section>

            {!analyzing && playedGames.length === 0 && (
               <div className="bg-purple-50 border border-purple-100 rounded-3xl p-10 text-center">
                 <AlertCircle className="w-16 h-16 text-purple-200 mx-auto mb-6" />
                 <h3 className="text-purple-900 font-black uppercase text-sm mb-3">Aguardando bilhetes</h3>
                 <p className="text-purple-700/60 text-xs leading-relaxed font-medium">As 15 Dezenas de Elite serão calculadas automaticamente.</p>
               </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t p-8 text-center">
        <div className="flex justify-center items-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          <span>© 2024 Lotofácil Conferidor Pro</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
