import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Eye, EyeOff, MapPin, DollarSign, Ruler, Calendar, Clock } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { getPhotoUploadErrorMessage, getPhotoUploadSuccessMessage } from "@/lib/photo-upload-error-messages";
import { timezoneService } from "@/lib/timezone-service";
import { supabase } from "@/integrations/supabase/client";

interface ListSpaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SpaceFormData {
  title: string;
  description: string;
  spaceType: string;
  address: string;
  zipCode: string;
  pricePerHour: number;
  pricePerDay: number | null;
  dimensions: string;
  availableFrom: string;
  availableUntil: string;
  timezone: string;
  showPhoto: boolean;
  photoUrl: string;
  specialInstructions: string;
}

const spaceTypes = [
  { value: "garage", label: "Garage", description: "Covered storage space" },
  { value: "driveway", label: "Driveway", description: "Open parking space" },
  { value: "warehouse", label: "Warehouse", description: "Large commercial space" },
  { value: "parking_spot", label: "Parking Spot", description: "Single parking space" },
  { value: "storage_unit", label: "Storage Unit", description: "Indoor storage unit" },
  { value: "outdoor_space", label: "Outdoor Space", description: "Open outdoor area" },
];

const timezones = [
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

export function ListSpaceModal({ open, onOpenChange }: ListSpaceModalProps) {
  const [formData, setFormData] = useState<SpaceFormData>({
    title: "",
    description: "",
    spaceType: "",
    address: "",
    zipCode: "",
    pricePerHour: 0,
    pricePerDay: null,
    dimensions: "",
    availableFrom: "",
    availableUntil: "",
    timezone: "America/Los_Angeles",
    showPhoto: true,
    photoUrl: "",
    specialInstructions: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();

  const handleInputChange = async (field: keyof SpaceFormData, value: string | number | boolean) => {
    // Auto-detect timezone when address changes
    if (field === 'address' && typeof value === 'string' && value.trim().length > 5) {
      try {
        const timezoneData = await timezoneService.getTimezoneFromAddress(value);
        
        setFormData(prev => ({
          ...prev,
          [field]: value,
          timezone: timezoneData.timezone
        }));
        
        toast({
          title: "Timezone Auto-Detected",
          description: `Timezone set to ${timezoneData.displayName} based on your address`,
          duration: 4000,
        });
      } catch (error) {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        toast({
          title: "Timezone Detection Failed",
          description: "Could not auto-detect timezone. Please select manually.",
          variant: "destructive",
          duration: 4000,
        });
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setUploading(true);
    try {
      // Create a unique filename that matches policy expectations
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName; // Store directly in bucket root, not in subfolder

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('space-photos')
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('space-photos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, photoUrl: publicUrl }));
      const successMessage = getPhotoUploadSuccessMessage(1);
      toast({
        title: successMessage.title,
        description: successMessage.description,
      });
    } catch (error: unknown) {
      const errorMessage = getPhotoUploadErrorMessage(false);
      toast({
        title: errorMessage.title,
        description: errorMessage.description,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Get fresh user data from Supabase auth to avoid stale context
      const { data: authData, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authData.user) {
        throw new Error('Authentication error: Please log in again');
      }
      
      const currentUser = authData.user;

      // Convert local datetime strings to UTC timestamps
      const convertToUTC = (localDateTime: string) => {
        if (!localDateTime) return null;
        const date = new Date(localDateTime);
        return date.toISOString();
      };

      // Insert space into database
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert({
          title: formData.title,
          description: formData.description,
          space_type: formData.spaceType,
          address: formData.address,
          zip_code: formData.zipCode,
          price_per_hour: formData.pricePerHour,
          price_per_day: formData.pricePerDay,
          dimensions: formData.dimensions,
          available_from: convertToUTC(formData.availableFrom),
          available_until: convertToUTC(formData.availableUntil),
          timezone: formData.timezone,
          special_instructions: formData.specialInstructions,
          owner_id: currentUser.id,
          is_active: true,
        })
        .select()
        .single();

      if (spaceError) throw spaceError;

      // Insert photo if provided and show photo is enabled
      if (formData.photoUrl && formData.showPhoto) {
        const { error: photoError } = await supabase
          .from('space_photos')
          .insert({
            space_id: space.id,
            photo_url: formData.photoUrl,
            display_order: 1,
          });

        if (photoError) {
          console.error('Error saving photo:', photoError);
          // Don't throw here, as the space was created successfully
        }
      }

      toast({
        title: "Space listed successfully!",
        description: "Your space is now available for booking.",
      });

      // Verify user is still authenticated after submission
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authData.user) {
          toast({
            title: "⚠️ Authentication Issue",
            description: "Your listing was submitted successfully, but there was an authentication issue. Please refresh the page and log in again.",
            variant: "destructive",
            duration: 8000,
          });
          
          // Reset form and close modal
          setFormData({
            title: "",
            description: "",
            spaceType: "",
            address: "",
            zipCode: "",
            pricePerHour: 0,
            pricePerDay: null,
            dimensions: "",
            availableFrom: "",
            availableUntil: "",
            timezone: "America/Los_Angeles",
            showPhoto: true,
            photoUrl: "",
            specialInstructions: "",
          });
          onOpenChange(false);
          return;
        }
        
        // Verify it's the same user
        if (authData.user.id !== currentUser.id) {
          toast({
            title: "⚠️ Authentication Issue",
            description: "Your listing was submitted successfully, but there was an authentication issue. Please refresh the page and log in again.",
            variant: "destructive",
            duration: 8000,
          });
          
          // Reset form and close modal
          setFormData({
            title: "",
            description: "",
            spaceType: "",
            address: "",
            zipCode: "",
            pricePerHour: 0,
            pricePerDay: null,
            dimensions: "",
            availableFrom: "",
            availableUntil: "",
            timezone: "America/Los_Angeles",
            showPhoto: true,
            photoUrl: "",
            specialInstructions: "",
          });
          onOpenChange(false);
          return;
        }
      } catch (authVerifyError) {
        toast({
          title: "⚠️ Authentication Issue",
          description: "Your listing was submitted successfully, but there was an authentication issue. Please refresh the page and log in again.",
          variant: "destructive",
          duration: 8000,
        });
        
        // Reset form and close modal
        setFormData({
          title: "",
          description: "",
          spaceType: "",
          address: "",
          zipCode: "",
          pricePerHour: 0,
          pricePerDay: null,
          dimensions: "",
          availableFrom: "",
          availableUntil: "",
          timezone: "America/Los_Angeles",
          showPhoto: true,
          photoUrl: "",
          specialInstructions: "",
        });
        onOpenChange(false);
        return;
      }

      // Reset form and close modal
      setFormData({
        title: "",
        description: "",
        spaceType: "",
        address: "",
        zipCode: "",
        pricePerHour: 0,
        pricePerDay: null,
        dimensions: "",
        availableFrom: "",
        availableUntil: "",
        timezone: "America/Los_Angeles",
        showPhoto: true,
        photoUrl: "",
        specialInstructions: "",
      });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Failed to list space",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const removePhoto = () => {
    setFormData(prev => ({ ...prev, photoUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="apple-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-4">
          <DialogTitle className="text-2xl font-bold tracking-tight">
            List Your Space
          </DialogTitle>
          <p className="text-muted-foreground">
            Share your space with the community and start earning
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Space Title *
              </Label>
              <Input
                id="title"
                placeholder="e.g., Spacious Garage in Mission District"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="apple-input h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description *
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your space, what makes it special, access details... (Note: 24/7 access during reservation period)"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className="apple-input min-h-[100px] resize-none"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialInstructions" className="text-sm font-medium">
                Special Instructions
              </Label>
              <Textarea
                id="specialInstructions"
                placeholder="Gate codes, community rules, access instructions, etc. (Optional)"
                value={formData.specialInstructions}
                onChange={(e) => handleInputChange("specialInstructions", e.target.value)}
                className="apple-input min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Provide any special access instructions like gate codes, community rules, or specific entry procedures.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spaceType" className="text-sm font-medium">
                Space Type *
              </Label>
              <Select
                value={formData.spaceType}
                onValueChange={(value) => handleInputChange("spaceType", value)}
                required
              >
                <SelectTrigger className="apple-input h-12">
                  <SelectValue placeholder="Select space type" />
                </SelectTrigger>
                <SelectContent>
                  {spaceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Location</h3>
            
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">
                Address *
              </Label>
              <Input
                id="address"
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                className="apple-input h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode" className="text-sm font-medium">
                ZIP Code *
              </Label>
              <Input
                id="zipCode"
                placeholder="94110"
                value={formData.zipCode}
                onChange={(e) => handleInputChange("zipCode", e.target.value)}
                className="apple-input h-12"
                required
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pricing</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pricePerHour" className="text-sm font-medium">
                  Price per Hour *
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pricePerHour"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.pricePerHour}
                    onChange={(e) => handleInputChange("pricePerHour", parseFloat(e.target.value) || 0)}
                    className="apple-input pl-10 h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerDay" className="text-sm font-medium">
                  Price per Day (Optional)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pricePerDay"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.pricePerDay || ""}
                    onChange={(e) => handleInputChange("pricePerDay", e.target.value ? parseFloat(e.target.value) : null)}
                    className="apple-input pl-10 h-12"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Space Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Space Details</h3>
            
            <div className="space-y-2">
              <Label htmlFor="dimensions" className="text-sm font-medium">
                Dimensions
              </Label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="dimensions"
                  placeholder="e.g., 20x12 feet, 10x20 feet"
                  value={formData.dimensions}
                  onChange={(e) => handleInputChange("dimensions", e.target.value)}
                  className="apple-input pl-10 h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="availableFrom" className="text-sm font-medium">
                  Available From
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="availableFrom"
                    type="datetime-local"
                    value={formData.availableFrom}
                    onChange={(e) => handleInputChange("availableFrom", e.target.value)}
                    className="apple-input pl-10 h-12"
                  />
                </div>
                <p className="text-xs text-muted-foreground">When your space becomes available</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="availableUntil" className="text-sm font-medium">
                  Available Until
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="availableUntil"
                    type="datetime-local"
                    value={formData.availableUntil}
                    onChange={(e) => handleInputChange("availableUntil", e.target.value)}
                    className="apple-input pl-10 h-12"
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
              <p className="text-xs text-blue-600">
                💡 Timezone is automatically detected when you enter your address
              </p>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Space Photo</h3>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showPhoto"
                checked={formData.showPhoto}
                onCheckedChange={(checked) => handleInputChange("showPhoto", checked)}
              />
              <Label htmlFor="showPhoto" className="text-sm">
                Show photo to potential renters
              </Label>
            </div>

            {formData.showPhoto && (
              <div className="space-y-4">
                {formData.photoUrl ? (
                  <Card className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative">
                        <img
                          src={formData.photoUrl}
                          alt="Space preview"
                          className="w-full h-48 object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={removePhoto}
                          className="absolute top-2 right-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a photo of your space
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="apple-button-secondary"
                    >
                      {uploading ? "Uploading..." : "Choose Photo"}
                    </Button>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full apple-button-primary h-12"
          >
            {loading ? "Listing Space..." : "List My Space"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
