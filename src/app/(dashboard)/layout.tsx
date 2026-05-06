'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MenuBar from '@/components/MenuBar';
import { getSupabaseClient } from '@/lib/supabase';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [autorizado, setAutorizado] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const validarSessao = async () => {
      // 1. Tenta buscar a sessão no LocalStorage (Lembrar de Mim = Marcado)
      const supabaseLocal = getSupabaseClient(true);
      const { data: { session: sessaoLocal } } = await supabaseLocal.auth.getSession();

      if (sessaoLocal) {
        setAutorizado(true);
        return;
      }

      // 2. Se não achou, tenta no SessionStorage (Lembrar de Mim = Desmarcado)
      const supabaseSession = getSupabaseClient(false);
      const { data: { session: sessaoTemp } } = await supabaseSession.auth.getSession();

      if (sessaoTemp) {
        setAutorizado(true);
        return;
      }

      // 3. Se não achou em nenhum lugar, expulsa para o login
      router.push('/login');
    };

    validarSessao();
  }, [router]);

  // Enquanto está validando, exibe uma tela de carregamento (evita piscar o dashboard)
  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Se passou na validação, renderiza o sistema e o menu
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-1 pb-16">{children}</main>
      <MenuBar />
    </div>
  );
}