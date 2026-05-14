'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type TipoCusto = 'album' | 'pac7' | 'pac5' | 'figav';

interface Custo {
  id: number;
  tipo: TipoCusto;
  descricao: string;
  preco: number;
  qtd: number;
  data_compra: string;
}

interface Venda {
  id: number;
  qtd: number;
  valor_unitario: number;
  descricao: string;
  data_venda: string;
}

const CORES = { album: '#3b82f6', pac7: '#10b981', pac5: '#f59e0b', figav: '#8b5cf6' };
const LABELS = { album: 'Álbum', pac7: 'Pacotinho (7)', pac5: 'Pacotinho (5) McD', figav: 'Avulsa' };

export default function Carteira() {
  const [custos, setCustos] = useState<Custo[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'compra' | 'venda'>('compra');

  // Estados Form Compra
  const [tipo, setTipo] = useState<TipoCusto>('pac7');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [qtdCompra, setQtdCompra] = useState('1');

  // Estados Form Venda
  const [codigosVenda, setCodigosVenda] = useState('');
  const [qtdVenda, setQtdVenda] = useState('');
  const [valorUnitarioVenda, setValorUnitarioVenda] = useState('');
  const [descricaoVenda, setDescricaoVenda] = useState('');
  const [codigosValidosParaBaixa, setCodigosValidosParaBaixa] = useState<string[]>([]);
  const [avisoVenda, setAvisoVenda] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Busca Custos
    const { data: dataCustos } = await supabase
      .from('custos')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('data_compra', { ascending: false });
    if (dataCustos) setCustos(dataCustos as Custo[]);

    // Busca Vendas
    const { data: dataVendas } = await supabase
      .from('vendas')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('data_venda', { ascending: false });
    if (dataVendas) setVendas(dataVendas as Venda[]);

    setLoading(false);
  };

  // --- LÓGICA DE COMPRA ---
  const adicionarCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('custos').insert({
      user_id: userData.user?.id,
      tipo,
      descricao,
      preco: parseFloat(preco.replace(',', '.')),
      qtd: parseInt(qtdCompra),
    });
    setDescricao(''); setPreco(''); setQtdCompra('1');
    await carregarDados();
  };

  const excluirCusto = async (id: number) => {
    if (!window.confirm('Excluir esta compra?')) return;
    await supabase.from('custos').delete().eq('id', id);
    setCustos(prev => prev.filter(c => c.id !== id));
  };

  // --- LÓGICA DE VENDA ---
  const validarCodigosOnBlur = async () => {
    if (!codigosVenda.trim()) {
      setQtdVenda('');
      setAvisoVenda('');
      setCodigosValidosParaBaixa([]);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const codigosDigitados = codigosVenda.toUpperCase().split(/[\s,]+/).filter(c => c !== '');
    setQtdVenda(codigosDigitados.length.toString());

    // Verifica quais dessas figurinhas realmente estão nas repetidas
    const { data: repetidasDb } = await supabase
      .from('repetidas')
      .select('codigo')
      .eq('user_id', userData.user.id)
      .in('codigo', codigosDigitados);

    const codigosEncontrados = repetidasDb?.map(r => r.codigo) || [];
    const codigosFaltando = codigosDigitados.filter(c => !codigosEncontrados.includes(c));

    setCodigosValidosParaBaixa(codigosEncontrados);

    if (codigosFaltando.length > 0) {
      setAvisoVenda(`Atenção: ${codigosFaltando.join(', ')} não constam no estoque. A venda será salva, mas não haverá baixa automática destas.`);
    } else {
      setAvisoVenda('');
    }
  };

  const registrarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const qtd = parseInt(qtdVenda);
    const vUnitario = parseFloat(valorUnitarioVenda.replace(',', '.'));

    // 1. Insere a grana na tabela de vendas
    await supabase.from('vendas').insert({
      user_id: userData.user.id,
      qtd: qtd,
      valor_unitario: vUnitario,
      descricao: descricaoVenda // <- Campo adicionado aqui
    });

    // 2. Dá baixa nas repetidas (apenas nas que foram validadas no onBlur)
    for (const cod of codigosValidosParaBaixa) {
      const { data: rep } = await supabase
        .from('repetidas')
        .select('quantidade')
        .eq('user_id', userData.user.id)
        .eq('codigo', cod)
        .single();

      if (rep) {
        if (rep.quantidade > 1) {
          await supabase.from('repetidas').update({ quantidade: rep.quantidade - 1 }).eq('codigo', cod).eq('user_id', userData.user.id);
        } else {
          await supabase.from('repetidas').delete().eq('codigo', cod).eq('user_id', userData.user.id);
        }
      }
    }

    setCodigosVenda(''); setQtdVenda(''); setValorUnitarioVenda(''); setDescricaoVenda('');
    setAvisoVenda(''); setCodigosValidosParaBaixa([]);
    alert('Venda registrada e estoque atualizado com sucesso!');
    await carregarDados();
  };

  const excluirVenda = async (id: number) => {
    if (!window.confirm('Excluir esta venda? As figurinhas NÃO voltarão para o estoque automaticamente.')) return;
    await supabase.from('vendas').delete().eq('id', id);
    setVendas(prev => prev.filter(v => v.id !== id));
  };

  // --- CÁLCULOS FINANCEIROS E ESTATÍSTICAS ---
  const calcularTotalPorTipo = (t: TipoCusto) =>
    custos.filter(c => c.tipo === t).reduce((acc, curr) => acc + (curr.preco * curr.qtd), 0);

  const calcularQtdPacotes = (t: 'pac5' | 'pac7') =>
    custos.filter(c => c.tipo === t).reduce((acc, curr) => acc + curr.qtd, 0);

  const totalGastoGeral = custos.reduce((acc, curr) => acc + (curr.preco * curr.qtd), 0);
  const totalRecuperado = vendas.reduce((acc, curr) => acc + (curr.valor_unitario * curr.qtd), 0);
  const custoReal = totalGastoGeral - totalRecuperado;

  const totalFigurinhas = custos.reduce((acc, c) => {
    if (c.tipo === 'pac5') return acc + (c.qtd * 5);
    if (c.tipo === 'pac7') return acc + (c.qtd * 7);
    if (c.tipo === 'figav') return acc + c.qtd;
    return acc;
  }, 0);

  const gastosComFigurinhas = custos
    .filter(c => c.tipo !== 'album')
    .reduce((acc, curr) => acc + (curr.preco * curr.qtd), 0);

  const precoMedioPorFigurinha = totalFigurinhas > 0 ? gastosComFigurinhas / totalFigurinhas : 0;

  const dadosGrafico = (Object.keys(LABELS) as TipoCusto[]).map(t => ({
    name: LABELS[t],
    value: calcularTotalPorTipo(t),
    tipo: t
  })).filter(d => d.value > 0);

  return (
    <div className="p-4 max-w-lg mx-auto mt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Carteira & Caixa</h1>

      {/* 1. RESUMO FINANCEIRO (Custo Real) */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-xl text-white shadow-md border border-gray-700">
          <p className="text-[10px] uppercase font-bold opacity-70">Gasto Total</p>
          <p className="text-lg font-bold text-red-400">- R$ {totalGastoGeral.toFixed(2)}</p>
          <div className="mt-2 border-t border-gray-600 pt-2">
            <p className="text-[10px] uppercase font-bold opacity-70">Recuperado (Vendas)</p>
            <p className="text-sm font-bold text-emerald-400">+ R$ {totalRecuperado.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-blue-600 p-4 rounded-xl text-white shadow-md flex flex-col justify-center">
          <p className="text-[10px] uppercase font-bold opacity-80">Custo Real do Álbum</p>
          <p className="text-2xl font-black">R$ {custoReal.toFixed(2)}</p>
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

      {/* 3. ESTATÍSTICAS DE VOLUME */}
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
            <p className="text-[10px] text-gray-400 font-bold uppercase">Preço Médio / Fig.</p>
            <p className="text-lg font-bold text-gray-700">R$ {precoMedioPorFigurinha.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* 4. ABAS (COMPRA / VENDA) */}
      <div className="flex bg-gray-200 rounded-lg p-1 mb-6">
        <button
          onClick={() => setAbaAtiva('compra')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${abaAtiva === 'compra' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          🛒 Comprar Pacotes
        </button>
        <button
          onClick={() => setAbaAtiva('venda')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${abaAtiva === 'venda' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          💰 Vender Figurinhas
        </button>
      </div>

      {/* FORMULÁRIO DE COMPRA */}
      {abaAtiva === 'compra' && (
        <form onSubmit={adicionarCusto} className="bg-gray-800 p-5 rounded-xl shadow-lg mb-6 text-white animate-in fade-in duration-300">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400">
            <span>➕</span> Registrar Compra
          </h3>
          <div className="space-y-3">
            <select
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-blue-400"
              value={tipo} onChange={e => setTipo(e.target.value as TipoCusto)}
            >
              {Object.entries(LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              type="text" placeholder="Onde comprou? (Opcional)"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-blue-400"
              value={descricao} onChange={e => setDescricao(e.target.value)}
            />
            <div className="flex gap-3">
              <input
                type="number" step="0.01" required placeholder="Preço"
                className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-blue-400"
                value={preco} onChange={e => setPreco(e.target.value)}
              />
              <input
                type="number" min="1" required placeholder="Qtd"
                className="w-1/2 p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-blue-400"
                value={qtdCompra} onChange={e => setQtdCompra(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 font-bold py-3 rounded-lg mt-2">
              {loading ? 'Salvando...' : 'ADICIONAR GASTO'}
            </button>
          </div>
        </form>
      )}

      {/* FORMULÁRIO DE VENDA */}
      {abaAtiva === 'venda' && (
        <form onSubmit={registrarVenda} className="bg-gray-800 p-5 rounded-xl shadow-lg mb-6 text-white animate-in fade-in duration-300">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-emerald-400">
            <span>💰</span> Registrar Venda
          </h3>
          <div className="space-y-3">

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Descrição (Opcional)</label>
              <input
                type="text" placeholder="Ex: Shopping..."
                className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-emerald-400 text-sm"
                value={descricaoVenda}
                onChange={e => setDescricaoVenda(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Códigos das Figurinhas (Opcional)</label>

              <p className="text-xs text-emerald-500/80 mb-2 leading-tight">
                💡 Dica: Informe os códigos separados por vírgula para atualizar automaticamente no seu estoque de repetidas.
              </p>

              <textarea
                rows={2}
                placeholder="Ex: BRA1, ARG4 (Separe por vírgula)"
                className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-emerald-400 text-sm"
                value={codigosVenda}
                onChange={e => setCodigosVenda(e.target.value)}
                onBlur={validarCodigosOnBlur}
              />
              {avisoVenda && <p className="text-xs text-orange-400 mt-1 font-medium leading-tight">{avisoVenda}</p>}
            </div>

            <div className="flex gap-3">
              <div className="w-1/2">
                <label className="text-xs font-bold text-gray-400 uppercase">Qtd</label>
                <input
                  type="number" min="1" required placeholder="Ex: 3"
                  className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-emerald-400"
                  value={qtdVenda} onChange={e => setQtdVenda(e.target.value)}
                />
              </div>
              <div className="w-1/2">
                <label className="text-xs font-bold text-gray-400 uppercase">Valor Unitário</label>
                <input
                  type="number" step="0.50" required placeholder="R$ 1,00"
                  min={0}
                  className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-lg outline-none focus:border-emerald-400"
                  value={valorUnitarioVenda} onChange={e => setValorUnitarioVenda(e.target.value)}
                />
              </div>
            </div>

            {qtdVenda && valorUnitarioVenda && (
              <div className="bg-emerald-900/30 p-3 rounded-lg border border-emerald-800/50 flex justify-between items-center mt-2">
                <span className="text-sm font-bold text-emerald-400">Total a receber:</span>
                <span className="font-black text-emerald-400">R$ {(parseInt(qtdVenda) * parseFloat(valorUnitarioVenda.replace(',', '.'))).toFixed(2)}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold py-3 rounded-lg mt-2">
              {loading ? 'Processando...' : 'CONFIRMAR VENDA'}
            </button>
          </div>
        </form>
      )}

      {/* 5. HISTÓRICO MISTO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <p className="text-[10px] font-black text-gray-400 p-4 border-b uppercase tracking-widest bg-gray-50">Movimentações Recentes</p>

        {abaAtiva === 'compra' && custos.map((custo) => (
          <div key={custo.id} className="p-4 border-b border-gray-100 flex justify-between items-center bg-white hover:bg-gray-50">
            <div>
              <h3 className="font-bold text-gray-800">{custo.descricao || LABELS[custo.tipo]}</h3>
              <p className="text-sm text-gray-500">{custo.qtd}x R$ {custo.preco.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-red-500">- R$ {(custo.qtd * custo.preco).toFixed(2).replace('.', ',')}</span>
              <button onClick={() => excluirCusto(custo.id)} className="text-gray-300 hover:text-red-500">🗑️</button>
            </div>
          </div>
        ))}

        {abaAtiva === 'venda' && vendas.map((venda) => (
          <div key={venda.id} className="p-4 border-b border-gray-100 flex justify-between items-center bg-white hover:bg-gray-50">
            <div>
              <h3 className="font-bold text-emerald-700">{venda.descricao || 'Venda de Figurinhas'}</h3>
              <p className="text-sm text-gray-500">{venda.qtd}x R$ {venda.valor_unitario.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-emerald-600">+ R$ {(venda.qtd * venda.valor_unitario).toFixed(2).replace('.', ',')}</span>
              <button onClick={() => excluirVenda(venda.id)} className="text-gray-300 hover:text-red-500">🗑️</button>
            </div>
          </div>
        ))}

        {abaAtiva === 'venda' && vendas.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Nenhuma venda registrada ainda.</p>
        )}
      </div>

    </div>
  );
}