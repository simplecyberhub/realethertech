import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PencilIcon, ShieldCheck, ShieldOff, UserIcon } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

// Type definition for user
type User = {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  stripeCustomerId: string | null;
};

// Form schema for editing user
const editUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  email: z.string().email("Must be a valid email").optional().nullable(),
  isAdmin: z.boolean().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export function UserManagement() {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Fetch users
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return await response.json();
    },
    retry: false,
  });

  // Handle error with useEffect
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Failed to load users",
        description: (error as Error)?.message || "An error occurred while fetching users.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Form setup
  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      email: "",
      isAdmin: false,
      password: "",
    },
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EditUserFormValues }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User updated",
        description: "The user has been updated successfully.",
      });
      setEditingUser(null);
      form.reset();
      setShowResetPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update user",
        description: error.message || "An error occurred while updating the user.",
        variant: "destructive",
      });
    },
  });

  // Table columns
  const columns = [
    {
      header: "User",
      accessorKey: "username",
      cell: (row: User) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.username}</div>
            {row.email && <div className="text-xs text-muted-foreground">{row.email}</div>}
          </div>
        </div>
      ),
    },
    {
      header: "Role",
      accessorKey: "isAdmin",
      cell: (row: User) => (
        <div className="flex items-center gap-2">
          {row.isAdmin ? (
            <>
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium">Admin</span>
            </>
          ) : (
            <>
              <ShieldOff className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium">User</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: "Stripe",
      accessorKey: "stripeCustomerId",
      cell: (row: User) => (
        <div className="text-xs">
          {row.stripeCustomerId ? (
            <span className="text-green-600">Connected</span>
          ) : (
            <span className="text-gray-400">Not connected</span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: User) => (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleEditUser(row)}
            className="h-8 w-8 p-0"
          >
            <PencilIcon className="h-4 w-4" />
            <span className="sr-only">Edit user</span>
          </Button>
        </div>
      ),
    },
  ];

  // Handle edit user
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      email: user.email || "",
      isAdmin: user.isAdmin,
      password: "",
    });
    setShowResetPassword(false);
  };

  // Handle form submission
  const onSubmit = (data: EditUserFormValues) => {
    if (!editingUser) return;

    // Remove empty fields
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== "" && value !== undefined) {
        acc[key as keyof EditUserFormValues] = value;
      }
      return acc;
    }, {} as Partial<EditUserFormValues>);

    // If password is empty and we're not resetting, remove it
    if (!showResetPassword || !cleanData.password) {
      delete cleanData.password;
    }

    editUserMutation.mutate({ id: editingUser.id, data: cleanData });
  };

  if (isLoading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">User Management</h2>

      <DataTable
        data={users}
        columns={columns}
        searchable
        searchKeys={["username", "email"]}
      />

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details or change their role</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="user@example.com" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAdmin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Admin Access</FormLabel>
                      <FormDescription>
                        Grant admin privileges to this user
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex flex-row items-start space-x-3 space-y-0">
                <Checkbox
                  id="reset-password"
                  checked={showResetPassword}
                  onCheckedChange={(checked) => setShowResetPassword(!!checked)}
                />
                <div className="space-y-1 leading-none">
                  <label
                    htmlFor="reset-password"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Reset Password
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enter a new password for this user
                  </p>
                </div>
              </div>

              {showResetPassword && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="New password" {...field} />
                      </FormControl>
                      <FormDescription>
                        Minimum 6 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editUserMutation.isPending}
                >
                  {editUserMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}