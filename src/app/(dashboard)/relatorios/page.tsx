'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { COUNTRY_FLAGS, SECOES_ALBUM } from '@/utils/constants';

interface Repetida {
  codigo: string;
  quantidade: number;
}

export default function ExportarRelatorios() {
  const [repetidas, setRepetidas] = useState<Repetida[]>([]);
  const [obtidas, setObtidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para o Modal
  const [cromoSelecionado, setCromoSelecionado] = useState<Repetida | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  // Estados para exclusão em lote
  const [inputLote, setInputLote] = useState('');
  const [removendoLote, setRemovendoLote] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Busca as Repetidas
    const { data: repData } = await supabase
      .from('repetidas')
      .select('codigo, quantidade')
      .eq('user_id', userData.user.id);

    if (repData) setRepetidas(repData);

    // Busca as Obtidas (para poder calcular as faltantes)
    const { data: obtData } = await supabase
      .from('obtidas')
      .select('codigo')
      .eq('user_id', userData.user.id);

    if (obtData) setObtidas(obtData.map(item => item.codigo));

    setLoading(false);
  };

  // --- LÓGICA DE ORDENAÇÃO ---
  const PREFIX_ORDER = SECOES_ALBUM.map(secao => secao.prefixo);

  const repetidasOrdenadas = [...repetidas].sort((a, b) => {
    const matchA = a.codigo.match(/^([a-zA-Z]+)(\d+)$/);
    const matchB = b.codigo.match(/^([a-zA-Z]+)(\d+)$/);

    if (!matchA || !matchB) return 0;

    const prefixA = matchA[1].toUpperCase();
    const prefixB = matchB[1].toUpperCase();
    const numA = parseInt(matchA[2], 10);
    const numB = parseInt(matchB[2], 10);

    const indexA = PREFIX_ORDER.indexOf(prefixA);
    const indexB = PREFIX_ORDER.indexOf(prefixB);

    if (indexA !== indexB) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }

    return numA - numB;
  });

  // Cálculo do total geral de figurinhas repetidas
  const totalCromos = repetidas.reduce((acc, item) => acc + item.quantidade, 0);

  // --- LÓGICA DO MODAL DE REPETIDAS ---
  const alterarQuantidade = async (delta: number) => {
    if (!cromoSelecionado || atualizando) return;
    setAtualizando(true);

    const novaQtd = cromoSelecionado.quantidade + delta;

    if (novaQtd <= 0) {
      await removerRegistro();
    } else {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('repetidas')
        .update({ quantidade: novaQtd })
        .eq('user_id', userData.user?.id)
        .eq('codigo', cromoSelecionado.codigo);

      if (!error) {
        setRepetidas(prev => prev.map(item =>
          item.codigo === cromoSelecionado.codigo ? { ...item, quantidade: novaQtd } : item
        ));
        setCromoSelecionado({ ...cromoSelecionado, quantidade: novaQtd });
      }
    }
    setAtualizando(false);
  };

  const removerRegistro = async () => {
    if (!cromoSelecionado) return;
    setAtualizando(true);

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('repetidas')
      .delete()
      .eq('user_id', userData.user?.id)
      .eq('codigo', cromoSelecionado.codigo);

    if (!error) {
      setRepetidas(prev => prev.filter(item => item.codigo !== cromoSelecionado.codigo));
      setCromoSelecionado(null);
    }
    setAtualizando(false);
  };

  // --- LÓGICA DE EXCLUSÃO EM LOTE E TOTAL ---
  const removerEmLote = async () => {
    if (!inputLote.trim()) return;
    setRemovendoLote(true);

    const codigosParaRemover = inputLote
      .toUpperCase()
      .split(/[\s,]+/)
      .filter((codigo) => codigo !== '');

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('repetidas')
      .delete()
      .eq('user_id', userData.user?.id)
      .in('codigo', codigosParaRemover);

    if (!error) {
      setRepetidas(prev => prev.filter(item => !codigosParaRemover.includes(item.codigo)));
      setInputLote('');
      alert(`${codigosParaRemover.length} figurinhas removidas com sucesso!`);
    } else {
      alert('Erro ao remover as figurinhas em lote.');
    }
    setRemovendoLote(false);
  };

  const removerTodas = async () => {
    const confirmacao = window.confirm(
      "TEM CERTEZA? Essa ação apagará TODAS as suas figurinhas repetidas e não pode ser desfeita."
    );

    if (confirmacao) {
      setRemovendoLote(true);
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('repetidas')
        .delete()
        .eq('user_id', userData.user?.id);

      if (!error) {
        setRepetidas([]);
        alert('Todas as repetidas foram excluídas!');
      } else {
        alert('Erro ao limpar as repetidas.');
      }
      setRemovendoLote(false);
    }
  };

  // --- FUNÇÕES DE EXPORTAÇÃO ---
  const copiarRepetidas = () => {
    if (repetidasOrdenadas.length === 0) {
      alert('Você não tem figurinhas repetidas cadastradas.');
      return;
    }

    let texto = `📋 *Minhas Repetidas - Copa 2026*\n\n`;

    // 1. Agrupa as figurinhas multiplicando pelas quantidades
    const grupos: Record<string, string[]> = {};

    repetidasOrdenadas.forEach(rep => {
      const match = rep.codigo.match(/^([a-zA-Z]+)/);
      const prefixo = match ? match[1].toUpperCase() : 'OUTROS';

      if (!grupos[prefixo]) grupos[prefixo] = [];

      // Adiciona o código no array N vezes, baseado na quantidade
      for (let i = 0; i < rep.quantidade; i++) {
        grupos[prefixo].push(rep.codigo);
      }
    });

    // 2. Monta o texto seguindo a ordem oficial do álbum (SECOES_ALBUM)
    SECOES_ALBUM.forEach(secao => {
      if (grupos[secao.prefixo] && grupos[secao.prefixo].length > 0) {
        // Pega a bandeira da constante, ou usa uma bandeira branca se não achar
        const bandeira = COUNTRY_FLAGS[secao.prefixo] || '🏳️';

        texto += `${bandeira} *${secao.prefixo}*\n${grupos[secao.prefixo].join(', ')}\n\n`;
        // Remove do objeto para sabermos se sobrou alguma figurinha especial no final
        delete grupos[secao.prefixo];
      }
    });

    // 3. Adiciona figurinhas extras/promocionais que não estejam na constante SECOES_ALBUM
    Object.keys(grupos).forEach(prefixo => {
      if (grupos[prefixo].length > 0) {
        const bandeira = COUNTRY_FLAGS[prefixo] || '🏳️';
        texto += `${bandeira} *${prefixo}*\n${grupos[prefixo].join(', ')}\n\n`;
      }
    });

    const linkSite = window.location.origin;
    texto += `⚡ Organize seu álbum e crie grupos de trocas em:\n👉 ${linkSite}`;

    navigator.clipboard.writeText(texto);
    alert('Lista de REPETIDAS copiada para a área de transferência!');
  };

  const copiarFaltantes = () => {
    let texto = `🔍 *Minhas Faltantes - Copa 2026*\n\n`;
    let temFaltante = false;

    SECOES_ALBUM.forEach(secao => {
      const obtidasSecao = obtidas.filter(cod => cod.startsWith(secao.prefixo));

      const numerosObtidos = obtidasSecao.map(cod => {
        const num = parseInt(cod.replace(secao.prefixo, '').trim());
        return isNaN(num) ? -1 : num;
      });

      const faltantesSecao = [];

      for (let i = 1; i <= secao.total; i++) {
        if (!numerosObtidos.includes(i)) {
          // Empurra o código completo (ex: BRA1) e não apenas o número
          faltantesSecao.push(`${secao.prefixo}${i}`);
        }
      }

      if (faltantesSecao.length > 0) {
        const bandeira = COUNTRY_FLAGS[secao.prefixo] || '🏳️';
        texto += `${bandeira} *${secao.prefixo}*\n${faltantesSecao.join(', ')}\n\n`;
        temFaltante = true;
      }
    });

    if (!temFaltante) {
      alert('Parabéns! Seu álbum está completo, não há faltantes! 🎉');
      return;
    }

    const linkSite = window.location.origin;
    texto += `⚡ Organize seu álbum e crie grupos de trocas em:\n👉 ${linkSite}`;

    navigator.clipboard.writeText(texto);
    alert('Lista de FALTANTES copiada para a área de transferência!');
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Exportar & Gerenciar</h1>

      {/* Botões de Exportação */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={copiarRepetidas}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white p-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
        >
          <span className="text-xl">📋</span>
          Copiar Repetidas
        </button>

        <button
          onClick={copiarFaltantes}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
        >
          <span className="text-xl">🔍</span>
          Copiar Faltantes
        </button>
      </div>

      {/* Indicador de Quantidade de Repetidas */}
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center mb-8 shadow-sm">
        <span className="text-blue-800 font-bold">Total de repetidas:</span>
        <span className="text-2xl font-black text-blue-600 bg-white px-3 py-1 rounded-lg border border-blue-100">
          {totalCromos}
        </span>
      </div>

      <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Minhas Repetidas</h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : repetidasOrdenadas.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {repetidasOrdenadas.map((item) => (
              <button
                key={item.codigo}
                onClick={() => setCromoSelecionado(item)}
                className="bg-white border-2 border-blue-100 p-3 rounded-xl shadow-sm flex flex-col items-center hover:border-blue-400 transition-all active:scale-95"
              >
                <span className="font-black text-blue-800">{item.codigo}</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mt-1 font-bold">
                  {item.quantidade}x
                </span>
              </button>
            ))}
          </div>

          {/* Ferramentas de Exclusão (Lote e Total) */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-sm space-y-4">
            <div>
              <label htmlFor="inputLote" className="block text-sm font-bold text-gray-700 mb-1">
                Remover em lote
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Separe os códigos por espaço ou vírgula (Ex: FWC6, MEX2)
              </p>
              <textarea
                id="inputLote"
                rows={2}
                value={inputLote}
                onChange={(e) => setInputLote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-700"
                placeholder="FWC6, MEX2, MEX4..."
                disabled={removendoLote}
              />
              <button
                onClick={removerEmLote}
                disabled={removendoLote || !inputLote.trim()}
                className="mt-2 w-full bg-white border border-gray-300 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
              >
                {removendoLote ? 'Removendo...' : 'Excluir lote selecionado'}
              </button>
            </div>

            <hr className="border-gray-200" />

            <button
              onClick={removerTodas}
              disabled={removendoLote}
              className="w-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 font-bold py-3 rounded-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Excluir TODAS as Repetidas
            </button>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
          Nenhuma figurinha repetida cadastrada ainda.
        </p>
      )}

      {/* MODAL DE GERENCIAMENTO (Mantido igual) */}
      {cromoSelecionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <h3 className="text-3xl font-black text-gray-800 mb-1">{cromoSelecionado.codigo}</h3>
              <p className="text-sm text-gray-500">Gerenciar quantidade</p>
            </div>

            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
              <button
                onClick={() => alterarQuantidade(-1)}
                disabled={atualizando}
                className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center text-2xl font-bold text-gray-700 active:scale-90 shadow-sm disabled:opacity-50"
              >
                -
              </button>

              <span className="text-4xl font-black text-blue-600">
                {cromoSelecionado.quantidade}
              </span>

              <button
                onClick={() => alterarQuantidade(1)}
                disabled={atualizando}
                className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center text-2xl font-bold text-gray-700 active:scale-90 shadow-sm disabled:opacity-50"
              >
                +
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={removerRegistro}
                disabled={atualizando}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-100 active:scale-95 transition-all disabled:opacity-50"
              >
                Remover Figurinha
              </button>
              <button
                onClick={() => setCromoSelecionado(null)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl active:scale-95 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}