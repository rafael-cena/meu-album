'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ConviteGrupo() {
    const params = useParams();
    const router = useRouter();
    const grupoId = params.id as string;
    const [status, setStatus] = useState('Verificando seu convite...');

    useEffect(() => {
        processarConvite();
    }, []);

    const processarConvite = async () => {
        // 1. Verifica se o usuário está logado
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user) {
            // SALVA O CONVITE: O usuário não está logado, então guardamos o ID 
            // para processar depois que ele entrar no app.
            localStorage.setItem('convite_pendente', grupoId);

            setStatus('Redirecionando para login...');
            setTimeout(() => router.push('/'), 1500); // Mande para sua tela de login/home
            return;
        }

        setStatus('Entrando no grupo...');

        // 2. Tenta inserir o usuário na tabela de membros do grupo
        const { error } = await supabase
            .from('grupo_membros')
            .insert({
                grupo_id: grupoId,
                user_id: userData.user.id
            });

        // 3. Tratamento inteligente de erros
        if (error) {
            // O código '23505' no Postgres significa "Unique Violation" (ele já está no grupo)
            if (error.code === '23505') {
                setStatus('Você já faz parte deste grupo!');
                setTimeout(() => router.push('/trocas'), 1500); // Mude para a rota onde lista seus grupos
            } else {
                setStatus('Erro ao entrar. O grupo pode não existir mais.');
                setTimeout(() => router.push('/trocas'), 2500);
            }
        } else {
            // Deu tudo certo!
            setStatus('Sucesso! Redirecionando...');
            setTimeout(() => router.push('/trocas'), 1000);
        }
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center max-w-sm w-full animate-in zoom-in duration-300">
                <div className="text-5xl mb-4 animate-bounce">🤝</div>
                <h1 className="text-xl font-bold text-gray-800 mb-2">{status}</h1>

                {/* Spinner de carregamento (Some se der erro e mostrar mensagem longa) */}
                {(status.includes('Verificando') || status.includes('Entrando') || status.includes('Sucesso')) && (
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mt-6"></div>
                )}
            </div>
        </div>
    );
}