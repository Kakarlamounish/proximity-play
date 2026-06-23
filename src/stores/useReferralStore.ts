import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredEmail: string;
  status: 'pending' | 'signed_up' | 'active';
  createdAt: Date;
  activatedAt?: Date;
}

interface ReferralStats {
  totalInvites: number;
  signups: number;
  activeUsers: number;
  rewardTier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface ReferralState {
  referrals: Referral[];
  referralCode: string;
  generateCode: () => string;
  addReferral: (referral: Omit<Referral, 'id' | 'createdAt' | 'status'>) => void;
  activateReferral: (referralId: string) => void;
  getStats: (userId: string) => ReferralStats;
  setReferralCode: (code: string) => void;
}

export const useReferralStore = create<ReferralState>()(
  persist(
    (set, get) => ({
      referrals: [],
      referralCode: '',
      generateCode: () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        set({ referralCode: code });
        return code;
      },
      addReferral: (referral) =>
        set((state) => ({
          referrals: [
            ...state.referrals,
            {
              ...referral,
              id: crypto.randomUUID(),
              createdAt: new Date(),
              status: 'pending',
            },
          ],
        })),
      activateReferral: (referralId) =>
        set((state) => ({
          referrals: state.referrals.map((r) =>
            r.id === referralId
              ? { ...r, status: 'active', activatedAt: new Date() }
              : r
          ),
        })),
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
      setReferralCode: (code) => set({ referralCode: code }),
    }),
    {
      name: 'referral-storage',
    }
  )
);
