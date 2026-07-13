import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuthenticationResponse } from "npm:@simplewebauthn/server@13";
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

    const { credential } = await req.json();
    if (!credential?.id) {
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
      return new Response(JSON.stringify({ error: "No pending authentication challenge" }), {
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

    const { data: storedCredential, error: credError } = await supabase
      .from("webauthn_credentials")
      .select("credential_id, public_key, counter, transports")
      .eq("user_id", callerUserId)
      .eq("credential_id", credential.id)
      .maybeSingle();

    if (credError || !storedCredential) {
      return new Response(JSON.stringify({ error: "Unknown credential" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.credential_id,
        publicKey: isoBase64URL.toBuffer(storedCredential.public_key),
        counter: storedCredential.counter,
        transports: storedCredential.transports ?? undefined,
      },
    });

    // Challenge is single-use regardless of outcome.
    await supabase.from("webauthn_challenges").delete().eq("id", challengeRow.id);

    if (!verification.verified) {
      return new Response(JSON.stringify({ verified: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("webauthn_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used: new Date().toISOString(),
      })
      .eq("user_id", callerUserId)
      .eq("credential_id", credential.id);

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webauthn-authenticate-verify error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
