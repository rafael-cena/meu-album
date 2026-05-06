'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function InsercaoRepetidas() {
  const [inputTexto, setInputTexto] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [loading, setLoading] = useState(false);

  const processarRepetidas = async () => {
    if (!inputTexto.trim()) return;
    setLoading(true);
    setMensagemSucesso('');
    setMensagemErro('');

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const codigosBrutos = inputTexto.toUpperCase().split(',').map(c => c.trim()).filter(c => c);

    if (codigosBrutos.length === 0) {
      setLoading(false);
      return;
    }

    // Busca quais dessas figurinhas o usuário JÁ TEM na tabela de obtidas
    const { data: obtidasData } = await supabase
      .from('obtidas')
      .select('codigo')
      .in('codigo', codigosBrutos)
      .eq('user_id', userId);

    const obtidasSet = new Set(obtidasData?.map(o => o.codigo) || []);

    const codigosValidos: string[] = [];
    const codigosInvalidos: string[] = [];

    // Separa os válidos (já tem) dos inválidos (não tem no álbum ainda)
    codigosBrutos.forEach(codigo => {
      if (obtidasSet.has(codigo)) {
        codigosValidos.push(codigo);
      } else {
        codigosInvalidos.push(codigo);
      }
    });

    if (codigosValidos.length > 0) {
      // Agrupa as válidas para somar caso digite "BRA1, BRA1"
      const incrementos: Record<string, number> = {};
      codigosValidos.forEach(c => incrementos[c] = (incrementos[c] || 0) + 1);

      // Puxa o saldo atual das repetidas
      const { data: repetidasAtuais } = await supabase
        .from('repetidas')
        .select('codigo, quantidade')
        .in('codigo', Object.keys(incrementos))
        .eq('user_id', userId);

      const mapaRepetidasAtuais = new Map(repetidasAtuais?.map(r => [r.codigo, r.quantidade]) || []);

      const upsertsRepetidas = Object.keys(incrementos).map(codigo => ({
        user_id: userId,
        codigo,
        quantidade: (mapaRepetidasAtuais.get(codigo) || 0) + incrementos[codigo]
      }));

      await supabase.from('repetidas').upsert(upsertsRepetidas, { onConflict: 'user_id,codigo' });
      setMensagemSucesso(`${codigosValidos.length} repetida(s) registrada(s) com sucesso!`);
    }

    if (codigosInvalidos.length > 0) {
      setMensagemErro(`Atenção: Você ainda não possui as figurinhas a seguir no seu álbum: ${codigosInvalidos.join(', ')}.`);
      // Mantém apenas as inválidas no input para o usuário ver
      setInputTexto(codigosInvalidos.join(', '));
    } else {
      // Se deu tudo certo, limpa o input
      setInputTexto('');
    }

    setLoading(false);
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Adicionar Repetidas</h1>
      <p className="text-sm text-gray-600 mb-4">Insira apenas figurinhas que você já possui coladas no álbum.</p>

      <textarea
        className="w-full h-40 p-3 border border-gray-300 rounded focus:ring-yellow-500 focus:border-yellow-500"
        placeholder="Ex: BRA1, ARG6, MEX2"
        value={inputTexto}
        onChange={(e) => setInputTexto(e.target.value)}
      ></textarea>

      {mensagemSucesso && <p className="mt-2 text-green-600 font-medium">{mensagemSucesso}</p>}
      {mensagemErro && <p className="mt-2 text-red-600 font-medium text-sm bg-red-50 p-2 rounded border border-red-200">{mensagemErro}</p>}

      <button
        onClick={processarRepetidas}
        disabled={loading}
        className="mt-4 w-full bg-yellow-500 text-white font-bold py-3 rounded shadow hover:bg-yellow-600 disabled:bg-gray-400"
      >
        {loading ? 'Processando...' : 'Registrar Repetidas'}
      </button>
    </div>
  );
}