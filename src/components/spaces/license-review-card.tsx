import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, ShieldCheck, AlertTriangle, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LicenseReviewCardProps {
  licenseUrl: string;
  isVerified: boolean;
  extractedAddress: string | null;
  listingAddress: string;
  addressMatch: boolean;
  verificationConfidence: number | null;
  onUpdateLicense?: () => void;
}

export function LicenseReviewCard({
  licenseUrl,
  isVerified,
  extractedAddress,
  listingAddress,
  addressMatch,
  verificationConfidence,
  onUpdateLicense
}: LicenseReviewCardProps) {
  return (
    <Card className={`border-2 ${addressMatch ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${addressMatch ? 'text-green-600' : 'text-red-600'}`} />
            <h3 className="text-lg font-semibold">Driver's License Verification</h3>
          </div>
          {onUpdateLicense && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onUpdateLicense}
              className="text-muted-foreground hover:text-foreground"
            >
              <Edit className="h-4 w-4 mr-1" />
              Update
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* License Image */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Your Driver's License</p>
            <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
              <img
                src={licenseUrl}
                alt="Driver's License"
                className="w-full h-auto"
              />
              {isVerified && (
                <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </div>
              )}
            </div>
          </div>

          {/* Verification Details */}
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">License Address</p>
              <p className="text-sm font-medium bg-white/50 p-3 rounded-lg border">
                {extractedAddress || 'Not extracted'}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Listing Address</p>
              <p className="text-sm font-medium bg-white/50 p-3 rounded-lg border">
                {listingAddress}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Verification Status</p>
              <div className={`p-3 rounded-lg border-2 ${
                addressMatch 
                  ? 'border-green-300 bg-green-100' 
                  : 'border-red-300 bg-red-100'
              }`}>
                <div className="flex items-center gap-2">
                  {addressMatch ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-700" />
                      <div>
                        <p className="text-sm font-bold text-green-900">✅ Address Verified</p>
                        <p className="text-xs text-green-700">
                          {verificationConfidence}% confidence match
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 text-red-700" />
                      <div>
                        <p className="text-sm font-bold text-red-900">❌ Address Mismatch</p>
                        <p className="text-xs text-red-700">
                          Addresses do not match
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Status */}
        <div className={`p-4 rounded-lg border-2 ${
          addressMatch 
            ? 'border-green-300 bg-green-100' 
            : 'border-red-300 bg-red-100'
        }`}>
          <div className="flex items-start gap-3">
            {addressMatch ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-700 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-green-900">✅ Approved to Post Listing</p>
                  <p className="text-sm text-green-800">
                    Your driver's license address matches the listing address. You're all set to publish your space!
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-red-700 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-red-900">❌ Cannot Post Listing</p>
                  <p className="text-sm text-red-800">
                    The address on your driver's license doesn't match the listing address. Please update your license or use the address from your license.
                  </p>
                  <p className="text-xs text-red-700 mt-2">
                    <strong>Security Requirement:</strong> For trust and safety, listings must be at your registered address.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

