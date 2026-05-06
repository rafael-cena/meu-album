'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SECOES_ALBUM } from '@/utils/constants';

export default function Relatorios() {
  const [loadingFaltantes, setLoadingFaltantes] = useState(false);
  const [loadingRepetidas, setLoadingRepetidas] = useState(false);

  // Estados para o feedback visual de "Copiado"
  const [copiadoFaltantes, setCopiadoFaltantes] = useState(false);
  const [copiadoRepetidas, setCopiadoRepetidas] = useState(false);

  // Função para copiar para a área de transferência
  const copiarParaClipboard = async (texto: string, tipo: 'faltantes' | 'repetidas') => {
    try {
      await navigator.clipboard.writeText(texto);

      if (tipo === 'faltantes') {
        setCopiadoFaltantes(true);
        setTimeout(() => setCopiadoFaltantes(false), 2000);
      } else {
        setCopiadoRepetidas(true);
        setTimeout(() => setCopiadoRepetidas(false), 2000);
      }
    } catch (err) {
      alert("Erro ao copiar. Verifique as permissões do navegador.");
    }
  };

  const copiarRelatorioFaltantes = async () => {
    setLoadingFaltantes(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: obtidasData } = await supabase
      .from('obtidas')
      .select('codigo')
      .eq('user_id', userData.user?.id);

    const obtidasSet = new Set(obtidasData?.map(o => o.codigo) || []);
    let relatorioText = '📉 MINHAS FALTANTES - COPA 2026\n\n';
    let totalFaltantes = 0;

    SECOES_ALBUM.forEach(secao => {
      const faltantesSecao = [];
      for (let i = 1; i <= secao.total; i++) {
        const codigo = `${secao.prefixo}${i}`;
        if (!obtidasSet.has(codigo)) {
          faltantesSecao.push(codigo);
        }
      }

      if (faltantesSecao.length > 0) {
        relatorioText += `*${secao.nome}* (${faltantesSecao.length}):\n`;
        relatorioText += faltantesSecao.join(', ') + '\n\n';
        totalFaltantes += faltantesSecao.length;
      }
    });

    relatorioText += `Total Faltantes: ${totalFaltantes}`;

    await copiarParaClipboard(relatorioText, 'faltantes');
    setLoadingFaltantes(false);
  };

  const copiarRelatorioRepetidas = async () => {
    setLoadingRepetidas(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: repetidasData } = await supabase
      .from('repetidas')
      .select('codigo, quantidade')
      .eq('user_id', userData.user?.id)
      .order('codigo', { ascending: true });

    let relatorioText = '🔄 MINHAS REPETIDAS - COPA 2026\n\n';
    let totalRepetidas = 0;

    if (!repetidasData || repetidasData.length === 0) {
      relatorioText += 'Nenhuma figurinha repetida registrada.';
    } else {
      const repetidasMap: Record<string, string[]> = {};

      repetidasData.forEach(item => {
        const prefixo = item.codigo.replace(/[0-9]/g, '');
        if (!repetidasMap[prefixo]) repetidasMap[prefixo] = [];
        const textoQtd = item.quantidade > 1 ? `${item.codigo}(x${item.quantidade})` : item.codigo;
        repetidasMap[prefixo].push(textoQtd);
        totalRepetidas += item.quantidade;
      });

      Object.keys(repetidasMap).forEach(prefixo => {
        const secao = SECOES_ALBUM.find(s => s.prefixo === prefixo);
        const nomeSecao = secao ? secao.nome : prefixo;

        relatorioText += `*${nomeSecao}*:\n`;
        relatorioText += repetidasMap[prefixo].join(', ') + '\n\n';
      });
    }

    relatorioText += `Total de Repetidas: ${totalRepetidas}`;

    await copiarParaClipboard(relatorioText, 'repetidas');
    setLoadingRepetidas(false);
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-4 pb-20">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Compartilhar Listas</h1>
      <p className="text-gray-600 mb-8 text-sm">Copie suas listas com formatação para enviar rapidamente no WhatsApp ou em grupos de troca.</p>

      <div className="flex flex-col gap-4">
        {/* Botão Faltantes */}
        <button
          onClick={copiarRelatorioFaltantes}
          disabled={loadingFaltantes || copiadoFaltantes}
          className={`flex items-center justify-start p-4 border shadow-sm rounded-lg transition active:scale-95 
            ${copiadoFaltantes ? 'bg-green-50 border-green-300' : 'bg-white border-blue-200 hover:bg-blue-50'}`}
        >
          <span className="text-4xl mr-4">{copiadoFaltantes ? '✅' : '📉'}</span>
          <div className="text-left">
            <h3 className={`font-bold text-lg ${copiadoFaltantes ? 'text-green-700' : 'text-blue-800'}`}>
              {copiadoFaltantes ? 'Copiado para a área de transferência!' : 'Copiar Lista de Faltantes'}
            </h3>
            {!copiadoFaltantes && <p className="text-sm text-gray-500 mt-1">Gera e copia a lista do que você precisa.</p>}
          </div>
        </button>

        {/* Botão Repetidas */}
        <button
          onClick={copiarRelatorioRepetidas}
          disabled={loadingRepetidas || copiadoRepetidas}
          className={`flex items-center justify-start p-4 border shadow-sm rounded-lg transition active:scale-95 
            ${copiadoRepetidas ? 'bg-green-50 border-green-300' : 'bg-white border-yellow-200 hover:bg-yellow-50'}`}
        >
          <span className="text-4xl mr-4">{copiadoRepetidas ? '✅' : '🔄'}</span>
          <div className="text-left">
            <h3 className={`font-bold text-lg ${copiadoRepetidas ? 'text-green-700' : 'text-yellow-800'}`}>
              {copiadoRepetidas ? 'Copiado para a área de transferência!' : 'Copiar Lista de Repetidas'}
            </h3>
            {!copiadoRepetidas && <p className="text-sm text-gray-500 mt-1">Gera e copia seu bolo de extras.</p>}
          </div>
        </button>
      </div>
    </div>
  );
}