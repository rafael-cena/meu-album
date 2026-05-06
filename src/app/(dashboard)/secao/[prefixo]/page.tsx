'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SECOES_ALBUM, COUNTRY_FLAGS } from '@/utils/constants';

export default function SecaoPage() {
  const params = useParams();
  const router = useRouter();
  const prefixo = params.prefixo as string;

  const secao = SECOES_ALBUM.find(s => s.prefixo === prefixo);

  const [obtidas, setObtidas] = useState<string[]>([]);
  const [repetidasMap, setRepetidasMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Controle do Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [figurinhasSelecionada, setFigurinhasSelecionada] = useState<string | null>(null);

  useEffect(() => {
    carregarFigurinhas();
  }, [prefixo]);

  const carregarFigurinhas = async () => {
    // 1. Pega o usuário logado
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const userId = userData.user.id;

    // 2. Busca as obtidas APENAS deste usuário
    const { data: obtidasData } = await supabase
      .from('obtidas')
      .select('codigo')
      // Filtra pelo prefixo da seção (ex: BRA%)
      .like('codigo', `${prefixo}%`)
      // A LINHA MÁGICA QUE FALTAVA:
      .eq('user_id', userId);

    if (obtidasData) {
      setObtidas(obtidasData.map(item => item.codigo));
    }

    // 3. Busca as repetidas APENAS deste usuário
    const { data: repetidasData } = await supabase
      .from('repetidas')
      .select('codigo, quantidade')
      .like('codigo', `${prefixo}%`)
      // A LINHA MÁGICA AQUI TAMBÉM:
      .eq('user_id', userId);

    if (repetidasData) {
      const repetidasMap: Record<string, number> = {};
      repetidasData.forEach(item => {
        repetidasMap[item.codigo] = item.quantidade;
      });
      setRepetidasMap(repetidasMap);
    }

    setLoading(false);
  };

  const handleCliqueFigurinha = async (codigo: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!obtidas.includes(codigo)) {
      // Se não tem, registra como obtida
      await supabase.from('obtidas').insert({ user_id: userId, codigo });
      setObtidas(prev => [...prev, codigo]);
    } else {
      // Se já tem, abre o modal de gerenciamento
      setFigurinhasSelecionada(codigo);
      setModalAberto(true);
    }
  };

  const gerenciarRepetida = async (incremento: number) => {
    if (!figurinhasSelecionada) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const qtdAtual = repetidasMap[figurinhasSelecionada] || 0;
    const novaQtd = qtdAtual + incremento;

    if (novaQtd > 0) {
      // Upsert (Insere ou Atualiza)
      await supabase.from('repetidas').upsert({
        user_id: userId,
        codigo: figurinhasSelecionada,
        quantidade: novaQtd
      }, { onConflict: 'user_id,codigo' });

      setRepetidasMap(prev => ({ ...prev, [figurinhasSelecionada]: novaQtd }));
    } else if (novaQtd === 0 && qtdAtual > 0) {
      // Remove o registro de repetidas se chegar a zero
      await supabase.from('repetidas').delete().match({ user_id: userId, codigo: figurinhasSelecionada });
      setRepetidasMap(prev => {
        const novoMapa = { ...prev };
        delete novoMapa[figurinhasSelecionada];
        return novoMapa;
      });
    }
  };

  const excluirObtida = async () => {
    if (!figurinhasSelecionada) return;
    const { data: userData } = await supabase.auth.getUser();

    await supabase.from('obtidas').delete().match({ user_id: userData.user?.id, codigo: figurinhasSelecionada });
    setObtidas(prev => prev.filter(c => c !== figurinhasSelecionada));
    fecharModal();
  };

  const fecharModal = () => {
    setModalAberto(false);
    setFigurinhasSelecionada(null);
  };

  if (!secao) return <div className="p-4 text-center">Seção não encontrada</div>;

  const bandeira = COUNTRY_FLAGS[prefixo] || '';

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <button onClick={() => router.push('/')} className="mb-4 text-blue-600 font-medium cursor-pointer">
        ← Voltar
      </button>

      <div className="flex items-center gap-3 mb-6">
        {bandeira && <span className="text-4xl">{bandeira}</span>}
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">{secao.nome}</h1>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-4 gap-3 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: secao.total }, (_, i) => i + 1).map(num => {
            const codigo = `${prefixo}${num}`;
            const isObtida = obtidas.includes(codigo);
            const qtdRepetida = repetidasMap[codigo] || 0;

            return (
              <div
                key={codigo}
                onClick={() => handleCliqueFigurinha(codigo)}
                className={`
                  relative flex items-center justify-center h-16 rounded-md shadow-sm border cursor-pointer select-none transition-all
                  ${isObtida ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}
                `}
              >
                <span className="font-bold">{num}</span>
                {/* Badge de repetidas */}
                {qtdRepetida > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {qtdRepetida}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Gerenciamento */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4 text-gray-800 text-center">
              Figurinha {figurinhasSelecionada}
            </h2>

            <div className="flex items-center justify-between mb-6 bg-gray-100 p-3 rounded">
              <span className="text-gray-700 font-medium">Repetidas: {repetidasMap[figurinhasSelecionada!] || 0}</span>
              <div className="flex gap-2">
                <button onClick={() => gerenciarRepetida(-1)} className="bg-red-500 text-white w-8 h-8 rounded font-bold hover:bg-red-600">-</button>
                <button onClick={() => gerenciarRepetida(1)} className="bg-green-500 text-white w-8 h-8 rounded font-bold hover:bg-green-600">+</button>
              </div>
            </div>

            {/* A exclusão só é permitida se não houver repetidas, conforme sua regra */}
            {(repetidasMap[figurinhasSelecionada!] || 0) === 0 && (
              <button onClick={excluirObtida} className="w-full bg-red-100 text-red-600 border border-red-300 py-2 rounded mb-3 hover:bg-red-200 transition">
                Remover da Coleção (Não tenho)
              </button>
            )}

            <button onClick={fecharModal} className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 transition">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}