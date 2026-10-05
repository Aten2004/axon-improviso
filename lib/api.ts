const COLAB_API_BASE = process.env.NEXT_PUBLIC_COLAB_API_URL || 'http://localhost:8000';

export interface AnalysisResult {
  accuracy: number;
  practiceHours: number;
  tempoDeviationScore: number;
  highlights: {
    id: string;
    timestamp: string;
    timeSeconds: number;
    type: 'Tempo' | 'Precision' | 'Key';
    description: string;
  }[];
}

export async function uploadSessionForAnalysis(
  file: Blob | File,
  sessionName: string,
  bpm: number,
  key: string
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_name', sessionName);
  formData.append('bpm', bpm.toString());
  formData.append('key', key);

  try {
    const res = await fetch(`${COLAB_API_BASE}/api/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('API server returned error');
    return await res.json();
  } catch (error) {
    console.warn('Backend unavailable, using mock analysis data:', error);
    // ข้อมูลจำลองอ้างอิงจากบทที่ 3 ในเล่มรายงาน A.X.O.N.
    return {
      accuracy: 86.7,
      practiceHours: 12,
      tempoDeviationScore: 85,
      highlights: [
        {
          id: '1',
          timestamp: '02:00',
          timeSeconds: 120,
          type: 'Tempo',
          description: 'ตรวจพบการเล่นเร็ว 85ms ซึ่งคลาดเคลื่อนเกินเกณฑ์ 100ms',
        },
        {
          id: '2',
          timestamp: '02:15',
          timeSeconds: 135,
          type: 'Tempo',
          description: 'ตรวจพบว่ากลองมักจะเล่นเร็วกว่าจังหวะในช่วงเปลี่ยนท่อน (Fill-in) ประมาณ 1-2 วินาที',
        },
        {
          id: '3',
          timestamp: '03:00',
          timeSeconds: 180,
          type: 'Precision',
          description: 'จังหวะเริ่มแกว่งในช่วงรอยต่อระหว่างท่อนเพลง',
        },
      ],
    };
  }
}