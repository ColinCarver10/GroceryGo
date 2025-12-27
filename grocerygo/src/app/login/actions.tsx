'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import type { UserInsert } from '@/types/database'
import type { PostgrestError } from '@supabase/supabase-js';


type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function ensureUserExists(supabase: SupabaseServerClient, userId: string, email: string) {
  console.log('ensureUserExists', userId, email)
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

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword(data)
  if (error) {
    redirect('/login?error=' + encodeURIComponent('Invalid credentials. Please check your email and password.'))
  }

  // Ensure user exists in users table
  if (authData.user) {
    await ensureUserExists(supabase, authData.user.id, authData.user.email || data.email)
  }

  // Check if user has completed the questionnaire
  const { data: userData } = await supabase
    .from('users')
    .select('survey_response')
    .eq('user_id', authData.user.id)
    .single()

  revalidatePath('/', 'layout')
  
  // Redirect based on questionnaire completion
  if (userData?.survey_response) {
    redirect('/dashboard')
  } else {
    redirect('/onboarding')
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: authData, error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message || 'Failed to create account. Please try again.'))
  }

  // Ensure user exists in users table
  if (authData.user) {
    await ensureUserExists(supabase, authData.user.id, authData.user.email || data.email)
  }

  revalidatePath('/', 'layout')
  // New users should complete the questionnaire
  redirect('/onboarding')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL + '/auth/callback' || 'http://localhost:3000/auth/callback'}`,
    },
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message || 'Failed to sign in with Google. Please try again.'))
  }

  if (data.url) {
    redirect(data.url)
  }
}