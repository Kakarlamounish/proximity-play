import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getCallerUserId } from "../_shared/auth.ts";

// Runs with the service role because redeeming a code is an action taken by
// the REFERRED user, not the referrer — and referrals_insert_own only allows
// a row's referrer_id to insert it. A client-side insert can never satisfy
// that RLS check for this flow, so it has to happen here.
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const callerUserId = await getCallerUserId(req);
    if (!callerUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Missing referral code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: referrer, error: referrerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", code.toUpperCase())
      .maybeSingle();

    if (referrerError || !referrer) {
      return new Response(JSON.stringify({ error: "Invalid referral code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (referrer.id === callerUserId) {
      return new Response(JSON.stringify({ error: "You can't refer yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", callerUserId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Referral already redeemed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(callerUserId);
    if (authUserError || !authUser?.user?.email) {
      return new Response(JSON.stringify({ error: "Could not resolve your account email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("referrals").insert({
      referrer_id: referrer.id,
      referred_user_id: callerUserId,
      referred_email: authUser.user.email,
      status: "signed_up",
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("redeem-referral error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
