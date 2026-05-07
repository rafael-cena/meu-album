'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SECOES_ALBUM } from '@/utils/constants';

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
      .eq('user_id', userData.user.id)
      .order('codigo', { ascending: true });

    if (repData) setRepetidas(repData);

    // Busca as Obtidas (para poder calcular as faltantes)
    const { data: obtData } = await supabase
      .from('obtidas')
      .select('codigo')
      .eq('user_id', userData.user.id);

    if (obtData) setObtidas(obtData.map(item => item.codigo));

    setLoading(false);
  };

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

  // --- FUNÇÕES DE EXPORTAÇÃO ---
  const copiarRepetidas = () => {
    if (repetidas.length === 0) {
      alert('Você não tem figurinhas repetidas cadastradas.');
      return;
    }

    // Pega o link atual do site (ex: https://album2026.com.br)
    const linkSite = window.location.origin;

    const texto = `📋 *Minhas Repetidas - Copa 2026*\n\n` +
      repetidas.map(r => `${r.codigo} (${r.quantidade}x)`).join(', ') +
      `\n\n⚡ Organize seu álbum e crie grupos de trocas em:\n👉 ${linkSite}`;

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
          faltantesSecao.push(i);
        }
      }

      if (faltantesSecao.length > 0) {
        texto += `*${secao.nome}:* ${faltantesSecao.join(', ')}\n`;
        temFaltante = true;
      }
    });

    if (!temFaltante) {
      alert('Parabéns! Seu álbum está completo, não há faltantes! 🎉');
      return;
    }

    // Pega o link atual do site
    const linkSite = window.location.origin;

    // Adiciona o convite no final da lista de faltantes
    texto += `\n⚡ Organize seu álbum e crie grupos de trocas em:\n👉 ${linkSite}`;

    navigator.clipboard.writeText(texto);
    alert('Lista de FALTANTES copiada para a área de transferência!');
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Exportar & Gerenciar</h1>

      {/* Botões de Exportação */}
      <div className="flex gap-3 mb-8">
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

      <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Meu Estoque de Repetidas</h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : repetidas.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {repetidas.map((item) => (
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