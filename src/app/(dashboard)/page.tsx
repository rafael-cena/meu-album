'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SECOES_ALBUM, COUNTRY_FLAGS } from '@/utils/constants';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [obtidas, setObtidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Calcula o total geral do álbum somando as seções em constants.ts
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* Barra de Progresso no Topo */}
      <div className="sticky top-0 z-10 bg-white p-4 rounded-xl shadow-md border border-gray-200 mb-8 max-w-2xl mx-auto">
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
          <div
            className="bg-blue-600 h-full transition-all duration-1000 ease-out"
            style={{ width: `${porcentagem}%` }}
          />
        </div>
        <p className="text-[10px] text-right mt-1 text-gray-400 font-bold uppercase">{porcentagem}% concluído</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        /* Grid com 2 colunas */
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {SECOES_ALBUM.map((secao) => {
            const bandeira = COUNTRY_FLAGS[secao.prefixo] || '';

            // Conta quantas figurinhas desta seção o usuário já tem
            const obtidasDestaSecao = obtidas.filter(cod => cod.startsWith(secao.prefixo)).length;
            const falta = secao.total - obtidasDestaSecao;

            return (
              <Link
                key={secao.prefixo}
                href={`/secao/${secao.prefixo}`}
                className={`relative bg-white p-4 rounded-xl shadow-sm border transition-all active:scale-95 flex flex-col items-center justify-center text-center
                  ${falta === 0 ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400'}
                `}
              >
                {bandeira && <span className="text-3xl mb-2">{bandeira}</span>}

                <span className="font-bold text-gray-800 leading-tight">{secao.nome}</span>

                {/* Badge de quantidade que falta */}
                <div className="mt-2">
                  {falta > 0 ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-100 text-orange-600">
                      Faltam {falta}
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-green-100 text-green-600">
                      Completo!
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}