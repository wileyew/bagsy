import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentSetupForm } from "./payment-setup-form";

interface PaymentSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetupComplete: () => void;
  isRequired?: boolean;
  title?: string;
  description?: string;
}

export function PaymentSetupModal({
  open,
  onOpenChange,
  onSetupComplete,
  isRequired = true,
  title,
  description,
}: PaymentSetupModalProps) {
  const handleSetupComplete = () => {
    onSetupComplete();
    onOpenChange(false);
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {title || (isRequired ? "Payment Setup Required" : "Set Up Payment Method")}
          </DialogTitle>
          <DialogDescription>
            {description || 
              (isRequired 
                ? "Complete payment setup to continue with your booking."
                : "Add a payment method to make future bookings easier."
              )
            }
          </DialogDescription>
        </DialogHeader>
        
        <PaymentSetupForm
          onSetupComplete={handleSetupComplete}
          onSkip={!isRequired ? handleSkip : undefined}
          isRequired={isRequired}
        />
      </DialogContent>
    </Dialog>
  );
}
