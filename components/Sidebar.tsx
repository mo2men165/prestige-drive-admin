'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: '□' },
  { label: 'Cars', href: '/dashboard/cars', icon: '⬡' },
  { label: 'Locations', href: '/dashboard/locations', icon: '◎' },
  { label: 'Plans', href: '/dashboard/plans', icon: '◈' },
  { label: 'Add-on Options', href: '/dashboard/options', icon: '◇' },
  { label: 'Protection Details', href: '/dashboard/protection', icon: '△' },
  { label: 'Special services', href: '/dashboard/special-services', icon: '◐' },
  { label: 'Bookings', href: '/dashboard/bookings', icon: '▤' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-5 border-b border-gray-200">
        <h1 className="text-sm font-bold text-gray-900">EliteDrive4U</h1>
        <p className="text-xs text-gray-400">Admin Panel</p>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-left"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
