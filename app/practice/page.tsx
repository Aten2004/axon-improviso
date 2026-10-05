'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import TopHeader from '@/components/TopHeader';
import BottomNav from '@/components/BottomNav';
import OnboardingModal from '@/components/OnboardingModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Edit2, 
  UploadCloud, 
  RefreshCw, 
  Square, 
  Minus, 
  Plus, 
  Loader2, 
  Crown, 
  Users, 
  User, 
  Music2
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useUserRole } from '@/lib/useUserRole';

function PracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isManager, bandId, role, loading: roleLoading } = useUserRole();

  // รับค่าเพลงที่ส่งต่อมาจากหน้าคลังเพลง (/songs)
  const paramSongId = searchParams.get('songId');
  const paramSong = searchParams.get('song');
  const paramBpm = searchParams.get('bpm');
  const paramKey = searchParams.get('key');

  const [mode, setMode] = useState<'audio' | 'video' | 'upload'>('audio');
  
  // ตั้งชื่อเพลงตามที่เลือกมาจากคลังเพลง หรือเว้นว่างเพื่อให้ระบบตั้งชื่ออัตโนมัติ
  const [sessionTitle, setSessionTitle] = useState(paramSong || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // ขอบเขตการซ้อม: ซ้อมรวมวง (Band) กับ ซ้อมเดี่ยว (Personal)
  const [rehearsalScope, setRehearsalScope] = useState<'band' | 'personal'>('personal');

  // ชุดสีตามบทบาท: Manager (แดงกุหลาบ / Rose) vs Member (ฟ้าสดใส / Sky Blue)
  const roleTheme = isManager
    ? {
        recordBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm',
        recordRing: 'bg-rose-700 ring-4 ring-rose-500/50 shadow-sm',
        waveActive: 'bg-rose-500',
        accentText: 'text-rose-400',
        accentBg: 'bg-rose-500',
        borderFocus: 'border-rose-500',
        scopeBorder: 'border-rose-900/60',
        scopeBtnActive: 'bg-rose-600 text-white shadow-sm',
        spinner: 'text-rose-500',
      }
    : {
        recordBtn: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-sm',
        recordRing: 'bg-sky-600 ring-4 ring-sky-400/50 shadow-sm',
        waveActive: 'bg-sky-400',
        accentText: 'text-sky-400',
        accentBg: 'bg-sky-400',
        borderFocus: 'border-sky-500',
        scopeBorder: 'border-sky-900/60',
        scopeBtnActive: 'bg-sky-500 text-slate-950 font-bold shadow-sm',
        spinner: 'text-sky-400',
      };

  useEffect(() => {
    if (isManager && bandId) {
      setRehearsalScope('band');
    } else {
      setRehearsalScope('personal');
    }
  }, [isManager, bandId]);

  // Metronome & Key Controls (BPM อิสระ)
  const [bpm, setBpm] = useState(paramBpm ? Number(paramBpm) : 120);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [keyRoot, setKeyRoot] = useState(paramKey || 'C');
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // คืนทรัพยากรกล้องและไมโครโฟนเมื่อออกจากหน้าเว็บ
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // อัปเดตข้อมูลเมื่อเปลี่ยนค่า Query Parameter
  useEffect(() => {
    if (paramSong) setSessionTitle(paramSong);
    if (paramBpm) setBpm(Number(paramBpm));
    if (paramKey) setKeyRoot(paramKey);
  }, [paramSong, paramBpm, paramKey]);

  // Metronome Audio Engine
  useEffect(() => {
    let intervalId: any;
    if (isMetronomeOn) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const safeBpm = bpm > 0 ? bpm : 120;
      const intervalMs = (60 / safeBpm) * 1000;
      intervalId = setInterval(() => {
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
          try {
            const osc = audioContextRef.current.createOscillator();
            const gain = audioContextRef.current.createGain();
            osc.connect(gain);
            gain.connect(audioContextRef.current.destination);
            osc.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
            gain.gain.setValueAtTime(0.25, audioContextRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.05);
            osc.start();
            osc.stop(audioContextRef.current.currentTime + 0.06);
          } catch (e) {
            console.error('Metronome error:', e);
          }
        }
      }, intervalMs);
    }
    return () => clearInterval(intervalId);
  }, [isMetronomeOn, bpm]);

  // Timer Counter
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setTimer((prev) => prev + 1), 10);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTimer = (cents: number) => {
    const totalSeconds = Math.floor(cents / 100);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    const ms = String(cents % 100).padStart(2, '0');
    return `${mm}:${ss}.${ms}`;
  };

  // บันทึกไฟล์ อัปโหลด Storage และบันทึกลงตาราง practice_sessions
  const handleSaveAndUpload = async (
    mediaBlob: Blob, 
    mediaType: 'audio' | 'video',
    uploadedDuration?: number
  ) => {
    setIsUploading(true);
    setUploadProgressText('กำลังเชื่อมต่อระบบจัดเก็บข้อมูล...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      }

      // ดึงนามสกุลไฟล์จริง
      let fileExtension = mediaType === 'video' ? 'webm' : 'wav';
      if (mediaBlob instanceof File && mediaBlob.name) {
        const ext = mediaBlob.name.split('.').pop()?.toLowerCase();
        if (ext) fileExtension = ext;
      } else if (mediaBlob.type) {
        if (mediaBlob.type.includes('mp4')) fileExtension = 'mp4';
        else if (mediaBlob.type.includes('mp3') || mediaBlob.type.includes('mpeg')) fileExtension = 'mp3';
        else if (mediaBlob.type.includes('wav')) fileExtension = 'wav';
        else if (mediaBlob.type.includes('webm')) fileExtension = 'webm';
      }
      
      let storagePath = '';
      if (rehearsalScope === 'band' && bandId) {
        storagePath = `band/${bandId}/${Date.now()}_band_rehearsal.${fileExtension}`;
      } else {
        storagePath = `members/${user.id}/${Date.now()}_practice.${fileExtension}`;
      }

      setUploadProgressText('กำลังอัปโหลดไฟล์บันทึกการซ้อม...');
      
      const { error: uploadError } = await supabase.storage
        .from('practice-recordings')
        .upload(storagePath, mediaBlob, {
          contentType: mediaBlob.type || (mediaType === 'video' ? `video/${fileExtension}` : `audio/${fileExtension}`),
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`[Storage Error] ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('practice-recordings')
        .getPublicUrl(storagePath);

      setUploadProgressText('กำลังบันทึกข้อมูลเข้าฐานข้อมูล...');

      // ระบบสร้างชื่อรอบซ้อมอัตโนมัติหากไม่ได้กรอกไว้
      let cleanTitle = sessionTitle.trim();
      if (!cleanTitle || cleanTitle === 'ซ้อมดนตรีอิสระ') {
        if (paramSong) {
          cleanTitle = paramSong;
        } else if (mediaBlob instanceof File && mediaBlob.name) {
          cleanTitle = mediaBlob.name.replace(/\.[^/.]+$/, "");
        } else {
          const now = new Date();
          const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
          const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          cleanTitle = `รอบซ้อม (${dateStr} ${timeStr})`;
        }
      }

      const durationSeconds = uploadedDuration !== undefined && uploadedDuration > 0
        ? uploadedDuration
        : Math.max(1, Math.round(timer / 100));

      const { data: sessionData, error: sessionError } = await supabase
        .from('practice_sessions')
        .insert({
          user_id: user.id,
          band_id: bandId || null,
          song_id: paramSongId || null,
          title: cleanTitle,
          session_title: cleanTitle,
          bpm: Number(bpm) || 120,
          key_signature: keyRoot || 'C',
          media_url: publicUrl,
          media_type: mediaType, // ล็อกตาม CHECK constraint ('audio' หรือ 'video')
          practice_duration: durationSeconds,
          duration_seconds: durationSeconds,
          session_scope: rehearsalScope,
          is_band_rehearsal: rehearsalScope === 'band',
          status: 'pending_analysis',
        })
        .select('id')
        .single();

      if (sessionError) {
        throw new Error(`[Database Error] ${sessionError.message}`);
      }

      router.push(`/stack?sessionId=${sessionData.id}`);

    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  };

  const handleStartStopRecord = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === 'video',
        });
        streamRef.current = stream;

        if (videoRef.current && mode === 'video') {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        const mimeType = mode === 'video' ? 'video/webm;codecs=vp8,opus' : 'audio/webm;codecs=opus';
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        });

        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
          }

          const blob = new Blob(recordedChunksRef.current, {
            type: mode === 'video' ? 'video/webm' : 'audio/webm',
          });

          await handleSaveAndUpload(blob, mode === 'video' ? 'video' : 'audio');
        };

        mediaRecorder.start(1000);
        setIsRecording(true);
      } catch (err) {
        alert('กรุณาอนุญาตการเข้าถึงกล้องและไมโครโฟนบนเบราว์เซอร์เพื่อเริ่มการบันทึก');
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  const shiftKey = (direction: 'prev' | 'next') => {
    const currentIndex = keys.indexOf(keyRoot);
    if (direction === 'prev') {
      setKeyRoot(keys[(currentIndex - 1 + keys.length) % keys.length]);
    } else {
      setKeyRoot(keys[(currentIndex + 1) % keys.length]);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#080b14] text-white flex flex-col pb-24 md:pb-10">
      <TopHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* แถบหัว Session และ สลับโหมด */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center space-x-2">
            {isEditingTitle ? (
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                autoFocus
                placeholder="ระบุชื่อรอบซ้อม หรือเว้นว่างเพื่อรันวัน-เวลา..."
                className={`bg-slate-800 text-base sm:text-lg font-bold px-2.5 py-1 rounded-lg border ${roleTheme.borderFocus} outline-none w-72 sm:w-80`}
              />
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">เพลง:</span>
                <h1 className="text-base sm:text-lg font-bold text-white">
                  {sessionTitle || (paramSong ? paramSong : 'ซ้อมดนตรีอิสระ')}
                </h1>
                <button 
                  onClick={() => setIsEditingTitle(true)} 
                  className="text-slate-500 hover:text-slate-300 p-1"
                  title="แก้ไขชื่อรอบซ้อม"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900 p-1 rounded-xl flex border border-slate-800 text-xs">
            {(['audio', 'video', 'upload'] as const).map((m) => (
              <button
                key={m}
                onClick={() => !isRecording && setMode(m)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 font-medium rounded-lg capitalize transition ${
                  mode === m ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'video' ? 'Audio & Video' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Layout หลัก: หน้าจอมอนิเตอร์ + แผงควบคุม */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ฝั่งซ้าย: จอมอนิเตอร์การซ้อม */}
          <div className="lg:col-span-8 flex flex-col items-center">
            <div className="w-full bg-[#0d1220] rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-between min-h-[320px] sm:min-h-[380px]">
              
              {/* Audio Mode */}
              <div className="w-full flex-1 flex flex-col items-center justify-center">
                {mode === 'audio' && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="flex items-center space-x-1.5 h-16 sm:h-20">
                      {[30, 55, 25, 75, 45, 90, 30, 65, 40, 85, 30, 50, 70, 40, 80].map((h, i) => (
                        <div
                          key={i}
                          className={`w-1.5 rounded-full transition-all duration-200 ${
                            isRecording ? roleTheme.waveActive : 'bg-slate-700'
                          }`}
                          style={{ height: isRecording ? `${h}%` : '25%' }}
                        />
                      ))}
                    </div>
                    <div className="text-3xl sm:text-4xl font-mono font-bold text-slate-100 tracking-wider">
                      {formatTimer(timer)}
                    </div>
                  </div>
                )}

                {/* Video Mode */}
                {mode === 'video' && (
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800">
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    <button className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-lg text-white">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <div className={`absolute top-3 left-3 font-mono text-xs bg-black/60 px-2.5 py-1 rounded-md ${roleTheme.accentText} font-semibold flex items-center space-x-1.5`}>
                      <span className={`w-2 h-2 ${roleTheme.accentBg} rounded-full animate-ping`} />
                      <span>{formatTimer(timer)}</span>
                    </div>
                  </div>
                )}

                {/* Upload Mode */}
                {mode === 'upload' && (
                  <label className="flex flex-col items-center justify-center w-full py-12 border-2 border-dashed border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800/20 transition text-center px-4">
                    <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-200">แตะเพื่อเลือกไฟล์เสียงหรือวิดีโอ</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">รองรับ MP4, MOV, MP3, WAV (ไม่เกิน 50 MB)</p>
                    <input
                      type="file"
                      accept="audio/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 50 * 1024 * 1024) {
                            alert('ขนาดไฟล์เกิน 50 MB กรุณาตัดไฟล์ให้สั้นลง');
                            return;
                          }
                          const isVideo = file.type.startsWith('video');
                          const mediaEl = document.createElement(isVideo ? 'video' : 'audio');
                          mediaEl.preload = 'metadata';
                          mediaEl.src = URL.createObjectURL(file);
                          
                          mediaEl.onloadedmetadata = () => {
                            URL.revokeObjectURL(mediaEl.src);
                            const actualDuration = Math.round(mediaEl.duration || 0);
                            handleSaveAndUpload(file, isVideo ? 'video' : 'audio', actualDuration);
                          };

                          mediaEl.onerror = () => {
                            URL.revokeObjectURL(mediaEl.src);
                            handleSaveAndUpload(file, isVideo ? 'video' : 'audio', 0);
                          };
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {/* ปุ่มควบคุมการบันทึก */}
              {mode !== 'upload' && (
                <div className="w-full pt-4 flex flex-col items-center border-t border-slate-800/80">
                  <button
                    onClick={handleStartStopRecord}
                    disabled={isUploading}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      isRecording ? roleTheme.recordRing : roleTheme.recordBtn
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-5 h-5 fill-white text-white" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white" />
                    )}
                  </button>
                  <span className="text-[11px] text-slate-400 mt-2 font-medium">
                    {isRecording 
                      ? 'กดเพื่อหยุดและส่งขึ้นวิเคราะห์' 
                      : isManager 
                        ? 'กดปุ่มเพื่อเริ่มบันทึก (Manager)' 
                        : 'กดปุ่มเพื่อเริ่มบันทึก (Member)'}
                  </span>
                </div>
              )}

            </div>
          </div>

          {/* ฝั่งขวา: แผงควบคุม BPM, Scope และ Key Tuning */}
          <div className="lg:col-span-4 w-full space-y-4">
            
            {/* สวิตช์สลับโหมดเฉพาะผู้จัดการวง */}
            {isManager && bandId && (
              <div className={`bg-[#0d1220] border ${roleTheme.scopeBorder} rounded-2xl p-4 space-y-2.5`}>
                <div className="flex items-center space-x-2">
                  <Crown className={`w-4 h-4 ${roleTheme.accentText}`} />
                  <div>
                    <span className="text-xs font-bold text-white block">โหมดบันทึกการซ้อม</span>
                    <span className="text-[10px] text-slate-400">
                      {rehearsalScope === 'band'
                        ? 'ซ้อมรวมวง: สมาชิกทุกคนในวงจะเห็นคลิปและสถิตินี้'
                        : 'ซ้อมเดี่ยว: บันทึกเฉพาะตัวผู้จัดการวง'}
                    </span>
                  </div>
                </div>

                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setRehearsalScope('band')}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center space-x-1 ${
                      rehearsalScope === 'band'
                        ? roleTheme.scopeBtnActive
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>ซ้อมรวมวง</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRehearsalScope('personal')}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center space-x-1 ${
                      rehearsalScope === 'personal'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>ซ้อมเดี่ยว</span>
                  </button>
                </div>
              </div>
            )}

            {/* แผงควบคุมจังหวะและคีย์ */}
            <div className="bg-[#0d1220] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                การตั้งค่าจังหวะและคีย์
              </h2>

              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {/* BPM Control */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[11px] text-slate-400 font-medium mb-1">BPM (Metronome)</span>
                  
                  <div className="flex items-center space-x-3 my-1.5">
                    <input
                      type="number"
                      min={1}
                      value={bpm === 0 ? '' : bpm}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                        if (!isNaN(val)) setBpm(val);
                      }}
                      onBlur={() => {
                        if (!bpm || bpm < 1) setBpm(120);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      className="w-20 bg-transparent text-3xl font-black text-white font-mono text-center p-0 m-0 border-none outline-none focus:outline-none focus:ring-0 cursor-text select-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col space-y-1">
                      <button
                        type="button"
                        onClick={() => setBpm((b) => (b || 0) + 1)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-xs text-slate-300 transition"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setBpm((b) => Math.max(1, (b || 1) - 1))}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-xs text-slate-300 transition"
                      >
                        -
                      </button>
                    </div>
                  </div>

                  {/* สลับเปิด/ปิด Metronome */}
                  <div className="flex bg-slate-950 rounded-lg p-1 w-full max-w-[120px] mt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!audioContextRef.current) {
                          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                        }
                        if (audioContextRef.current.state === 'suspended') {
                          await audioContextRef.current.resume();
                        }
                        setIsMetronomeOn(true);
                      }}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded transition ${
                        isMetronomeOn ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      On
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMetronomeOn(false)}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded transition ${
                        !isMetronomeOn ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Off
                    </button>
                  </div>
                </div>

                {/* Key Reference Control */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[11px] text-slate-400 font-medium mb-1">Key Reference</span>
                  <div className="flex items-center space-x-3 my-2">
                    <button
                      type="button"
                      onClick={() => shiftKey('prev')}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-2xl font-black text-white font-mono w-10 text-center">
                      {keyRoot}
                    </span>
                    <button
                      type="button"
                      onClick={() => shiftKey('next')}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">Root Scale Tuning</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      <OnboardingModal />

      {/* Loading Overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className={`w-9 h-9 ${roleTheme.spinner} animate-spin mb-3`} />
          <p className="text-sm font-semibold text-white">{uploadProgressText}</p>
          <span className="text-xs text-slate-400 mt-1 font-mono">กรุณาอย่าเพิ่งปิดหน้าต่างเว็บ</span>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-[#080d1a] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-3" />
      </div>
    }>
      <PracticeContent />
    </Suspense>
  );
}