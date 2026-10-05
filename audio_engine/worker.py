import os
import sys
import time
import io
import re
import tempfile
import requests
import numpy as np
import scipy.signal as signal
import soundfile as sf
import librosa
from urllib.parse import urlparse
from supabase import create_client, Client

# ==============================================================================
# 1. การตั้งค่าระบบ และการเชื่อมต่อ Supabase
# ==============================================================================
SUPABASE_URL = "https://jceqbwkzhrffeyndrtsk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZXFid2t6aHJmZmV5bmRydHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTgwMDYsImV4cCI6MjEwNDY3NDAwNn0.xacaG7D-6snm1wTsYk2fRiCx2AbU302VTQkrk7p9mwM"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TARGET_SR = 22050  # อัตราการสุ่มตัวอย่างมาตรฐาน DSP
STORAGE_BUCKET = "song-references"
FAILED_SONG_IDS = set()


# ==============================================================================
# 2. ฟังก์ชันแปลงชื่อเป็น ASCII ปลอดภัย 100% (แก้ InvalidKey)
# ==============================================================================
def make_safe_storage_folder(raw_name: str, song_id: str) -> str:
    """
    ดึงเฉพาะภาษาอังกฤษ ตัวเลข ขีดกลาง เพื่อให้ Supabase Storage ยอมรับ
    หากเป็นชื่อภาษาไทยล้วน จะตั้งเป็น song_{song_id} เพื่อแยกโฟลเดอร์ไม่ให้ทับกัน
    """
    safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', raw_name)
    safe_name = re.sub(r'_+', '_', safe_name).strip('_')
    
    if not safe_name:
        safe_name = "song"
        
    return f"{safe_name[:25]}_{song_id[:8]}"


def download_audio_to_temp_file(url: str) -> str:
    """
    ดาวน์โหลดไฟล์เสียงจาก Supabase Storage และบันทึกลง Tempfile
    พร้อมระบุนามสกุลไฟล์จริง เพื่อให้ Librosa ถอดรหัสไฟล์จากมือถือ (.m4a, .aac, .webm)
    และเครื่องอื่นได้ทุกฟอร์แมต แก้ปัญหา 'Format not recognised'
    """
    headers = {"User-Agent": "AXON-Separation-Worker/2.0"}
    resp = requests.get(url, headers=headers, timeout=90)
    if resp.status_code != 200:
        raise FileNotFoundError(f"ดาวน์โหลดไฟล์ไม่สำเร็จ (HTTP Status: {resp.status_code}) URL: {url}")

    # ตรวจหานามสกุลไฟล์จริงจาก URL หรือ Content-Type
    parsed = urlparse(url)
    ext = os.path.splitext(parsed.path)[1].lower()
    if not ext or ext not in ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac']:
        content_type = resp.headers.get("Content-Type", "").lower()
        if "m4a" in content_type or "mp4" in content_type:
            ext = ".m4a"
        elif "webm" in content_type:
            ext = ".webm"
        elif "mpeg" in content_type or "mp3" in content_type:
            ext = ".mp3"
        else:
            ext = ".wav"

    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    tmp.write(resp.content)
    tmp.flush()
    temp_path = tmp.name
    tmp.close()
    return temp_path


def butter_filter(data: np.ndarray, cutoff: float, sr: int, btype: str = 'low', order: int = 4) -> np.ndarray:
    """Butterworth Filter สำหรับตัดกรองย่านความถี่เครื่องกระทบ"""
    nyq = 0.5 * sr
    normal_cutoff = max(0.001, min(0.999, cutoff / nyq))
    b, a = signal.butter(order, normal_cutoff, btype=btype, analog=False)
    return signal.filtfilt(b, a, data)


