import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, CheckCircle, ShieldCheck, AlertCircle, FileCheck } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DriverLicenseUploadProps {
  onVerificationComplete?: () => void;
  showSkip?: boolean;
  onSkip?: () => void;
}

export function DriverLicenseUpload({ onVerificationComplete, showSkip = false, onSkip }: DriverLicenseUploadProps) {
  const { user } = useAuthContext();
  const [uploading, setUploading] = useState(false);
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasExistingLicense, setHasExistingLicense] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check if user already has a driver's license uploaded
  useEffect(() => {
    const checkExistingLicense = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('driver_license_url, driver_license_verified')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        if (data?.driver_license_url) {
          setLicenseUrl(data.driver_license_url);
          setIsVerified(data.driver_license_verified || false);
          setHasExistingLicense(true);
        }
      } catch (error) {
        console.error('Error checking existing license:', error);
      }
    };

    checkExistingLicense();
  }, [user]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, or WebP image of your driver's license.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.id}/driver-license-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('driver-licenses')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('driver-licenses')
        .getPublicUrl(fileName);

      // Update profile with driver's license URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          driver_license_url: publicUrl,
          driver_license_uploaded_at: new Date().toISOString(),
          driver_license_verified: false // Will be verified by admin/AI later
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setLicenseUrl(publicUrl);
      setHasExistingLicense(true);
      
      toast({
        title: "✅ Driver's License Uploaded",
        description: "Your license has been uploaded successfully. It will be verified shortly.",
      });

      // Trigger callback after a brief delay
      setTimeout(() => {
        onVerificationComplete?.();
      }, 1500);
    } catch (error: unknown) {
      console.error('Error uploading driver license:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload driver's license. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!user || !licenseUrl) return;

    try {
      // Extract file path from URL
      const urlParts = licenseUrl.split('/');
      const fileName = `${user.id}/${urlParts[urlParts.length - 1]}`;

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('driver-licenses')
        .remove([fileName]);

      if (deleteError) throw deleteError;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          driver_license_url: null,
          driver_license_uploaded_at: null,
          driver_license_verified: false
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setLicenseUrl(null);
      setIsVerified(false);
      setHasExistingLicense(false);
      
      toast({
        title: "Driver's License Removed",
        description: "You can upload a new license image.",
      });
    } catch (error: unknown) {
      console.error('Error removing driver license:', error);
      toast({
        title: "Removal Failed",
        description: error instanceof Error ? error.message : "Failed to remove driver's license. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold">Driver's License Verification</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          To list your space and ensure trust and safety, please upload a photo of your driver's license.
        </p>
      </div>

      {hasExistingLicense && licenseUrl ? (
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="relative flex-1">
                <img
                  src={licenseUrl}
                  alt="Driver's License"
                  className="w-full h-auto rounded-lg border-2 border-green-300"
                />
                {isVerified && (
                  <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isVerified ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">License Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">Pending Verification</span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>

            {!isVerified && (
              <p className="text-xs text-muted-foreground text-center">
                Your license will be reviewed within 24 hours. You can still continue with listing your space.
              </p>
            )}

            <Button
              onClick={() => onVerificationComplete?.()}
              className="w-full apple-button-primary h-12 font-semibold"
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Continue to List Your Space
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium text-lg mb-2">Click to upload your driver's license</p>
              <p className="text-sm text-muted-foreground mb-4">
                Supported formats: JPG, PNG, WebP (max 10MB)
              </p>
              {uploading && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Uploading...</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900">Your Privacy is Protected</p>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• Your license is encrypted and stored securely</li>
                    <li>• Only used for identity verification</li>
                    <li>• Never shared with third parties</li>
                    <li>• You can delete it anytime</li>
                  </ul>
                </div>
              </div>
            </div>

            {showSkip && onSkip && (
              <Button
                variant="outline"
                onClick={onSkip}
                className="w-full"
              >
                Skip for Now (Listing will be pending verification)
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

