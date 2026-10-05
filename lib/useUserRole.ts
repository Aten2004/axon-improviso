'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface UserProfileState {
  userId: string | null;
  role: 'Band Manager' | 'Band Member';
  userName: string;
  userEmail: string;
  instrument: string;
  bandId: string | null;
  bandName: string;
  bandCode: string;
  isManager: boolean;
  avatarUrl: string | null; // เพิ่มฟิลด์รูปโปรไฟล์
  loading: boolean;
}

export function useUserRole() {
  const [profile, setProfile] = useState<UserProfileState>({
    userId: null,
    role: 'Band Member',
    userName: '',
    userEmail: '',
    instrument: 'กลองชุด (Drums)',
    bandId: null,
    bandName: '',
    bandCode: '',
    isManager: false,
    avatarUrl: null,
    loading: true,
  });

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProfile((prev) => ({ ...prev, loading: false }));
          return;
        }

        // ดึง avatar_url เพิ่มเติมจาก profiles
        const { data: userProfile, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            role,
            instrument,
            band_id,
            avatar_url,
            bands (
              id,
              name,
              invite_code
            )
          `)
          .eq('id', user.id)
          .single();

        if (error || !userProfile) {
          console.error('Fetch profile error:', error);
          setProfile((prev) => ({ ...prev, loading: false }));
          return;
        }

        const bandData = (userProfile as any).bands;
        const currentRole = userProfile.role as 'Band Manager' | 'Band Member';

        setProfile({
          userId: user.id,
          role: currentRole,
          userName: userProfile.full_name || 'Musician',
          userEmail: user.email || '',
          instrument: userProfile.instrument || 'กลองชุด (Drums)',
          bandId: userProfile.band_id,
          bandName: bandData?.name || 'ไม่มีสังกัดวง',
          bandCode: bandData?.invite_code || '-',
          isManager: currentRole === 'Band Manager',
          avatarUrl: (userProfile as any).avatar_url || (user.user_metadata as any)?.avatar_url || null,
          loading: false,
        });
      } catch (err) {
        console.error('Error fetching user role:', err);
        setProfile((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchUserProfile();
  }, []);

  return profile;
}