# ==============================================================================
# 3. กระบวนการสกัดแยกเสียง 7 แทร็ก (Pure Separation Pipeline)
# ==============================================================================
def process_song_separation(song: dict):
    song_id = song["id"]
    ref_url = song.get("reference_audio_url")
    raw_title = song.get("title") or "เพลงต้นฉบับ"
    band_id = song.get("band_id") or "common"

    # สร้างชื่อโฟลเดอร์ที่เป็นภาษาอังกฤษและตัวเลข 100% ป้องกัน InvalidKey
    song_folder = make_safe_storage_folder(raw_title, song_id)

    print(f"\n=======================================================")
    print(f"🎵 [7-Track Separation] กำลังแยกเพลง: \"{raw_title}\"")
    print(f"📂 ปลายทาง Storage: separated/{band_id}/{song_folder}/")

    if not ref_url:
        print("⚠️ ไม่พบ URL ไฟล์เพลงต้นฉบับ ข้ามรายการนี้")
        mark_song_failed(song_id)
        return

    temp_path = None
    try:
        # 1. โหลดไฟล์เสียงต้นฉบับเข้า Tempfile รองรับไฟล์จากมือถือและเครื่องอื่นทุกชนิด
        print("⏳ กำลังโหลดไฟล์เสียงเข้าเครื่อง...")
        temp_path = download_audio_to_temp_file(ref_url)

        # 2. ถอดรหัสสัญญาณเสียงผ่าน Librosa จาก Tempfile
        y_raw, sr = librosa.load(temp_path, sr=TARGET_SR, mono=False)

        # จัดการมิติเสียง Stereo / Mid-Side เพื่อแยกเสียงร้องและดนตรีประกอบ
        if y_raw.ndim > 1 and y_raw.shape[0] >= 2:
            left_ch = y_raw[0]
            right_ch = y_raw[1]
            y_vocal_mid = 0.5 * (left_ch + right_ch)      # แทร็กที่ 6: Vocal Center
            y_backing_side = 0.5 * (left_ch - right_ch)   # แทร็กที่ 7: Backing Side
            y = y_vocal_mid
            has_stereo = True
        else:
            y = y_raw if y_raw.ndim == 1 else y_raw[0]
            y_vocal_mid = y
            y_backing_side = np.zeros_like(y)
            has_stereo = False

        duration_sec = len(y) / sr
        print(f"✅ ถอดรหัสสำเร็จ ความยาว: {duration_sec:.2f} วินาที ({'Stereo' if has_stereo else 'Mono'})")

        # 3. แยกสัญญาณ Harmonic และ Percussive ด้วย HPSS
        print("⏳ แยกสัญญาณ Harmonic และ Percussive (HPSS)...")
        y_harmonic, y_percussive = librosa.effects.hpss(y, margin=(1.0, 5.0))

        # 4. สกัดย่านความถี่เฉพาะ: กระเดื่อง Kick (LPF 150Hz) และ ไฮแฮท Hi-hat (HPF 3000Hz)
        print("⏳ สกัดย่านความถี่เครื่องกระทบ (LPF 150Hz / HPF 3000Hz)...")
        y_kick_low = butter_filter(y_percussive, cutoff=150.0, sr=sr, btype='low')
        y_hihat_high = butter_filter(y_percussive, cutoff=3000.0, sr=sr, btype='high')

        # 5. ชื่อไฟล์ทั้ง 7 แทร็กภายในโฟลเดอร์ของเพลงนั้นๆ
        tracks = {
            "1_original.wav": y,
            "2_harmonic.wav": y_harmonic,
            "3_percussive.wav": y_percussive,
            "4_kick_low.wav": y_kick_low,
            "5_hihat_high.wav": y_hihat_high,
            "6_vocal_center.wav": y_vocal_mid,
            "7_backing_side.wav": y_backing_side,
        }

        # 6. เขียนไฟล์ลง RAM Buffer ทีละแทร็กแล้วอัปโหลดขึ้นโฟลเดอร์ประจำเพลง
        print(f"⏳ อัปโหลดทั้ง 7 แทร็กเข้าสู่ Storage...")
        uploaded_urls = {}

        for filename, audio_data in tracks.items():
            track_buffer = io.BytesIO()
            sf.write(track_buffer, audio_data, sr, format='WAV')
            track_buffer.seek(0)

            storage_path = f"separated/{band_id}/{song_folder}/{filename}"
            supabase.storage.from_(STORAGE_BUCKET).upload(
                storage_path,
                track_buffer.read(),
                file_options={"content-type": "audio/wav", "x-upsert": "true"}
            )
            track_buffer.close()

            public_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(storage_path)
            track_key = filename.replace(".wav", "")
            uploaded_urls[track_key] = public_url

        # 7. อัปเดตสถานะในตาราง songs เป็น 'separated' พร้อมบันทึกลิงก์แทร็ก
        try:
            supabase.table("songs").update({
                "reference_status": "separated",
                "separated_tracks": uploaded_urls
            }).eq("id", song_id).execute()
        except Exception:
            supabase.table("songs").update({
                "reference_status": "separated"
            }).eq("id", song_id).execute()

        print(f"🎉 สำเร็จ! แยกครบ 7 แทร็กในโฟลเดอร์ \"{song_folder}\" เรียบร้อยแล้ว")

    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการประมวลผลเพลง: {e}")
        mark_song_failed(song_id)
    finally:
        # ลบไฟล์ชั่วคราวทิ้งทันทีเมื่อประมวลผลเสร็จสิ้น
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def mark_song_failed(song_id: str):
    FAILED_SONG_IDS.add(song_id)
    try:
        supabase.table("songs").update({"reference_status": "failed"}).eq("id", song_id).execute()
    except Exception:
        pass


# ==============================================================================
# 4. ลูปหลักสำหรับมอนิเตอร์เฉพาะคิวงานแยกเสียงเพลง
# ==============================================================================
def start_separation_worker():
    print("\n🎧 [A.X.O.N. Dedicated Audio Separation Worker]")
    print("   • สถาปัตยกรรม: ทำงานร่วมกับ Supabase Cloud (รองรับคิวงานจากทุกอุปกรณ์)")
    print("   • รูปแบบจัดเก็บ: แยกโฟลเดอร์ตามเพลงอย่างปลอดภัย (S3 Compliant)")
    print("   • ถังจัดเก็บ: Bucket 'song-references'")
    print("   กด Ctrl + C เพื่อหยุดการทำงาน\n")

    while True:
        try:
            song_res = supabase.table("songs") \
                .select("*") \
                .eq("reference_status", "pending_separation") \
                .limit(1) \
                .execute()

            songs = song_res.data or []
            valid_songs = [s for s in songs if s["id"] not in FAILED_SONG_IDS]

            if valid_songs:
                process_song_separation(valid_songs[0])
                time.sleep(1)
            else:
                time.sleep(3)

        except KeyboardInterrupt:
            print("\n🛑 หยุดการทำงานของ Separation Worker เรียบร้อย")
            break
        except Exception as err:
            print(f"⚠️ Worker Error: {err}")
            time.sleep(5)


if __name__ == "__main__":
    start_separation_worker()