import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, MapPin, Sparkles, CheckCircle, Edit3, HelpCircle, ExternalLink } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingDots } from "@/components/ui/loading-dots";
import { aiService } from "@/lib/ai-service";
import { webScrapingService } from "@/lib/web-scraping-service";
import { createComponentDebugger } from "@/lib/debug-utils";
import { runFullStorageTest } from "@/lib/storage-test";

interface AISpaceListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SpaceFormData {
  address: string;
  zipCode: string;
  photos: File[];
  photoUrls: string[];
  disableAI: boolean;
  allowAIAgent: boolean;
  enableWebScraping: boolean;
}

interface AIGeneratedData {
  spaceType: string;
  title: string;
  description: string;
  dimensions: string;
  pricePerHour: number;
  pricePerDay: number;
}

interface MarketAnalysis {
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  competitorCount: number;
  listings: Array<{
    title: string;
    price: number;
    priceType: 'hourly' | 'daily' | 'monthly';
    location: string;
    spaceType: string;
    dimensions?: string;
    description?: string;
    source: string;
    url: string;
    scrapedAt: string;
  }>;
  recommendations: {
    suggestedPrice: number;
    reasoning: string;
    competitiveAdvantages: string[];
  };
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
  const debug = createComponentDebugger('AISpaceListingModal');
  
  const [formData, setFormData] = useState<SpaceFormData>({
    address: "",
    zipCode: "",
    photos: [],
    photoUrls: [],
    disableAI: false,
    allowAIAgent: false,
    enableWebScraping: false,
  });
  
  const [aiGeneratedData, setAiGeneratedData] = useState<AIGeneratedData | null>(null);
  const [editableData, setEditableData] = useState<AIGeneratedData | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [step, setStep] = useState<'upload' | 'analyze' | 'review' | 'manual' | 'confirm'>('upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();

  // Debug form data changes
  useEffect(() => {
    debug.debug('Form data changed', formData);
  }, [formData, debug]);

  // Debug step changes
  useEffect(() => {
    debug.info('Step changed', { step });
  }, [step, debug]);

  // Debug state changes
  useEffect(() => {
    debug.debug('Component state', {
      loading,
      uploading,
      analyzing,
      scraping,
      hasUser: !!user,
      hasAiData: !!aiGeneratedData,
      hasEditableData: !!editableData,
      hasMarketAnalysis: !!marketAnalysis
    });
  }, [loading, uploading, analyzing, scraping, user, aiGeneratedData, editableData, marketAnalysis, debug]);

  const handleInputChange = (field: keyof SpaceFormData, value: string | File[] | string[] | boolean) => {
    debug.userAction('Form field changed', { field, value, valueType: typeof value });
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      debug.stateChange(field, prev[field], value);
      return newData;
    });
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    debug.userAction('File upload started', { 
      fileCount: files.length,
      fileNames: Array.from(files).map(f => f.name),
      fileSizes: Array.from(files).map(f => f.size)
    });

    if (!user) {
      debug.warn('File upload failed - no user', { hasUser: !!user });
      toast({
        title: "Authentication required",
        description: "Please sign in to upload photos.",
        variant: "destructive",
      });
      return;
    }

    // Test storage bucket access first
    try {
      debug.debug('Testing storage bucket access');
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        debug.error('Storage bucket access failed', bucketError);
        throw new Error(`Storage access failed: ${bucketError.message}`);
      }
      
      const spacePhotosBucket = buckets?.find(bucket => bucket.name === 'space-photos');
      if (!spacePhotosBucket) {
        debug.error('Space photos bucket not found', { availableBuckets: buckets?.map(b => b.name) });
        throw new Error('Storage bucket "space-photos" not found. Please contact support.');
      }
      
