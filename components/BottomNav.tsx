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
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0d18]/95 backdrop-blur-xl border-t border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)' }}
    >
      {/* ปรับความสูงเป็น h-16 (64px) ถึง h-[70px] เพื่อให้กดง่าย ไม่ติดขอบล่าง */}
      <div className="grid grid-cols-5 h-16 sm:h-[70px] items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center h-full transition-all duration-200 relative py-1 ${
                isActive 
                  ? isManager 
                    ? 'text-rose-500 font-bold scale-105' 
                    : 'text-sky-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className={`absolute top-0 inset-x-3 h-[3px] rounded-full shadow-sm ${
                  isManager ? 'bg-rose-500 shadow-rose-500/50' : 'bg-sky-400 shadow-sky-400/50'
                }`} />
              )}
              {/* ขยายขนาดไอคอนจาก w-4 h-4 (16px) เป็น w-5 h-5 (20px) */}
              <Icon className="w-5 h-5 mb-1 shrink-0" />
              {/* ขยายฟอนต์จาก 10px เป็น 11px/12px เพื่อให้อ่านชัดเจน */}
              <span className="text-[11px] sm:text-xs tracking-tight font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}