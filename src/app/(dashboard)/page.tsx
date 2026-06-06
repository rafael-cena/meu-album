'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SECOES_ALBUM, COUNTRY_FLAGS } from '@/utils/constants';
import type { SecaoAlbum } from '@/utils/constants';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

function chunkArray<T>(array: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

type ModoExibicao = 'grupos' | 'grade';

const MODO_EXIBICAO_STORAGE_KEY = 'dashboard_modo_exibicao';

// Função para remover acentos e ignorar maiúsculas (ex: "Japão" vira "japao")
const normalizarTexto = (texto: string) => {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export default function Dashboard() {
  const router = useRouter();

  const [obtidas, setObtidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const [modoExibicao, setModoExibicao] = useState<ModoExibicao>('grupos');
  const [secaoModal, setSecaoModal] = useState<SecaoAlbum | null>(null);
  const [figurinhaSelecionada, setFigurinhaSelecionada] = useState<string | null>(null);
  const [repetidasMap, setRepetidasMap] = useState<Record<string, number>>({});

  // Novo estado para a barra de pesquisa
  const [busca, setBusca] = useState('');

  const totalGeralAlbum = SECOES_ALBUM.reduce((acc, curr) => acc + curr.total, 0);
  const totalObtidas = obtidas.length;
  const porcentagem = Math.round((totalObtidas / totalGeralAlbum) * 100);

  useEffect(() => {
    const carregarProgresso = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: obtidasData } = await supabase
        .from('obtidas')
        .select('codigo')
        .eq('user_id', userData.user.id);

      if (obtidasData) setObtidas(obtidasData.map(item => item.codigo));

      const { data: repetidasData } = await supabase
        .from('repetidas')
        .select('codigo, quantidade')
        .eq('user_id', userData.user.id);

      if (repetidasData) {
        const novoMapa: Record<string, number> = {};
        repetidasData.forEach(item => {
          novoMapa[item.codigo] = item.quantidade;
        });
        setRepetidasMap(novoMapa);
      }

      setLoading(false);
    };

    carregarProgresso();
  }, []);

  useEffect(() => {
    const preferenciaSalva = localStorage.getItem(MODO_EXIBICAO_STORAGE_KEY);

    if (preferenciaSalva === 'grupos' || preferenciaSalva === 'grade') {
      setModoExibicao(preferenciaSalva);
    }
  }, []);

  const toggleGrupo = (nome: string) => {
    setGruposAbertos(prev => ({ ...prev, [nome]: !prev[nome] }));
  };

  const obterCodigosSecao = (secao: SecaoAlbum) => {
    return Array.from({ length: secao.total }, (_, index) => `${secao.prefixo}${index + 1}`);
  };

  const alterarModoExibicao = (modo: ModoExibicao) => {
    setModoExibicao(modo);
    localStorage.setItem(MODO_EXIBICAO_STORAGE_KEY, modo);
  };

  const fwcSecao = SECOES_ALBUM.find(s => s.prefixo === 'FWC');
  const ccSecao = SECOES_ALBUM.find(s => s.prefixo === 'CC');
  const selecoes = SECOES_ALBUM.filter(s => s.prefixo !== 'FWC' && s.prefixo !== 'CC');

  const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const gruposDePaises = chunkArray(selecoes, 4).map((times, index) => ({
    nome: `Grupo ${letras[index]}`,
    times
  }));

  // Lógica de filtro da pesquisa
  const resultadosBusca = SECOES_ALBUM.filter(secao =>
    normalizarTexto(secao.nome).includes(normalizarTexto(busca)) ||
    normalizarTexto(secao.prefixo).includes(normalizarTexto(busca))
  );

  const renderCard = (secao: SecaoAlbum | undefined, isFullWidth = false) => {
    if (!secao) return null;
    const bandeira = COUNTRY_FLAGS[secao.prefixo] || '';
    const obtidasDestaSecao = obtidas.filter(cod => cod.startsWith(secao.prefixo)).length;
    const falta = secao.total - obtidasDestaSecao;
    const concluido = falta === 0;

    return (
      <div
        key={secao.prefixo}
        className={isFullWidth ? 'w-full mb-4' : 'min-w-0'}
      >
        <button
          type="button"
          onClick={() => {
            setFigurinhaSelecionada(null);
            setSecaoModal(secao);
          }}
          className={`relative bg-white rounded-xl shadow-sm border transition-all active:scale-95 flex w-full
            ${concluido ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400'}
            ${isFullWidth ? 'flex-row justify-between items-center p-5' : 'flex-col items-center justify-center text-center p-4 min-h-36'}
            select-none
          `}
        >
          {isFullWidth ? (
            <>
              <div className="flex items-center gap-4 text-left">
                {bandeira && <span className="text-4xl drop-shadow-sm">{bandeira}</span>}
                <div>
                  <span className="font-bold text-gray-800 text-lg leading-tight block">{secao.nome}</span>
                  <span className="text-xs text-gray-400 font-bold uppercase">{secao.total} figurinhas</span>
                </div>
              </div>
              <div>
                {concluido ? (
                  <span className="text-[10px] font-black uppercase px-2 py-1.5 rounded bg-green-100 text-green-600">Completo!</span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2 py-1.5 rounded bg-orange-100 text-orange-600">Faltam {falta}</span>
                )}
              </div>
            </>
          ) : (
            <>
              {bandeira && <span className="text-3xl mb-2 drop-shadow-sm">{bandeira}</span>}
              <span className="font-bold text-gray-800 leading-tight">{secao.nome}</span>
              <div className="mt-2">
                {concluido ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-green-100 text-green-600">Completo!</span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-100 text-orange-600">Faltam {falta}</span>
                )}
              </div>
            </>
          )}
        </button>
      </div>
    );
  };

  useEffect(() => {
    const conferirConvites = () => {
      const pendente = localStorage.getItem('convite_pendente');
      if (pendente) {
        // Se achou um convite, remove do "bolso" e manda o usuário 
        // de volta para a página que processa a entrada.
        localStorage.removeItem('convite_pendente');
        router.push(`/grupos/convite/${pendente}`);
      }
    };

    conferirConvites();
  }, []);

  const fecharModalSecao = () => {
    setSecaoModal(null);
    setFigurinhaSelecionada(null);
  };

  const handleCliqueFigurinha = async (codigo: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    if (!obtidas.includes(codigo)) {
      await supabase.from('obtidas').insert({ user_id: userId, codigo });
      setObtidas(prev => [...prev, codigo]);
      return;
    }

    setFigurinhaSelecionada(codigo);
  };

  const gerenciarRepetida = async (incremento: number) => {
    if (!figurinhaSelecionada) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const qtdAtual = repetidasMap[figurinhaSelecionada] || 0;
    const novaQtd = qtdAtual + incremento;

    if (novaQtd > 0) {
      await supabase.from('repetidas').upsert({
        user_id: userId,
        codigo: figurinhaSelecionada,
        quantidade: novaQtd
      }, { onConflict: 'user_id,codigo' });

      setRepetidasMap(prev => ({ ...prev, [figurinhaSelecionada]: novaQtd }));
      return;
    }

    if (novaQtd === 0 && qtdAtual > 0) {
      await supabase.from('repetidas').delete().match({ user_id: userId, codigo: figurinhaSelecionada });
      setRepetidasMap(prev => {
        const novoMapa = { ...prev };
        delete novoMapa[figurinhaSelecionada];
        return novoMapa;
      });
    }
  };

  const excluirObtida = async () => {
    if (!figurinhaSelecionada) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    await supabase.from('obtidas').delete().match({ user_id: userId, codigo: figurinhaSelecionada });
    setObtidas(prev => prev.filter(codigo => codigo !== figurinhaSelecionada));
    setFigurinhaSelecionada(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* Barra de Progresso no Topo */}
      <div className="sticky top-0 z-10 bg-white p-4 rounded-xl shadow-md border border-gray-200 mb-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800 leading-none">Meu Progresso</h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Copa do Mundo 2026</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-blue-600">{totalObtidas}</span>
            <span className="text-sm text-gray-400 font-bold"> / {totalGeralAlbum}</span>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border border-gray-100">
          <div className="bg-blue-600 h-full transition-all duration-1000 ease-out" style={{ width: `${porcentagem}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">

          {/* Barra de Pesquisa */}
          <div className="mb-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
            <input
              type="text"
              placeholder="Buscar país ou prefixo (ex: BRA)..."
              className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all text-gray-700"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                ✖️
              </button>
            )}
          </div>

          {!busca.trim() && (
            <div className="mb-6 flex rounded-xl bg-white border border-gray-200 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => alterarModoExibicao('grupos')}
                aria-pressed={modoExibicao === 'grupos'}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                  modoExibicao === 'grupos'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                Por grupos
              </button>
              <button
                type="button"
                onClick={() => alterarModoExibicao('grade')}
                aria-pressed={modoExibicao === 'grade'}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                  modoExibicao === 'grade'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                Grade completa
              </button>
            </div>
          )}

          {/* Renderização Condicional: Pesquisa vs Layout Normal */}
          {busca.trim().length > 0 ? (
            // MODO DE PESQUISA
            resultadosBusca.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {resultadosBusca.map(secao => renderCard(secao, false))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <span className="text-3xl block mb-2">🤔</span>
                Nenhum país encontrado para "{busca}"
              </div>
            )
          ) : (
            // MODO NORMAL (Sem pesquisa)
            <>
              {renderCard(fwcSecao, true)}

              {modoExibicao === 'grupos' ? (
                <div className="space-y-3 mb-4">
                  {gruposDePaises.map((grupo) => {
                    const isAberto = gruposAbertos[grupo.nome];
                    const totalGrupo = grupo.times.reduce((acc, t) => acc + t.total, 0);
                    const obtidasGrupo = grupo.times.reduce((acc, t) => {
                      return acc + obtidas.filter(cod => cod.startsWith(t.prefixo)).length;
                    }, 0);

                    return (
                      <div key={grupo.nome} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => toggleGrupo(grupo.nome)}
                          className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <h2 className="font-bold text-gray-800 text-lg">{grupo.nome}</h2>
                            {obtidasGrupo === totalGrupo && (
                              <span className="bg-green-100 text-green-600 text-[10px] uppercase font-black px-2 py-0.5 rounded">100%</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-gray-400">
                            <span className="text-xs font-bold">{obtidasGrupo}/{totalGrupo}</span>
                            <svg className={`w-5 h-5 transform transition-transform duration-200 ${isAberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isAberto && (
                          <div className="p-4 grid grid-cols-2 gap-4 border-t border-gray-100 bg-white">
                            {grupo.times.map(time => renderCard(time, false))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {selecoes.map(secao => renderCard(secao, false))}
                </div>
              )}

              {renderCard(ccSecao, true)}

              {/* --- BOTÕES DE AÇÕES RÁPIDAS (Final do Scroll) --- */}
              <div className="mt-8 mb-4 border-t border-gray-200 pt-6">
                <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-4 text-center">Ações Rápidas</h3>

                <div className="flex flex-col gap-3">
                  <Link
                    href="/insercao/texto"
                    className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl flex items-center justify-between shadow-md active:scale-95 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl drop-shadow-sm">📝</span>
                      <div className="text-left">
                        <span className="font-bold text-base block">Inserção em Lote</span>
                        <span className="text-xs text-blue-200">Colar várias de uma vez</span>
                      </div>
                    </div>
                    <span className="text-blue-200 text-2xl font-light">→</span>
                  </Link>

                  <Link
                    href="/insercao/camera"
                    className="bg-slate-800 hover:bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between shadow-md active:scale-95 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl drop-shadow-sm">📷</span>
                      <div className="text-left">
                        <span className="font-bold text-base block">Registro por Câmera</span>
                        <span className="text-xs text-slate-200">Escanear e salvar no álbum</span>
                      </div>
                    </div>
                    <span className="text-slate-200 text-2xl font-light">→</span>
                  </Link>

                  <Link
                    href="/insercao/repetidas"
                    className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-xl flex items-center justify-between shadow-md active:scale-95 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl drop-shadow-sm">➕</span>
                      <div className="text-left">
                        <span className="font-bold text-base block">Nova Repetida</span>
                        <span className="text-xs text-green-100">Registrar estoque extra</span>
                      </div>
                    </div>
                    <span className="text-green-100 text-2xl font-light">→</span>
                  </Link>
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {secaoModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={fecharModalSecao}>
          <div
            className="flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-100 bg-white p-4">
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gray-300" />
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-3xl">{COUNTRY_FLAGS[secaoModal.prefixo] || ''}</span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black text-gray-800">{secaoModal.nome}</h2>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {secaoModal.total} figurinhas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fecharModalSecao}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-gray-600"
                  aria-label="Fechar figurinhas da seleção"
                >
                  ✕
                </button>
              </div>

              {figurinhaSelecionada && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-gray-400">Figurinha</p>
                      <h3 className="text-lg font-black text-gray-800">{figurinhaSelecionada}</h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFigurinhaSelecionada(null)}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-500"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-white p-3">
                    <span className="text-sm font-bold text-gray-700">
                      Repetidas: {repetidasMap[figurinhaSelecionada] || 0}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => gerenciarRepetida(-1)}
                        className="flex h-8 w-8 items-center justify-center rounded bg-red-500 text-lg font-black text-white"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => gerenciarRepetida(1)}
                        className="flex h-8 w-8 items-center justify-center rounded bg-green-500 text-lg font-black text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {(repetidasMap[figurinhaSelecionada] || 0) === 0 && (
                    <button
                      type="button"
                      onClick={excluirObtida}
                      className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600"
                    >
                      Remover da coleção
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-8">
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {obterCodigosSecao(secaoModal).map((codigo, index) => {
                  const obtida = obtidas.includes(codigo);
                  const qtdRepetida = repetidasMap[codigo] || 0;

                  return (
                    <button
                      type="button"
                      key={codigo}
                      onClick={() => handleCliqueFigurinha(codigo)}
                      className={`relative flex h-12 items-center justify-center rounded-lg border text-sm font-black shadow-sm transition-all ${
                        figurinhaSelecionada === codigo
                          ? 'border-green-700 bg-green-600 text-white'
                          : obtida
                            ? 'border-blue-700 bg-blue-600 text-white'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {index + 1}
                      {qtdRepetida > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                          {qtdRepetida}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
