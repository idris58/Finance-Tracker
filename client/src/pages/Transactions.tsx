import { useTransactions, useDeleteTransaction, useSettings } from "@/hooks/use-finance";
import { format } from "date-fns";
import { Trash2, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: transactions, isLoading } = useTransactions();
  const { data: settings } = useSettings();
  const { mutate: deleteTx } = useDeleteTransaction();

  const currency = settings?.currencySymbol || "৳";

  // Client-side filtering for simplicity, though API supports params
  const filteredTx = transactions?.filter(tx => 
    tx.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <h1 className="text-3xl font-bold font-display">Transactions</h1>
        
        <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                    placeholder="Search expenses..." 
                    className="pl-9 bg-card/50 border-white/10 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button variant="outline" className="border-white/10 bg-card/50 rounded-xl">
                <Filter className="w-4 h-4" />
            </Button>
        </div>
      </div>

      <div className="glass-card rounded-3xl border border-white/5 overflow-hidden min-h-[500px]">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl bg-white/5" />)}
          </div>
        ) : filteredTx?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 opacity-50" />
            </div>
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredTx?.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-lg">
                    {tx.categoryName?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm md:text-base">{tx.categoryName}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(tx.date), "MMM d, yyyy")}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                        <span>{tx.paymentMethod}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="font-mono font-bold text-foreground">-{currency}{Number(tx.amount).toLocaleString()}</div>
                        {tx.note && <div className="text-[10px] text-muted-foreground/70 max-w-[100px] truncate">{tx.note}</div>}
                    </div>
                    
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-white/10">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This cannot be undone. This will permanently delete this transaction from your history.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-white/10 hover:bg-white/5">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTx(tx.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
