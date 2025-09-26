import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DeleteConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceTitle: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteConfirmationModal({ 
  open, 
  onOpenChange, 
  spaceTitle, 
  onConfirm, 
  loading = false 
}: DeleteConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="apple-card max-w-md w-full mx-4">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Delete Listing
          </DialogTitle>
          <p className="text-muted-foreground">
            Are you sure you want to delete <strong>"{spaceTitle}"</strong>? This action cannot be undone.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium mb-1">This will permanently:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Remove the listing from search results</li>
                  <li>Cancel any pending bookings</li>
                  <li>Delete all associated photos</li>
                  <li>Remove negotiation history</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Listing
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
