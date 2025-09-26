import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RelistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: any;
  onSuccess?: () => void;
}

const timezones = [
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

export function RelistModal({ open, onOpenChange, space, onSuccess }: RelistModalProps) {
  const [formData, setFormData] = useState({
    availableFrom: "",
    availableUntil: "",
    timezone: space?.timezone || "America/Los_Angeles",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!space) return;

    setLoading(true);
    try {
      // Convert local datetime strings to UTC timestamps
      const convertToUTC = (localDateTime: string) => {
        if (!localDateTime) return null;
        const date = new Date(localDateTime);
        return date.toISOString();
      };

      // Update space with new availability dates
      const { error } = await supabase
        .from('spaces')
        .update({
          available_from: convertToUTC(formData.availableFrom),
          available_until: convertToUTC(formData.availableUntil),
          timezone: formData.timezone,
          is_active: true, // Reactivate the space
        })
        .eq('id', space.id);

      if (error) throw error;

      toast({
        title: "Space Relisted Successfully!",
        description: "Your space is now available for booking with the new schedule.",
      });

      // Reset form and close modal
      setFormData({
        availableFrom: "",
        availableUntil: "",
        timezone: space?.timezone || "America/Los_Angeles",
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        title: "Failed to relist space",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="apple-card max-w-md w-full mx-4">
        <DialogHeader className="text-center space-y-4">
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Relist Your Space
          </DialogTitle>
          <p className="text-muted-foreground">
            Set new availability dates for "{space?.title}"
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="availableFrom" className="text-sm font-medium">
                  Available From *
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="availableFrom"
                    type="datetime-local"
                    value={formData.availableFrom}
                    onChange={(e) => handleInputChange("availableFrom", e.target.value)}
                    className="apple-input pl-10 h-12"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">When your space becomes available</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="availableUntil" className="text-sm font-medium">
                  Available Until *
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="availableUntil"
                    type="datetime-local"
                    value={formData.availableUntil}
                    onChange={(e) => handleInputChange("availableUntil", e.target.value)}
                    className="apple-input pl-10 h-12"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">When your space stops being available</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone" className="text-sm font-medium">
                Timezone
              </Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleInputChange("timezone", value)}
              >
                <SelectTrigger className="apple-input h-12">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Timezone for the availability dates above</p>
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
              type="submit"
              disabled={loading}
              className="flex-1 apple-button-primary"
            >
              {loading ? "Relisting..." : "Relist Space"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
