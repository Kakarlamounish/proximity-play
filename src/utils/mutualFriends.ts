import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the count of mutual friends between the current user and another user.
 */
export async function getMutualFriendsCount(
  currentUserId: string,
  otherUserId: string
): Promise<number> {
  // Get current user's friends
  const { data: myFriendships } = await supabase
    .from('friendships')
    .select('user_id_1, user_id_2')
    .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`);

  const myFriendIds = new Set(
    (myFriendships || []).map((f) =>
      f.user_id_1 === currentUserId ? f.user_id_2 : f.user_id_1
    )
  );

  // Get other user's friends
  const { data: theirFriendships } = await supabase
    .from('friendships')
    .select('user_id_1, user_id_2')
    .or(`user_id_1.eq.${otherUserId},user_id_2.eq.${otherUserId}`);

  const theirFriendIds = new Set(
    (theirFriendships || []).map((f) =>
      f.user_id_1 === otherUserId ? f.user_id_2 : f.user_id_1
    )
  );

  let count = 0;
  for (const id of myFriendIds) {
    if (theirFriendIds.has(id)) count++;
  }
  return count;
}

/**
 * Batch version: returns a map of userId -> mutual friend count.
 */
export async function getMutualFriendsCountBatch(
  currentUserId: string,
  otherUserIds: string[]
): Promise<Map<string, number>> {
  if (otherUserIds.length === 0) return new Map();

  // Get current user's friends
  const { data: myFriendships } = await supabase
    .from('friendships')
    .select('user_id_1, user_id_2')
    .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`);

  const myFriendIds = new Set(
    (myFriendships || []).map((f) =>
      f.user_id_1 === currentUserId ? f.user_id_2 : f.user_id_1
    )
  );

  const result = new Map<string, number>();

  // For each other user, get their friends and count overlap
  for (const otherId of otherUserIds) {
    const { data: theirFriendships } = await supabase
      .from('friendships')
      .select('user_id_1, user_id_2')
      .or(`user_id_1.eq.${otherId},user_id_2.eq.${otherId}`);

    const theirFriendIds = new Set(
      (theirFriendships || []).map((f) =>
        f.user_id_1 === otherId ? f.user_id_2 : f.user_id_1
      )
    );

    let count = 0;
    for (const id of myFriendIds) {
      if (theirFriendIds.has(id)) count++;
    }
    result.set(otherId, count);
  }

  return result;
}
