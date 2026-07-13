import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyRegistrationResponse } from "npm:@simplewebauthn/server@13";
import { isoBase64URL } from "npm:@simplewebauthn/server@13/helpers";
import { corsHeaders } from "../_shared/cors.ts";
import { getCallerUserId } from "../_shared/auth.ts";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

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

    const { credential, name, deviceType } = await req.json();
    if (!credential) {
      return new Response(JSON.stringify({ error: "Missing credential" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpID = Deno.env.get("WEBAUTHN_RP_ID") ?? "localhost";
    const origin = Deno.env.get("WEBAUTHN_ORIGIN") ?? `https://${rpID}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: challengeRow, error: challengeError } = await supabase
      .from("webauthn_challenges")
      .select("id, challenge, created_at")
      .eq("user_id", callerUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError || !challengeRow) {
      return new Response(JSON.stringify({ error: "No pending registration challenge" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Date.now() - new Date(challengeRow.created_at).getTime() > CHALLENGE_TTL_MS) {
      await supabase.from("webauthn_challenges").delete().eq("id", challengeRow.id);
      return new Response(JSON.stringify({ error: "Challenge expired, please retry" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    // Challenge is single-use regardless of outcome.
    await supabase.from("webauthn_challenges").delete().eq("id", challengeRow.id);

    if (!verification.verified || !verification.registrationInfo) {
      return new Response(JSON.stringify({ verified: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { credential: registered } = verification.registrationInfo;

    const { error: insertError } = await supabase.from("webauthn_credentials").insert({
      user_id: callerUserId,
      credential_id: registered.id,
      public_key: isoBase64URL.fromBuffer(registered.publicKey),
      counter: registered.counter,
      transports: registered.transports ?? null,
      name: name ?? "Device",
      type: deviceType ?? "fingerprint",
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webauthn-register-verify error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