      debug.info('Storage bucket access confirmed', { bucketName: spacePhotosBucket.name });
    } catch (error: any) {
      debug.logError(error, { context: 'storage_bucket_check' });
      toast({
        title: "Storage Error",
        description: error.message || "Unable to access file storage. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    let uploadedUrls: string[] = [];
    let uploadTimeout: NodeJS.Timeout | undefined;
    
    try {
      debug.info('Starting file upload process', { 
        fileCount: files.length,
        userId: user.id 
      });
      
      // Add timeout to prevent hanging
      uploadTimeout = setTimeout(() => {
        debug.error('Upload timeout', { fileCount: files.length });
        throw new Error('Upload timed out after 30 seconds');
      }, 30000);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${user.id}-${Date.now()}-${i}.${fileExt}`;

        debug.debug('Uploading file', { 
          fileName, 
          fileSize: file.size, 
          fileType: file.type, 
          userId: user.id,
          fileIndex: i
        });

        try {
          // Upload to Supabase Storage with timeout
          const uploadPromise = supabase.storage
            .from('space-photos')
            .upload(fileName, file);

          const { data, error } = await uploadPromise;

          if (error) {
            debug.error('Upload error for individual file', { 
              fileName, 
              error, 
              errorCode: error.statusCode,
              fileIndex: i 
            });
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
          }

          debug.debug('Upload successful', { fileName, data });

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('space-photos')
            .getPublicUrl(fileName);

          debug.debug('Public URL generated', { fileName, publicUrl });
          uploadedUrls.push(publicUrl);
        } catch (fileError: any) {
          debug.error('Individual file upload failed', { 
            fileName, 
            fileIndex: i, 
            error: fileError.message 
          });
          throw fileError; // Re-throw to be caught by outer try-catch
        }
      }
      
      // Clear timeout if upload completes successfully
      clearTimeout(uploadTimeout);

      // Update form data with uploaded files and URLs
      setFormData(prev => ({ 
        ...prev, 
        photos: Array.from(files),
        photoUrls: uploadedUrls 
      }));
      
      debug.info('File upload completed successfully', {
        uploadedCount: uploadedUrls.length,
        uploadedUrls,
        disableAI: formData.disableAI,
        enableWebScraping: formData.enableWebScraping
      });
      
      toast({
        title: "Photos uploaded successfully!",
        description: formData.disableAI 
          ? `${files.length} photo(s) uploaded. Ready for manual entry.`
          : `${files.length} photo(s) uploaded. AI analysis starting automatically...`,
      });
      
      if (formData.disableAI) {
        debug.info('Skipping AI analysis - disabled by user');
        setStep('manual');
      } else {
        debug.info('Starting AI analysis after upload', { 
          photoCount: uploadedUrls.length,
          enableWebScraping: formData.enableWebScraping
        });
        setStep('analyze');
        setTimeout(() => {
          analyzePhotosWithAI(uploadedUrls);
        }, 500); // Small delay to let the UI update
      }
    } catch (error: any) {
      // Clear timeout if it exists
      if (typeof uploadTimeout !== 'undefined') {
        clearTimeout(uploadTimeout);
      }
      
      debug.logError(error, { 
        fileCount: files.length,
        uploadedCount: uploadedUrls.length,
        errorMessage: error.message
      });
      
      // Reset form data if upload failed
      setFormData(prev => ({ 
        ...prev, 
        photos: [],
        photoUrls: [] 
      }));
      
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      debug.info('File upload process completed', { 
        success: uploadedUrls.length > 0,
        uploadedCount: uploadedUrls.length 
      });
      setUploading(false);
    }
  };

  const performWebScraping = async (spaceType: string) => {
    if (!formData.enableWebScraping) {
      debug.info('Web scraping skipped - disabled by user');
      return null;
    }
    
    debug.info('Starting web scraping for market analysis', { spaceType });
    setScraping(true);
    
    try {
      const location = formData.address || 'San Francisco, CA';
      debug.debug('Web scraping parameters', { location, spaceType });
      
      const analysis = await webScrapingService.scrapeMarketData(location, spaceType);
      setMarketAnalysis(analysis);
      
      debug.info('Web scraping completed', {
        competitorCount: analysis.competitorCount,
        averagePrice: analysis.averagePrice,
        suggestedPrice: analysis.recommendations.suggestedPrice
      });
      
      toast({
        title: "Market Analysis Complete!",
        description: `Found ${analysis.competitorCount} similar listings in your area.`,
      });
      
      return analysis;
    } catch (error: any) {
      debug.logError(error, { spaceType, location: formData.address });
      toast({
        title: "Market Analysis Unavailable",
        description: "Could not gather market data. Proceeding with AI analysis only.",
        variant: "default",
      });
      return null;
    } finally {
      setScraping(false);
    }
  };

  const analyzePhotosWithAI = async (photoUrls?: string[]) => {
    const urlsToUse = photoUrls || formData.photoUrls;
    
    debug.info('AI analysis started', {
      photoCount: urlsToUse.length,
      photoUrls: urlsToUse,
      address: formData.address,
      zipCode: formData.zipCode,
      enableWebScraping: formData.enableWebScraping
    });
    
    if (!urlsToUse.length) {
      debug.warn('AI analysis skipped - no photo URLs');
      return;
    }

    setAnalyzing(true);
    
    try {
      debug.debug('Calling AI service for photo analysis');
      
      // Add timeout to prevent hanging
      const analysisPromise = aiService.analyzeSpacePhotos(urlsToUse, {
        address: formData.address,
        zipCode: formData.zipCode,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timed out after 30 seconds')), 30000)
      );
      
      const analysisResult = await Promise.race([analysisPromise, timeoutPromise]);
      
      debug.info('AI analysis completed', { analysisResult });
      
      // Perform web scraping if enabled
      const marketData = await performWebScraping(analysisResult.spaceType);
      
      // Convert pricePerHour to pricePerDay (assuming 8 hours per day)
      let pricePerHour = analysisResult.pricePerHour;
      let pricePerDay = pricePerHour * 8;
      
      debug.debug('Initial pricing from AI', { pricePerHour, pricePerDay });
      
      // Adjust pricing based on market analysis if available
      if (marketData) {
        const marketSuggestedPrice = marketData.recommendations.suggestedPrice;
        const originalPrice = pricePerHour;
        // Use market data to inform pricing, but don't override completely
        pricePerHour = Math.round((pricePerHour + marketSuggestedPrice) / 2 * 100) / 100;
        pricePerDay = pricePerHour * 8;
        
        debug.info('Pricing adjusted with market data', {
          originalPrice,
          marketSuggestedPrice,
          finalPrice: pricePerHour,
          adjustment: ((pricePerHour - originalPrice) / originalPrice * 100).toFixed(2) + '%'
        });
      }
      
      // Convert to the expected format
      const aiData: AIGeneratedData = {
        spaceType: analysisResult.spaceType,
        title: analysisResult.title,
        description: analysisResult.description,
        dimensions: analysisResult.dimensions,
        pricePerHour: pricePerHour,
        pricePerDay: pricePerDay,
      };
      
      debug.info('Final AI data generated', { aiData });
      
      setAiGeneratedData(aiData);
      setEditableData(aiData);
      setStep('review');
      
      debug.info('Analysis completed successfully, moving to review step');
      
      toast({
        title: "AI Analysis Complete!",
        description: marketData 
          ? `Your space has been analyzed with market data from ${marketData.competitorCount} competitors.`
          : "Your space has been analyzed. Review the suggestions below.",
      });
    } catch (error: any) {
      debug.logError(error, { photoCount: urlsToUse.length });
      
      // If AI analysis fails, show manual entry form
      setStep('manual');
      
      toast({
        title: "AI Analysis Unavailable",
        description: "Please enter your space details manually below.",
        variant: "default",
      });
    } finally {
      setAnalyzing(false);
    }
  };


  const handleEditableChange = (field: keyof AIGeneratedData, value: string | number) => {
    if (!editableData) return;
    setEditableData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editableData) {
      debug.warn('Submit blocked - missing user or editable data', { 
        hasUser: !!user, 
        hasEditableData: !!editableData 
      });
      return;
    }

    debug.userAction('Form submission started', { 
      editableData, 
      formData: {
        address: formData.address,
        zipCode: formData.zipCode,
        allowAIAgent: formData.allowAIAgent,
        photoCount: formData.photoUrls.length
      }
    });

    setLoading(true);
    try {
      // Insert space into database
      const spaceData = {
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
        allow_ai_agent: formData.allowAIAgent,
      };

      debug.debug('Inserting space into database', spaceData);

      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert(spaceData)
        .select()
        .single();

      if (spaceError) {
        debug.error('Space insertion failed', spaceError);
        throw spaceError;
      }

      debug.info('Space inserted successfully', { spaceId: space.id });

      // Insert photos
      debug.info('Inserting photos', { photoCount: formData.photoUrls.length });
      
      for (let i = 0; i < formData.photoUrls.length; i++) {
        const photoData = {
          space_id: space.id,
          photo_url: formData.photoUrls[i],
          display_order: i + 1,
        };

        debug.debug('Inserting photo', { photoIndex: i, photoData });

        const { error: photoError } = await supabase
          .from('space_photos')
          .insert(photoData);

        if (photoError) {
          debug.error('Photo insertion failed', { photoIndex: i, photoError });
        } else {
          debug.debug('Photo inserted successfully', { photoIndex: i });
        }
      }

      debug.info('Space listing completed successfully', {
        spaceId: space.id,
        photoCount: formData.photoUrls.length,
        allowAIAgent: formData.allowAIAgent
      });

      toast({
        title: "Space listed successfully!",
        description: "Your space is now available for booking.",
      });

      // Reset form and close modal
      debug.info('Resetting form and closing modal');
      setFormData({
        address: "",
        zipCode: "",
        photos: [],
        photoUrls: [],
        disableAI: false,
        allowAIAgent: false,
        enableWebScraping: false,
      });
      setAiGeneratedData(null);
      setEditableData(null);
      setMarketAnalysis(null);
      setStep('upload');
      onOpenChange(false);
    } catch (error: any) {
      debug.logError(error, { 
        hasUser: !!user, 
        hasEditableData: !!editableData,
        formData: {
          address: formData.address,
          zipCode: formData.zipCode,
          photoCount: formData.photoUrls.length
        }
      });
      
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
      disableAI: false,
      allowAIAgent: false,
      enableWebScraping: false,
    });
    setAiGeneratedData(null);
    setEditableData(null);
    setMarketAnalysis(null);
    setStep('upload');
  };

  const testStorage = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to test storage.",
        variant: "destructive",
      });
      return;
    }

    debug.info('Starting storage test');
    try {
      const result = await runFullStorageTest(user.id);
      
      if (result.success) {
        toast({
          title: "Storage Test Passed",
          description: result.message,
        });
        debug.info('Storage test completed successfully', result.details);
      } else {
        toast({
          title: "Storage Test Failed",
          description: result.message,
          variant: "destructive",
        });
        debug.error('Storage test failed', result.details);
      }
    } catch (error: any) {
      debug.logError(error, { context: 'storage_test' });
      toast({
        title: "Storage Test Error",
        description: error.message || "Failed to test storage.",
        variant: "destructive",
      });
    }
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
            {step === 'manual' && "Enter your space details manually"}
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
          <div className={`w-8 h-0.5 ${step === 'review' || step === 'manual' || step === 'confirm' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center space-x-2 ${step === 'review' || step === 'manual' || step === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'review' || step === 'manual' || step === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              3
            </div>
            <span className="text-sm font-medium">Review/Manual</span>
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
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Location (Optional)</h3>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Pro tip:</strong> Adding your location helps our AI generate more accurate pricing, 
                      better descriptions, and location-specific features for your listing.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Address (optional)
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="address"
                        placeholder="e.g., 123 Main St, San Francisco, CA"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        className="apple-input pl-10 h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="text-sm font-medium">
                      ZIP Code (optional)
                    </Label>
                    <Input
                      id="zipCode"
                      placeholder="94110"
                      value={formData.zipCode}
                      onChange={(e) => handleInputChange("zipCode", e.target.value)}
                      className="apple-input h-12"
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded-lg">
                    <p className="font-medium mb-1">📍 Location helps AI provide:</p>
                    <ul className="space-y-1 list-disc list-inside ml-2">
                      <li>Market-appropriate pricing</li>
                      <li>Local neighborhood features</li>
                      <li>Area-specific descriptions</li>
                      <li>Better search visibility</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* AI Analysis Toggle */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="disableAI"
                      checked={formData.disableAI}
                      onCheckedChange={(checked) => handleInputChange("disableAI", checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="disableAI" className="text-sm font-medium cursor-pointer">
                        Disable AI photo analysis
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Check this box to skip AI analysis and enter your space details manually. 
                        Your photos will still be uploaded but won't be analyzed by AI.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Web Scraping Toggle */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-blue-50/50">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="enableWebScraping"
                      checked={formData.enableWebScraping}
                      onCheckedChange={(checked) => handleInputChange("enableWebScraping", checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="enableWebScraping" className="text-sm font-medium cursor-pointer">
                          Enable market research via web scraping
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4">
                              <div className="space-y-2">
                                <p className="font-medium">Market Research</p>
                                <p className="text-sm">
                                  Our AI will automatically search other websites (Craigslist, Facebook Marketplace, etc.) 
                                  to find similar listings in your area and provide competitive pricing insights.
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium mb-1">What we'll find:</p>
                                  <ul className="space-y-1 list-disc list-inside">
                                    <li>Competitor pricing data</li>
                                    <li>Market average rates</li>
                                    <li>Location-specific insights</li>
                                    <li>Pricing recommendations</li>
                                  </ul>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, our AI will research similar listings on other platforms to provide 
                        data-driven pricing recommendations and market insights for your space.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {formData.photoUrls.length > 0 ? (
                <div className="space-y-3">
                  {formData.disableAI ? (
                    <Button
                      type="button"
                      onClick={() => setStep('manual')}
                      className="w-full apple-button-primary h-12"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Enter Details Manually
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={analyzePhotosWithAI}
                      className="w-full apple-button-primary h-12"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze with AI
                    </Button>
                  )}
                  <p className="text-xs text-center text-muted-foreground">
                    {formData.disableAI 
                      ? "ℹ️ AI analysis disabled - you'll enter details manually"
                      : formData.address && formData.zipCode 
                        ? "✅ Location provided - AI will generate location-specific pricing and features"
                        : "ℹ️ No location provided - AI will use general market rates"
                    }
                  </p>
                </div>
              ) : (
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Upload photos above to start AI analysis
                  </p>
                </div>
              )}

              {/* Debug Information */}
              {import.meta.env.DEV && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs">
                  <h4 className="font-semibold mb-2">Debug Info:</h4>
                  <div className="space-y-1">
                    <p><strong>Uploading:</strong> {uploading ? 'Yes' : 'No'}</p>
                    <p><strong>Photos:</strong> {formData.photos.length}</p>
                    <p><strong>Photo URLs:</strong> {formData.photoUrls.length}</p>
                    <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
                    <p><strong>Step:</strong> {step}</p>
                    {formData.photoUrls.length > 0 && (
                      <div>
                        <p><strong>Uploaded URLs:</strong></p>
                        <ul className="ml-4 list-disc">
                          {formData.photoUrls.map((url, index) => (
                            <li key={index} className="break-all">{url}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={testStorage}
                      className="w-full text-xs"
                    >
                      Test Storage Connection
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: AI Analysis */}
          {step === 'analyze' && (
            <div className="text-center space-y-6 py-8">
              <LoadingDots size="lg" className="text-primary mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  {analyzing && scraping 
                    ? "AI is analyzing your photos and researching market data..."
                    : analyzing 
                      ? "AI is analyzing your photos..."
                      : scraping
                        ? "Researching market data from other platforms..."
                        : "Processing your space..."
                  }
                </h3>
                <p className="text-muted-foreground">
                  {analyzing && scraping 
                    ? "Our AI is examining your space and gathering competitive pricing insights"
                    : analyzing 
                      ? "Our AI is examining your space to generate the perfect listing"
                      : scraping
                        ? "Searching other websites for similar listings and pricing data"
                        : "Preparing your space analysis"
                  }
                </p>
                <div className="text-xs text-muted-foreground mt-4 p-3 bg-gray-50 rounded-lg">
                  <p>This may take 10-30 seconds depending on your connection and API response time.</p>
                  {formData.enableWebScraping && (
                    <p>Market research may take additional time to gather competitor data.</p>
                  )}
                  <p>Check the browser console for detailed progress logs.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Manual Entry Form */}
          {step === 'manual' && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Enter Your Space Details</h3>
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

                {/* Manual Entry Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Space Type *</Label>
                    <select
                      value={editableData?.spaceType || ''}
                      onChange={(e) => {
                        if (!editableData) {
                          setEditableData({
                            spaceType: e.target.value,
                            title: '',
                            description: '',
                            dimensions: '',
                            pricePerHour: 0,
                            pricePerDay: 0
                          });
                        } else {
                          handleEditableChange("spaceType", e.target.value);
                        }
                      }}
                      className="apple-input h-12 w-full"
                      required
                    >
                      <option value="">Select space type</option>
                      {spaceTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Title *</Label>
                    <Input
                      value={editableData?.title || ''}
                      onChange={(e) => {
                        if (!editableData) {
                          setEditableData({
                            spaceType: '',
                            title: e.target.value,
                            description: '',
                            dimensions: '',
                            pricePerHour: 0,
                            pricePerDay: 0
                          });
                        } else {
                          handleEditableChange("title", e.target.value);
                        }
                      }}
                      placeholder="e.g., Spacious Garage in Downtown"
                      className="apple-input h-12"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Description *</Label>
                    <textarea
                      value={editableData?.description || ''}
                      onChange={(e) => {
                        if (!editableData) {
                          setEditableData({
                            spaceType: '',
                            title: '',
                            description: e.target.value,
                            dimensions: '',
                            pricePerHour: 0,
                            pricePerDay: 0
                          });
                        } else {
                          handleEditableChange("description", e.target.value);
                        }
                      }}
                      placeholder="Describe your space, its features, and what makes it special..."
                      className="apple-input min-h-[100px] resize-none w-full"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Dimensions *</Label>
                      <Input
                        value={editableData?.dimensions || ''}
                        onChange={(e) => {
                          if (!editableData) {
                            setEditableData({
                              spaceType: '',
                              title: '',
                              description: '',
                              dimensions: e.target.value,
                              pricePerHour: 0,
                              pricePerDay: 0
                            });
                          } else {
                            handleEditableChange("dimensions", e.target.value);
                          }
                        }}
                        placeholder="e.g., 20x12 feet"
                        className="apple-input h-12"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Price per Hour ($) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editableData?.pricePerHour || ''}
                        onChange={(e) => {
                          const price = parseFloat(e.target.value) || 0;
                          if (!editableData) {
                            setEditableData({
                              spaceType: '',
                              title: '',
                              description: '',
                              dimensions: '',
                              pricePerHour: price,
                              pricePerDay: price * 8
                            });
                          } else {
                            handleEditableChange("pricePerHour", price);
                            handleEditableChange("pricePerDay", price * 8);
                          }
                        }}
                        placeholder="0.00"
                        className="apple-input h-12"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!editableData?.spaceType || !editableData?.title || !editableData?.description || !editableData?.dimensions || !editableData?.pricePerHour}
                className="w-full apple-button-primary h-12"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Continue to Confirmation
              </Button>
            </>
          )}

          {/* Step 4: Review AI Suggestions */}
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

              {/* Market Analysis Display */}
              {marketAnalysis && (
                <div className="space-y-4">
                  <div className="p-4 border border-blue-200 rounded-lg bg-blue-50/50">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Market Analysis
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">${marketAnalysis.averagePrice}</div>
                        <div className="text-sm text-gray-600">Market Average</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-green-600">${marketAnalysis.recommendations.suggestedPrice}</div>
                        <div className="text-sm text-gray-600">Suggested Price</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{marketAnalysis.competitorCount}</div>
                        <div className="text-sm text-gray-600">Competitors Found</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">Pricing Insights</h4>
                        <p className="text-sm text-gray-700">{marketAnalysis.recommendations.reasoning}</p>
                      </div>

                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">Price Range</h4>
                        <p className="text-sm text-gray-700">
                          ${marketAnalysis.priceRange.min} - ${marketAnalysis.priceRange.max} per hour
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">Competitive Advantages</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {marketAnalysis.recommendations.competitiveAdvantages.map((advantage, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                              {advantage}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

              {/* AI Agent Negotiation Option */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="allowAIAgent"
                      checked={formData.allowAIAgent}
                      onCheckedChange={(checked) => handleInputChange("allowAIAgent", checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="allowAIAgent" className="text-sm font-medium cursor-pointer">
                          Allow AI agent to negotiate on my behalf
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4">
                              <div className="space-y-2">
                                <p className="font-medium">AI Agent Negotiation</p>
                                <p className="text-sm">
                                  Our AI agent will automatically negotiate with potential renters on your behalf, 
                                  handling price discussions, availability, and special requests.
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium mb-1">Benefits:</p>
                                  <ul className="space-y-1 list-disc list-inside">
                                    <li>24/7 availability for negotiations</li>
                                    <li>Data-driven pricing strategies</li>
                                    <li>Automatic counter-offers</li>
                                    <li>Reduced time spent on back-and-forth</li>
                                  </ul>
                                </div>
                                <a 
                                  href="/ai-agent-help" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  Learn more <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, our AI agent will automatically handle negotiations with potential renters, 
                        including price discussions and special requests. You can always override decisions or disable this feature later.
                      </p>
                    </div>
                  </div>
                </div>
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
