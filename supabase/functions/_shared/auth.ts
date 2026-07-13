import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Verifies the caller's JWT and returns their user id, or null if the
// request isn't authenticated. Mirrors the pattern already used by
// send-push-notification so all functions authenticate the same way.
export async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await callerClient.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}
