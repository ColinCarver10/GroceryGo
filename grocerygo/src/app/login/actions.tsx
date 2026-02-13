'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import type { UserInsert } from '@/types/database'
import type { PostgrestError } from '@supabase/supabase-js';
import { getPostHogClient } from '@/lib/posthog-server';
import { logDatabaseError, logAuthError } from '@/utils/errorLogger';


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
      logDatabaseError('ensureUserExists', insertError, {
        table: 'users',
        operation: 'INSERT',
        queryParams: { user_id: userId, email }
      }, userId)
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
    logAuthError('login', error, {
      operation: 'signInWithPassword',
      authErrorType: 'invalid_credentials'
    }, data.email)
    // Track login error
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: data.email,
      event: 'login_error',
      properties: {
        email: data.email,
        error_message: 'Invalid credentials',
        auth_method: 'email'
      }
    });
    redirect('/login?error=' + encodeURIComponent('Invalid credentials. Please check your email and password.'))
  }

  // Ensure user exists in users table
  if (authData.user) {
    await ensureUserExists(supabase, authData.user.id, authData.user.email || data.email)
  }

  // Track successful login
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: authData.user.id,
    event: 'user_logged_in',
    properties: {
      email: authData.user.email,
      auth_method: 'email'
    }
  });
  posthog.identify({
    distinctId: authData.user.id,
    properties: {
      email: authData.user.email
    }
  });

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
    logAuthError('signup', error, {
      operation: 'signUp',
      authErrorType: 'signup_error'
    }, data.email)
    // Track signup error
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: data.email,
      event: 'login_error',
      properties: {
        email: data.email,
        error_message: error.message,
        auth_method: 'email',
        action: 'signup'
      }
    });
    redirect('/login?error=' + encodeURIComponent(error.message || 'Failed to create account. Please try again.'))
  }

  // Ensure user exists in users table
  if (authData.user) {
    await ensureUserExists(supabase, authData.user.id, authData.user.email || data.email)

    // Track successful signup
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: authData.user.id,
      event: 'user_signed_up',
      properties: {
        email: authData.user.email,
        auth_method: 'email'
      }
    });
    posthog.identify({
      distinctId: authData.user.id,
      properties: {
        email: authData.user.email,
        created_at: new Date().toISOString()
      }
    });
  }

  revalidatePath('/', 'layout')
  redirect('/login?success=check_email')
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  // Track Google sign-in initiation
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: 'anonymous',
    event: 'user_logged_in_google',
    properties: {
      auth_method: 'google',
      action: 'initiated'
    }
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL + '/auth/callback' || 'https://grocerygo.co/auth/callback'}`,
    },
  })

  if (error) {
    logAuthError('signInWithGoogle', error, {
      operation: 'signInWithOAuth',
      authErrorType: 'oauth_error'
    })
    posthog.capture({
      distinctId: 'anonymous',
      event: 'login_error',
      properties: {
        error_message: error.message,
        auth_method: 'google'
      }
    });
    redirect('/login?error=' + encodeURIComponent(error.message || 'Failed to sign in with Google. Please try again.'))
  }

  if (data.url) {
    redirect(data.url)
  }
}