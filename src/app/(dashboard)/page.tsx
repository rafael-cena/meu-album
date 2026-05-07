'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SECOES_ALBUM, COUNTRY_FLAGS } from '@/utils/constants';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

function chunkArray(array: any[], size: number) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Função para remover acentos e ignorar maiúsculas (ex: "Japão" vira "japao")
const normalizarTexto = (texto: string) => {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export default function Dashboard() {
  const router = useRouter();

  const [obtidas, setObtidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});

  // Novo estado para a barra de pesquisa
  const [busca, setBusca] = useState('');

  const totalGeralAlbum = SECOES_ALBUM.reduce((acc, curr) => acc + curr.total, 0);
  const totalObtidas = obtidas.length;
  const porcentagem = Math.round((totalObtidas / totalGeralAlbum) * 100);

  useEffect(() => {
    const carregarProgresso = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('obtidas')
        .select('codigo')
        .eq('user_id', userData.user.id);

      if (data) setObtidas(data.map(item => item.codigo));
      setLoading(false);
    };

    carregarProgresso();
  }, []);

  const toggleGrupo = (nome: string) => {
    setGruposAbertos(prev => ({ ...prev, [nome]: !prev[nome] }));
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

  const renderCard = (secao: any, isFullWidth = false) => {
    if (!secao) return null;
    const bandeira = COUNTRY_FLAGS[secao.prefixo] || '';
    const obtidasDestaSecao = obtidas.filter(cod => cod.startsWith(secao.prefixo)).length;
    const falta = secao.total - obtidasDestaSecao;
    const concluido = falta === 0;

    return (
      <Link
        key={secao.prefixo}
        href={`/secao/${secao.prefixo}`}
        className={`relative bg-white rounded-xl shadow-sm border transition-all active:scale-95 flex 
          ${concluido ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400'}
          ${isFullWidth ? 'flex-row justify-between items-center p-5 w-full mb-4' : 'flex-col items-center justify-center text-center p-4'}
        `}
      >
        {isFullWidth ? (
          <>
            <div className="flex items-center gap-4">
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
      </Link>
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
    </div>
  );
}