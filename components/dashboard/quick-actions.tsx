import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, MessageSquare, Wallet, CreditCard } from "lucide-react"
import Link from "next/link"

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acciones Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button asChild variant="outline" className="justify-start bg-transparent">
          <Link href="/dashboard/transactions/new">
            <Plus className="mr-2 size-4" />
            Agregar Transacción
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start bg-transparent">
          <Link href="/dashboard/whatsapp">
            <MessageSquare className="mr-2 size-4 text-[#25D366]" />
            Conectar WhatsApp
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start bg-transparent">
          <Link href="/dashboard/accounts">
            <Wallet className="mr-2 size-4" />
            Gestionar Cuentas
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start bg-transparent">
          <Link href="/dashboard/categories">
            <CreditCard className="mr-2 size-4" />
            Ver Categorías
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
