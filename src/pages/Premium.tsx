import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Crown, Sparkles, Map, MessageSquare, Shield, Star, Zap, Lock,
  Check, CreditCard, Palette, Navigation as NavIcon, MapPin, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PremiumFeature {
  icon: React.ReactNode;
  title: string;
  description: string;
  tier: 'free' | 'pro' | 'elite';
}

const FEATURES: PremiumFeature[] = [
  // Free
  { icon: <MapPin />, title: 'Basic Map', description: 'Standard map view', tier: 'free' },
  { icon: <MessageSquare />, title: 'Text Chat', description: 'Send messages to friends', tier: 'free' },
  { icon: <Shield />, title: 'Ghost Mode', description: 'Hide your location', tier: 'free' },
  // Pro
  { icon: <Map />, title: 'All Map Themes', description: 'Dark, Satellite, Retro & more', tier: 'pro' },
  { icon: <Zap />, title: 'Dead Drops', description: 'Leave hidden location messages', tier: 'pro' },
  { icon: <NavIcon />, title: 'Live Trip Sharing', description: 'Share route + ETA in real-time', tier: 'pro' },
  { icon: <MessageSquare />, title: 'Voice Notes', description: 'Hold-to-talk audio messages', tier: 'pro' },
  { icon: <Sparkles />, title: 'Memory Lane', description: 'Personal location heatmaps', tier: 'pro' },
  // Elite
  { icon: <Crown />, title: '3D Avatar Frames', description: 'Exclusive animated profile borders', tier: 'elite' },
  { icon: <Palette />, title: 'Custom Map Icons', description: 'Personalized map marker designs', tier: 'elite' },
  { icon: <Star />, title: 'Priority Support', description: '24/7 dedicated support', tier: 'elite' },
  { icon: <Shield />, title: 'AI Safety Alerts', description: 'Smart anomaly detection & alerts', tier: 'elite' },
];

// Safe Vite env accessor (works with both Vite and non-Vite TS configs)
const getEnv = (key: string): string => {
  try {
    // @ts-ignore — Vite injects import.meta.env at build time
    return (import.meta as any).env?.[key] || '';
  } catch {
    return '';
  }
};

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99',
    period: '/month',
    description: 'Everything you need for a premium social experience',
    color: 'from-violet-500 to-indigo-500',
    badge: 'Most Popular',
    features: FEATURES.filter(f => f.tier === 'pro').map(f => f.title),
    priceId: getEnv('VITE_STRIPE_PRO_PRICE_ID') || 'price_pro_placeholder',
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '$9.99',
    period: '/month',
    description: 'All Pro features + exclusive perks and customization',
    color: 'from-amber-500 to-orange-500',
    badge: 'Premium',
    features: [...FEATURES.filter(f => f.tier === 'pro'), ...FEATURES.filter(f => f.tier === 'elite')].map(f => f.title),
    priceId: getEnv('VITE_STRIPE_ELITE_PRICE_ID') || 'price_elite_placeholder',
  },
];

// ── Premium badge for export ─────────────────────────────────────────────────
export function PremiumBadge({ tier = 'pro' }: { tier?: 'pro' | 'elite' }) {
  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-bold text-white
        ${tier === 'elite'
          ? 'bg-gradient-to-r from-amber-500 to-orange-500'
          : 'bg-gradient-to-r from-violet-500 to-indigo-500'
        }`}
    >
      <Crown className="h-2.5 w-2.5" />
      {tier === 'elite' ? 'Elite' : 'Pro'}
    </div>
  );
}

function LockedFeature({ title, description, icon }: PremiumFeature) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 opacity-60 relative overflow-hidden">
      <div className="p-2 bg-background rounded-lg text-muted-foreground">
        {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4' })}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const Premium = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  if (!user && !loading) return <Navigate to="/auth" replace />;

  const handleCheckout = async (plan: typeof PLANS[0]) => {
    const stripeKey = getEnv('VITE_STRIPE_PUBLIC_KEY');

    if (!stripeKey || stripeKey === 'your_stripe_key') {
      toast({
        title: '💳 Stripe not configured',
        description: 'Add VITE_STRIPE_PUBLIC_KEY to your .env to enable payments',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      // In production: call your Supabase edge function to create a Stripe checkout session
      toast({
        title: `✨ ${plan.name} Plan`,
        description: 'Redirecting to Stripe checkout...',
      });
      // window.location.href = checkoutUrl;
    } catch (err: any) {
      toast({ title: 'Checkout failed', description: err.message, variant: 'destructive' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(245,158,11,0.15))' }}>
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Unlock the full experience</span>
            </div>
            <h1 className="text-4xl font-bold mb-3">
              Go{' '}
              <span className="bg-gradient-to-r from-violet-500 to-amber-500 bg-clip-text text-transparent">
                Premium
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Dead drops, live trips, AR view, memory heatmaps, and exclusive customization —
              all in one plan. No data selling, ever.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {PLANS.map(plan => (
              <Card
                key={plan.id}
                className={`relative overflow-hidden border-0 shadow-lg ${
                  plan.id === 'pro' ? 'ring-2 ring-violet-500/50' : ''
                }`}
              >
                {/* Gradient header */}
                <div className={`h-2 bg-gradient-to-r ${plan.color}`} />

                <CardHeader className="pb-2">
                  {plan.badge && (
                    <Badge className="w-fit text-xs mb-2" variant="secondary">{plan.badge}</Badge>
                  )}
                  <CardTitle className="flex items-end gap-1">
                    <span className="text-3xl font-black">{plan.price}</span>
                    <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>
                  </CardTitle>
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className={`w-full bg-gradient-to-r ${plan.color} border-0 text-white hover:opacity-90`}
                    onClick={() => handleCheckout(plan)}
                    disabled={checkoutLoading === plan.id}
                  >
                    {checkoutLoading === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Get {plan.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Locked features showcase */}
          <Card className="glass border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" />
                Locked Features (Preview)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {FEATURES.filter(f => f.tier !== 'free').map(f => (
                  <LockedFeature key={f.title} {...f} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Footer trust signals */}
          <div className="text-center mt-6 text-xs text-muted-foreground space-y-1">
            <p>🔒 Secure payment via Stripe · Cancel anytime · No hidden fees</p>
            <p>We never sell your location data — your privacy is the product, not your data</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Premium;
