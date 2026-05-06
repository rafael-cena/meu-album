'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrarMim, setLembrarMim] = useState(true);
  const [erro, setErro] = useState('');
  const router = useRouter();

  useEffect(() => {
    const verificarLogado = async () => {
      const supabaseLocal = getSupabaseClient(true);
      const { data: { session: sessaoLocal } } = await supabaseLocal.auth.getSession();

      const supabaseSession = getSupabaseClient(false);
      const { data: { session: sessaoTemp } } = await supabaseSession.auth.getSession();

      if (sessaoLocal || sessaoTemp) {
        router.push('/');
      }
    };
    verificarLogado();
  }, [router]);

  const handleAuth = async (isLogin: boolean) => {
    setErro('');
    // Cria o cliente dinâmico com base no checkbox
    const supabaseClient = getSupabaseClient(lembrarMim);
    const emailFicticio = `${usuario}@album2026.com`;

    if (isLogin) {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: emailFicticio,
        password: senha,
      });
      if (error) setErro('Usuário ou senha incorretos.');
      else router.push('/');
    } else {
      const { error } = await supabaseClient.auth.signUp({
        email: emailFicticio,
        password: senha,
      });
      if (error) setErro('Erro ao registrar. Tente outra senha ou usuário.');
      else router.push('/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Meu Álbum</h1>

        {erro && <p className="text-red-500 text-sm mb-4">{erro}</p>}

        <input
          type="text"
          placeholder="Usuário"
          className="w-full p-2 border border-gray-300 rounded mb-4 text-black"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <input
          type="password"
          placeholder="Senha"
          className="w-full p-2 border border-gray-300 rounded mb-4 text-black"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <div className="flex items-center mb-6">
          <input
            type="checkbox"
            id="lembrar"
            className="mr-2"
            checked={lembrarMim}
            onChange={(e) => setLembrarMim(e.target.checked)}
          />
          <label htmlFor="lembrar" className="text-sm text-gray-700">Lembrar de mim</label>
        </div>

        <button
          onClick={() => handleAuth(true)}
          className="w-full bg-blue-600 text-white p-2 rounded mb-2 hover:bg-blue-700 transition"
        >
          Entrar
        </button>
        <div className="mt-4 text-center text-sm text-gray-600">
          Ainda não tem conta?{' '}
          <Link href="/registro" className="text-green-600 font-bold hover:underline">
            Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  );
}