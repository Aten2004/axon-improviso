'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Video, 
  BarChart2, 
  Music, 
  Users, 
  User, 
  Crown, 
  LogOut 
} from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { supabase } from '@/lib/supabaseClient';

export default function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, userName, bandName, isManager, instrument, avatarUrl } = useUserRole();

  const handleLogout = async () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      await supabase.auth.signOut();
      router.push('/');
    }
  };

  const navItems = [
    { label: 'ห้องซ้อม', href: '/practice', icon: Video },
    { label: 'สถิติการซ้อม', href: '/stack', icon: BarChart2 },
    { label: 'คลังเพลง', href: '/songs', icon: Music },
    { label: 'วงดนตรี', href: '/band', icon: Users },
    { label: 'โปรไฟล์', href: '/profile', icon: User },
  ];

  return (
    <header className="w-full bg-[#0a0d18] border-b border-slate-800/80 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        
        {/* ฝั่งซ้าย: โลโก้ AXON สลับสีตาม Role */}
        <div className="flex items-center space-x-3">
          <Link href="/practice" className="flex items-center space-x-2.5">
            <div className="relative w-7 h-7 sm:w-8 sm:h-8">
              <Image
                src="/Logo.png"
                alt="AXON Logo"
                fill
                priority
                className="object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="flex flex-col">
              <span className={`text-base sm:text-lg font-black tracking-wider font-sans leading-none ${
                isManager ? 'text-rose-500' : 'text-sky-400'
              }`}>
                AXON
              </span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-medium mt-0.5 hidden sm:block">
                Improviso
              </span>
            </div>
          </Link>
        </div>

        {/* กึ่งกลาง: เมนูนำทาง */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? isManager
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ฝั่งขวา: แสดงชื่อ และรูปโปรไฟล์ */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {bandName && (
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
              <span className="text-slate-400">วง:</span>
              <span className="text-slate-200 font-medium max-w-[120px] truncate">{bandName}</span>
            </div>
          )}

          <Link 
            href="/profile" 
            className="flex items-center space-x-2 p-1 rounded-lg hover:bg-slate-900 transition"
          >
            {/* วงกลมรูปโปรไฟล์ */}
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border-2 flex items-center justify-center font-bold text-xs text-white overflow-hidden ${
              isManager ? 'border-rose-800 text-rose-300' : 'border-sky-800 text-sky-300'
            }`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <span>{userName ? userName.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>

            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 truncate max-w-[100px] leading-tight">
                {userName || 'ผู้ใช้'}
              </span>
              <span className={`text-[10px] leading-tight font-medium ${
                isManager ? 'text-rose-400' : 'text-sky-400'
              }`}>
                {isManager ? 'ผู้จัดการวง' : instrument}
              </span>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className={`p-1.5 text-slate-400 rounded-lg transition ${
              isManager ? 'hover:text-rose-400' : 'hover:text-sky-400'
            }`}
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
}