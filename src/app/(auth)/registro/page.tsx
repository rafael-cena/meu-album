'use client';

import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Registro() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    // Validação básica
    if (!usuario || !senha) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    // Usa o cliente padrão (com localStorage) para já deixar o usuário logado
    const supabaseClient = getSupabaseClient(true);

    // Mascara o usuário como e-mail para o Supabase aceitar
    const emailFicticio = `${usuario.toLowerCase()}@album2026.com`;

    const { error } = await supabaseClient.auth.signUp({
      email: emailFicticio,
      password: senha,
      options: {
        data: {
          full_name: usuario,
        }
      }
    });

    if (error) {
      const { error } = await supabaseClient.auth.signUp({
        email: emailFicticio,
        password: senha,
        options: {
          data: {
            full_name: usuario,
          }
        }
      });

      if (error) {
        // Exibe o erro real no console para você saber o que deu errado
        console.error("Erro real do Supabase:", error);

        // Ajusta a mensagem para a tela
        if (error.message.includes('already registered')) {
          setErro('Este usuário já existe. Escolha outro nome.');
        } else if (error.message.includes('Password should be')) {
          setErro('A senha é muito fraca ou curta.');
        } else {
          setErro(`Erro: ${error.message}`);
        }
        setLoading(false);
      } else {
        router.push('/');
      }
    } else {
      // Se der sucesso, redireciona direto para o Dashboard
      router.push('/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm border border-gray-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Criar Conta</h1>
          <p className="text-sm text-gray-500 mt-1">Junte-se e gerencie seu álbum</p>
        </div>

        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200 text-center">
            {erro}
          </div>
        )}

        <form onSubmit={handleRegistro} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
            <input
              type="text"
              placeholder="Ex: joao123"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value.replace(/\s+/g, '').toLowerCase())} // Evita espaços no nome de usuário
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              placeholder="••••••"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
            <input
              type="password"
              placeholder="••••••"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-green-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Criando conta...' : 'Registrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 border-t pt-4">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-blue-600 font-bold hover:underline">
            Faça login aqui
          </Link>
        </div>
      </div>
    </div>
  );
}