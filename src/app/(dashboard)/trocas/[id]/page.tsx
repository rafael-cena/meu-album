'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface MatchTroca {
    membro_id: string;
    nome_membro: string; // Adicionado para facilitar a exibição
    figurinhas_disponiveis: string[];
}

export default function DetalheGrupo() {
    const params = useParams();
    const router = useRouter();
    const grupoId = params.id as string;

    const [nomeGrupo, setNomeGrupo] = useState('');
    const [matches, setMatches] = useState<MatchTroca[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregarMatches();
    }, [grupoId]);

    const carregarMatches = async () => {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const meuId = userData.user.id;

        // 1. Busca detalhes do grupo
        const { data: grupo } = await supabase.from('grupos').select('nome').eq('id', grupoId).single();
        if (grupo) setNomeGrupo(grupo.nome);

        // 2. Busca os membros do grupo (exceto eu)
        const { data: membros } = await supabase
            .from('grupo_membros')
            .select('user_id')
            .eq('grupo_id', grupoId)
            .neq('user_id', meuId);

        if (!membros || membros.length === 0) {
            setLoading(false);
            return;
        }

        const outrosMembrosIds = membros.map(m => m.user_id);

        // 3. Busca os NOMES desses membros na tabela 'profiles'
        const { data: perfisData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', outrosMembrosIds);

        const mapaNomes: Record<string, string> = {};
        perfisData?.forEach(p => {
            mapaNomes[p.id] = p.full_name;
        });

        // 4. Busca minhas obtidas
        const { data: minhasObtidasData } = await supabase
            .from('obtidas')
            .select('codigo')
            .eq('user_id', meuId);

        const minhasObtidas = new Set(minhasObtidasData?.map(o => o.codigo) || []);

        // 5. Busca as repetidas dos outros membros
        const { data: repetidasOutros } = await supabase
            .from('repetidas')
            .select('user_id, codigo')
            .in('user_id', outrosMembrosIds);

        // 6. Lógica de Matchmaker
        const matchesPorUsuario: Record<string, string[]> = {};

        repetidasOutros?.forEach(rep => {
            if (!minhasObtidas.has(rep.codigo)) {
                if (!matchesPorUsuario[rep.user_id]) {
                    matchesPorUsuario[rep.user_id] = [];
                }
                matchesPorUsuario[rep.user_id].push(rep.codigo);
            }
        });

        const matchesArray = Object.keys(matchesPorUsuario).map(userId => ({
            membro_id: userId,
            nome_membro: mapaNomes[userId] || 'Colecionador Desconhecido', // Usa o nome buscado
            figurinhas_disponiveis: matchesPorUsuario[userId]
        }));

        setMatches(matchesArray);
        setLoading(false);
    };

    const copiarLinkConvite = () => {
        // Pega a URL base do site (ex: http://localhost:3000 ou https://seusite.com)
        const linkSite = window.location.origin;
        const linkConvite = `${linkSite}/trocas/convite/${grupoId}`;

        // Cria uma mensagem amigável para o WhatsApp
        const texto = `🤝 Vem trocar figurinhas da Copa comigo!\nClique no link abaixo para entrar no meu grupo de trocas automaticamente:\n👉 ${linkConvite}`;

        navigator.clipboard.writeText(texto);
        alert('Link de convite copiado! Agora é só colar no WhatsApp.');
    };

    return (
        <div className="p-4 max-w-lg mx-auto mt-4 pb-20">
            <button onClick={() => router.push('/trocas')} className="mb-4 text-blue-600 font-medium">
                ← Voltar aos Grupos
            </button>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex justify-between items-center">
                <div>
                    {/* Transformamos o título em um link que vai para a tela de Info */}
                    <Link href={`/trocas/${grupoId}/info`} className="hover:opacity-80 transition-opacity">
                        <h1 className="text-xl font-bold text-blue-700 flex items-center gap-2">
                            {nomeGrupo} <span className="text-sm bg-blue-100 p-1 rounded-full px-2">ℹ️ Info</span>
                        </h1>
                    </Link>
                    <p className="text-xs text-gray-500 mt-1 break-all">ID: {grupoId}</p>
                </div>
                <button
                    onClick={copiarLinkConvite}
                    className="bg-blue-50 p-2 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-100 active:scale-95 border border-blue-200 transition-all flex items-center gap-1"
                >
                    <span>🔗</span> Convite
                </button>
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-4">Matches (O que eles têm e você precisa)</h2>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : matches.length > 0 ? (
                <ul className="space-y-4">
                    {matches.map(match => (
                        <li key={match.membro_id} className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                <span className="bg-blue-200 p-1 rounded-full text-[10px]">👤</span>
                                {match.nome_membro}
                            </h3>
                            <p className="text-sm text-gray-700 mb-2">Possui {match.figurinhas_disponiveis.length} figurinhas que você precisa:</p>
                            <div className="flex flex-wrap gap-2">
                                {match.figurinhas_disponiveis.sort().map(fig => (
                                    <span key={fig} className="bg-white border border-blue-300 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                        {fig}
                                    </span>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-4xl mb-2 block">😢</span>
                    <p className="text-gray-600 font-medium">Nenhum match encontrado.</p>
                    <p className="text-sm text-gray-500 mt-1">Nenhum membro do grupo tem figurinhas repetidas que faltam para você.</p>
                </div>
            )}
        </div>
    );
}