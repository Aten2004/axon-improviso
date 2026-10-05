'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Eye, 
  EyeOff, 
  Crown, 
  Users, 
  Music2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Headphones
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function LandingAuthPage() {
  const router = useRouter();

  // สถานะโหมดและการแสดงผล
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // ข้อความแจ้งเตือนสถานะ
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ข้อมูลในฟอร์ม
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ข้อมูลเฉพาะการสมัครสมาชิก
  const [registerRole, setRegisterRole] = useState<'Band Manager' | 'Band Member'>('Band Member');
  const [bandName, setBandName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [instrument, setInstrument] = useState('กลองชุด (Drums)');

  // 1. ตรวจสอบ Session เดิมอัตโนมัติ
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.role === 'Band Manager') {
            router.replace('/band');
          } else {
            router.replace('/practice');
          }
          return;
        }
      } catch (err) {
        console.error('Session verification error:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkActiveSession();
  }, [router]);

  // ดักจับและแปลง Error จาก Supabase เป็นภาษาไทยที่ชัดเจน
  const mapSupabaseError = (errMessage: string): string => {
    const lower = errMessage.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
    }
    if (lower.includes('user already registered')) {
      return 'อีเมลนี้ลงทะเบียนไว้แล้วในระบบ กรุณาเลือกเข้าสู่ระบบ';
    }
    if (lower.includes('password should be at least 6 characters')) {
      return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
    }
    if (lower.includes('email not confirmed')) {
      return 'อีเมลยังไม่ได้รับการยืนยัน หรือเข้าไปปิด Confirm email ใน Supabase';
    }
    if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
      return 'ติดโควตาส่งอีเมลของ Supabase (Email Rate Limit Exceeded): กรุณาเข้าไปปิด "Confirm email" ใน Supabase > Authentication > Providers > Email แล้วกด Save หรือใส่ SUPABASE_SERVICE_ROLE_KEY ใน .env.local';
    }
    if (lower.includes('only request this once every')) {
      return 'กรุณารอประมาณ 60 วินาทีก่อนกดสมัครใหม่อีกครั้ง';
    }
    return errMessage || 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
  };

  // 2. จัดการการ Submit ฟอร์ม (Sign In & Sign Up)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          throw new Error('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
        }

        if (registerRole === 'Band Manager' && !bandName.trim()) {
          throw new Error('กรุณาระบุชื่อวงดนตรีของคุณ');
        }

        let isRegisteredSuccessfully = false;

        // ขั้นที่ 1: ลงทะเบียนผ่าน Server API Route เพื่อ Bypass Email Rate Limit
        try {
          const apiRes = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              password: password,
              fullName: name.trim(),
              role: registerRole,
              instrument,
              bandName,
              inviteCode,
            }),
          });

          const apiData = await apiRes.json();

          if (apiRes.ok && apiData.success) {
            isRegisteredSuccessfully = true;
          } else if (apiData.error && apiData.error !== 'MISSING_SERVICE_ROLE_KEY') {
            throw new Error(apiData.error);
          }
        } catch (apiErr: any) {
          if (!apiErr.message?.includes('MISSING_SERVICE_ROLE_KEY') && !apiErr.message?.includes('Failed to fetch')) {
            throw apiErr;
          }
        }

        // ขั้นที่ 2: กรณีไม่มี Service Role Key ให้ Fallback เป็น Supabase Client ปกติ
        if (!isRegisteredSuccessfully) {
          let targetBandId: string | null = null;

          if (registerRole === 'Band Member') {
            const trimmedCode = inviteCode.trim().toUpperCase();
            if (trimmedCode) {
              const { data: bandData, error: bandLookupError } = await supabase
                .from('bands')
                .select('id')
                .eq('invite_code', trimmedCode)
                .maybeSingle();

              if (bandLookupError || !bandData) {
                throw new Error(`ไม่พบรหัสวง "${trimmedCode}" ในระบบ กรุณาตรวจสอบความถูกต้อง`);
              }
              targetBandId = bandData.id;
            }
          }

          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
              data: {
                full_name: name.trim(),
                role: registerRole,
                instrument: registerRole === 'Band Manager' ? 'Band Manager' : instrument,
              },
            },
          });

          if (authError) throw authError;

          const userId = authData.user?.id;
          if (!userId) throw new Error('ไม่สามารถสร้างบัญชีผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง');

          if (registerRole === 'Band Manager') {
            const newInviteCode = `AXON-${Math.floor(1000 + Math.random() * 9000)}`;
            const { data: createdBand, error: createBandError } = await supabase
              .from('bands')
              .insert({
                name: bandName.trim(),
                invite_code: newInviteCode,
                created_by: userId,
              })
              .select('id')
              .single();

            if (createBandError) throw createBandError;
            targetBandId = createdBand.id;
          }

          const { error: profileUpsertError } = await supabase
            .from('profiles')
            .upsert(
              {
                id: userId,
                full_name: name.trim(),
                role: registerRole,
                instrument: registerRole === 'Band Manager' ? 'Band Manager' : instrument,
                band_id: targetBandId,
              },
              { onConflict: 'id' }
            );

          if (profileUpsertError) throw profileUpsertError;
        }

        // ขั้นที่ 3: สั่ง Sign In ทันที เพื่อสร้าง Session ให้ผู้ใช้งาน
        const { error: autoLoginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (autoLoginError) {
          setSuccessMessage('สร้างบัญชีสำเร็จแล้ว กำลังสลับไปหน้าเข้าสู่ระบบ...');
          setTimeout(() => {
            setIsRegister(false);
          }, 1000);
          return;
        }

        setSuccessMessage('สร้างบัญชีสำเร็จ กำลังนำท่านเข้าสู่ระบบ...');
        setTimeout(() => {
          router.push(registerRole === 'Band Manager' ? '/band' : '/practice');
        }, 700);

      } else {
        // --- เข้าสู่ระบบ (Sign In) ---
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (loginError) throw loginError;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', loginData.user.id)
          .maybeSingle();

        setSuccessMessage('เข้าสู่ระบบสำเร็จ กำลังพาไปยังห้องซ้อม...');
        setTimeout(() => {
          if (profileData?.role === 'Band Manager') {
            router.push('/band');
          } else {
            router.push('/practice');
          }
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(mapSupabaseError(err.message || 'เกิดข้อผิดพลาดในการประมวลผล'));
    } finally {
      setLoading(false);
    }
  };

  // 3. เข้าสู่ระบบด้วย Google OAuth ผ่าน Supabase
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/practice`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen w-full bg-[#08090D] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-3 border-[#FF2E63] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Initializing A.X.O.N. Studio...</p>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-[#08090D] text-white flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-x-hidden selection:bg-[#FF2E63] selection:text-white">
      {/* Background Glow Effect */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FF2E63]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-96 h-96 bg-[#FF007A]/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Onboarding Visual Card ฝั่งซ้าย (ปรับข้อความกระชับและนำกรอบเทคนิคออก) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between h-[680px] bg-[#10121A] border border-[#1E2230] rounded-[36px] p-8 sm:p-10 relative overflow-hidden shadow-2xl">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity scale-105"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0E14] via-[#0C0E14]/70 to-transparent" />

          {/* Top Bar Header */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 drop-shadow-[0_0_12px_rgba(255,46,99,0.8)]">
                <Image
                  src="/Logo.png"
                  alt="AXON Logo"
                  fill
                  priority
                  className="object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <span className="text-xl font-black tracking-widest text-[#FF2E63] font-sans">AXON</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#181B26]/80 backdrop-blur-md border border-[#262B3D] text-[11px] text-slate-300">
              <Headphones className="w-3.5 h-3.5 text-[#FF2E63]" />
              <span>Studio Rehearsal Node</span>
            </div>
          </div>

          {/* Hero Typography & Intro Description */}
          <div className="relative z-10 space-y-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center space-x-2 text-xs text-[#FF2E63] font-semibold tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Smart Music Rehearsal Platform</span>
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
                A.X.O.N. Improviso <br />
                <span className="text-[#FF2E63]">Smart Music Assistant</span>
              </h2>
              <p className="text-sm text-slate-300 font-light max-w-md leading-relaxed pt-1">
                เว็บแอปพลิเคชันผู้ช่วยซ้อมดนตรีอัจฉริยะสำหรับนักดนตรีและวงดนตรี บันทึกการซ้อม วิเคราะห์ความแม่นยำของจังหวะและระดับเสียง พร้อมระบบติดตามสถิติพัฒนาการแบบครบวงจร
              </p>
            </div>

            {/* Pill Indicator */}
            <div className="pt-4 flex items-center space-x-1.5">
              <div className="w-6 h-1.5 bg-[#FF2E63] rounded-full" />
              <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
              <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
            </div>
          </div>
        </div>

        {/* Card ฟอร์ม Login / Sign Up ฝั่งขวา */}
        <div className="w-full lg:col-span-6 max-w-md mx-auto">
          <div className="bg-[#10121A]/90 backdrop-blur-2xl border border-[#1E2230] rounded-[36px] p-6 sm:p-9 shadow-2xl relative">
            
            {/* Header Title Bar */}
            <div className="text-center sm:text-left mb-6">
              <div className="lg:hidden flex justify-center mb-3">
                <span className="text-2xl font-black tracking-widest text-[#FF2E63] font-sans">AXON</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {isRegister ? 'Sign Up To Your Account.' : 'Login Now To Your Account.'}
              </h1>
              <p className="text-xs text-slate-400 mt-1.5 font-light">
                {isRegister 
                  ? 'กรอกข้อมูลเพื่อสร้างโปรไฟล์และเชื่อมต่อระบบห้องซ้อม' 
                  : 'เข้าสู่ระบบเพื่อจัดการห้องซ้อมและติดตามสถิติการเล่น'}
              </p>
            </div>

            {/* Error & Success Banners */}
            {errorMessage && (
              <div className="mb-4 p-3.5 bg-red-950/60 border border-red-800/80 rounded-2xl text-xs text-red-300 leading-relaxed flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#FF2E63] mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-xs text-emerald-300 leading-relaxed flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* ช่อง Full Name สำหรับ Sign Up */}
              {isRegister && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5 font-medium">ชื่อผู้ใช้งาน (Full Name)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="กรอกชื่อ-นามสกุลของคุณ"
                    className="w-full bg-[#171922] border border-[#262A36] rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF2E63] transition shadow-inner"
                  />
                </div>
              )}

              {/* ช่อง Email */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Email</label>
                <input
                  type="email"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  placeholder="name@example.com"
                  className="w-full bg-[#171922] border border-[#262A36] rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF2E63] transition shadow-inner"
                />
              </div>

              {/* ช่อง Password */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านอย่างน้อย 6 ตัวอักษร"
                    className="w-full bg-[#171922] border border-[#262A36] rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF2E63] transition pr-11 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* ช่อง Confirm Password สำหรับ Sign Up */}
              {isRegister && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5 font-medium">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                      className="w-full bg-[#171922] border border-[#262A36] rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF2E63] transition pr-11 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* ส่วนเลือก Role / Band / Instrument */}
              {isRegister && (
                <div className="pt-2 space-y-3.5 border-t border-[#1F2332]">
                  <label className="text-xs font-semibold text-slate-300 block">บทบาทในระบบ</label>
                  
                  {/* ปุ่มเลือก Role */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRegisterRole('Band Member')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        registerRole === 'Band Member'
                          ? 'bg-[#1C1F2B] border-[#FF2E63] shadow-md ring-1 ring-[#FF2E63]'
                          : 'bg-[#14161F] border-[#222533] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 text-slate-200 font-bold text-xs mb-1">
                        <Users className={`w-3.5 h-3.5 ${registerRole === 'Band Member' ? 'text-[#FF2E63]' : 'text-slate-400'}`} />
                        <span>นักดนตรี / สมาชิก</span>
                      </div>
                      <span className="text-[10px] text-slate-500 leading-tight">ซ้อมเดี่ยว หรือใช้รหัสเข้าวง</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegisterRole('Band Manager')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        registerRole === 'Band Manager'
                          ? 'bg-[#1C1F2B] border-[#FF2E63] shadow-md ring-1 ring-[#FF2E63]'
                          : 'bg-[#14161F] border-[#222533] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 text-slate-200 font-bold text-xs mb-1">
                        <Crown className={`w-3.5 h-3.5 ${registerRole === 'Band Manager' ? 'text-[#FF2E63]' : 'text-slate-400'}`} />
                        <span>ผู้จัดการวง</span>
                      </div>
                      <span className="text-[10px] text-slate-500 leading-tight">สร้างวงใหม่และบริหาร</span>
                    </button>
                  </div>

                  {/* ป้อนชื่อวง (กรณีผู้จัดการ) */}
                  {registerRole === 'Band Manager' ? (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">ชื่อวงดนตรี (Band Name) *</label>
                      <input
                        type="text"
                        required
                        value={bandName}
                        onChange={(e) => setBandName(e.target.value)}
                        placeholder="ระบุชื่อวงดนตรีของคุณ"
                        className="w-full bg-[#171922] border border-[#262A36] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FF2E63]"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-400">รหัสวง (Band Code)</label>
                        <span className="text-[10px] text-slate-500">ไม่บังคับ (เว้นว่างเพื่อซ้อมเดี่ยว)</span>
                      </div>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="กรอกรหัสวงดนตรี (เช่น AXON-1234)"
                        className="w-full uppercase font-mono tracking-wider bg-[#171922] border border-[#262A36] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FF2E63]"
                      />
                    </div>
                  )}

                  {/* เลือกเครื่องดนตรีสำหรับ Member */}
                  {registerRole === 'Band Member' && (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">เครื่องดนตรีประจำตำแหน่ง</label>
                      <div className="relative">
                        <Music2 className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                        <select
                          value={instrument}
                          onChange={(e) => setInstrument(e.target.value)}
                          className="w-full bg-[#171922] border border-[#262A36] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2E63] cursor-pointer"
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
                  )}
                </div>
              )}

              {/* Remember me & Forgot Password Bar */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none text-slate-400 hover:text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-full border-slate-700 bg-[#171922] text-[#FF2E63] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#FF2E63]"
                  />
                  <span>Remember me</span>
                </label>

                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => alert('ฟีเจอร์รีเซ็ตรหัสผ่าน: กรุณาติดต่อ Band Manager หรือผู้ดูแลระบบ')}
                    className="text-[#FF2E63] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              {/* ปุ่ม Action หลัก */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 bg-[#FF2E63] hover:bg-[#E02655] disabled:bg-slate-800 text-white font-bold rounded-2xl text-sm shadow-sm transition-all transform active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>กำลังประมวลผล...</span>
                  </>
                ) : (
                  <span>{isRegister ? 'Sign UP' : 'Login'}</span>
                )}
              </button>

              {/* เส้นคั่น OR */}
              <div className="flex items-center my-4">
                <div className="flex-1 border-t border-[#1F2332]" />
                <span className="px-3 text-[11px] text-slate-500 font-medium">OR</span>
                <div className="flex-1 border-t border-[#1F2332]" />
              </div>

              {/* ปุ่ม Google Sign-In */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#14161F] hover:bg-[#1A1D29] border border-[#222533] rounded-2xl text-xs font-semibold text-slate-200 transition flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-1.9.4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.4-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>

              {/* ท้ายฟอร์ม: สลับ Sign In <-> Sign Up */}
              <div className="pt-4 text-center">
                <p className="text-xs text-slate-400">
                  {isRegister ? "Already have an account? " : "Don't have an account? "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister);
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-[#FF2E63] font-bold hover:underline ml-1"
                  >
                    {isRegister ? 'Login' : 'Sign Up'}
                  </button>
                </p>
              </div>

            </form>
          </div>
        </div>

      </div>
    </main>
  );
}