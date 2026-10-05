import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, role, instrument, bandName, inviteCode } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // ใช้ SERVICE_ROLE_KEY เพื่อข้าม Email Rate Limit และ RLS ในขั้นตอนสร้างบัญชี
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { 
          fallback: true, 
          error: 'MISSING_SERVICE_ROLE_KEY',
          message: 'ไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ใน .env.local' 
        },
        { status: 200 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let targetBandId: string | null = null;

    // 1. กรณีเป็นสมาชิก และกรอกรหัสวง ให้ตรวจสอบก่อน
    if (role === 'Band Member' && inviteCode) {
      const trimmedCode = inviteCode.trim().toUpperCase();
      const { data: bandData, error: bandErr } = await supabaseAdmin
        .from('bands')
        .select('id')
        .eq('invite_code', trimmedCode)
        .maybeSingle();

      if (bandErr || !bandData) {
        return NextResponse.json(
          { error: `ไม่พบรหัสวง "${trimmedCode}" ในระบบ กรุณาตรวจสอบความถูกต้อง` },
          { status: 400 }
        );
      }
      targetBandId = bandData.id;
    }

    // 2. สร้างผู้ใช้ผ่าน Admin API พร้อม auto-confirm ทันที (ไม่ส่งเมล จึงไม่ติด Rate Limit 100%)
    const { data: userData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true, // ยืนยันอีเมลทันที ไม่ยิง SMTP
      user_metadata: {
        full_name: fullName.trim(),
        role: role,
        instrument: role === 'Band Manager' ? 'Band Manager' : instrument,
      },
    });

    if (createAuthError) {
      return NextResponse.json({ error: createAuthError.message }, { status: 400 });
    }

    const userId = userData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'ไม่สามารถสร้างผู้ใช้งานได้' }, { status: 500 });
    }

    // 3. กรณีเป็นผู้จัดการวง ให้สร้างวงดนตรีใหม่
    if (role === 'Band Manager') {
      const newInviteCode = `AXON-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: createdBand, error: createBandError } = await supabaseAdmin
        .from('bands')
        .insert({
          name: bandName.trim(),
          invite_code: newInviteCode,
          created_by: userId,
        })
        .select('id')
        .single();

      if (createBandError) {
        return NextResponse.json(
          { error: `สร้างวงไม่สำเร็จ: ${createBandError.message}` },
          { status: 500 }
        );
      }
      targetBandId = createdBand.id;
    }

    // 4. บันทึกข้อมูลลงตาราง profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName.trim(),
        role: role,
        instrument: role === 'Band Manager' ? 'Band Manager' : instrument,
        band_id: targetBandId,
      }, { onConflict: 'id' });

    if (profileError) {
      return NextResponse.json(
        { error: `บันทึกโปรไฟล์ไม่สำเร็จ: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' },
      { status: 500 }
    );
  }
}