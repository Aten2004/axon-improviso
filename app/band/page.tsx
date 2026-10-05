'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopHeader from '@/components/TopHeader';
import BottomNav from '@/components/BottomNav';
import { 
  Users, 
  Send, 
  CheckCircle2, 
  Video, 
  Crown, 
  MessageSquare, 
  RefreshCw, 
  Copy, 
  Check, 
  LogIn, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Music2,
  PlusCircle,
  X
} from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { supabase } from '@/lib/supabaseClient';

interface BandMember {
  id: string;
  full_name: string;
  role: string;
  instrument: string;
  status?: string;
  avatar_url?: string | null;
  created_at: string;
}

export default function BandOverviewPage() {
  const router = useRouter();
  const { isManager, bandId, bandName, bandCode, loading: roleLoading } = useUserRole();

  const [members, setMembers] = useState<BandMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [copied, setCopied] = useState(false);

  // กระดานประกาศจากวงดนตรี
  const [managerReport, setManagerReport] = useState('');
  const [latestAnnouncement, setLatestAnnouncement] = useState('ยังไม่มีประกาศจากวงในขณะนี้');
  const [isSent, setIsSent] = useState(false);

  // ระบบเข้าร่วมวง (Join Band)
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  // ระบบสร้างวงดนตรีใหม่สำหรับสมาชิกทั่วไป
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBandNameInput, setNewBandNameInput] = useState('');
  const [creatingBand, setCreatingBand] = useState(false);

  const roleTheme = isManager
    ? {
        primaryBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm',
        accentText: 'text-rose-400',
        accentBg: 'bg-rose-500',
        borderFocus: 'focus:border-rose-500',
        badge: 'bg-rose-950/80 border-rose-800 text-rose-300',
        cardBorder: 'border-rose-900/60',
        codeBg: 'bg-rose-950/40 hover:bg-rose-950/60 border-rose-900/60 text-rose-300',
        boardHeader: 'text-rose-300',
        boardIcon: 'text-rose-400',
        boardBadge: 'bg-rose-950 text-rose-400 border-rose-800',
        glow: 'bg-rose-500/10',
        spinner: 'text-rose-500',
      }
    : {
        primaryBtn: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-sm',
        accentText: 'text-sky-400',
        accentBg: 'bg-sky-400',
        borderFocus: 'focus:border-sky-500',
        badge: 'bg-sky-950/80 border-sky-800 text-sky-300',
        cardBorder: 'border-sky-900/60',
        codeBg: 'bg-sky-950/40 hover:bg-sky-950/60 border-sky-900/60 text-sky-300',
        boardHeader: 'text-sky-300',
        boardIcon: 'text-sky-400',
        boardBadge: 'bg-sky-950 text-sky-400 border-sky-800',
        glow: 'bg-sky-500/10',
        spinner: 'text-sky-400',
      };

  const fetchBandData = async () => {
    if (!bandId) return;
    setLoadingMembers(true);
    try {
      const { data: memberList, error: memberError } = await supabase
        .from('profiles')
        .select('id, full_name, role, instrument, status, created_at, avatar_url')
        .eq('band_id', bandId)
        .order('role', { ascending: false });

      if (memberError) throw memberError;
      setMembers(memberList || []);

      const { data: annData, error: annError } = await supabase
        .from('band_announcements')
        .select('message, created_at')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!annError && annData) {
        setLatestAnnouncement(annData.message);
      }
    } catch (err) {
      console.error('Fetch band data error:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (!bandId) return;
    fetchBandData();

    const announcementChannel = supabase
      .channel(`realtime:band_announcements:${bandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'band_announcements',
          filter: `band_id=eq.${bandId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new && payload.new.message) {
              setLatestAnnouncement(payload.new.message);
            }
          } else if (payload.eventType === 'DELETE') {
            fetchBandData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
    };
  }, [bandId]);

  const copyInviteCode = () => {
    if (!bandCode || bandCode === '-') return;
    navigator.clipboard.writeText(bandCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // สมาชิกเข้าร่วมวงด้วยรหัส
  const handleJoinBand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    setJoinLoading(true);
    setJoinError('');
    setJoinSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนดำเนินการ');

      const { data: bandData, error: bandFetchError } = await supabase
        .from('bands')
        .select('id, name')
        .eq('invite_code', cleanCode)
        .maybeSingle();

      if (bandFetchError || !bandData) {
        throw new Error(`ไม่พบรหัสวง "${cleanCode}" ในระบบ`);
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          band_id: bandData.id,
          role: 'Band Member',
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setJoinSuccess(`เข้าร่วมวง "${bandData.name}" สำเร็จ...`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setJoinError(err.message || 'เกิดข้อผิดพลาดในการเข้าร่วมวง');
    } finally {
      setJoinLoading(false);
    }
  };

  // สมาชิกสร้างวงดนตรีเอง และอัปเกรดเป็น Band Manager
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

      setIsCreateModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      alert(`สร้างวงไม่สำเร็จ: ${err.message}`);
    } finally {
      setCreatingBand(false);
    }
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerReport.trim() || !bandId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนส่งประกาศ');

      const { error } = await supabase
        .from('band_announcements')
        .insert({
          band_id: bandId,
          author_id: user.id,
          message: managerReport.trim(),
        });

      if (error) throw error;

      setLatestAnnouncement(managerReport.trim());
      setIsSent(true);
      setManagerReport('');
      setTimeout(() => setIsSent(false), 2500);
    } catch (err: any) {
      alert(`บันทึกประกาศไม่สำเร็จ: ${err.message}`);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen w-full bg-[#080d1a] flex flex-col items-center justify-center text-white">
        <Loader2 className={`w-8 h-8 ${roleTheme.spinner} animate-spin mb-3`} />
        <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Loading Band Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#080d1a] text-white flex flex-col pb-24 md:pb-8">
      <TopHeader />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* กรณีที่ 1: ผู้ใช้ยังไม่มีสังกัดวง */}
        {!bandId ? (
          <div className="max-w-xl mx-auto mt-6 sm:mt-12">
            <div className="bg-[#101422] border border-[#1F263B] rounded-[32px] p-6 sm:p-10 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5">
                <div className={`w-16 h-16 rounded-2xl bg-[#181D2E] border border-slate-800 flex items-center justify-center ${roleTheme.accentText} shadow-sm shrink-0`}>
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-[#181D2E] border border-slate-700/60 text-[10px] text-slate-300 font-medium mb-1">
                    <Sparkles className={`w-3 h-3 ${roleTheme.accentText}`} />
                    <span>Solo Practicing Mode</span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white">การจัดการวงดนตรี</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    คุณสามารถเลือกเข้าร่วมวงที่มีอยู่แล้ว หรือสร้างวงใหม่เพื่อเป็นผู้จัดการวง
                  </p>
                </div>
              </div>

              {/* สลับแท็บ */}
              <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs mt-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-2 rounded-xl font-semibold transition ${
                    activeTab === 'join'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  เข้าร่วมวงด้วยรหัส
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-2 rounded-xl font-semibold transition ${
                    activeTab === 'create'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  สร้างวงดนตรีใหม่
                </button>
              </div>

              {joinError && (
                <div className="mt-4 p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{joinError}</span>
                </div>
              )}

              {joinSuccess && (
                <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{joinSuccess}</span>
                </div>
              )}

              {activeTab === 'join' ? (
                <form onSubmit={handleJoinBand} className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      รหัสคำเชิญเข้าวงดนตรี (Band Code)
                    </label>
                    <input
                      type="text"
                      required
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      placeholder="เช่น AXON-1234"
                      className={`w-full uppercase font-mono tracking-widest bg-[#161B2E] border border-[#2B3552] rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none ${roleTheme.borderFocus} transition`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={joinLoading}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition flex items-center justify-center space-x-2"
                  >
                    {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    <span>ยืนยันเข้าร่วมวง</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCreateBand} className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      ตั้งชื่อวงดนตรีของคุณ (Band Name)
                    </label>
                    <input
                      type="text"
                      required
                      value={newBandNameInput}
                      onChange={(e) => setNewBandNameInput(e.target.value)}
                      placeholder="เช่น Bodyslam, The Parkinson"
                      className="w-full bg-[#161B2E] border border-[#2B3552] rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingBand}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition flex items-center justify-center space-x-2"
                  >
                    {creatingBand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                    <span>สร้างวงใหม่และเป็นผู้จัดการ</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* กรณีที่ 2: มีสังกัดวงแล้ว */
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold tracking-tight">วงดนตรี: {bandName || '...'}</h1>
                  {isManager ? (
                    <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 border border-rose-800 text-rose-400">
                      <Crown className="w-3 h-3" />
                      <span>Manager Panel</span>
                    </span>
                  ) : (
                    <span className="text-xs text-sky-400 font-semibold px-2 py-0.5 rounded bg-sky-950 border border-sky-800">
                      Band Member
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-slate-400">รหัสเชิญเข้าวง:</span>
                  <button
                    onClick={copyInviteCode}
                    className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border transition ${roleTheme.codeBg}`}
                  >
                    <span>{bandCode || '...'}</span>
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-70" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {!isManager && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 rounded-xl text-xs text-rose-300 font-medium transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>สร้างวงใหม่ของฉัน</span>
                  </button>
                )}

                <button
                  onClick={fetchBandData}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-300 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMembers ? 'animate-spin' : ''}`} />
                  <span>รีเฟรช</span>
                </button>
              </div>
            </div>

            {/* กระดานประกาศ Realtime */}
            <div className={`border rounded-3xl p-5 mt-6 shadow-sm bg-[#0e1422] ${roleTheme.cardBorder}`}>
              <div className="flex items-start space-x-3">
                <MessageSquare className={`w-5 h-5 shrink-0 mt-0.5 ${roleTheme.boardIcon}`} />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className={`text-sm font-bold ${roleTheme.boardHeader}`}>ประกาศล่าสุดจากวง</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${roleTheme.boardBadge}`}>
                      Realtime
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-2 leading-relaxed bg-[#070b14] p-3.5 rounded-xl border border-slate-800/80 font-light whitespace-pre-line break-words">
                    {latestAnnouncement}
                  </p>
                </div>
              </div>
            </div>

            {/* รายชื่อสมาชิก */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-200 flex items-center space-x-2">
                  <Users className={`w-5 h-5 ${roleTheme.accentText}`} />
                  <span>สมาชิกในวง ({members.length} คน)</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="bg-[#111728] border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition"
                  >
                    <div>
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 rounded-full bg-slate-800 border-2 flex items-center justify-center font-bold text-white text-base overflow-hidden shrink-0 ${
                          member.role === 'Band Manager' ? 'border-rose-800 text-rose-300' : 'border-sky-800 text-sky-300'
                        }`}>
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{member.full_name ? member.full_name.charAt(0).toUpperCase() : 'M'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <h4 className="text-sm font-bold text-white truncate">{member.full_name}</h4>
                            {member.role === 'Band Manager' && (
                              <Crown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate flex items-center space-x-1 mt-0.5">
                            <Music2 className={`w-3 h-3 ${member.role === 'Band Manager' ? 'text-rose-400' : 'text-sky-400'}`} />
                            <span>{member.instrument}</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">บทบาท:</span>
                          <span className={`font-semibold ${member.role === 'Band Manager' ? 'text-rose-400' : 'text-sky-400'}`}>
                            {member.role}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">เข้าร่วมเมื่อ:</span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {new Date(member.created_at).toLocaleDateString('th-TH')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isManager && member.role !== 'Band Manager' && (
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono">ID: {member.id.slice(0, 6)}...</span>
                        <button
                          onClick={() => router.push(`/stack?memberId=${member.id}`)}
                          className="p-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center space-x-1 transition"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>ตรวจคลิปซ้อม</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ส่งประกาศ */}
            {isManager && (
              <div className="bg-[#111728] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm mt-8">
                <h3 className="text-base font-bold text-slate-200 mb-2 flex items-center space-x-2">
                  <Send className="w-4 h-4 text-rose-500" />
                  <span>ส่งประกาศถึงสมาชิกในวง</span>
                </h3>
                <form onSubmit={handleSendReport} className="space-y-3">
                  <textarea
                    rows={3}
                    required
                    value={managerReport}
                    onChange={(e) => setManagerReport(e.target.value)}
                    placeholder="พิมพ์ประกาศถึงลูกวงที่นี่..."
                    className="w-full bg-[#182235] border border-slate-700/80 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-rose-500 transition placeholder-slate-500 resize-y"
                  />
                  <div className="flex items-center justify-between pt-1">
                    {isSent ? (
                      <span className="text-xs text-emerald-400 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ส่งประกาศเรียบร้อย!</span>
                      </span>
                    ) : <div />}
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>ส่งประกาศ</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal สร้างวงดนตรีใหม่ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#101422] border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-rose-400" />
                <span>สร้างวงดนตรีใหม่</span>
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
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
                  placeholder="เช่น Bodyslam, Slot Machine"
                  className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                เมื่อสร้างวงใหม่แล้ว ระบบจะเปลี่ยนบทบาทของคุณเป็นผู้จัดการวงทันที
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