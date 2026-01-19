import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Plus } from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { TransactionWithRelations } from "@/lib/database.types"

interface RecentTransactionsProps {
  transactions: TransactionWithRelations[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Transacciones Recientes</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/transactions">
            Ver Todas
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {transactions && transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: transaction.category?.color || "#94a3b8" }}
                  >
                    {transaction.category?.name_es?.[0] || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {transaction.merchant_name || transaction.description || "Sin descripción"}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatDate(transaction.transaction_date)}</p>
                      {transaction.needs_review && (
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                          Revisar
                        </span>
                      )}
                      {transaction.source !== "manual" && (
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                          {transaction.source === "whatsapp" ? "WhatsApp" : transaction.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold ${transaction.category?.type === "expense" ? "text-red-600" : "text-green-600"}`}
                >
                  {transaction.category?.type === "expense" ? "-" : "+"}
                  {formatCurrency(Math.abs(Number(transaction.amount)))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="mb-3 rounded-full bg-muted p-3">
              <ArrowRight className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Aún no hay transacciones</p>
            <p className="text-xs text-muted-foreground mb-4">Agrega tu primera transacción para comenzar</p>
            <Button asChild size="sm">
              <Link href="/dashboard/transactions/new">
                <Plus className="mr-1 size-4" />
                Agregar Primera
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
