'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MenuBar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Álbum', icon: '📖' },
    { href: '/carteira', label: 'Carteira', icon: '💰' },
    { href: '/trocas', label: 'Trocas', icon: '🤝' },
    { href: '/relatorios', label: 'Exportar', icon: '📄' },
    { href: '/perfil', label: 'Perfil', icon: '👤' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-lg pb-safe">
      <ul className="flex justify-around items-center h-16">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
          
          return (
            <li key={link.href} className="w-full">
              <Link
                href={link.href}
                className={`flex flex-col items-center justify-center w-full h-full text-[10px] sm:text-xs transition-colors ${
                  isActive ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-blue-500'
                }`}
              >
                <span className="text-xl mb-1">{link.icon}</span>
                <span className="truncate w-full text-center px-1">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}