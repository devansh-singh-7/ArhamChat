export function formatSupabaseError(error, fallbackMessage = 'Something went wrong.') {
  const message = error?.message || fallbackMessage

  if (message.includes("Could not find the table 'public.profiles'")) {
    return 'Database setup is incomplete: the public.profiles table is missing. Run supabase/start-chat-setup.sql in the Supabase SQL Editor, then refresh the app.'
  }

  return message
}
