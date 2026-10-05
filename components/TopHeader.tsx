'use client';

import React, { useState } from 'react';
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
  LogOut,
  Radio,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { supabase } from '@/lib/supabaseClient';

export default function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, userName, bandName, isManager, instrument, avatarUrl, bandCode } = useUserRole();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { label: 'ห้องซ้อม', href: '/practice', icon: Video },
    { label: 'สถิติการซ้อม', href: '/stack', icon: BarChart2 },
    { label: 'คลังเพลง', href: '/songs', icon: Music },
    { label: 'วงดนตรี', href: '/band', icon: Users },
    { label: 'โปรไฟล์', href: '/profile', icon: User },
  ];

  const roleStyles = isManager
    ? {
        accentText: 'text-rose-500',
        badgeBg: 'bg-rose-950/70 border-rose-800/80 text-rose-300',
        glowRing: 'ring-rose-500/30',
        activeNav: 'bg-rose-600 text-white shadow-rose-900/40',
        headerBorderGlow: 'from-rose-500/40 via-rose-500/10 to-transparent',
        dotColor: 'bg-rose-500',
      }
    : {
        accentText: 'text-sky-400',
        badgeBg: 'bg-sky-950/70 border-sky-800/80 text-sky-300',
        glowRing: 'ring-sky-400/30',
        activeNav: 'bg-sky-500 text-slate-950 font-bold shadow-sky-900/40',
        headerBorderGlow: 'from-sky-400/40 via-sky-400/10 to-transparent',
        dotColor: 'bg-sky-400',
      };

  return (
    <>
      <header className="w-full bg-[#080c18]/90 backdrop-blur-2xl border-b border-slate-800/80 sticky top-0 z-30 transition-all">
        {/* เส้นแสงนีออนบางบอกสถานะด้านบนสุด */}
        <div className={`h-[1.5px] w-full bg-gradient-to-r ${roleStyles.headerBorderGlow}`} />

        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          
          {/* ฝั่งซ้าย: โลโก้ และ สถานะโหมดสตูดิโอ */}
          <div className="flex items-center space-x-2.5">
            <Link href="/practice" className="flex items-center space-x-2.5 group">
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-slate-800 to-[#101422] p-1 border border-slate-700/70 shadow-inner group-hover:border-slate-500 transition">
                <Image
                  src="/Logo.png"
                  alt="AXON Logo"
                  fill
                  priority
                  className="object-contain p-0.5"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className={`text-base font-black tracking-wider font-sans leading-none ${roleStyles.accentText}`}>
                    AXON
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800/90 text-slate-300 border border-slate-700 hidden xs:inline-block">
                    PRO
                  </span>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-medium leading-tight mt-0.5">
                  Improviso
                </span>
              </div>
            </Link>

            {/* ชิปแสดงสถานะวงบนมือถือ (Mobile Status Badge) */}
            <div className="flex md:hidden items-center space-x-1.5 pl-2 border-l border-slate-800/80">
              <div className={`px-2 py-0.5 rounded-full border text-[10px] font-medium flex items-center space-x-1.5 max-w-[125px] sm:max-w-[170px] truncate ${roleStyles.badgeBg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${roleStyles.dotColor} animate-pulse shrink-0`} />
                <span className="truncate">
                  {bandName ? bandName : (isManager ? 'ผู้จัดการ' : 'ซ้อมเดี่ยว')}
                </span>
              </div>
            </div>
          </div>

          {/* กึ่งกลาง: เมนูนำทาง (สำหรับ Desktop & iPad แนวนอน) */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? `${roleStyles.activeNav} shadow-sm`
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* ฝั่งขวา: โปรไฟล์ผู้ใช้ & ปุ่มคำสั่ง */}
          <div className="flex items-center space-x-2">
            
            {/* กล่องแสดงชื่อวงสำหรับ Desktop */}
            {bandName && (
              <div className="hidden md:flex items-center space-x-1.5 bg-[#101524] border border-slate-800/90 px-3 py-1 rounded-xl text-xs">
                <Radio className={`w-3 h-3 ${roleStyles.accentText}`} />
                <span className="text-slate-400">วง:</span>
                <span className="text-slate-200 font-semibold max-w-[130px] truncate">{bandName}</span>
              </div>
            )}

            {/* แคปซูลโปรไฟล์ผู้ใช้ */}
            <Link 
              href="/profile" 
              className="flex items-center space-x-2 p-1 pl-1.5 pr-2.5 rounded-full bg-[#101524]/90 border border-slate-800 hover:border-slate-700 transition active:scale-95 shadow-sm"
            >
              <div className={`w-7 h-7 rounded-full bg-slate-800 border flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0 ring-2 ${roleStyles.glowRing} ${
                isManager ? 'border-rose-500' : 'border-sky-400'
              }`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <span>{userName ? userName.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>

              <div className="flex flex-col text-left leading-none max-w-[85px] sm:max-w-[110px]">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {userName || 'ผู้ใช้งาน'}
                </span>
                <span className={`text-[9px] mt-0.5 truncate font-medium ${roleStyles.accentText}`}>
                  {isManager ? 'Manager' : (instrument.split(' ')[0] || 'Member')}
                </span>
              </div>
            </Link>

            {/* ปุ่มออกจากระบบสไตล์มินิมอล */}
            <button
              type="button"
              onClick={() => setShowConfirmLogout(true)}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/70 rounded-full border border-slate-800/80 transition"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* Modal ยืนยันออกจากระบบแบบกำหนดเอง (แทน alert ธรรมดา) */}
      {showConfirmLogout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#0f1422] border border-slate-800 rounded-3xl p-5 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">ออกจากระบบ A.X.O.N. ?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ต้องการสิ้นสุดเซสชันการใช้งานปัจจุบันหรือไม่
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-sm"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}