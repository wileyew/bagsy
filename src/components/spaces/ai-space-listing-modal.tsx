import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, MapPin, Sparkles, CheckCircle, Edit3 } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingDots } from "@/components/ui/loading-dots";

interface AISpaceListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SpaceFormData {
  address: string;
  zipCode: string;
  photos: File[];
  photoUrls: string[];
}

interface AIGeneratedData {
  spaceType: string;
  title: string;
  description: string;
  dimensions: string;
  pricePerHour: number;
  pricePerDay: number;
}

const spaceTypes = [
  { value: "garage", label: "Garage", description: "Covered storage space" },
  { value: "driveway", label: "Driveway", description: "Open parking space" },
  { value: "warehouse", label: "Warehouse", description: "Large commercial space" },
  { value: "parking_spot", label: "Parking Spot", description: "Single parking space" },
  { value: "storage_unit", label: "Storage Unit", description: "Indoor storage unit" },
  { value: "outdoor_space", label: "Outdoor Space", description: "Open outdoor area" },
];

export function AISpaceListingModal({ open, onOpenChange }: AISpaceListingModalProps) {
  const [formData, setFormData] = useState<SpaceFormData>({
    address: "",
    zipCode: "",
    photos: [],
    photoUrls: [],
  });
  
  const [aiGeneratedData, setAiGeneratedData] = useState<AIGeneratedData | null>(null);
  const [editableData, setEditableData] = useState<AIGeneratedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState<'upload' | 'analyze' | 'review' | 'confirm'>('upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();

  const handleInputChange = (field: keyof SpaceFormData, value: string | File[] | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${user?.id}-${Date.now()}-${i}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('space-photos')
          .upload(fileName, file);

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('space-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      setFormData(prev => ({ 
        ...prev, 
        photos: Array.from(files),
        photoUrls: uploadedUrls 
      }));
      
      toast({
        title: "Photos uploaded successfully!",
        description: `${files.length} photo(s) uploaded. Ready for AI analysis.`,
      });
      
      setStep('analyze');
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const analyzePhotosWithAI = async () => {
    if (!formData.photoUrls.length) return;

    setAnalyzing(true);
    try {
      // Simulate AI analysis - in production, this would call your AI service
      const mockAnalysis = await simulateAIAnalysis(formData.photoUrls, formData.address);
      
      setAiGeneratedData(mockAnalysis);
      setEditableData(mockAnalysis);
      setStep('review');
      
      toast({
        title: "AI Analysis Complete!",
        description: "Your space has been analyzed. Review the suggestions below.",
      });
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to analyze photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const simulateAIAnalysis = async (photoUrls: string[], address: string): Promise<AIGeneratedData> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock AI analysis based on address patterns
    const isUrban = address.toLowerCase().includes('san francisco') || 
                   address.toLowerCase().includes('sf') ||
                   address.toLowerCase().includes('mission') ||
                   address.toLowerCase().includes('valencia');
    
    const basePrice = isUrban ? 8 : 5;
    
    return {
      spaceType: isUrban ? 'garage' : 'driveway',
      title: `${isUrban ? 'Spacious' : 'Convenient'} ${isUrban ? 'Garage' : 'Driveway'} in ${address.split(',')[0]}`,
      description: `Perfect ${isUrban ? 'covered storage space' : 'parking spot'} in a ${isUrban ? 'prime urban location' : 'quiet neighborhood'}. ${isUrban ? 'Secure and easily accessible' : 'Easy access and well-maintained'}. Ideal for ${isUrban ? 'short-term storage or vehicle parking' : 'daily parking or temporary storage'}.`,
      dimensions: isUrban ? '20x12 feet' : '10x20 feet',
      pricePerHour: basePrice,
      pricePerDay: basePrice * 8,
    };
  };

  const handleEditableChange = (field: keyof AIGeneratedData, value: string | number) => {
    if (!editableData) return;
    setEditableData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editableData) return;

    setLoading(true);
    try {
      // Insert space into database
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert({
          title: editableData.title,
          description: editableData.description,
          space_type: editableData.spaceType,
          address: formData.address,
          zip_code: formData.zipCode,
          price_per_hour: editableData.pricePerHour,
          price_per_day: editableData.pricePerDay,
          dimensions: editableData.dimensions,
          owner_id: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (spaceError) throw spaceError;

      // Insert photos
      for (let i = 0; i < formData.photoUrls.length; i++) {
        const { error: photoError } = await supabase
          .from('space_photos')
          .insert({
            space_id: space.id,
            photo_url: formData.photoUrls[i],
            display_order: i + 1,
          });

        if (photoError) {
          console.error('Error saving photo:', photoError);
        }
      }

      toast({
        title: "Space listed successfully!",
        description: "Your space is now available for booking.",
      });

      // Reset form and close modal
      setFormData({
        address: "",
        zipCode: "",
        photos: [],
        photoUrls: [],
      });
      setAiGeneratedData(null);
      setEditableData(null);
      setStep('upload');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Failed to list space",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    const newUrls = formData.photoUrls.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, photos: newPhotos, photoUrls: newUrls }));
  };

  const resetToUpload = () => {
    setFormData({
      address: "",
      zipCode: "",
      photos: [],
      photoUrls: [],
    });
    setAiGeneratedData(null);
    setEditableData(null);
    setStep('upload');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="apple-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-4">
          <DialogTitle className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI-Powered Space Listing
          </DialogTitle>
          <p className="text-muted-foreground">
            {step === 'upload' && "Upload photos and enter location - AI will do the rest!"}
            {step === 'analyze' && "AI is analyzing your photos..."}
            {step === 'review' && "Review AI suggestions and make any adjustments"}
            {step === 'confirm' && "Confirm your space listing"}
          </p>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          <div className={`flex items-center space-x-2 ${step === 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              1
            </div>
            <span className="text-sm font-medium">Upload</span>
          </div>
          <div className={`w-8 h-0.5 ${step === 'analyze' || step === 'review' || step === 'confirm' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center space-x-2 ${step === 'analyze' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'analyze' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium">Analyze</span>
          </div>
          <div className={`w-8 h-0.5 ${step === 'review' || step === 'confirm' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center space-x-2 ${step === 'review' || step === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'review' || step === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              3
            </div>
            <span className="text-sm font-medium">Review</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Upload Photos and Location */}
          {step === 'upload' && (
            <>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Upload Photos</h3>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload 1-5 photos of your space
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="apple-button-secondary"
                  >
                    {uploading ? "Uploading..." : "Choose Photos"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Location</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Address *
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="address"
                        placeholder="Street address"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        className="apple-input pl-10 h-12"
                        required
                      />
                    </div>
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
              </div>

              <Button
                type="button"
                onClick={analyzePhotosWithAI}
                disabled={!formData.photoUrls.length || !formData.address || !formData.zipCode}
                className="w-full apple-button-primary h-12"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze with AI
              </Button>
            </>
          )}

          {/* Step 2: AI Analysis */}
          {step === 'analyze' && (
            <div className="text-center space-y-6 py-8">
              <LoadingDots size="lg" className="text-primary mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">AI is analyzing your photos...</h3>
                <p className="text-muted-foreground">
                  Our AI is examining your space to generate the perfect listing
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review AI Suggestions */}
          {step === 'review' && editableData && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">AI-Generated Listing</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetToUpload}
                    className="apple-button-secondary"
                  >
                    Start Over
                  </Button>
                </div>

                {/* Photo Preview */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {formData.photoUrls.map((url, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="relative">
                          <img
                            src={url}
                            alt={`Space photo ${index + 1}`}
                            className="w-full h-32 object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removePhoto(index)}
                            className="absolute top-2 right-2 h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Editable Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      Space Type
                    </Label>
                    <select
                      value={editableData.spaceType}
                      onChange={(e) => handleEditableChange("spaceType", e.target.value)}
                      className="apple-input h-12 w-full"
                    >
                      {spaceTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      Title
                    </Label>
                    <Input
                      value={editableData.title}
                      onChange={(e) => handleEditableChange("title", e.target.value)}
                      className="apple-input h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      Description
                    </Label>
                    <textarea
                      value={editableData.description}
                      onChange={(e) => handleEditableChange("description", e.target.value)}
                      className="apple-input min-h-[100px] resize-none w-full"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        Dimensions
                      </Label>
                      <Input
                        value={editableData.dimensions}
                        onChange={(e) => handleEditableChange("dimensions", e.target.value)}
                        className="apple-input h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        Price per Hour ($)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editableData.pricePerHour}
                        onChange={(e) => handleEditableChange("pricePerHour", parseFloat(e.target.value) || 0)}
                        className="apple-input h-12"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setStep('confirm')}
                className="w-full apple-button-primary h-12"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Continue to Confirmation
              </Button>
            </>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirm' && editableData && (
            <>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Confirm Your Listing</h3>
                
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h4 className="font-semibold text-lg">{editableData.title}</h4>
                      <p className="text-muted-foreground">{editableData.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Type:</span> {spaceTypes.find(t => t.value === editableData.spaceType)?.label}
                      </div>
                      <div>
                        <span className="font-medium">Dimensions:</span> {editableData.dimensions}
                      </div>
                      <div>
                        <span className="font-medium">Price/Hour:</span> ${editableData.pricePerHour}
                      </div>
                      <div>
                        <span className="font-medium">Price/Day:</span> ${editableData.pricePerDay}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium">Location:</span> {formData.address}, {formData.zipCode}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('review')}
                  className="flex-1 apple-button-secondary h-12"
                >
                  Back to Edit
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 apple-button-primary h-12"
                >
                  {loading ? "Listing Space..." : "List My Space"}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
