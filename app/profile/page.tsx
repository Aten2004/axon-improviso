'use client';

import React, { useState, useEffect } from 'react';
import TopHeader from '@/components/TopHeader';
import BottomNav from '@/components/BottomNav';
import { useRouter } from 'next/navigation';
import { 
  User, 
  LogOut, 
  CheckCircle2, 
  Music2, 
  Crown, 
  Copy, 
  Check, 
  Users, 
  Camera, 
  Loader2,
  PlusCircle,
  X
} from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { supabase } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const router = useRouter();
  const { role, userName, userEmail, bandId, bandName, bandCode, instrument: defaultInst, isManager, loading } = useUserRole();
  
  const [name, setName] = useState('');
  const [currentBandName, setCurrentBandName] = useState('');
  const [instrument, setInstrument] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // สถานะสำหรับรูปโปรไฟล์ (Avatar)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ป๊อปอัปสร้างวงใหม่สำหรับสมาชิกทั่วไป
  const [isCreateBandModalOpen, setIsCreateBandModalOpen] = useState(false);
  const [newBandNameInput, setNewBandNameInput] = useState('');
  const [creatingBand, setCreatingBand] = useState(false);

  // กำหนดชุดสีตามบทบาท: Manager (สีแดง / Rose) vs Member (สีฟ้า / Sky Blue)
  const roleTheme = isManager
    ? {
        primaryBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm',
        accentText: 'text-rose-400',
        badge: 'bg-rose-950/60 border-rose-800 text-rose-300',
        avatarBorder: 'border-rose-800 text-rose-300',
        borderFocus: 'focus:border-rose-500',
        tagBg: 'bg-slate-900 hover:bg-rose-950/30 border-slate-800 hover:border-rose-900/60 text-slate-300',
        logoutHover: 'hover:bg-rose-950/40 hover:text-rose-300',
      }
    : {
        primaryBtn: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-sm',
        accentText: 'text-sky-400',
        badge: 'bg-sky-950/60 border-sky-800 text-sky-300',
        avatarBorder: 'border-sky-800 text-sky-300',
        borderFocus: 'focus:border-sky-500',
        tagBg: 'bg-slate-900 hover:bg-sky-950/30 border-slate-800 hover:border-sky-900/60 text-slate-300',
        logoutHover: 'hover:bg-sky-950/40 hover:text-sky-300',
      };

  useEffect(() => {
    setName(userName || '');
    setCurrentBandName(bandId ? (bandName || '') : '');
    setInstrument(defaultInst || 'กลองชุด (Drums)');

    // ดึงรูปโปรไฟล์เดิมของผู้ใช้จาก Supabase
    const fetchAvatar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        } else if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .maybeSingle();
          if (profile?.avatar_url) {
            setAvatarUrl(profile.avatar_url);
          }
        }
      } catch (err) {
        console.error('Error fetching avatar:', err);
      }
    };

    fetchAvatar();
  }, [userName, bandName, bandId, defaultInst]);

  // ฟังก์ชันอัปโหลดรูปโปรไฟล์ใหม่
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์รูปภาพต้องไม่เกิน 5 MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `avatars/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl } as any)
        .eq('id', user.id);

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      alert(`อัปโหลดรูปภาพไม่สำเร็จ: ${err.message}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profilePayload: { full_name: string; instrument?: string } = {
        full_name: name.trim(),
      };

      if (!isManager) {
        profilePayload.instrument = instrument;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', user.id);

      if (profileError) throw profileError;

      if (isManager && bandId && currentBandName.trim()) {
        const { error: bandError } = await supabase
          .from('bands')
          .update({ name: currentBandName.trim() })
          .eq('id', bandId);

        if (bandError) throw bandError;
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      alert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // สร้างวงใหม่โดยตรงจากหน้า Profile
  const handleCreateBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBandNameInput.trim()) return;

    setCreatingBand(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนสร้างวง');

      const newInviteCode = `AXON-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: createdBand, error: createError } = await supabase
        .from('bands')
        .insert({
          name: newBandNameInput.trim(),
          invite_code: newInviteCode,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (createError) throw createError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'Band Manager',
          instrument: 'Band Manager',
          band_id: createdBand.id,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setIsCreateBandModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      alert(`สร้างวงไม่สำเร็จ: ${err.message}`);
    } finally {
      setCreatingBand(false);
    }
  };

  const copyCode = () => {
    if (!bandCode || bandCode === '-') return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(bandCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      await supabase.auth.signOut();
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#080b14] flex items-center justify-center text-white">
        <p className="text-xs text-slate-400 font-mono tracking-wider">กำลังโหลดข้อมูลโปรไฟล์...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#080b14] text-white flex flex-col pb-24 md:pb-10">
      <TopHeader />
      
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        
        {/* กล่องสรุปโปรไฟล์ผู้ใช้งาน */}
        <div className="bg-[#0f1422] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center text-center sm:text-left gap-4">
          
          <div className="relative group shrink-0">
            <div className={`w-20 h-20 rounded-full bg-slate-800 border-2 flex items-center justify-center text-2xl font-bold overflow-hidden relative ${roleTheme.avatarBorder}`}>
              {uploadingAvatar ? (
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span>{name ? name.charAt(0).toUpperCase() : 'U'}</span>
              )}

              <label
                htmlFor="avatar-file-input"
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity"
                title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
              >
                <Camera className="w-5 h-5 text-white" />
                <span className="text-[9px] text-slate-200 mt-0.5 font-medium">เปลี่ยนรูป</span>
              </label>
            </div>

            <label
              htmlFor="avatar-file-input"
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#161b2a] border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition shadow-md"
              title="อัปโหลดรูปโปรไฟล์"
            >
              <Camera className="w-3.5 h-3.5" />
            </label>

            <input
              type="file"
              id="avatar-file-input"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <h1 className="text-xl font-bold text-white truncate">{name || 'ผู้ใช้งาน'}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold w-fit mx-auto sm:mx-0 border ${roleTheme.badge}`}>
                {isManager ? <Crown className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                {role}
              </span>
            </div>
            
            <p className="text-xs text-slate-400 font-mono">{userEmail}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {!isManager && (
                <span className="text-xs text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <Music2 className="w-3 h-3 text-sky-400" />
                  <span>{instrument}</span>
                </span>
              )}

              {bandId && bandName && (
                <button
                  type="button"
                  onClick={copyCode}
                  className={`text-xs border px-2.5 py-1 rounded-md flex items-center gap-1 transition ${roleTheme.tagBg}`}
                  title="คัดลอกรหัสวง"
                >
                  <Users className={`w-3.5 h-3.5 ${roleTheme.accentText}`} />
                  <span>วง {currentBandName || bandName} {bandCode && bandCode !== '-' ? `(${bandCode})` : ''}</span>
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-60" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ฟอร์มแก้ไขข้อมูล */}
        <div className="bg-[#0f1422] border border-slate-800 rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-bold text-slate-200 pb-3 border-b border-slate-800/80 mb-4">
            แก้ไขข้อมูลส่วนตัว
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">ชื่อที่ใช้แสดง (Display Name)</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none ${roleTheme.borderFocus} transition`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">
                    {isManager ? 'ชื่อวงดนตรี (ผู้จัดการแก้ไขได้)' : 'สังกัดวงดนตรี'}
                  </label>
                  {!isManager && (
                    <button
                      type="button"
                      onClick={() => setIsCreateBandModalOpen(true)}
                      className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>สร้างวงใหม่ของฉัน</span>
                    </button>
                  )}
                </div>
                {isManager && bandId ? (
                  <input
                    type="text"
                    required
                    value={currentBandName}
                    onChange={(e) => setCurrentBandName(e.target.value)}
                    className={`w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none ${roleTheme.borderFocus} transition`}
                  />
                ) : (
                  <input
                    type="text"
                    disabled
                    value={bandId ? (currentBandName || bandName) : 'ยังไม่มีสังกัดวง (ซ้อมเดี่ยว)'}
                    className="w-full bg-slate-900/60 border border-slate-800 text-slate-400 rounded-xl px-3.5 py-2 text-xs cursor-not-allowed"
                  />
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">บทบาทในระบบ</label>
                <input
                  type="text"
                  disabled
                  value={role}
                  className="w-full bg-slate-900/60 border border-slate-800 text-slate-400 rounded-xl px-3.5 py-2 text-xs cursor-not-allowed"
                />
              </div>
            </div>

            {!isManager && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">เครื่องดนตรีหลัก</label>
                <select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                  className={`w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none ${roleTheme.borderFocus} transition cursor-pointer`}
                >
                  <option value="กลองชุด (Drums)">กลองชุด (Drums)</option>
                  <option value="กีตาร์โซโล่ (Lead Guitar)">กีตาร์โซโล่ (Lead Guitar)</option>
                  <option value="กีตาร์คอร์ด (Rhythm Guitar)">กีตาร์คอร์ด (Rhythm Guitar)</option>
                  <option value="เบส (Bass)">เบส (Bass)</option>
                  <option value="ร้องนำ (Lead Vocal)">ร้องนำ (Lead Vocal)</option>
                  <option value="คีย์บอร์ด (Keyboard)">คีย์บอร์ด (Keyboard)</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {isSaved ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกการเปลี่ยนแปลงเรียบร้อย</span>
                </span>
              ) : <div />}

              <button
                type="submit"
                disabled={isSaving}
                className={`px-5 py-2.5 rounded-xl text-xs transition flex items-center space-x-1.5 ${roleTheme.primaryBtn}`}
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>บันทึกการเปลี่ยนแปลง</span>
              </button>
            </div>
          </form>
        </div>

        {/* ปุ่มออกจากระบบ */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleLogout}
            className={`flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-slate-400 border border-slate-800 rounded-xl text-xs transition ${roleTheme.logoutHover}`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>

      </main>

      {/* ป๊อปอัปสร้างวงใหม่ */}
      {isCreateBandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#101422] border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-rose-400" />
                <span>สร้างวงดนตรีใหม่</span>
              </h3>
              <button onClick={() => setIsCreateBandModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBand} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">ชื่อวงดนตรีใหม่ *</label>
                <input
                  type="text"
                  required
                  value={newBandNameInput}
                  onChange={(e) => setNewBandNameInput(e.target.value)}
                  placeholder="เช่น Bodyslam, The Parkinson"
                  className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                เมื่อสร้างวงใหม่แล้ว ระบบจะสร้างรหัสวงอัตโนมัติและเปลี่ยนบทบาทของคุณเป็นผู้จัดการวงทันที
              </p>
              <button
                type="submit"
                disabled={creatingBand}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center space-x-1.5"
              >
                {creatingBand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                <span>ยืนยันสร้างวงและเป็น Manager</span>
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}