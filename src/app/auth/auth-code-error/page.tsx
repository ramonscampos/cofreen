'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AuthCodeError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-red-500/10 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Erro de Autenticação</h1>
        <p className="text-zinc-400">
          Ocorreu um problema ao tentar fazer login.
        </p>

        {error && (
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded text-red-400 text-sm break-all font-mono">
                {error}
            </div>
        )}

        <div className="pt-4">
           <Link href="/login">
             <Button type="button" className="w-full">
               Tentar Novamente
             </Button>
           </Link>
        </div>
      </div>
    </div>
  )
}
