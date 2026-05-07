'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Membro {
    id: string;
    nome: string;
}

export default function InfoGrupo() {
    const params = useParams();
    const router = useRouter();
    const grupoId = params.id as string;

    const [nomeGrupo, setNomeGrupo] = useState('');
    const [membros, setMembros] = useState<Membro[]>([]);
    const [loading, setLoading] = useState(true);
    const [saindo, setSaindo] = useState(false);
    const [meuId, setMeuId] = useState('');

    const [editando, setEditando] = useState(false);
    const [novoNome, setNovoNome] = useState('');

    useEffect(() => {
        carregarDados();
    }, [grupoId]);

    const carregarDados = async () => {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        setMeuId(userData.user.id);

        // 1. Busca nome do grupo
        const { data: grupo } = await supabase.from('grupos').select('nome').eq('id', grupoId).single();
        if (grupo) setNomeGrupo(grupo.nome);

        // 2. Busca os membros associados ao grupo
        const { data: membrosData } = await supabase
            .from('grupo_membros')
            .select('user_id')
            .eq('grupo_id', grupoId);

        if (membrosData) {
            const ids = membrosData.map(m => m.user_id);

            // 3. Busca os nomes na tabela profiles
            const { data: perfisData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', ids);

            const mapaNomes: Record<string, string> = {};
            perfisData?.forEach(p => {
                mapaNomes[p.id] = p.full_name;
            });

            const listaMembros = membrosData.map(m => ({
                id: m.user_id,
                nome: mapaNomes[m.user_id] || 'Colecionador Desconhecido'
            }));

            // Coloca o usuário logado no topo da lista
            listaMembros.sort((a, b) => a.id === userData.user?.id ? -1 : 1);
            setMembros(listaMembros);
        }
        setLoading(false);
    };

    const sairDoGrupo = async () => {
        if (!window.confirm('Tem certeza que deseja sair deste grupo? Você perderá acesso aos matches dele.')) return;

        setSaindo(true);
        const { error } = await supabase
            .from('grupo_membros')
            .delete()
            .eq('grupo_id', grupoId)
            .eq('user_id', meuId);

        if (!error) {
            alert('Você saiu do grupo com sucesso.');
            router.push('/trocas'); // Ou a rota principal onde lista os grupos
        } else {
            alert('Erro ao tentar sair do grupo.');
            setSaindo(false);
        }
    };

    const salvarNome = async () => {
        if (!novoNome.trim()) return;

        setLoading(true);
        const { error } = await supabase
            .from('grupos')
            .update({ nome: novoNome })
            .eq('id', grupoId);

        if (error) {
            alert('Erro ao atualizar o nome.');
        } else {
            setNomeGrupo(novoNome);
            setEditando(false);
        }
        setLoading(false);
    };

    return (
        <div className="p-4 max-w-lg mx-auto mt-4 pb-20">
            <button onClick={() => router.back()} className="mb-4 text-blue-600 font-medium">
                ← Voltar
            </button>

            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-4 shadow-sm border border-blue-200">
                    👥
                </div>

                {editando ? (
                    <div className="flex flex-col gap-2 items-center">
                        <input
                            type="text"
                            className="p-2 border border-blue-300 rounded-lg text-center font-bold text-xl outline-none focus:ring-2 focus:ring-blue-500 w-full"
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={salvarNome}
                                className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md active:scale-95"
                            >
                                Salvar
                            </button>
                            <button
                                onClick={() => setEditando(false)}
                                className="bg-gray-400 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="group flex items-center justify-center gap-2 cursor-pointer" onClick={() => {
                        setNovoNome(nomeGrupo);
                        setEditando(true);
                    }}>
                        <h1 className="text-2xl font-bold text-gray-800">{nomeGrupo}</h1>
                        <span className="text-gray-400 text-sm">✏️</span>
                    </div>
                )}

                <p className="text-xs text-gray-400 mt-2 break-all uppercase tracking-widest font-bold">ID: {grupoId}</p>
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Membros do Grupo ({membros.length})</h2>

            {loading ? (
                <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <ul className="space-y-3 mb-8">
                    {membros.map(membro => (
                        <li key={membro.id} className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm">
                                    {membro.nome.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-gray-800">{membro.nome}</span>
                            </div>
                            {membro.id === meuId && (
                                <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded">Você</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <div className="border-t border-gray-200 pt-6">
                <button
                    onClick={sairDoGrupo}
                    disabled={saindo}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-bold border border-red-200 rounded-lg hover:bg-red-100 transition active:scale-95 disabled:opacity-50"
                >
                    <span>🚪</span> {saindo ? 'Saindo...' : 'Sair do Grupo'}
                </button>
            </div>
        </div>
    );
}