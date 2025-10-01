import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PenTool, CheckCircle, Download } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AgreementSignatureProps {
  agreement: any;
  booking: any;
  onSigned: () => void;
}

export function AgreementSignature({ agreement, booking, onSigned }: AgreementSignatureProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const isOwner = user?.id === agreement.owner_id;
  const hasUserSigned = isOwner ? !!agreement.owner_signature : !!agreement.renter_signature;
  const otherPartySigned = isOwner ? !!agreement.renter_signature : !!agreement.owner_signature;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 150;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Drawing settings
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  };

  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to data URL
    const signatureData = canvas.toDataURL('image/png');
    
    if (!signatureData || signatureData === canvas.toDataURL()) {
      toast({
        title: "Signature Required",
        description: "Please draw your signature in the box above.",
        variant: "destructive",
      });
      return;
    }

    setSigning(true);
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (isOwner) {
        updateData.owner_signature = signatureData;
        updateData.owner_signed_at = new Date().toISOString();
      } else {
        updateData.renter_signature = signatureData;
        updateData.renter_signed_at = new Date().toISOString();
      }

      // Check if both parties will have signed
      const bothSigned = isOwner ? !!agreement.renter_signature : !!agreement.owner_signature;
      if (bothSigned) {
        updateData.fully_executed = true;
      }

      const { error } = await supabase
        .from('agreements')
        .update(updateData)
        .eq('id', agreement.id);

      if (error) throw error;

      // If both parties signed, update booking to confirmed
      if (bothSigned) {
        await supabase
          .from('bookings')
          .update({ status: 'accepted' })
          .eq('id', booking.id);
      }

      toast({
        title: "Agreement Signed!",
        description: bothSigned
          ? "Both parties have signed. You can now proceed to payment."
          : "Waiting for the other party to sign.",
      });

      onSigned();
    } catch (error: any) {
      toast({
        title: "Signing Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSigning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Rental Agreement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agreement Terms */}
        <div className="p-4 bg-muted rounded-lg max-h-64 overflow-y-auto">
          <pre className="text-xs whitespace-pre-wrap font-sans">
            {agreement.terms}
          </pre>
        </div>

        {/* Signature Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg border ${agreement.renter_signature ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {agreement.renter_signature ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-gray-400" />
              )}
              <span className="text-sm font-semibold">Renter</span>
            </div>
            {agreement.renter_signature ? (
              <img src={agreement.renter_signature} alt="Renter signature" className="h-12 w-full object-contain bg-white border rounded" />
            ) : (
              <p className="text-xs text-muted-foreground">Pending signature</p>
            )}
          </div>

          <div className={`p-3 rounded-lg border ${agreement.owner_signature ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {agreement.owner_signature ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-gray-400" />
              )}
              <span className="text-sm font-semibold">Owner</span>
            </div>
            {agreement.owner_signature ? (
              <img src={agreement.owner_signature} alt="Owner signature" className="h-12 w-full object-contain bg-white border rounded" />
            ) : (
              <p className="text-xs text-muted-foreground">Pending signature</p>
            )}
          </div>
        </div>

        {/* Signature Pad */}
        {!hasUserSigned && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <PenTool className="h-4 w-4" />
                Your Signature
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSignature}
              >
                Clear
              </Button>
            </div>

            <canvas
              ref={canvasRef}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />

            <Button
              onClick={handleSign}
              disabled={signing}
              className="w-full apple-button-primary"
            >
              {signing ? "Signing..." : "Sign Agreement"}
            </Button>
          </div>
        )}

        {/* Status Messages */}
        {hasUserSigned && !otherPartySigned && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            ✓ You've signed the agreement. Waiting for the other party to sign.
          </div>
        )}

        {agreement.fully_executed && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Agreement fully executed! Both parties have signed.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Missing import
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}

