import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flag, AlertTriangle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { flaggingService, type FlagType } from "@/lib/flagging-service";

interface ReportListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceTitle: string;
}

const flagOptions: { value: FlagType; label: string; description: string }[] = [
  {
    value: 'fake_listing',
    label: 'Fake or Fraudulent Listing',
    description: 'This space doesn\'t exist or is misrepresented'
  },
  {
    value: 'fake_photos',
    label: 'Fake or Misleading Photos',
    description: 'Photos don\'t match the actual space'
  },
  {
    value: 'wrong_address',
    label: 'Wrong Address',
    description: 'Address is incorrect or doesn\'t match license'
  },
  {
    value: 'unsafe_space',
    label: 'Unsafe or Dangerous',
    description: 'Space has safety issues or hazards'
  },
  {
    value: 'price_scam',
    label: 'Price Scam',
    description: 'Unrealistic pricing or hidden fees'
  },
  {
    value: 'unverified_owner',
    label: 'Unverified Owner',
    description: 'Owner identity seems suspicious'
  },
  {
    value: 'spam',
    label: 'Spam or Duplicate',
    description: 'Duplicate listing or spam content'
  },
  {
    value: 'other',
    label: 'Other Issue',
    description: 'Something else is wrong with this listing'
  }
];

export function ReportListingModal({ open, onOpenChange, spaceId, spaceTitle }: ReportListingModalProps) {
  const [flagType, setFlagType] = useState<FlagType>('fake_listing');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide details about the issue.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await flaggingService.reportListing(spaceId, flagType, reason);

      if (result.success) {
        toast({
          title: "✅ Report Submitted",
          description: "Thank you for helping keep Bagsy safe. We'll review this listing.",
        });
        onOpenChange(false);
        setReason('');
        setFlagType('fake_listing');
      } else {
        toast({
          title: "Failed to Submit Report",
          description: result.error || "Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="apple-card max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
            <Flag className="h-8 w-8 text-red-600" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Report Listing
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Help us keep Bagsy safe by reporting suspicious or inappropriate listings
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Space Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Reporting:</p>
            <p className="font-semibold text-foreground">{spaceTitle}</p>
          </div>

          {/* Flag Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">What's wrong with this listing?</Label>
            <RadioGroup value={flagType} onValueChange={(value) => setFlagType(value as FlagType)}>
              <div className="space-y-2">
                {flagOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      flagType === option.value
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setFlagType(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-base font-semibold">
              Please provide details *
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue in detail. Include any evidence or observations that support your report."
              className="apple-input min-h-[120px] resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Privacy Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Your report is confidential</p>
              <p className="text-xs text-blue-800">
                The listing owner won't know who reported them. Our team will review and take appropriate action.
              </p>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-900">
              <p className="font-semibold mb-1">False reports may result in account suspension</p>
              <p className="text-yellow-800">
                Please only report legitimate concerns. Abuse of the reporting system violates our Terms of Service.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {submitting ? (
                <>
                  <Flag className="h-4 w-4 mr-2 animate-pulse" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

