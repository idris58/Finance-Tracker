import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCategorySchema } from "@shared/schema";
import { z } from "zod";
import { useCreateCategory, useUpdateCategory, useDeleteCategory, useCategories } from "@/hooks/use-finance";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Edit2, X } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const formSchema = insertCategorySchema.extend({
  id: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategorySelect?: (categoryId: number) => void;
}

export function CategoryManagementModal({ open, onOpenChange, onCategorySelect }: CategoryManagementModalProps) {
  const { data: categories } = useCategories();
  const { mutate: createCategory, isPending: createPending } = useCreateCategory();
  const { mutate: updateCategory, isPending: updatePending } = useUpdateCategory();
  const { mutate: deleteCategory, isPending: deletePending } = useDeleteCategory();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      monthlyLimit: "0",
      color: "#39ff14",
      isFixed: false,
    },
  });

  // Check if category name already exists
  const existingCategoryNames = useMemo(() => {
    return categories?.map(c => c.name.toLowerCase()) || [];
  }, [categories]);

  const onSubmit = (values: FormValues) => {
    setFormError("");

    // Check for duplicate category name (excluding the one being edited)
    const categoryNameLower = values.name.toLowerCase();
    const isDuplicate = existingCategoryNames.some(name => 
      name === categoryNameLower && 
      (!editingId || categories?.find(c => c.id === editingId)?.name.toLowerCase() !== categoryNameLower)
    );

    if (isDuplicate) {
      setFormError("Category already exists with this name");
      return;
    }

    if (editingId) {
      updateCategory({
        id: editingId,
        data: {
          name: values.name,
          monthlyLimit: values.monthlyLimit,
          color: values.color,
          isFixed: values.isFixed,
        },
      }, {
        onSuccess: () => {
          setEditingId(null);
          setIsAdding(false);
          form.reset({
            name: "",
            monthlyLimit: "0",
            color: "#39ff14",
            isFixed: false,
          });
        },
      });
    } else {
      createCategory({
        name: values.name,
        monthlyLimit: values.monthlyLimit,
        color: values.color,
        isFixed: values.isFixed,
      }, {
        onSuccess: () => {
          form.reset({
            name: "",
            monthlyLimit: "0",
            color: "#39ff14",
            isFixed: false,
          });
          setIsAdding(false);
        },
      });
    }
  };

  const handleEdit = (category: any) => {
    setEditingId(category.id);
    setIsAdding(true);
    setFormError("");
    form.reset({
      name: category.name,
      monthlyLimit: category.monthlyLimit,
      color: category.color,
      isFixed: category.isFixed,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormError("");
    form.reset({
      name: "",
      monthlyLimit: "0",
      color: "#39ff14",
      isFixed: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 sm:max-w-2xl w-[95vw] max-h-[85vh] flex flex-col rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl sm:text-2xl">Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {/* Existing Categories */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-muted-foreground">Your Categories</h3>
            </div>
            <div className="space-y-2 pr-2 max-h-[300px] overflow-y-auto">
              {categories?.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-white/5 hover:border-white/20 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {category.name}
                        {category.isFixed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive">Fixed</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Limit: ₹{Number(category.monthlyLimit).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{category.name}" and cannot be undone. Transactions in this category will be preserved.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-white/10 hover:bg-white/5">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => category.id && deleteCategory(category.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add/Edit Form - Nested Modal */}
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">
                  {editingId ? "Edit Category" : "Add New Category"}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Error Message */}
                  {formError && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                      {formError}
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Category Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Groceries, Gym, etc."
                            className="bg-background/50 border-white/10 text-sm h-9"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="monthlyLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Monthly Limit</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                              <Input
                                {...field}
                                type="number"
                                placeholder="0"
                                className="bg-background/50 border-white/10 text-sm h-9 pl-7"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2 items-center h-9">
                              <input
                                {...field}
                                type="color"
                                className="w-9 h-9 rounded-lg cursor-pointer border border-white/10"
                              />
                              <span className="text-xs text-muted-foreground font-mono">{field.value}</span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="isFixed"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-white/20"
                          />
                        </FormControl>
                        <FormLabel className="text-xs sm:text-sm font-normal cursor-pointer">
                          Fixed Bill (e.g., Rent, Utilities)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-white/10 text-xs sm:text-sm h-9"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm h-9"
                      disabled={createPending || updatePending}
                    >
                      {editingId ? "Update" : "Add"} Category
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 pt-4 border-t border-white/5">
          {!isAdding && (
            <Button
              onClick={() => {
                setIsAdding(true);
                setEditingId(null);
                setFormError("");
                form.reset({
                  name: "",
                  monthlyLimit: "0",
                  color: "#39ff14",
                  isFixed: false,
                });
              }}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-sm h-10"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Category
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="flex-1 border-white/10 text-sm h-10"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
