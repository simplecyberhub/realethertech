import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Clock, User, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Types
type PendingTransaction = {
  transaction: {
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
  user: {
    id: number;
    username: string;
    email: string;
  };
  coin: {
    id: number;
    name: string;
    symbol: string;
  };
};

type PendingActivitiesResponse = {
  pendingTransactions: PendingTransaction[];
  summary: {
    totalPending: number;
    totalValue: number;
  };
};

export function PendingActivities() {
  const { toast } = useToast();
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [showBulkActionDialog, setShowBulkActionDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'decline' | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch pending activities
  const { data, isLoading, error } = useQuery<PendingActivitiesResponse>({
    queryKey: ["/api/admin/pending"],
    queryFn: async () => {
      const response = await fetch("/api/admin/pending", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch pending activities");
      }
      return await response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Handle error with useEffect
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Failed to load pending activities",
        description: (error as Error)?.message || "An error occurred while fetching pending activities.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Individual transaction verification mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ transactionId, status, notes }: { transactionId: number; status: string; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/transactions/${transactionId}/verify`, {
        status,
        adminNotes: notes
      });
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({
        title: `Transaction ${variables.status}`,
        description: `Transaction has been successfully ${variables.status}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "An error occurred while verifying the transaction.",
        variant: "destructive",
      });
    },
  });

  // Bulk action mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ transactionIds, action, notes }: { transactionIds: number[]; action: string; notes: string }) => {
      const response = await apiRequest("POST", "/api/admin/transactions/bulk-action", {
        transactionIds,
        action,
        adminNotes: notes
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      setSelectedTransactions([]);
      setShowBulkActionDialog(false);
      setBulkAction(null);
      setAdminNotes("");
      toast({
        title: "Bulk action completed",
        description: `${data.processedCount} transactions have been ${data.action}d successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk action failed",
        description: error.message || "An error occurred while processing the bulk action.",
        variant: "destructive",
      });
    },
  });

  const handleIndividualAction = (transactionId: number, action: 'approve' | 'decline') => {
    const status = action === 'approve' ? 'approved' : 'rejected';
    const notes = action === 'approve' 
      ? 'Transaction approved by admin' 
      : 'Transaction declined by admin';

    verifyMutation.mutate({ transactionId, status, notes });
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedTransactions.length === 0) return;

    bulkActionMutation.mutate({
      transactionIds: selectedTransactions,
      action: bulkAction,
      notes: adminNotes || `Bulk ${bulkAction} action performed by admin`
    });
  };

  const handleSelectTransaction = (transactionId: number, checked: boolean) => {
    if (checked) {
      setSelectedTransactions(prev => [...prev, transactionId]);
    } else {
      setSelectedTransactions(prev => prev.filter(id => id !== transactionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.pendingTransactions) {
      setSelectedTransactions(data.pendingTransactions.map(t => t.transaction.id));
    } else {
      setSelectedTransactions([]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading pending activities...</span>
      </div>
    );
  }

  if (!data?.pendingTransactions?.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-500">No pending transactions require your attention.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Activities</h1>
          <p className="text-muted-foreground">
            Review and approve pending user transactions
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Transactions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.summary.totalPending}</div>
            <p className="text-xs text-orange-600 mt-1">Require approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedTransactions.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Bulk Actions</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex items-center gap-4">
              <span>{selectedTransactions.length} transactions selected</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setBulkAction('approve');
                    setShowBulkActionDialog(true);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve All
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setBulkAction('decline');
                    setShowBulkActionDialog(true);
                  }}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Decline All
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Transactions</CardTitle>
              <CardDescription>
                Review cryptocurrency transactions awaiting verification
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedTransactions.length === data.pendingTransactions.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.pendingTransactions.map((item) => (
              <div key={item.transaction.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedTransactions.includes(item.transaction.id)}
                      onCheckedChange={(checked) => 
                        handleSelectTransaction(item.transaction.id, checked as boolean)
                      }
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                        <Badge variant="secondary">
                          {item.transaction.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Transaction #{item.transaction.id} • {new Date(item.transaction.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(parseFloat(item.transaction.totalValue))}</p>
                    <p className="text-sm text-gray-600">
                      {item.transaction.amount} {item.coin.symbol}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">User</p>
                    <div className="flex items-center gap-1 mt-1">
                      <User className="w-3 h-3" />
                      <span className="font-medium">{item.user.username}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600">Cryptocurrency</p>
                    <p className="font-medium mt-1">{item.coin.name} ({item.coin.symbol})</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Payment Method</p>
                    <p className="font-medium mt-1">{item.transaction.paymentMethod}</p>
                  </div>
                </div>

                {item.transaction.metadata && (
                  <div className="bg-gray-50 rounded p-3 text-sm">
                    <p className="text-gray-600 mb-2">Transaction Details:</p>
                    {item.transaction.metadata.transactionHash && (
                      <p><span className="font-medium">Hash:</span> {item.transaction.metadata.transactionHash}</p>
                    )}
                    {item.transaction.metadata.senderAddress && (
                      <p><span className="font-medium">From:</span> {item.transaction.metadata.senderAddress}</p>
                    )}
                    {item.transaction.metadata.notes && (
                      <p><span className="font-medium">Notes:</span> {item.transaction.metadata.notes}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleIndividualAction(item.transaction.id, 'decline')}
                    variant="outline"
                    disabled={verifyMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleIndividualAction(item.transaction.id, 'approve')}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={verifyMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Dialog */}
      <Dialog open={showBulkActionDialog} onOpenChange={setShowBulkActionDialog}>
        <DialogContent aria-describedby="bulk-action-description">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'approve' ? 'Approve' : 'Decline'} {selectedTransactions.length} Transactions
            </DialogTitle>
            <DialogDescription id="bulk-action-description">
              This action will {bulkAction} all selected transactions. Please provide notes for the bulk action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={`Notes for bulk ${bulkAction} action...`}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkActionDialog(false)}
              disabled={bulkActionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAction}
              disabled={bulkActionMutation.isPending}
              className={bulkAction === 'approve' ? "bg-green-600 hover:bg-green-700" : ""}
              variant={bulkAction === 'decline' ? "destructive" : "default"}
            >
              {bulkActionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {bulkAction === 'approve' ? 'Approve All' : 'Decline All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}