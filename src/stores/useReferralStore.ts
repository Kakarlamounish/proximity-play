import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string | null;
  referredEmail: string;
  status: 'pending' | 'signed_up' | 'active';
  createdAt: Date;
  activatedAt?: Date;
}

export interface ReferralStats {
  totalInvites: number;
  signups: number;
  activeUsers: number;
  rewardTier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface ReferralState {
  referrals: Referral[];
  referralCode: string;
  loading: boolean;
  generateCode: () => string;
  setReferralCode: (code: string) => void;
  getOrCreateCode: (userId: string) => Promise<string>;
  fetchReferrals: (userId: string) => Promise<void>;
  addReferral: (input: {
    referrerId: string;
    referredEmail: string;
    referredUserId?: string;
  }) => Promise<Referral | null>;
  activateReferral: (referralId: string) => Promise<void>;
  getStats: (userId: string) => ReferralStats;
}

const fromRow = (row: any): Referral => ({
  id: row.id,
  referrerId: row.referrer_id,
  referredUserId: row.referred_user_id ?? null,
  referredEmail: row.referred_email,
  status: row.status,
  createdAt: new Date(row.created_at),
  activatedAt: row.activated_at ? new Date(row.activated_at) : undefined,
});

export const useReferralStore = create<ReferralState>((set, get) => ({
  referrals: [],
  referralCode: '',
  loading: false,

  generateCode: () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    set({ referralCode: code });
    return code;
  },

  setReferralCode: (code) => set({ referralCode: code }),

  // Returns the user's persistent referral code, generating and saving one
  // to their profile the first time it's needed (retries on the rare
  // collision, same approach ShareBubbleDialog uses for invite codes).
  getOrCreateCode: async (userId) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (profile?.referral_code) {
      set({ referralCode: profile.referral_code });
      return profile.referral_code;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = get().generateCode();
      const { error } = await supabase
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', userId);
      if (!error) return code;
    }
    throw new Error('Could not generate a unique referral code');
  },

  fetchReferrals: async (userId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });
    set({ loading: false });
    if (!error && data) set({ referrals: data.map(fromRow) });
  },

  addReferral: async ({ referrerId, referredEmail, referredUserId }) => {
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_email: referredEmail,
        referred_user_id: referredUserId ?? null,
        status: 'pending',
      })
      .select()
      .single();
    if (error || !data) return null;
    const inserted = fromRow(data);
    set((s) => ({ referrals: [inserted, ...s.referrals] }));
    return inserted;
  },

  activateReferral: async (referralId) => {
    const activated_at = new Date().toISOString();
    const { error } = await supabase
      .from('referrals')
      .update({ status: 'active', activated_at })
      .eq('id', referralId);
    if (!error) {
      set((s) => ({
        referrals: s.referrals.map((r) =>
          r.id === referralId
            ? { ...r, status: 'active', activatedAt: new Date(activated_at) }
            : r
        ),
      }));
    }
  },

  getStats: (userId) => {
    const userReferrals = get().referrals.filter((r) => r.referrerId === userId);
    const totalInvites = userReferrals.length;
    const signups = userReferrals.filter((r) => r.status !== 'pending').length;
    const activeUsers = userReferrals.filter((r) => r.status === 'active').length;

    let rewardTier: ReferralStats['rewardTier'] = 'bronze';
    if (activeUsers >= 10) rewardTier = 'platinum';
    else if (activeUsers >= 5) rewardTier = 'gold';
    else if (activeUsers >= 2) rewardTier = 'silver';

    return { totalInvites, signups, activeUsers, rewardTier };
  },
}));
