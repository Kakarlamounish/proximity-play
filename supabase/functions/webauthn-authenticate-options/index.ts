import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateAuthenticationOptions } from "npm:@simplewebauthn/server@13";
import { corsHeaders } from "../_shared/cors.ts";
import { getCallerUserId } from "../_shared/auth.ts";

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

    const rpID = Deno.env.get("WEBAUTHN_RP_ID") ?? "localhost";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: credentials } = await supabase
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", callerUserId);

    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ error: "No registered authenticators" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
        transports: c.transports ?? undefined,
      })),
      userVerification: "preferred",
    });

    await supabase.from("webauthn_challenges").delete().eq("user_id", callerUserId);
    await supabase.from("webauthn_challenges").insert({
      user_id: callerUserId,
      challenge: options.challenge,
    });

    return new Response(JSON.stringify(options), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webauthn-authenticate-options error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
