import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplateManager } from './template-manager'

export default async function TemplatesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const { data: templates } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('day_of_month', { ascending: true })

  return <TemplateManager user={user} initialTemplates={templates || []} />
}
