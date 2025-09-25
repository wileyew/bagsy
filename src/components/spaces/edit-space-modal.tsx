import { useState, useRef, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";

interface EditSpaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: {
    id: string;
    title: string;
    description: string | null;
    space_type: string;
    address: string;
    zip_code: string;
    price_per_hour: number;
    price_per_day: number | null;
    dimensions: string | null;
    available_from: string | null;
    available_until: string | null;
    photos: Array<{
      id: string;
      photo_url: string;
      display_order: number;
    }>;
  };
  onUpdate: () => void;
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

export function EditSpaceModal({ open, onOpenChange, space, onUpdate }: EditSpaceModalProps) {
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
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();

  // Initialize form data when space prop changes
  useEffect(() => {
    if (space) {
      // Convert timestamps to local date strings for the form
      const formatDateForInput = (dateString: string | null) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        // Convert to local timezone and format as YYYY-MM-DDTHH:MM
        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return localDate.toISOString().slice(0, 16);
      };

      setFormData({
        title: space.title || "",
        description: space.description || "",
        spaceType: space.space_type || "",
        address: space.address || "",
        zipCode: space.zip_code || "",
        pricePerHour: space.price_per_hour || 0,
        pricePerDay: space.price_per_day || null,
        dimensions: space.dimensions || "",
        availableFrom: formatDateForInput(space.available_from),
        availableUntil: formatDateForInput(space.available_until),
        timezone: "America/Los_Angeles", // Default timezone
        showPhoto: space.photos && space.photos.length > 0,
        photoUrl: space.photos && space.photos.length > 0 ? space.photos[0].photo_url : "",
      });
    }
  }, [space]);

  const handleInputChange = (field: keyof SpaceFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `space-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('space-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('space-photos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, photoUrl: publicUrl }));
      toast({
        title: "Photo uploaded successfully!",
        description: "Your photo has been uploaded and will be shown in your listing.",
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo. Please try again.",
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
      // Convert local datetime strings to UTC timestamps
      const convertToUTC = (localDateTime: string) => {
        if (!localDateTime) return null;
        const date = new Date(localDateTime);
        return date.toISOString();
      };

      // Update space in database
      const { error: spaceError } = await supabase
        .from('spaces')
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', space.id)
        .eq('owner_id', user.id);

      if (spaceError) throw spaceError;

      // Handle photo updates
      if (formData.photoUrl && formData.showPhoto) {
        // Check if photo already exists
        const { data: existingPhotos } = await supabase
          .from('space_photos')
          .select('*')
          .eq('space_id', space.id)
          .eq('display_order', 1);

        if (existingPhotos && existingPhotos.length > 0) {
          // Update existing photo
          const { error: photoError } = await supabase
            .from('space_photos')
            .update({ photo_url: formData.photoUrl })
            .eq('id', existingPhotos[0].id);

          if (photoError) {
            console.error('Error updating photo:', photoError);
          }
        } else {
          // Insert new photo
          const { error: photoError } = await supabase
            .from('space_photos')
            .insert({
              space_id: space.id,
              photo_url: formData.photoUrl,
              display_order: 1,
            });

          if (photoError) {
            console.error('Error saving photo:', photoError);
          }
        }
      } else if (!formData.showPhoto) {
        // Remove photo if user doesn't want to show it
        const { error: photoError } = await supabase
          .from('space_photos')
          .delete()
          .eq('space_id', space.id);

        if (photoError) {
          console.error('Error removing photo:', photoError);
        }
      }

      toast({
        title: "Listing updated successfully!",
        description: "Your space listing has been updated.",
      });

      onUpdate(); // Refresh the listings
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Failed to update listing",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Edit Space Listing
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Space Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Spacious Garage in Mission District"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spaceType">Space Type *</Label>
                  <Select
                    value={formData.spaceType}
                    onValueChange={(value) => handleInputChange('spaceType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select space type" />
                    </SelectTrigger>
                    <SelectContent>
                      {spaceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-sm text-gray-500">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe your space, including any special features or restrictions..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensions">Dimensions</Label>
                <Input
                  id="dimensions"
                  value={formData.dimensions}
                  onChange={(e) => handleInputChange('dimensions', e.target.value)}
                  placeholder="e.g., 20x12 feet, 2 cars, etc."
                />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Street address"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange('zipCode', e.target.value)}
                  placeholder="94110"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pricePerHour">Price per Hour ($) *</Label>
                  <Input
                    id="pricePerHour"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pricePerHour}
                    onChange={(e) => handleInputChange('pricePerHour', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerDay">Price per Day ($)</Label>
                  <Input
                    id="pricePerDay"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pricePerDay || ""}
                    onChange={(e) => handleInputChange('pricePerDay', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability & Timeframes */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Availability & Timeframes
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="availableFrom">Available From</Label>
                    <Input
                      id="availableFrom"
                      type="datetime-local"
                      value={formData.availableFrom}
                      onChange={(e) => handleInputChange('availableFrom', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">When your space becomes available</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="availableUntil">Available Until</Label>
                    <Input
                      id="availableUntil"
                      type="datetime-local"
                      value={formData.availableUntil}
                      onChange={(e) => handleInputChange('availableUntil', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">When your space stops being available</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => handleInputChange('timezone', value)}
                  >
                    <SelectTrigger>
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
                  <p className="text-xs text-gray-500">Timezone for the availability dates above</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photo */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Photo
              </h3>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="showPhoto"
                  checked={formData.showPhoto}
                  onCheckedChange={(checked) => handleInputChange('showPhoto', checked)}
                />
                <Label htmlFor="showPhoto">Show photo in listing</Label>
              </div>

              {formData.showPhoto && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center space-x-2"
                    >
                      <Upload className="h-4 w-4" />
                      <span>{uploading ? "Uploading..." : "Upload Photo"}</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    {formData.photoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, photoUrl: "" }))}
                        className="flex items-center space-x-1"
                      >
                        <X className="h-4 w-4" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>

                  {formData.photoUrl && (
                    <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={formData.photoUrl}
                        alt="Space preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, photoUrl: "" }))}
                          className="bg-white/80 hover:bg-white"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Listing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
