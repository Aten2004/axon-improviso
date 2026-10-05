'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Video, BarChart2, Music, Users, User } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';

export default function BottomNav() {
  const pathname = usePathname();
  const { isManager } = useUserRole();

  const navItems = [
    { label: 'ห้องซ้อม', href: '/practice', icon: Video },
    { label: 'สถิติ', href: '/stack', icon: BarChart2 },
    { label: 'คลังเพลง', href: '/songs', icon: Music },
    { label: 'วงดนตรี', href: '/band', icon: Users },
    { label: 'โปรไฟล์', href: '/profile', icon: User },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0d18]/95 backdrop-blur-lg border-t border-slate-800/90 shadow-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center h-full transition-colors relative ${
                isActive 
                  ? isManager 
                    ? 'text-rose-500 font-semibold' 
                    : 'text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className={`absolute top-0 inset-x-4 h-[2px] rounded-full ${
                  isManager ? 'bg-rose-500' : 'bg-sky-400'
                }`} />
              )}
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}