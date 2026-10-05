'use client';

import React, { useState, useEffect, useRef } from 'react';
import TopHeader from '@/components/TopHeader';
import BottomNav from '@/components/BottomNav';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Music, 
  Play, 
  Pause, 
  Trash2, 
  X, 
  Lock, 
  Crown, 
  Loader2, 
  UploadCloud, 
  Volume2,
  FileAudio,
  Headphones,
  Sparkles,
  Pencil,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { supabase } from '@/lib/supabaseClient';

interface Song {
  id: string;
  band_id: string | null;
  title: string;
  artist: string;
  bpm: number;
  key_signature: string;
  duration: string;
  reference_audio_url?: string | null;
  original_filename?: string | null;
  reference_status?: string;
  created_at: string;
}

export default function SongsPage() {
  const router = useRouter();
  const { isManager, bandId, bandName, loading: roleLoading } = useUserRole();

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // ฟอร์มเพิ่มเพลงใหม่
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newBpm, setNewBpm] = useState<number>(120);
  const [newKey, setNewKey] = useState('C');
  const [newDuration, setNewDuration] = useState('00:00');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [autoSeparate, setAutoSeparate] = useState(false);

  // ฟอร์มแก้ไขข้อมูลเพลงเดิม
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editBpm, setEditBpm] = useState<number>(120);
  const [editKey, setEditKey] = useState('C');
  const [updating, setUpdating] = useState(false);

  // สถานะการลบเพลง (Custom Confirm Modal)
  const [deletingSong, setDeletingSong] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // สถานะแจ้งเตือนในระบบ (Custom Toast Alert)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // พรีวิวเสียง
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Metronome Sound Preview
  const [isPlayingBpmPreview, setIsPlayingBpmPreview] = useState(false);
  const bpmPreviewTimersRef = useRef<NodeJS.Timeout[]>([]);

  // แสดงกล่องแจ้งเตือนแบบกำหนดเองแทน alert()
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
        borderFocus: 'focus:border-rose-500',
        cardIcon: 'text-rose-400',
        audioPlaying: 'bg-rose-950/80 border-rose-600 text-rose-300',
        hpssBtn: 'bg-rose-950/60 hover:bg-rose-900/80 border-rose-800 text-rose-300',
        spinner: 'text-rose-500',
      }
    : {
        primaryBtn: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-sm',
        accentText: 'text-sky-400',
        badge: 'bg-sky-950/80 border-sky-800 text-sky-300',
        borderFocus: 'focus:border-sky-500',
        cardIcon: 'text-sky-400',
        audioPlaying: 'bg-sky-950/80 border-sky-600 text-sky-300',
        hpssBtn: 'bg-sky-950/60 hover:bg-sky-900/80 border-sky-800 text-sky-300',
        spinner: 'text-sky-400',
      };

  useEffect(() => {
    return () => {
      bpmPreviewTimersRef.current.forEach(clearTimeout);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      let query = supabase.from('songs').select('*').order('created_at', { ascending: false });

      if (bandId) {
        query = query.or(`band_id.eq.${bandId},band_id.is.null`);
      } else {
        query = query.is('band_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSongs(data || []);
    } catch (err: any) {
      console.error('Fetch songs error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading) {
      fetchSongs();
    }
  }, [bandId, roleLoading]);

  useEffect(() => {
    const hasPending = songs.some((s) => s.reference_status === 'pending_separation');
    let timer: NodeJS.Timeout;
    if (hasPending) {
      timer = setInterval(() => {
        fetchSongs();
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [songs]);

  const handleTriggerSeparation = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('songs')
        .update({ reference_status: 'pending_separation' })
        .eq('id', songId);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) =>
          s.id === songId ? { ...s, reference_status: 'pending_separation' } : s
        )
      );
      showToast('ส่งคำสั่งแยกเสียง HPSS เรียบร้อยแล้ว', 'success');
    } catch (err: any) {
      showToast(`ไม่สามารถส่งคำสั่งแยกเสียงได้: ${err.message}`, 'error');
    }
  };

  const playBpmPreview = async (targetBpm?: number) => {
    bpmPreviewTimersRef.current.forEach(clearTimeout);
    bpmPreviewTimersRef.current = [];

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (e) {
        console.error('AudioContext resume error:', e);
      }
    }

    const bpmToUse = targetBpm || newBpm || 120;
    const safeBpm = bpmToUse && bpmToUse > 0 ? bpmToUse : 120;
    const intervalMs = (60 / safeBpm) * 1000;
    const totalClicks = 4;

    setIsPlayingBpmPreview(true);

    for (let i = 0; i < totalClicks; i++) {
      const timer = setTimeout(() => {
        try {
          if (audioCtx.state === 'running') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.frequency.setValueAtTime(i === 0 ? 1000 : 800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.06);
          }
        } catch (err) {
          console.error('Web Audio error:', err);
        }

        if (i === totalClicks - 1) {
          setTimeout(() => {
            setIsPlayingBpmPreview(false);
            audioCtx.close().catch(() => {});
          }, 200);
        }
      }, i * intervalMs);

      bpmPreviewTimersRef.current.push(timer);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAudioFile(file);

    if (file) {
      const tempAudioUrl = URL.createObjectURL(file);
      const tempAudio = new Audio(tempAudioUrl);

      tempAudio.onloadedmetadata = () => {
        const totalSeconds = Math.round(tempAudio.duration);
        if (!isNaN(totalSeconds) && totalSeconds > 0) {
          const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
          const ss = String(totalSeconds % 60).padStart(2, '0');
          setNewDuration(`${mm}:${ss}`);
        }
        URL.revokeObjectURL(tempAudioUrl);
      };

      tempAudio.onerror = () => {
        URL.revokeObjectURL(tempAudioUrl);
      };
    } else {
      setNewDuration('00:00');
    }
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setUploadStatusText('กำลังเตรียมข้อมูลเพลง...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('กรุณาเข้าสู่ระบบก่อนเพิ่มเพลง');
      }

      let finalTitle = newTitle.trim();
      if (!finalTitle) {
        if (audioFile && audioFile.name) {
          finalTitle = audioFile.name.replace(/\.[^/.]+$/, "");
        } else {
          const now = new Date();
          const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
          const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          finalTitle = `เพลงที่ ${songs.length + 1} (${dateStr} ${timeStr})`;
        }
      }

      const finalBpm = Math.max(1, Number(newBpm) || 120);
      let uploadedAudioUrl: string | null = null;
      let originalName: string | null = null;

      if (audioFile) {
        if (audioFile.size > 50 * 1024 * 1024) {
          throw new Error('ขนาดไฟล์เกิน 50 MB กรุณาตัดไฟล์ให้สั้นลง');
        }

        setUploadStatusText('กำลังอัปโหลดเพลงต้นฉบับเข้าคลังอ้างอิง...');
        const fileExt = audioFile.name.split('.').pop() || 'mp3';
        const filePath = `references/${bandId || 'common'}/${Date.now()}_song.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('song-references')
          .upload(filePath, audioFile, {
            contentType: audioFile.type || 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) throw new Error(`[Storage Error] ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('song-references')
          .getPublicUrl(filePath);

        uploadedAudioUrl = publicUrl;
        originalName = audioFile.name;
      }

      setUploadStatusText('กำลังบันทึกข้อมูลเพลงของวง...');

      const { error: insertError } = await supabase.from('songs').insert({
        band_id: bandId || null,
        title: finalTitle,
        artist: newArtist.trim() || 'ไม่ระบุศิลปิน',
        bpm: finalBpm,
        key_root: newKey,
        key_signature: newKey,
        duration: newDuration || '04:00',
        reference_audio_url: uploadedAudioUrl,
        original_filename: originalName,
        created_by: user.id,
        reference_status: autoSeparate && uploadedAudioUrl 
          ? 'pending_separation' 
          : (uploadedAudioUrl ? 'ready' : 'no_audio'),
      });

      if (insertError) throw new Error(`[Database Error] ${insertError.message}`);

      setNewTitle('');
      setNewArtist('');
      setNewBpm(120);
      setNewKey('C');
      setNewDuration('00:00');
      setAudioFile(null);
      setAutoSeparate(false);
      setIsAddModalOpen(false);
      showToast('บันทึกเพลงใหม่เข้าคลังเรียบร้อยแล้ว', 'success');
      fetchSongs();
    } catch (err: any) {
      showToast(`บันทึกเพลงไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
      setUploadStatusText('');
    }
  };

  const openEditModal = (song: Song) => {
    setEditingSongId(song.id);
    setEditTitle(song.title);
    setEditArtist(song.artist);
    setEditBpm(song.bpm);
    setEditKey(song.key_signature || 'C');
    setIsEditModalOpen(true);
  };

  const handleUpdateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSongId || !editTitle.trim()) return;

    setUpdating(true);
    try {
      const finalBpm = Math.max(1, Number(editBpm) || 120);
      const { error } = await supabase
        .from('songs')
        .update({
          title: editTitle.trim(),
          artist: editArtist.trim() || 'ไม่ระบุศิลปิน',
          bpm: finalBpm,
          key_root: editKey,
          key_signature: editKey,
        })
        .eq('id', editingSongId);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) =>
          s.id === editingSongId
            ? {
                ...s,
                title: editTitle.trim(),
                artist: editArtist.trim() || 'ไม่ระบุศิลปิน',
                bpm: finalBpm,
                key_signature: editKey,
              }
            : s
        )
      );

      setIsEditModalOpen(false);
      setEditingSongId(null);
      showToast('อัปเดตข้อมูลเพลงเรียบร้อยแล้ว', 'success');
    } catch (err: any) {
      showToast(`ไม่สามารถแก้ไขข้อมูลเพลงได้: ${err.message}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const togglePlayAudio = (song: Song) => {
    if (!song.reference_audio_url) {
      showToast('เพลงนี้ยังไม่มีไฟล์เสียงต้นฉบับที่อัปโหลดไว้', 'error');
      return;
    }

    if (playingSongId === song.id) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setPlayingSongId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.src = song.reference_audio_url;
        previewAudioRef.current.play().catch(() => {});
      }
      setPlayingSongId(song.id);
    }
  };

  // ดำเนินการลบเพลงและไฟล์เสียงจริงออกจาก Storage
  const handleConfirmDelete = async () => {
    if (!deletingSong) return;
    setIsDeleting(true);

    try {
      // 1. ลบไฟล์เพลงต้นฉบับออกจาก Storage
      if (deletingSong.reference_audio_url) {
        try {
          const urlParts = deletingSong.reference_audio_url.split('/song-references/');
          if (urlParts.length > 1) {
            const originalPath = decodeURIComponent(urlParts[1]);
            await supabase.storage.from('song-references').remove([originalPath]);
          }
        } catch (storageErr) {
          console.warn('ลบไฟล์ต้นฉบับไม่สำเร็จ:', storageErr);
        }
      }

      // 2. ลบโฟลเดอร์แทร็กแยกเสียง (ASCII Safe Folder Name)
      try {
        let safeTitle = (deletingSong.title || 'song').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        if (!safeTitle) safeTitle = 'song';
        const folderName = `${safeTitle.slice(0, 25)}_${deletingSong.id.slice(0, 8)}`;
        const folderPrefix = `separated/${deletingSong.band_id || 'common'}/${folderName}`;
        
        const { data: fileList } = await supabase.storage
          .from('song-references')
          .list(folderPrefix);

        if (fileList && fileList.length > 0) {
          const filesToRemove = fileList.map((file) => `${folderPrefix}/${file.name}`);
          await supabase.storage.from('song-references').remove(filesToRemove);
        }
      } catch (sepErr) {
        console.warn('ลบโฟลเดอร์แทร็กแยกไม่สำเร็จ:', sepErr);
      }

      // 3. ลบแถวข้อมูลออกจากตาราง songs
      const { error } = await supabase.from('songs').delete().eq('id', deletingSong.id);
      if (error) throw error;

      // 4. อัปเดต State หน้าจอ
      setSongs((prev) => prev.filter((s) => s.id !== deletingSong.id));
      if (playingSongId === deletingSong.id && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setPlayingSongId(null);
      }

      setDeletingSong(null);
      showToast('ลบเพลงและไฟล์เสียงออกจากระบบเรียบร้อยแล้ว', 'success');
    } catch (err: any) {
      showToast(`ลบเพลงไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-[#080d1a] text-white flex flex-col pb-24 md:pb-10">
      <TopHeader />

      <audio
        ref={previewAudioRef}
        onEnded={() => setPlayingSongId(null)}
        className="hidden"
      />

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

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">คลังเพลงของวง</h1>
              {isManager ? (
                <span className="text-[10px] bg-rose-950 border border-rose-800 text-rose-300 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  <Crown className="w-3 h-3 text-rose-400" />
                  <span>Manager Repertoire Control</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-mono">({bandName || 'คลังส่วนตัว'})</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isManager
                ? 'ผู้จัดการวง: กำหนดเพลงต้นฉบับ คีย์ BPM และอัปโหลดไฟล์เสียงอ้างอิงเพื่อให้ระบบวิเคราะห์ก่อนเริ่มซ้อม'
                : 'สมาชิก: เลือกเพลงที่ผู้จัดการวงกำหนดไว้เพื่อเข้าห้องซ้อมและเปรียบเทียบจังหวะ'}
            </p>
          </div>

          {isManager ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className={`flex items-center justify-center space-x-1.5 px-4 py-2 ${roleTheme.primaryBtn} rounded-xl text-xs font-semibold transition w-fit`}
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มเพลงต้นฉบับเข้าคลัง</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 w-fit">
              <Lock className="w-3.5 h-3.5" />
              <span>จัดการคลังได้เฉพาะผู้จัดการวง</span>
            </div>
          )}
        </div>

        {/* ช่องค้นหาเพลง */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อเพลง หรือศิลปิน..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full bg-[#0f1422] border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none ${roleTheme.borderFocus} transition`}
          />
        </div>

        {/* รายการเพลง */}
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className={`w-7 h-7 ${roleTheme.spinner} animate-spin mb-3`} />
            <p className="text-xs text-slate-400 font-mono">กำลังดึงข้อมูลคลังเพลง...</p>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="mt-8 p-10 bg-[#0f1422] border border-dashed border-slate-800 rounded-2xl text-center flex flex-col items-center">
            <Music className="w-10 h-10 text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">ยังไม่มีเพลงในคลัง</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {isManager
                ? 'กดปุ่ม "เพิ่มเพลงต้นฉบับเข้าคลัง" เพื่ออัปโหลดไฟล์เสียงอ้างอิงและระบุค่า BPM'
                : 'ผู้จัดการวงยังไม่ได้เพิ่มเพลงลงในคลังเพลง'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                className="bg-[#0f1422] border border-slate-800 hover:border-slate-700 rounded-2xl p-4.5 flex flex-col justify-between transition"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center ${roleTheme.cardIcon} shrink-0`}>
                        <Music className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-100 truncate">{song.title}</h3>
                        <p className="text-xs text-slate-400 truncate">{song.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {song.reference_audio_url && (
                        <button
                          onClick={() => togglePlayAudio(song)}
                          className={`p-1.5 rounded-lg border text-xs transition ${
                            playingSongId === song.id
                              ? roleTheme.audioPlaying
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title={playingSongId === song.id ? 'หยุดเล่น' : 'ฟังเพลงต้นฉบับ'}
                        >
                          {playingSongId === song.id ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {isManager && (
                        <>
                          <button
                            onClick={() => openEditModal(song)}
                            className="text-slate-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
                            title="แก้ไขข้อมูลเพลง (คีย์, BPM, ชื่อเพลง)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingSong(song)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
                            title="ลบเพลง"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-slate-800/80 text-center">
                    <div className="bg-slate-900/90 rounded-lg p-1.5">
                      <span className="text-[10px] text-slate-400 block">BPM เป้าหมาย</span>
                      <span className="text-xs font-bold text-white font-mono">{song.bpm}</span>
                    </div>
                    <div className="bg-slate-900/90 rounded-lg p-1.5">
                      <span className="text-[10px] text-slate-400 block">คีย์เพลง</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">{song.key_signature}</span>
                    </div>
                    <div className="bg-slate-900/90 rounded-lg p-1.5">
                      <span className="text-[10px] text-slate-400 block">ความยาว</span>
                      <span className="text-xs font-bold text-slate-300 font-mono">{song.duration}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <div className="flex items-center text-slate-400 truncate max-w-[170px]">
                      <FileAudio className="w-3 h-3 mr-1 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {song.original_filename || 'ไม่มีไฟล์เสียงอ้างอิง'}
                      </span>
                    </div>

                    {song.reference_audio_url ? (
                      <div className="flex items-center space-x-1.5">
                        {song.reference_status === 'pending_separation' ? (
                          <span className="text-[10px] px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-800 rounded font-medium flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                            <span>กำลังแยกเสียง...</span>
                          </span>
                        ) : song.reference_status === 'separated' ? (
                          <span className="text-[10px] px-2 py-0.5 bg-purple-950/80 text-purple-300 border border-purple-800 rounded font-medium flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                            <span>แยกเสียงแล้ว (HPSS)</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTriggerSeparation(song.id)}
                            className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 transition ${roleTheme.hpssBtn}`}
                            title="สั่งให้ระบบประมวลผลแยกเสียง Harmonic และ Percussive"
                          >
                            <Sparkles className={`w-2.5 h-2.5 ${roleTheme.accentText}`} />
                            <span>แยกเสียง HPSS</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 text-slate-500 border border-slate-800 rounded">
                        ไม่มีต้นฉบับ
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(song.created_at).toLocaleDateString('th-TH')}
                  </span>
                  
                  <button
                    onClick={() =>
                      router.push(
                        `/practice?songId=${song.id}&song=${encodeURIComponent(
                          song.title
                        )}&bpm=${song.bpm}&key=${song.key_signature}`
                      )
                    }
                    className={`px-3.5 py-1.5 ${roleTheme.primaryBtn} rounded-lg text-xs font-medium flex items-center space-x-1.5 transition`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>เริ่มซ้อมเพลงนี้</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal ยืนยันการลบเพลงแบบกำหนดเอง (Custom Confirm Modal) */}
      {deletingSong && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f1422] border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white tracking-tight">ยืนยันการลบเพลง</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                คุณต้องการลบเพลง <span className="text-rose-300 font-semibold">"{deletingSong.title}"</span> และไฟล์เสียงทั้งหมดออกจากคลังใช่หรือไม่?
              </p>
              <p className="text-[11px] text-slate-500">
                ข้อมูลและไฟล์เสียงต้นฉบับจะถูกลบออกจาก Storage ทันที
              </p>
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingSong(null)}
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
                    <span>ยืนยันลบเพลง</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal เพิ่มเพลงต้นฉบับเข้าคลัง */}
      {isAddModalOpen && isManager && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f1422] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-rose-400" />
                <span>กำหนดเพลงต้นฉบับของวง</span>
              </h3>
              <button 
                onClick={() => {
                  bpmPreviewTimersRef.current.forEach(clearTimeout);
                  setIsPlayingBpmPreview(false);
                  setIsAddModalOpen(false);
                }} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSong} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">ชื่อเพลง (Title)</label>
                  <span className="text-[10px] text-slate-500">เว้นว่างเพื่อรันชื่ออัตโนมัติ</span>
                </div>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น แสงสุดท้าย (หรือเว้นว่างเพื่อรันวัน-เวลา)"
                  className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">ศิลปิน (Artist)</label>
                <input
                  type="text"
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  placeholder="เช่น Bodyslam"
                  className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#131826] border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300 font-medium">BPM เป้าหมาย</label>
                    <button
                      type="button"
                      onClick={() => playBpmPreview(newBpm)}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition flex items-center space-x-1 ${
                        isPlayingBpmPreview
                          ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                          : 'bg-slate-800 border-slate-700 text-rose-300 hover:bg-slate-700'
                      }`}
                      title="ฟังเสียงจังหวะ 4 เคาะ"
                    >
                      <Headphones className="w-3 h-3 text-rose-400" />
                      <span>{isPlayingBpmPreview ? 'เคาะ...' : 'ฟัง'}</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      min={1}
                      required
                      value={newBpm === 0 ? '' : newBpm}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                        if (!isNaN(val)) setNewBpm(val);
                      }}
                      onBlur={() => {
                        if (!newBpm || newBpm < 1) setNewBpm(120);
                      }}
                      placeholder="120"
                      className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">BPM</span>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">ระบุ BPM ตามเพลงที่ใช้ฝึก</span>
                </div>

                <div className="bg-[#131826] border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                  <label className="text-xs text-slate-300 font-medium mb-1">คีย์เพลง (Key)</label>
                  <div className="flex-1 flex items-center">
                    <select
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
                    >
                      {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Am', 'Em', 'Dm'].map(
                        (k) => (
                          <option key={k} value={k}>{k}</option>
                        )
                      )}
                    </select>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">Root Scale อ้างอิง</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 font-medium">
                    ไฟล์เสียงต้นฉบับ (.mp3 / .wav)
                  </label>
                  {newDuration !== '00:00' && (
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      ความยาวจริง: {newDuration} นาที
                    </span>
                  )}
                </div>
                <div className="border border-dashed border-slate-700 bg-[#161b2a] rounded-xl p-3.5 text-center">
                  <input
                    type="file"
                    id="ref-audio-upload"
                    accept="audio/mp3,audio/wav,audio/mpeg,audio/m4a"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="ref-audio-upload" className="cursor-pointer block">
                    <UploadCloud className="w-7 h-7 text-slate-400 mx-auto mb-1" />
                    <span className="text-xs font-medium text-slate-200 block truncate">
                      {audioFile ? audioFile.name : 'คลิกเพื่อเลือกไฟล์เพลงต้นฉบับ'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      ระบบคำนวณความยาวเพลงให้อัตโนมัติ (ไม่เกิน 50 MB)
                    </span>
                  </label>
                </div>
              </div>

              {audioFile && (
                <label className="flex items-center space-x-2 pt-1 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSeparate}
                    onChange={(e) => setAutoSeparate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#161b2a] text-rose-600 focus:ring-0 cursor-pointer accent-rose-600"
                  />
                  <span>แยกเสียงอัตโนมัติหลังอัปโหลด (HPSS)</span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-3 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white font-semibold rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{uploadStatusText || 'กำลังบันทึก...'}</span>
                  </>
                ) : (
                  <span>บันทึกเพลงเข้าคลังวง</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal แก้ไขข้อมูลเพลงเดิม */}
      {isEditModalOpen && isManager && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f1422] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <Pencil className="w-4 h-4 text-amber-400" />
                <span>แก้ไขข้อมูลเพลง (Repertoire Control)</span>
              </h3>
              <button 
                onClick={() => {
                  bpmPreviewTimersRef.current.forEach(clearTimeout);
                  setIsPlayingBpmPreview(false);
                  setIsEditModalOpen(false);
                  setEditingSongId(null);
                }} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSong} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">ชื่อเพลง (Title) *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">ศิลปิน (Artist)</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#131826] border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300 font-medium">BPM เป้าหมาย</label>
                    <button
                      type="button"
                      onClick={() => playBpmPreview(editBpm)}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition flex items-center space-x-1 ${
                        isPlayingBpmPreview
                          ? 'bg-amber-600 border-amber-500 text-white animate-pulse'
                          : 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
                      }`}
                      title="ฟังเสียงจังหวะ 4 เคาะ"
                    >
                      <Headphones className="w-3 h-3 text-amber-400" />
                      <span>{isPlayingBpmPreview ? 'เคาะ...' : 'ฟัง'}</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      min={1}
                      required
                      value={editBpm === 0 ? '' : editBpm}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                        if (!isNaN(val)) setEditBpm(val);
                      }}
                      onBlur={() => {
                        if (!editBpm || editBpm < 1) setEditBpm(120);
                      }}
                      className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">BPM</span>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">ระบุ BPM ตามเพลงที่ใช้ฝึก</span>
                </div>

                <div className="bg-[#131826] border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
                  <label className="text-xs text-slate-300 font-medium mb-1">คีย์เพลง (Key)</label>
                  <div className="flex-1 flex items-center">
                    <select
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      className="w-full bg-[#161b2a] border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Am', 'Em', 'Dm'].map(
                        (k) => (
                          <option key={k} value={k}>{k}</option>
                        )
                      )}
                    </select>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">Root Scale อ้างอิง</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-semibold rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังอัปเดตข้อมูล...</span>
                    </>
                  ) : (
                    <span>บันทึกการแก้ไข</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}