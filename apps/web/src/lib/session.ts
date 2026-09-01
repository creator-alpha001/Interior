/**
 * Who the app is signed in as. A single constant now; when auth lands this
 * becomes a session lookup and every caller stays as it is.
 *
 * Lives here rather than in actions.ts because a "use server" module may only
 * export async functions.
 */
export const DEMO_USER_ID = "user-client-priya";
