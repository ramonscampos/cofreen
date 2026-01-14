import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CardManager } from './card-manager'
import { getCurrentMonthRef } from '@/lib/finance-logic'

interface SearchParams {
  month?: string
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const params = await searchParams
  const monthRef = params.month || getCurrentMonthRef()

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const { data: cardTransactions } = await supabase
    .from('card_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('month_ref', monthRef)

  return (
    <CardManager 
      user={user} 
      initialCards={cards || []} 
      monthRef={monthRef}
      initialCardTransactions={cardTransactions || []}
    />
  )
}
