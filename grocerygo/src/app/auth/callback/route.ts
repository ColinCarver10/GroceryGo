import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { UserInsert } from '@/types/database'
import type { PostgrestError } from '@supabase/supabase-js'

async function ensureUserExists(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, email: string) {
  // Check if user exists in users table
  const { data: existingUser, error: checkError 
  } : { data: { id: string } | null; error: PostgrestError | null } = await supabase
    .from('users')
    .select('id')
    .eq('user_id', userId)
    .single()

  // If user doesn't exist, create them
  // PGRST116 means no rows were found, which is expected for new users
  if (!existingUser || checkError?.code === 'PGRST116') {
    const newUser: UserInsert = {
      user_id: userId,
      email: email,
      first_login_flag: true,
    }
    const { error: insertError } = await supabase
      .from('users')
      .insert(newUser)

    if (insertError) {
      console.error('Error creating user in users table:', insertError)
    }
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      return redirect('/login?error=' + encodeURIComponent('Failed to authenticate. Please try again.'))
    }

    if (data.user) {
      // Ensure user exists in users table
      await ensureUserExists(supabase, data.user.id, data.user.email || '')
      
      // Check if user has completed the questionnaire
      const { data: userData } = await supabase
        .from('users')
        .select('survey_response')
        .eq('user_id', data.user.id)
        .single()

      revalidatePath('/', 'layout')
      
      // Redirect based on questionnaire completion
      if (userData?.survey_response) {
        return redirect('/dashboard')
      } else {
        return redirect('/onboarding')
      }
    }
  }

  // If no code, redirect to login
  return redirect('/login?error=' + encodeURIComponent('Authentication failed. Please try again.'))
}

