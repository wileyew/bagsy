import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calendar } from "lucide-react";
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
        title: "✅ Space Relisted Successfully!",
        description: `Your driveway is now available from ${new Date(formData.availableFrom).toLocaleDateString()} to ${new Date(formData.availableUntil).toLocaleDateString()}`,
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
      <DialogContent className="apple-card max-w-lg w-full mx-4">
        <DialogHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Relist Your Driveway
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Set your next availability window for <span className="font-semibold text-foreground">"{space?.title}"</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-5">
            {/* Current Space Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Space Type:</span>
                <span className="font-medium capitalize">{space?.space_type?.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">{space?.address?.split(',')[0]}</span>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Next Reservation Time Window</Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="availableFrom" className="text-sm font-medium">
                    Available From *
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                    <Input
                      id="availableFrom"
                      type="datetime-local"
                      value={formData.availableFrom}
                      onChange={(e) => handleInputChange("availableFrom", e.target.value)}
                      className="apple-input pl-10 h-12"
                      required
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Start of availability</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availableUntil" className="text-sm font-medium">
                    Available Until *
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                    <Input
                      id="availableUntil"
                      type="datetime-local"
                      value={formData.availableUntil}
                      onChange={(e) => handleInputChange("availableUntil", e.target.value)}
                      className="apple-input pl-10 h-12"
                      required
                      min={formData.availableFrom || new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">End of availability</p>
                </div>
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
              <p className="text-xs text-muted-foreground">Timezone for the dates above</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.availableFrom || !formData.availableUntil}
              className="flex-1 apple-button-primary h-12 font-semibold"
            >
              {loading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Relisting...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Relist Space
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
