'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type TipoCusto = 'album' | 'pac7' | 'pac5' | 'figav';

interface Custo {
  id: number;
  tipo: TipoCusto;
  descricao: string;
  preco: number;
  qtd: number;
  data_compra: string;
}

const CORES = {
  album: '#3b82f6',
  pac7: '#10b981',
  pac5: '#f59e0b',
  figav: '#8b5cf6',
};

const LABELS = {
  album: 'Álbum',
  pac7: 'Pacotinho (7)',
  pac5: 'Pacotinho (5) McDonald\'s',
  figav: 'Figurinha Avulsa',
};

export default function Carteira() {
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário
  const [tipo, setTipo] = useState<TipoCusto>('pac7');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [qtd, setQtd] = useState('1');

  useEffect(() => {
    carregarCustos();
  }, []);

  const carregarCustos = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from('custos')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('data_compra', { ascending: false });
    if (data) setCustos(data as Custo[]);
    setLoading(false);
  };

  const adicionarCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const novoCusto = {
      user_id: userData.user?.id,
      tipo,
      descricao,
      preco: parseFloat(preco.replace(',', '.')),
      qtd: parseInt(qtd),
    };
    await supabase.from('custos').insert(novoCusto);
    setDescricao(''); setPreco(''); setQtd('1');
    await carregarCustos();
  };

  // --- CÁLCULOS FINANCEIROS ---

  const calcularTotalPorTipo = (t: TipoCusto) =>
    custos.filter(c => c.tipo === t).reduce((acc, curr) => acc + (curr.preco * curr.qtd), 0);

  const calcularQtdPacotes = (t: 'pac5' | 'pac7') =>
    custos.filter(c => c.tipo === t).reduce((acc, curr) => acc + curr.qtd, 0);

  const totalGastoGeral = custos.reduce((acc, curr) => acc + (curr.preco * curr.qtd), 0);

  const totalFigurinhas = custos.reduce((acc, c) => {
    if (c.tipo === 'pac5') return acc + (c.qtd * 5);
    if (c.tipo === 'pac7') return acc + (c.qtd * 7);
    if (c.tipo === 'figav') return acc + c.qtd;
    return acc;
  }, 0);

  // Valor médio: apenas pacotes e avulsas (ignora o preço do álbum físico)
  const gastosComFigurinhas = custos
    .filter(c => c.tipo !== 'album')
    .reduce((acc, curr) => acc + (curr.preco * curr.qtd), 0);

  const precoMedioPorFigurinha = totalFigurinhas > 0 ? gastosComFigurinhas / totalFigurinhas : 0;

  const dadosGrafico = Object.keys(LABELS).map(key => {
    const t = key as TipoCusto;
    return { name: LABELS[t], value: calcularTotalPorTipo(t), tipo: t };
  }).filter(d => d.value > 0);

  const excluirCusto = async (id: number) => {
    // Pede uma confirmação rápida para evitar cliques acidentais
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;

    const { error } = await supabase
      .from('custos')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Erro ao excluir o registro.');
      console.error(error);
    } else {
      // Atualiza a lista na tela removendo o item deletado
      setCustos(prevCustos => prevCustos.filter(custo => custo.id !== id));
      // Dica: Se você tiver uma função que recalcula o total (ex: calcularTotal()), chame ela aqui!
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Carteira</h1>

      {/* 1. RESUMO GERAL */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-600 p-4 rounded-xl text-white shadow-md">
          <p className="text-[10px] uppercase font-bold opacity-80">Total Gasto</p>
          <p className="text-xl font-black">R$ {totalGastoGeral.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-400">Preço Médio / Fig.</p>
          <p className="text-xl font-black text-gray-700">R$ {precoMedioPorFigurinha.toFixed(2)}</p>
        </div>
      </div>

      {/* 2. GRÁFICO E DETALHAMENTO POR TIPO */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
        <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Distribuição de Gastos</h3>
        <div className="h-48 w-full mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dadosGrafico} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                {dadosGrafico.map((entry, index) => <Cell key={`cell-${index}`} fill={CORES[entry.tipo]} />)}
              </Pie>
              <Tooltip formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Gasto']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {(Object.keys(LABELS) as TipoCusto[]).map(t => (
            <div key={t} className="flex justify-between text-sm items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CORES[t] }}></div>
                <span className="text-gray-600">{LABELS[t]}</span>
              </div>
              <span className="font-bold text-gray-800">R$ {calcularTotalPorTipo(t).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. ESTATÍSTICAS DE COMPRA */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
        <h3 className="font-bold text-gray-700 mb-3 uppercase text-xs tracking-widest">Estatísticas de Volume</h3>
        <div className="grid grid-cols-2 gap-y-4">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Pacotes (5)</p>
            <p className="text-lg font-bold text-gray-700">{calcularQtdPacotes('pac5')} <span className="text-xs font-normal">un</span></p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Pacotes (7)</p>
            <p className="text-lg font-bold text-gray-700">{calcularQtdPacotes('pac7')} <span className="text-xs font-normal">un</span></p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Total Figurinhas</p>
            <p className="text-lg font-bold text-blue-600">{totalFigurinhas} <span className="text-xs font-normal text-gray-400">un</span></p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Custo s/ Álbum</p>
            <p className="text-lg font-bold text-gray-700">R$ {gastosComFigurinhas.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* 4. FORMULÁRIO DE ADIÇÃO */}
      <form onSubmit={adicionarCusto} className="bg-gray-800 p-5 rounded-xl shadow-lg mb-6 text-white">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <span>➕</span> Registrar Nova Compra
        </h3>
        <div className="space-y-3">
          <select
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white outline-none focus:border-blue-400"
            value={tipo} onChange={e => setTipo(e.target.value as TipoCusto)}
          >
            {Object.entries(LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            type="text" placeholder="Onde comprou? (Opcional)"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white outline-none focus:border-blue-400"
            value={descricao} onChange={e => setDescricao(e.target.value)}
          />
          <div className="flex gap-3">
            <input
              type="number" step="0.01" required placeholder="Preço"
              className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-lg text-white outline-none focus:border-blue-400"
              value={preco} onChange={e => setPreco(e.target.value)}
            />
            <input
              type="number" min="1" required placeholder="Qtd"
              className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-lg text-white outline-none focus:border-blue-400"
              value={qtd} onChange={e => setQtd(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-3 rounded-lg transition-colors mt-2 shadow-lg">
            {loading ? 'Salvando...' : 'ADICIONAR À CARTEIRA'}
          </button>
        </div>
      </form>

      {/* 5. HISTÓRICO SIMPLIFICADO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <p className="text-[10px] font-black text-gray-400 p-4 border-b uppercase tracking-widest bg-gray-50">Últimas Movimentações</p>
        <ul className="space-y-3">
          {custos.map((custo) => (
            <li key={custo.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800">{custo.descricao || 'Pacotinhos'}</h3>
                <p className="text-sm text-gray-500">
                  {custo.qtd}x R$ {custo.preco.toFixed(2).replace('.', ',')}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-black text-gray-600">
                  R$ {(custo.qtd * custo.preco).toFixed(2).replace('.', ',')}
                </span>

                {/* BOTÃO DE EXCLUIR AQUI */}
                <button
                  onClick={() => excluirCusto(custo.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-2"
                  title="Excluir registro"
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}