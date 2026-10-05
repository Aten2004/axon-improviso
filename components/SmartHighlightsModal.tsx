'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Share2, Volume2, AlertCircle, RotateCcw } from 'lucide-react';

interface SmartHighlight {
  id: string;
  session_id: string;
  timestamp_str: string;
  timestamp_seconds: number;
  error_type: string;
  description: string;
}

interface SmartHighlightsModalProps {
  session: {
    id: string;
    title: string;
    media_url: string | null;
    media_type: string;
  };
  highlights: SmartHighlight[];
  initialHighlightId: string | null;
  onClose: () => void;
}

export default function SmartHighlightsModal({
  session,
  highlights,
  initialHighlightId,
  onClose,
}: SmartHighlightsModalProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<'All' | 'Tempo' | 'Precision' | 'Key'>('All');
  const [selectedId, setSelectedId] = useState<string>(
    initialHighlightId || (highlights[0]?.id ?? '')
  );
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const seekMedia = (seconds: number, id: string) => {
    setSelectedId(id);
    if (mediaRef.current) {
      mediaRef.current.currentTime = Math.max(0, seconds - 1); // ถอยหลัง 1 วินาทีก่อนจุดพลาดเพื่อให้ฟังทัน
      mediaRef.current.play();
    }
  };

  // กรองรายการข้อผิดพลาดตามแท็บที่เลือก (Tempo, Precision, Key)
  const filteredHighlights = highlights.filter((h) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Tempo') return h.error_type.includes('จังหวะ') || h.error_type.includes('Tempo') || h.error_type.includes('คร่อม');
    if (activeFilter === 'Precision') return h.error_type.includes('คลาดเคลื่อน') || h.error_type.includes('Precision') || h.error_type.includes('Onset');
    if (activeFilter === 'Key') return h.error_type.includes('คีย์') || h.error_type.includes('Key') || h.error_type.includes('ระดับเสียง');
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[#0e1626] border border-slate-800 rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">Smart Highlights</h3>
            <span className="text-[11px] text-slate-400 font-mono">เซสชัน: {session.title}</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* กล่อง Media Player (เล่นไฟล์จริงจาก Storage) */}
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
          {session.media_url ? (
            session.media_type === 'video' ? (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={session.media_url}
                className="w-full h-full object-contain"
                controls
              />
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 p-4 w-full">
                <Volume2 className="w-8 h-8 text-rose-400" />
                <audio
                  ref={mediaRef as React.RefObject<HTMLAudioElement>}
                  src={session.media_url}
                  className="w-full"
                  controls
                />
              </div>
            )
          ) : (
            <div className="flex flex-col items-center text-slate-500 text-xs">
              <AlertCircle className="w-6 h-6 mb-1 text-slate-600" />
              <span>ไม่พบไฟล์สื่อที่บันทึกไว้ในเซสชันนี้</span>
            </div>
          )}
        </div>

        {/* แท็บกรองประเภทข้อผิดพลาด (ภาพที่ 3.14 ในเล่มรายงาน) */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-[11px] my-3">
          {(['All', 'Tempo', 'Precision', 'Key'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={`flex-1 py-1 rounded-lg font-medium transition ${
                activeFilter === tab ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* รายการจุดบกพร่องจริงจากฐานข้อมูล */}
        <div className="space-y-2 mb-3">
          <span className="text-[11px] text-slate-400 font-medium block">
            จุดบกพร่องที่ตรวจพบ ({filteredHighlights.length} รายการ):
          </span>

          {filteredHighlights.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">ไม่มีข้อผิดพลาดในหมวดหมู่นี้</p>
          ) : (
            filteredHighlights.map((item) => (
              <div
                key={item.id}
                onClick={() => seekMedia(item.timestamp_seconds, item.id)}
                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-start space-x-2.5 ${
                  selectedId === item.id
                    ? 'bg-rose-950/40 border-rose-500 text-slate-100 shadow-sm'
                    : 'bg-[#141f33] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="font-mono font-bold text-rose-400 bg-rose-950/80 border border-rose-900 px-1.5 py-0.5 rounded text-[11px]">
                  {item.timestamp_str}
                </span>
                <div className="flex-1">
                  <span className="font-semibold block text-slate-200">{item.error_type}</span>
                  <span className="text-slate-400 text-[11px] leading-snug">{item.description}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* แถบปุ่ม Action: แชร์พิกัดเวลา และ ซ้อมใหม่อีกรอบ (ภาพที่ 3.14 ในเล่มรายงาน) */}
        <div className="flex space-x-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => alert(`แชร์พิกัดข้อผิดพลาดของเซสชัน "${session.title}" เรียบร้อย`)}
            className="flex-1 py-2.5 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 flex items-center justify-center space-x-1.5 transition shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Timestamp</span>
          </button>
          
          <button
            onClick={() => {
              onClose();
              router.push(`/practice?song=${encodeURIComponent(session.title)}`);
            }}
            className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ซ้อมใหม่อีกรอบ</span>
          </button>
        </div>

      </div>
    </div>
  );
}