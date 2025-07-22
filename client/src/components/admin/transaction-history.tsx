import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, Download, Eye, CheckCircle, XCircle, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types
type Transaction = {
  id: number;
  type: string;
  amount: string;
  price: string;
  totalValue: string;
  paymentMethod: string;
  status: string;
  metadata: any;
  createdAt: string;
};

type TransactionWithDetails = {
  transaction: Transaction;
  user: {
    id: number;
    username: string;
  };
  coin: {
    id: number;
    name: string;
    symbol: string;
  };
};

type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type TransactionsResponse = {
  transactions: TransactionWithDetails[];
  pagination: PaginationInfo;
};

export function TransactionHistory() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch transactions
  const { data, isLoading, error } = useQuery<TransactionsResponse>({
    queryKey: ["/api/admin/transactions", page, limit, statusFilter],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (statusFilter) {
        queryParams.append('status', statusFilter);
      }

      const response = await fetch(`/api/admin/transactions?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      return await response.json();
    }
  });

  // Mutation for verifying cryptocurrency transactions
  const verifyMutation = useMutation({
    mutationFn: async ({ 
      transactionId, 
      status, 
      notes 
    }: { 
      transactionId: number; 
      status: "approved" | "rejected"; 
      notes: string 
    }) => {
      const response = await apiRequest(
        "PATCH", 
        `/api/admin/transactions/${transactionId}/verify`,
        { status, adminNotes: notes }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to verify transaction");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      setSelectedTransaction(null);
      setAdminNotes("");

      toast({
        title: "Transaction verified",
        description: "The cryptocurrency transaction has been processed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Failed to verify transaction",
        variant: "destructive",
      });
    }
  });

  // Handle error with useEffect
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Failed to load transactions",
        description: (error as Error)?.message || "An error occurred while fetching transactions.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Handle page change
  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (data && page < data.pagination.totalPages) {
      setPage(page + 1);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get badge color based on transaction type
  const getTypeBadgeProps = (type: string) => {
    switch (type.toLowerCase()) {
      case 'buy':
        return { variant: "default" as const, className: "text-xs bg-green-100 text-green-800 hover:bg-green-100" };
      case 'sell':
        return { variant: "destructive" as const, className: "text-xs" };
      default:
        return { variant: "secondary" as const, className: "text-xs" };
    }
  };

  // Get badge color based on payment method
  const getPaymentMethodBadgeProps = (method: string) => {
    switch (method.toLowerCase()) {
      case 'crypto':
        return { variant: "default" as const, className: "text-xs bg-violet-600 hover:bg-violet-700" };
      case 'stripe':
        return { variant: "default" as const, className: "text-xs bg-blue-600 hover:bg-blue-700" };
      default:
        return { variant: "secondary" as const, className: "text-xs" };
    }
  };

  // Get badge color based on status
  const getStatusBadgeProps = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return { variant: "default" as const, className: "text-xs bg-green-100 text-green-800 hover:bg-green-100" };
      case 'pending':
        return { variant: "secondary" as const, className: "text-xs" };
      case 'pending_verification':
        return { variant: "default" as const, className: "text-xs bg-amber-100 text-amber-800 hover:bg-amber-100" };
      case 'rejected':
        return { variant: "destructive" as const, className: "text-xs" };
      case 'failed':
        return { variant: "destructive" as const, className: "text-xs" };
      default:
        return { variant: "outline" as const, className: "text-xs" };
    }
  };

  // Handle transaction verification
  const handleVerifyTransaction = (status: "approved" | "rejected") => {
    if (!selectedTransaction) return;

    verifyMutation.mutate({
      transactionId: selectedTransaction.transaction.id,
      status,
      notes: adminNotes
    });
  };

  // View transaction details
  const handleViewTransaction = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Render error state
  if (error || !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          <p className="font-medium">Failed to load transactions</p>
          <p className="text-sm">{(error as Error)?.message || "Please try again later."}</p>
        </div>
      </div>
    );
  }

  const { transactions, pagination } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          <span>Export</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>
                A complete record of all platform transactions
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by Status:</span>
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) => {
                  setStatusFilter(value === "all" ? null : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_verification">Pending Verification</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-3 font-medium">ID</th>
                  <th className="text-left py-3 font-medium">USER</th>
                  <th className="text-left py-3 font-medium">COIN</th>
                  <th className="text-left py-3 font-medium">TYPE</th>
                  <th className="text-left py-3 font-medium">AMOUNT</th>
                  <th className="text-left py-3 font-medium">VALUE</th>
                  <th className="text-left py-3 font-medium">PAYMENT</th>
                  <th className="text-left py-3 font-medium">STATUS</th>
                  <th className="text-left py-3 font-medium">DATE</th>
                  <th className="text-left py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr key={item.transaction.id} className="border-b">
                      <td className="py-3 font-medium">{item.transaction.id}</td>
                      <td className="py-3">{item.user.username}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{item.coin.symbol}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge {...getTypeBadgeProps(item.transaction.type)}>
                          {item.transaction.type}
                        </Badge>
                      </td>
                      <td className="py-3">{parseFloat(item.transaction.amount).toFixed(8)}</td>
                      <td className="py-3 font-medium">{formatCurrency(parseFloat(item.transaction.totalValue))}</td>
                      <td className="py-3">
                        <Badge {...getPaymentMethodBadgeProps(item.transaction.paymentMethod)}>
                          {item.transaction.paymentMethod}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge {...getStatusBadgeProps(item.transaction.status)}>
                          {item.transaction.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-xs">{formatDate(item.transaction.createdAt)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleViewTransaction(item)}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View details</span>
                          </Button>
                          {item.transaction.status === "pending_verification" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  verifyMutation.mutate({
                                    transactionId: item.transaction.id,
                                    status: "rejected",
                                    notes: "Transaction rejected from transaction history"
                                  });
                                }}
                                disabled={verifyMutation.isPending}
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="sr-only">Reject</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  verifyMutation.mutate({
                                    transactionId: item.transaction.id,
                                    status: "approved",
                                    notes: "Transaction approved from transaction history"
                                  });
                                }}
                                disabled={verifyMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                                <span className="sr-only">Approve</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.page * pagination.limit - pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Rows per page</span>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    setLimit(parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue placeholder={limit.toString()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous page</span>
                </Button>
                <div className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={page >= pagination.totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next page</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information for transaction #{selectedTransaction?.transaction.id}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Transaction ID</h4>
                  <p className="font-medium">{selectedTransaction.transaction.id}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Date</h4>
                  <p>{formatDate(selectedTransaction.transaction.createdAt)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">User</h4>
                  <p>{selectedTransaction.user.username} (ID: {selectedTransaction.user.id})</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Coin</h4>
                  <p>{selectedTransaction.coin.name} ({selectedTransaction.coin.symbol})</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Type</h4>
                  <Badge {...getTypeBadgeProps(selectedTransaction.transaction.type)}>
                    {selectedTransaction.transaction.type}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                  <Badge {...getStatusBadgeProps(selectedTransaction.transaction.status)}>
                    {selectedTransaction.transaction.status}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Amount</h4>
                  <p>{parseFloat(selectedTransaction.transaction.amount).toFixed(8)} {selectedTransaction.coin.symbol}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Price</h4>
                  <p>{formatCurrency(parseFloat(selectedTransaction.transaction.price))}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Total Value</h4>
                  <p className="font-medium">{formatCurrency(parseFloat(selectedTransaction.transaction.totalValue))}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Payment Method</h4>
                  <Badge {...getPaymentMethodBadgeProps(selectedTransaction.transaction.paymentMethod)}>
                    {selectedTransaction.transaction.paymentMethod}
                  </Badge>
                </div>
              </div>

              {selectedTransaction.transaction.metadata && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Payment Details</h4>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto">
                    <pre>{JSON.stringify(selectedTransaction.transaction.metadata, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Verification controls for crypto payments pending verification */}
              {selectedTransaction.transaction.paymentMethod === "crypto" && 
               selectedTransaction.transaction.status === "pending_verification" && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-bold mb-3">Verify Cryptocurrency Transaction</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Please verify this transaction by checking the blockchain for the transaction hash.
                      </p>
                      <p className="text-sm text-amber-600 font-medium mb-4">
                        This purchase will only be added to the user's portfolio after verification.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="admin-notes" className="text-sm font-medium">
                        Admin Notes (optional)
                      </label>
                      <Textarea
                        id="admin-notes"
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add any notes about the verification"
                        className="mt-1 w-full"
                      />
                    </div>

                    <div className="flex space-x-2 justify-end pt-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleVerifyTransaction("rejected")}
                        disabled={verifyMutation.isPending}
                        className="flex items-center"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reject Transaction
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => handleVerifyTransaction("approved")}
                        disabled={verifyMutation.isPending}
                        className="flex items-center"
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Approve Transaction
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {verifyMutation.isPending ? (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => setSelectedTransaction(null)}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}