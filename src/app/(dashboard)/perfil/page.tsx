'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SECOES_ALBUM } from '@/utils/constants';

export default function Perfil() {
    const router = useRouter();

    const [nome, setNome] = useState('');

    const [totalObtidas, setTotalObtidas] = useState(0);
    const [porcentagem, setPorcentagem] = useState(0);
    const [valorGasto, setValorGasto] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const totalGeralAlbum = SECOES_ALBUM.reduce((acc, curr) => acc + curr.total, 0);

    useEffect(() => {
        carregarPerfil();
    }, []);

    const carregarPerfil = async () => {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const userId = userData.user.id;

        // 1. Busca Nome
        const { data: perfil } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        if (perfil) {
            setNome(perfil.full_name);
        }

        // 2. Busca Obtidas para Porcentagem
        const { data: obtidasData } = await supabase
            .from('obtidas')
            .select('codigo')
            .eq('user_id', userId);

        if (obtidasData) {
            setTotalObtidas(obtidasData.length);
            setPorcentagem(Math.round((obtidasData.length / totalGeralAlbum) * 100));
        }

        // 3. Busca do Valor Gasto na tabela de custos
        const { data: custosData } = await supabase
            .from('custos')
            .select('preco, qtd')
            .eq('user_id', userId);

        if (custosData) {
            const total = custosData.reduce((acc, item) => {
                return acc + (Number(item.preco) * Number(item.qtd));
            }, 0);
            setValorGasto(total);
        } else {
            setValorGasto(0);
        }

        setLoading(false);
    };

    const sairDaConta = async () => {
        if (!window.confirm('Tem certeza que deseja sair?')) return;

        // O Supabase limpa a sessão localmente
        await supabase.auth.signOut();

        // Redireciona para a tela de login (ajuste a rota se a sua tela de login não for a raiz '/')
        router.push('/login');
    };

    return (
        <div className="p-4 max-w-lg mx-auto mt-4 pb-20">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Meu Perfil</h1>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-6">

                    {/* Card de Informações do Usuário */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-3xl mb-4 font-bold">
                            {nome ? nome.charAt(0).toUpperCase() : '?'}
                        </div>

                        <div className="flex items-center justify-center gap-2 group cursor-pointer">
                            <h2 className="text-2xl font-bold text-gray-800">{nome || 'Colecionador'}</h2>
                        </div>
                    </div>

                    {/* Grid de Estatísticas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 text-center">Álbum Completo</span>
                            <div className="text-3xl font-black text-blue-600 mb-2">{porcentagem}%</div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div className="bg-blue-600 h-full transition-all duration-1000 ease-out" style={{ width: `${porcentagem}%` }}></div>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-2 font-medium">{totalObtidas} de {totalGeralAlbum} coladas</span>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 text-center">Total Investido</span>
                            <div className="text-2xl font-black text-green-600 mb-1">
                                {valorGasto !== null ? `R$ ${valorGasto.toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                            </div>
                            <span className="text-[10px] text-gray-400 mt-2 text-center leading-tight">
                                Em pacotinhos e figurinhas
                            </span>
                        </div>
                    </div>

                    {/* Botão de Sair da Conta */}
                    <div className="pt-4">
                        <button
                            onClick={sairDaConta}
                            className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 p-4 rounded-xl font-bold shadow-sm active:scale-95 transition-all border border-red-100"
                        >
                            <span className="text-xl">🚪</span>
                            Sair da Conta
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}