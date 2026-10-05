'use client';

import React, { useState, useEffect, Suspense } from 'react';
import TopHeader from '@/components/TopHeader';
import BottomNav from '@/components/BottomNav';
import SmartHighlightsModal from '@/components/SmartHighlightsModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  AlertTriangle, 
  MessageSquare, 
  PlayCircle, 
  Crown, 
  User, 
  Send, 
  Check, 
  Loader2, 
  BarChart2,
  RefreshCw,
  TrendingUp,
  Trash2,
  X,
  CheckCircle2
} from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { supabase } from '@/lib/supabaseClient';

interface PracticeSession {
  id: string;
  user_id: string;
  band_id: string | null;
  title: string;
  session_title?: string;
  bpm: number;
  key_signature: string;
  media_url: string | null;
  media_type: string;
  accuracy?: number | null;
  accuracy_score?: number | null;
  bpm_stability?: number | null;
  practice_duration?: number | null;
  duration_seconds?: number | null;
  flagged_errors_count: number | null;
  manager_note: string | null;
  status: string;
  created_at: string;
}

interface SmartHighlight {
  id: string;
  session_id: string;
  timestamp_str: string;
  timestamp_seconds: number;
  time_seconds?: number;
  error_type: string;
  description: string;
}

interface MemberOption {
  id: string;
  full_name: string;
  instrument: string;
}

function PracticeStackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get('sessionId');
  const urlMemberId = searchParams.get('memberId');
  const { isManager, bandId, userName } = useUserRole();

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(urlMemberId || '');

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<PracticeSession | null>(null);
  const [highlights, setHighlights] = useState<SmartHighlight[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  // สถานะการลบรอบซ้อม (Custom Confirm Modal)
  const [deletingSession, setDeletingSession] = useState<PracticeSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // การแจ้งเตือนสถานะแบบกำหนดเอง (Custom Toast Notification)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [managerNoteInput, setManagerNoteInput] = useState('');
  const [isNoteUpdated, setIsNoteUpdated] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const roleTheme = isManager
    ? {
        primaryBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm',
        accentText: 'text-rose-400',
        badge: 'bg-rose-950/80 border-rose-800 text-rose-300',
        cardBorder: 'border-rose-900/50',
        highlightBorder: 'border-rose-900/60 hover:border-rose-700/80',
        highlightBadge: 'bg-rose-950/80 text-rose-300 border-rose-800',
        highlightBtn: 'hover:bg-rose-950/40 border-slate-700 hover:border-rose-800 text-rose-300',
        spinner: 'text-rose-500',
        chartLine: '#f43f5e',
      }
    : {
        primaryBtn: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-sm',
        accentText: 'text-sky-400',
        badge: 'bg-sky-950/80 border-sky-800 text-sky-300',
        cardBorder: 'border-sky-900/50',
        highlightBorder: 'border-sky-900/60 hover:border-sky-700/80',
        highlightBadge: 'bg-sky-950/80 text-sky-300 border-sky-800',
        highlightBtn: 'hover:bg-sky-950/40 border-slate-700 hover:border-sky-800 text-sky-300',
        spinner: 'text-sky-400',
        chartLine: '#0ea5e9',
      };

  useEffect(() => {
    if (urlMemberId) {
      setSelectedMemberId(urlMemberId);
    }
  }, [urlMemberId]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!isManager || !bandId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, instrument')
          .eq('band_id', bandId);

        if (error) throw error;

        if (data && data.length > 0) {
          setMembers(data);

          if (urlMemberId && data.some((m) => m.id === urlMemberId)) {
            setSelectedMemberId(urlMemberId);
          } else if (!selectedMemberId || !data.some((m) => m.id === selectedMemberId)) {
            setSelectedMemberId(data[0].id);
          }
        }
      } catch (err: any) {
        console.error('Fetch members error:', err.message);
      }
    };
    fetchMembers();
  }, [isManager, bandId, urlMemberId]);

  const fetchSessions = async (keepSelection = true) => {
    if (!keepSelection) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetMemberId = isManager ? (selectedMemberId || urlMemberId) : null;
      if (isManager && !targetMemberId) {
        setLoading(false);
        return;
      }

      let query = supabase.from('practice_sessions').select('*');

      if (isManager && targetMemberId) {
        query = query.eq('user_id', targetMemberId);
      } else if (bandId) {
        query = query.or(`user_id.eq.${user.id},and(band_id.eq.${bandId},session_scope.eq.band)`);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const sessionList: PracticeSession[] = data || [];
      setSessions(sessionList);

      if (sessionList.length > 0) {
        if (selectedSession && sessionList.some((s) => s.id === selectedSession.id)) {
          const current = sessionList.find((s) => s.id === selectedSession.id);
          setSelectedSession(current || sessionList[0]);
        } else if (urlSessionId) {
          const matched = sessionList.find((s) => s.id === urlSessionId);
          setSelectedSession(matched || sessionList[0]);
        } else {
          setSelectedSession(sessionList[0]);
        }
      } else {
        setSelectedSession(null);
      }
    } catch (err: any) {
      console.error('Fetch sessions error:', err.message);
    } finally {
      if (!keepSelection) setLoading(false);
    }
  };

  useEffect(() => {
    if (isManager && !selectedMemberId && !urlMemberId) return;
    fetchSessions(false);
  }, [selectedMemberId, isManager, urlSessionId, urlMemberId]);

  useEffect(() => {
    if (!selectedSession?.id) return;

    const sessionChannel = supabase
      .channel(`realtime:practice_session:${selectedSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'practice_sessions',
          filter: `id=eq.${selectedSession.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setSelectedSession((prev) => (prev ? { ...prev, ...payload.new } : payload.new));
            setSessions((prev) =>
              prev.map((s) => (s.id === payload.new.id ? { ...s, ...payload.new } : s))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [selectedSession?.id]);

  useEffect(() => {
    const fetchHighlights = async () => {
      if (!selectedSession?.id) {
        setHighlights([]);
        return;
      }
      const { data, error } = await supabase
        .from('smart_highlights')
        .select('*')
        .eq('session_id', selectedSession.id);

      if (!error && data) {
        const normalized: SmartHighlight[] = data.map((h: any) => ({
          id: h.id,
          session_id: h.session_id,
          timestamp_str: h.timestamp_str,
          timestamp_seconds: Number(h.time_seconds ?? h.timestamp_seconds ?? 0),
          time_seconds: Number(h.time_seconds ?? h.timestamp_seconds ?? 0),
          error_type: h.error_type,
          description: h.description,
        })).sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

        setHighlights(normalized);
      }
    };

    fetchHighlights();
  }, [selectedSession?.id, selectedSession?.status]);

  useEffect(() => {
    setManagerNoteInput('');
  }, [selectedSession?.id]);

  const handleSaveManagerNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession?.id || !managerNoteInput.trim()) return;

    setSavingNote(true);
    try {
      const cleanNote = managerNoteInput.trim();
      const { data, error } = await supabase
        .from('practice_sessions')
        .update({ manager_note: cleanNote })
        .eq('id', selectedSession.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('ไม่สามารถบันทึกได้เนื่องจากสิทธิ์ RLS ของฐานข้อมูล');
      }

      setSelectedSession((prev) => prev ? { ...prev, manager_note: cleanNote } : null);
      setManagerNoteInput('');
      setIsNoteUpdated(true);
      setTimeout(() => setIsNoteUpdated(false), 2000);
      showToast('บันทึกคำแนะนำเรียบร้อยแล้ว', 'success');
    } catch (err: any) {
      showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setSavingNote(false);
    }
  };

  // ฟังก์ชันลบรอบซ้อมและไฟล์สื่อใน Storage
  const handleConfirmDelete = async () => {
    if (!deletingSession) return;
    setIsDeleting(true);

    try {
      // 1. ลบไฟล์สื่อออกจาก Storage Bucket 'practice-recordings'
      if (deletingSession.media_url) {
        try {
          const urlParts = deletingSession.media_url.split('/practice-recordings/');
          if (urlParts.length > 1) {
            const storagePath = decodeURIComponent(urlParts[1]);
            await supabase.storage.from('practice-recordings').remove([storagePath]);
          }
        } catch (storageErr) {
          console.warn('ลบไฟล์ใน Storage ไม่สำเร็จ:', storageErr);
        }
      }

      // 2. ลบจุด Highlight ในตาราง smart_highlights
      await supabase.from('smart_highlights').delete().eq('session_id', deletingSession.id);

      // 3. ลบรอบซ้อมออกจากตาราง practice_sessions
      const { error } = await supabase.from('practice_sessions').delete().eq('id', deletingSession.id);
      if (error) throw error;

      // 4. อัปเดตรายการบนหน้าจอ
      const updatedList = sessions.filter((s) => s.id !== deletingSession.id);
      setSessions(updatedList);
      if (selectedSession?.id === deletingSession.id) {
        setSelectedSession(updatedList.length > 0 ? updatedList[0] : null);
      }

      setDeletingSession(null);
      showToast('ลบรอบซ้อมและไฟล์สื่อออกจากระบบเรียบร้อยแล้ว', 'success');
    } catch (err: any) {
      showToast(`ลบไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openHighlight = (id: string) => {
    setSelectedHighlightId(id);
    setIsModalOpen(true);
  };

  const chartSessions = [...sessions]
    .filter((s) => s.accuracy_score !== null || s.accuracy !== null)
    .slice(0, 6)
    .reverse();

  const selectedMemberName = members.find((m) => m.id === selectedMemberId)?.full_name;
  const currentAccuracy = selectedSession?.accuracy_score ?? selectedSession?.accuracy ?? null;
  const currentDuration = selectedSession?.practice_duration ?? selectedSession?.duration_seconds ?? 0;

  return (
    <div className="min-h-screen w-full bg-[#080d1a] text-white flex flex-col pb-24 md:pb-10">
      <TopHeader />

      {/* แจ้งเตือนสถานะการทำงาน (Custom Toast Notification) */}
      {toast && (
        <div 
          className="fixed top-5 right-5 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200"
          style={{
            backgroundColor: toast.type === 'success' ? '#062817ee' : '#2a0b12ee',
            borderColor: toast.type === 'success' ? '#10b98188' : '#f43f5e88',
            color: toast.type === 'success' ? '#6ee7b7' : '#fda4af'
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            className="ml-2 text-slate-400 hover:text-white p-0.5 rounded-lg transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        
        {/* Header แถบบน */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Music Practice Stack</h1>
              {isManager && (
                <span className="text-[10px] bg-rose-950 border border-rose-800 text-rose-300 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  <Crown className="w-3 h-3 text-rose-400" />
                  <span>Manager Audit Mode</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isManager 
                ? `ตรวจสอบและประเมินผลการซ้อมของ ${selectedMemberName || 'สมาชิกในวง'}`
                : `ประวัติการซ้อมของ ${userName}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ตัวเลือกลูกวงสำหรับ Manager */}
            {isManager && members.length > 0 && (
              <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
                <User className="w-3.5 h-3.5 text-rose-400" />
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedMemberId(newId);
                    router.replace(`/stack?memberId=${newId}`);
                  }}
                  className="bg-transparent text-white focus:outline-none cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#0f1422]">
                      {m.full_name} ({m.instrument})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ตัวเลือกรอบซ้อม พร้อมปุ่มลบรอบซ้อม */}
            {sessions.length > 0 && (
              <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-1 py-1 text-xs">
                <span className="text-slate-400">รอบซ้อม:</span>
                <select
                  value={selectedSession?.id || ''}
                  onChange={(e) => {
                    const found = sessions.find((s) => s.id === e.target.value);
                    if (found) setSelectedSession(found);
                  }}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer max-w-[170px] truncate mr-1"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#0f1422]">
                      {s.title || s.session_title || 'รอบซ้อม'} ({new Date(s.created_at).toLocaleDateString('th-TH')})
                    </option>
                  ))}
                </select>

                {/* ปุ่มถังขยะลบรอบซ้อมที่เลือก */}
                {selectedSession && (
                  <button
                    type="button"
                    onClick={() => setDeletingSession(selectedSession)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title="ลบรอบซ้อมและไฟล์สื่อนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => fetchSessions(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-300 transition"
              title="รีเฟรชข้อมูลสถิติ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>รีเฟรช</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className={`w-7 h-7 ${roleTheme.spinner} animate-spin mb-3`} />
            <p className="text-xs text-slate-400 font-mono">กำลังดึงข้อมูลสถิติการซ้อมจริง...</p>
          </div>
        ) : !selectedSession ? (
          <div className="p-10 bg-[#0f1422] border border-dashed border-slate-800 rounded-2xl text-center flex flex-col items-center">
            <BarChart2 className="w-10 h-10 text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">ยังไม่มีประวัติการซ้อม</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {isManager 
                ? `สมาชิกท่านนี้ (${selectedMemberName || 'ลูกวง'}) ยังไม่ได้อัดคลิปการเล่นเข้าสู่ระบบ`
                : 'เริ่มต้นบันทึกการเล่นของคุณได้ที่เมนู "ห้องซ้อม" เพื่อให้ระบบ AI ทำการประมวลผลสถิติ'}
            </p>
          </div>
        ) : (
          <>
            {selectedSession.status === 'pending_analysis' && (
              <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">ระบบ AI กำลังประมวลผลสัญญาณเสียง...</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      กำลังเปรียบเทียบคลื่นเสียง Onsets ภายใต้เกณฑ์ ±100 ms หน้านี้จะอัปเดตคะแนนอัตโนมัติแบบ Realtime เมื่อเสร็จสิ้น
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* การ์ดสถิติ 4 ช่อง */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#0f1422] border border-slate-800 rounded-xl p-4">
                <span className="text-[11px] text-slate-400">ความแม่นยำ (Accuracy)</span>
                <h3 className={`text-2xl font-black ${roleTheme.accentText} font-mono mt-1`}>
                  {currentAccuracy !== null ? `${Number(currentAccuracy).toFixed(1)}%` : 'รอผล AI'}
                </h3>
                <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                  BPM: {selectedSession.bpm} | Key: {selectedSession.key_signature}
                </span>
              </div>

              <div className="bg-[#0f1422] border border-slate-800 rounded-xl p-4">
                <span className="text-[11px] text-slate-400">เวลาซ้อมรอบนี้</span>
                <h3 className="text-2xl font-black text-white font-mono mt-1">
                  {currentDuration > 0 ? `${Math.round(currentDuration / 60)}` : '0'} 
                  <span className="text-xs font-normal text-slate-400 ml-1">นาที</span>
                </h3>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  รูปแบบ: {selectedSession.media_type === 'video' ? 'วิดีโอ & เสียง' : 'เสียง'}
                </span>
              </div>

              <div className="bg-[#0f1422] border border-slate-800 rounded-xl p-4">
                <span className="text-[11px] text-slate-400">ความเสถียรจังหวะ (BPM Stability)</span>
                <h3 className="text-2xl font-black text-emerald-400 font-mono mt-1">
                  {selectedSession.bpm_stability != null ? `${Number(selectedSession.bpm_stability).toFixed(1)}%` : 'รอประมวลผล'}
                </h3>

                <span className="text-[10px] text-slate-500 mt-0.5 block">เกณฑ์ Onset บวกลบ 100ms</span>
              </div>

              <div className="bg-[#0f1422] border border-slate-800 rounded-xl p-4">
                <span className="text-[11px] text-slate-400">จุดบกพร่องที่ตรวจพบ</span>
                <h3 className="text-2xl font-black text-amber-400 font-mono mt-1">
                  {highlights.length} <span className="text-xs font-normal text-slate-400">จุด</span>
                </h3>
                <span className="text-[10px] text-amber-400/80 mt-0.5 block">
                  {highlights.length > 0 ? 'มี Smart Highlights ให้ตรวจสอบ' : 'ไม่มีจุดหลุดจังหวะ'}
                </span>
              </div>
            </div>

            {/* กราฟแนวโน้มพัฒนาการความแม่นยำ (Trend Graph) */}
            <div className="bg-[#0f1422] border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <TrendingUp className={`w-4 h-4 ${roleTheme.accentText}`} />
                  <h3 className="text-xs sm:text-sm font-bold text-white">แนวโน้มพัฒนาการความแม่นยำ (Trend Progress)</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">คะแนนย้อนหลัง {chartSessions.length} รอบล่าสุด</span>
              </div>

              <div className="h-44 sm:h-52 w-full pt-3">
                {chartSessions.length > 1 ? (
                  <div className="w-full h-full flex flex-col justify-between">
                    <div className="flex-1 relative">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={roleTheme.chartLine} stopOpacity="0.35" />
                            <stop offset="100%" stopColor={roleTheme.chartLine} stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {[15, 40, 65, 90, 115].map((y, idx) => (
                          <line key={idx} x1="0" y1={y} x2="500" y2={y} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.8" />
                        ))}

                        {(() => {
                          const points = chartSessions.map((s, idx) => {
                            const x = (idx / (chartSessions.length - 1)) * 500;
                            const scoreNum = Number(s.accuracy_score ?? s.accuracy ?? 0);
                            const score = Math.max(0, Math.min(100, scoreNum));
                            const y = 115 - (score / 100) * 95;
                            return `${x},${y}`;
                          });
                          const areaD = `M 0,120 L ${points.join(' L ')} L 500,120 Z`;
                          const lineD = `M ${points.join(' L ')}`;
                          return (
                            <>
                              <path d={areaD} fill="url(#trendGradient)" />
                              <path d={lineD} fill="none" stroke={roleTheme.chartLine} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </>
                          );
                        })()}

                        {chartSessions.map((s, idx) => {
                          const x = (idx / (chartSessions.length - 1)) * 500;
                          const scoreNum = Number(s.accuracy_score ?? s.accuracy ?? 0);
                          const score = Math.max(0, Math.min(100, scoreNum));
                          const y = 115 - (score / 100) * 95;
                          return (
                            <g key={s.id}>
                              <circle cx={x} cy={y} r="4.5" fill="#0f1422" stroke={roleTheme.chartLine} strokeWidth="2.5" />
                              <text x={x} y={y - 7} fill="#cbd5e1" fontSize="9" textAnchor="middle" fontFamily="monospace">
                                {score.toFixed(0)}%
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/60">
                      {chartSessions.map((s, idx) => (
                        <span key={s.id}>รอบที่ {idx + 1}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-slate-500">ต้องมีประวัติการซ้อมที่วิเคราะห์แล้วอย่างน้อย 2 รอบขึ้นไปเพื่อพล็อตกราฟเปรียบเทียบแนวโน้ม</p>
                  </div>
                )}
              </div>
            </div>

            {/* Smart Highlights */}
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-slate-200">
                จุดที่ควรแก้ไขในรอบนี้ (Actionable Errors)
              </h2>

              {highlights.length === 0 ? (
                <div className="p-6 bg-[#0f1422] border border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-slate-400">
                    {selectedSession.status === 'pending_analysis'
                      ? 'กำลังรอการวิเคราะห์จุดบกพร่องจาก AI Engine...'
                      : 'ไม่พบจุดบกพร่องที่คลาดเคลื่อนเกินเกณฑ์ ±100 ms ในเซสชันนี้'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {highlights.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-[#0f1422] border ${roleTheme.highlightBorder} rounded-xl p-4 flex flex-col justify-between space-y-3 transition`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${roleTheme.highlightBadge}`}>
                              {item.timestamp_str}
                            </span>
                            <h4 className={`text-xs font-bold ${roleTheme.accentText}`}>{item.error_type}</h4>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => openHighlight(item.id)}
                        className={`w-full py-2 bg-slate-900 border rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition ${roleTheme.highlightBtn}`}
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>เปิดตรวจในคลิป (Smart Highlight)</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* คำแนะนำจาก Manager */}
            <div className="bg-[#0f1422] border border-amber-900/50 rounded-xl p-4 sm:p-5 space-y-3.5">
              <div className="flex items-start space-x-2.5">
                <MessageSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-bold text-amber-300">คำแนะนำจากผู้จัดการวง</h4>
                  </div>
                  <div className="text-xs text-slate-300 mt-2 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 min-h-[44px] whitespace-pre-line break-words leading-relaxed font-light">
                    {selectedSession.manager_note || 'ยังไม่มีคำแนะนำสำหรับเซสชันนี้'}
                  </div>
                </div>
              </div>

              {isManager && (
                <form onSubmit={handleSaveManagerNote} className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <label className="text-[11px] text-slate-400 block font-medium">
                    เขียนหรือแก้ไขข้อเสนอแนะสำหรับเซสชันนี้:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={managerNoteInput}
                    onChange={(e) => setManagerNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.stopPropagation();
                      }
                    }}
                    placeholder="พิมพ์คำแนะนำ หรือกด Shift + Enter เพื่อขึ้นบรรทัดใหม่..."
                    className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 transition placeholder-slate-500 whitespace-pre-wrap resize-y"
                  />
                  <div className="flex items-center justify-between pt-1">
                    {isNoteUpdated ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        <span>บันทึกคำแนะนำลงฐานข้อมูลเรียบร้อย</span>
                      </span>
                    ) : <div />}
                    <button
                      type="submit"
                      disabled={savingNote}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 rounded-xl text-xs font-semibold text-white transition flex items-center space-x-1.5 shadow-sm ml-auto"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{savingNote ? 'กำลังส่ง...' : 'บันทึกคำแนะนำ'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}

      </main>

      {/* Modal ยืนยันการลบรอบซ้อม (Custom Confirm Modal) */}
      {deletingSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f1422] border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white tracking-tight">ยืนยันการลบรอบซ้อม</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                คุณต้องการลบรอบซ้อม <span className="text-rose-300 font-semibold">"{deletingSession.title || deletingSession.session_title}"</span> และไฟล์สื่อบันทึกทั้งหมดออกจากระบบใช่หรือไม่?
              </p>
              <p className="text-[11px] text-slate-500">
                ไฟล์เสียง/วิดีโอและข้อมูลสถิติที่เกี่ยวข้องจะถูกลบออกจาก Storage ทันที
              </p>
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingSession(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ยืนยันลบ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && selectedSession && (
        <SmartHighlightsModal
          session={selectedSession}
          highlights={highlights}
          initialHighlightId={selectedHighlightId}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}

export default function PracticeStackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-[#080d1a] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-3" />
      </div>
    }>
      <PracticeStackContent />
    </Suspense>
  );
}