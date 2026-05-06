'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function InsercaoTexto() {
  const [inputTexto, setInputTexto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);

  const processarFigurinhas = async () => {
    if (!inputTexto.trim()) return;
    setLoading(true);
    setMensagem('');

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // Limpa, transforma em uppercase e separa os códigos
    const codigosBrutos = inputTexto.toUpperCase().split(',').map(c => c.trim()).filter(c => c);
    
    if (codigosBrutos.length === 0) {
      setLoading(false);
      return;
    }

    // Busca todas as figurinhas que o usuário já tem
    const { data: obtidasData } = await supabase
      .from('obtidas')
      .select('codigo')
      .eq('user_id', userId);

    const obtidasSet = new Set(obtidasData?.map(o => o.codigo) || []);

    const novasObtidas = new Set<string>();
    const incrementosRepetidas: Record<string, number> = {};

    // Separa a lógica
    for (const codigo of codigosBrutos) {
      if (!obtidasSet.has(codigo) && !novasObtidas.has(codigo)) {
        novasObtidas.add(codigo);
      } else {
        incrementosRepetidas[codigo] = (incrementosRepetidas[codigo] || 0) + 1;
      }
    }

    // 1. Insere as novas na tabela 'obtidas'
    if (novasObtidas.size > 0) {
      const insertsObtidas = Array.from(novasObtidas).map(codigo => ({
        user_id: userId,
        codigo
      }));
      await supabase.from('obtidas').insert(insertsObtidas);
    }

    // 2. Atualiza as repetidas
    if (Object.keys(incrementosRepetidas).length > 0) {
      // Puxa as repetidas atuais para somar corretamente
      const { data: repetidasAtuais } = await supabase
        .from('repetidas')
        .select('codigo, quantidade')
        .in('codigo', Object.keys(incrementosRepetidas))
        .eq('user_id', userId);

      const mapaRepetidasAtuais = new Map(repetidasAtuais?.map(r => [r.codigo, r.quantidade]) || []);

      const upsertsRepetidas = Object.keys(incrementosRepetidas).map(codigo => ({
        user_id: userId,
        codigo,
        quantidade: (mapaRepetidasAtuais.get(codigo) || 0) + incrementosRepetidas[codigo]
      }));

      await supabase.from('repetidas').upsert(upsertsRepetidas, { onConflict: 'user_id,codigo' });
    }

    setMensagem(`Sucesso! ${novasObtidas.size} novas e ${Object.keys(incrementosRepetidas).length} repetidas registradas.`);
    setInputTexto('');
    setLoading(false);
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Registro em Lote</h1>
      <p className="text-sm text-gray-600 mb-4">Insira os códigos separados por vírgula. O sistema separa automaticamente entre novas e repetidas.</p>

      <textarea
        className="w-full h-40 p-3 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
        placeholder="Ex: BRA1, BRA2, ARG1, MEX4"
        value={inputTexto}
        onChange={(e) => setInputTexto(e.target.value)}
      ></textarea>

      {mensagem && <p className="mt-2 text-green-600 font-medium">{mensagem}</p>}

      <button
        onClick={processarFigurinhas}
        disabled={loading}
        className="mt-4 w-full bg-blue-600 text-white font-bold py-3 rounded shadow hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Processando...' : 'Salvar Figurinhas'}
      </button>
    </div>
  );
}