'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getPostHogClient } from '@/lib/posthog-server';

export async function logout() {
  const supabase = await createClient()

  // Get current user before signing out
  const { data: { user } } = await supabase.auth.getUser()

  // Track logout event
  if (user) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: 'user_logged_out',
      properties: {
        email: user.email
      }
    });
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

