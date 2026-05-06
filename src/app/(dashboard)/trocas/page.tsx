'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Grupo {
  id: string;
  nome: string;
  criador_id: string;
}

export default function Trocas() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [idEntrar, setIdEntrar] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarMeusGrupos();
  }, []);

  const carregarMeusGrupos = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Busca os grupos que o usuário é membro
    const { data } = await supabase
      .from('grupo_membros')
      .select('grupo_id, grupos(id, nome, criador_id)')
      .eq('user_id', userData.user.id);

    if (data) {
      const meusGrupos = data.map((item: any) => item.grupos);
      setGrupos(meusGrupos);
    }
    setLoading(false);
  };

  const criarGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeGrupo.trim()) return;

    const { data: userData } = await supabase.auth.getUser();
    
    // 1. Cria o grupo
    const { data: novoGrupo, error } = await supabase
      .from('grupos')
      .insert({ nome: nomeGrupo, criador_id: userData.user?.id })
      .select()
      .single();

    if (novoGrupo && !error) {
      // 2. Adiciona o criador como membro
      await supabase
        .from('grupo_membros')
        .insert({ grupo_id: novoGrupo.id, user_id: userData.user?.id });
      
      setNomeGrupo('');
      carregarMeusGrupos();
    }
  };

  const entrarNoGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idEntrar.trim()) return;

    const { data: userData } = await supabase.auth.getUser();

    // Tenta inserir na tabela de junção (falhará silenciosamente se o ID do grupo for inválido pela constraint, mas num app real o ideal é buscar o grupo antes para validar)
    const { error } = await supabase
      .from('grupo_membros')
      .insert({ grupo_id: idEntrar, user_id: userData.user?.id });

    if (!error) {
      setIdEntrar('');
      carregarMeusGrupos();
    } else {
      alert('Erro ao entrar no grupo. Verifique o ID e tente novamente.');
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Grupos de Troca</h1>

      {/* Formulários lado a lado em telas maiores, empilhados no celular */}
      <div className="flex flex-col gap-4 mb-8">
        <form onSubmit={criarGrupo} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-2">Criar Novo Grupo</h3>
          <input
            type="text"
            placeholder="Nome do Grupo"
            value={nomeGrupo}
            onChange={e => setNomeGrupo(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700">
            Criar Grupo
          </button>
        </form>

        <form onSubmit={entrarNoGrupo} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-2">Entrar em um Grupo</h3>
          <input
            type="text"
            placeholder="ID do Grupo (UUID)"
            value={idEntrar}
            onChange={e => setIdEntrar(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button type="submit" className="w-full bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700">
            Participar
          </button>
        </form>
      </div>

      <h2 className="text-xl font-bold text-gray-800 mb-4">Meus Grupos</h2>
      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : grupos.length > 0 ? (
        <ul className="space-y-3">
          {grupos.map(grupo => (
            <li key={grupo.id}>
              <Link 
                href={`/trocas/${grupo.id}`}
                className="block bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-400 transition"
              >
                <h3 className="font-bold text-lg text-gray-800">{grupo.nome}</h3>
                <p className="text-xs text-gray-400 mt-1">ID: {grupo.id}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-center py-8">Você ainda não participa de nenhum grupo.</p>
      )}
    </div>
  );
}