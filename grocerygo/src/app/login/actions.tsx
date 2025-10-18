'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import type { UserInsert } from '@/types/database'

async function ensureUserExists(supabase: any, userId: string, email: string) {
  console.log('ensureUserExists', userId, email)
  // Check if user exists in users table
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('user_id', userId)
    .single()

  console.log('existingUser', existingUser)
  console.log('checkError', checkError)
  // If user doesn't exist, create them
  // PGRST116 means no rows were found, which is expected for new users
  if (!existingUser || checkError?.code === 'PGRST116') {
    const newUser: UserInsert = {
      user_id: userId,
      email: email,
    }
    console.log('newUser', newUser)
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
    redirect('/error')
  }

  // Ensure user exists in users table
  if (authData.user) {
    await ensureUserExists(supabase, authData.user.id, authData.user.email || data.email)
  }

  revalidatePath('/', 'layout')
  redirect('/')
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
    redirect('/error')
  }

  // Ensure user exists in users table
  if (authData.user) {
    await ensureUserExists(supabase, authData.user.id, authData.user.email || data.email)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}