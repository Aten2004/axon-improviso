'use client';

import React, { useState, useEffect } from 'react';
import { Crown, Users, Music2, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface OnboardingModalProps {
  onCompleted?: () => void;
}

export default function OnboardingModal({ onCompleted }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'Band Member' | 'Band Manager'>('Band Member');
  const [fullName, setFullName] = useState('');
  const [bandName, setBandName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [instrument, setInstrument] = useState('กลองชุด (Drums)');
  const [errorMessage, setErrorMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    const checkUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || '';
        const metaAvatar = user.user_metadata?.avatar_url || null;
        setFullName(metaName);
        setUserAvatar(metaAvatar);

        // ตรวจสอบว่ามีข้อมูล profile หรือยัง
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        // หากยังไม่มี profile หรือยังไม่มี role ให้เปิด Modal Onboarding
        if (!profile || !profile.role) {
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Onboarding check error:', err);
      }
    };

    checkUserProfile();
  }, []);

  const handleSaveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    setErrorMessage('');

    try {
      let targetBandId: string | null = null;

      if (role === 'Band Manager') {
        if (!bandName.trim()) {
          throw new Error('กรุณาระบุชื่อวงดนตรีของคุณ');
        }
        // สุ่มรหัสวง AXON-XXXX
        const newInviteCode = `AXON-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data: newBand, error: bandError } = await supabase
          .from('bands')
          .insert({
            name: bandName.trim(),
            invite_code: newInviteCode,
            created_by: userId,
          })
          .select('id')
          .single();

        if (bandError) throw bandError;
        targetBandId = newBand.id;
      } else {
        const cleanCode = inviteCode.trim().toUpperCase();
        if (cleanCode) {
          const { data: foundBand, error: lookupError } = await supabase
            .from('bands')
            .select('id')
            .eq('invite_code', cleanCode)
            .maybeSingle();

          if (lookupError || !foundBand) {
            throw new Error(`ไม่พบรหัสวง "${cleanCode}" ในระบบ กรุณาตรวจสอบอีกครั้ง`);
          }
          targetBandId = foundBand.id;
        }
      }

      // บันทึกลง profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            full_name: fullName.trim() || 'Musician',
            role: role,
            instrument: role === 'Band Manager' ? 'Band Manager' : instrument,
            band_id: targetBandId,
            avatar_url: userAvatar,
          },
          { onConflict: 'id' }
        );

      if (profileError) throw profileError;

      setIsOpen(false);
      if (onCompleted) {
        onCompleted();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#101422] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <div className="text-center mb-5">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-rose-400 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ยินดีต้อนรับสู่ A.X.O.N. Studio</span>
          </div>
          <h2 className="text-xl font-bold text-white">เลือกบทบาทการฝึกซ้อมของคุณ</h2>
          <p className="text-xs text-slate-400 mt-1">กรุณากำหนดบทบาทเริ่มต้นเพื่อปรับแต่งระบบให้ตรงกับคุณ</p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSaveOnboarding} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">ชื่อผู้ใช้งานของคุณ</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="เช่น ลิซ่า ลลิษา"
              className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">บทบาทเริ่มต้น</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole('Band Member')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  role === 'Band Member'
                    ? 'bg-[#1a2133] border-sky-400 ring-1 ring-sky-400 text-white'
                    : 'bg-[#131724] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold text-xs mb-1">
                  <Users className={`w-3.5 h-3.5 ${role === 'Band Member' ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>นักดนตรี</span>
                </div>
                <span className="text-[10px] text-slate-400 leading-tight">ซ้อมเดี่ยว หรือใส่รหัสเข้าวง</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('Band Manager')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  role === 'Band Manager'
                    ? 'bg-[#1a2133] border-rose-500 ring-1 ring-rose-500 text-white'
                    : 'bg-[#131724] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-bold text-xs mb-1">
                  <Crown className={`w-3.5 h-3.5 ${role === 'Band Manager' ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span>ผู้จัดการวง</span>
                </div>
                <span className="text-[10px] text-slate-400 leading-tight">สร้างวงดนตรีและบริหาร</span>
              </button>
            </div>
          </div>

          {role === 'Band Manager' ? (
            <div>
              <label className="text-xs text-slate-400 block mb-1">ชื่อวงดนตรีที่คุณต้องการสร้าง *</label>
              <input
                type="text"
                required
                value={bandName}
                onChange={(e) => setBandName(e.target.value)}
                placeholder="เช่น Bodyslam, The Parkinson"
                className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1">เครื่องดนตรีหลักของคุณ</label>
                <div className="relative">
                  <Music2 className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <select
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer"
                  >
                    <option value="กลองชุด (Drums)">กลองชุด (Drums)</option>
                    <option value="กีตาร์โซโล่ (Lead Guitar)">กีตาร์โซโล่ (Lead Guitar)</option>
                    <option value="กีตาร์คอร์ด (Rhythm Guitar)">กีตาร์คอร์ด (Rhythm Guitar)</option>
                    <option value="เบส (Bass)">เบส (Bass)</option>
                    <option value="ร้องนำ (Lead Vocal)">ร้องนำ (Lead Vocal)</option>
                    <option value="คีย์บอร์ด (Keyboard)">คีย์บอร์ด (Keyboard)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">รหัสวงดนตรี (Band Code)</label>
                  <span className="text-[10px] text-slate-500">เว้นว่างได้หากซ้อมเดี่ยว</span>
                </div>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="เช่น AXON-1234"
                  className="w-full uppercase font-mono bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-3 py-2.5 font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5 ${
              role === 'Band Manager'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึกข้อมูล...</span>
              </>
            ) : (
              <span>เริ่มต้นใช้งาน A.X.O.N.</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}