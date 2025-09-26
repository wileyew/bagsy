import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, MapPin, Sparkles, CheckCircle, Edit3, HelpCircle, ExternalLink, ArrowRight, Calendar, Plus } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserListingsCount } from "@/hooks/use-user-listings-count";
import { LoadingDots } from "@/components/ui/loading-dots";
import { aiService, LocationContext } from "@/lib/ai-service";
import { webScrapingService } from "@/lib/web-scraping-service";
import { smartSchedulingService } from "@/lib/smart-scheduling-service";
import { smartMatchingService } from "@/lib/smart-matching-service";
import { marketingContentService } from "@/lib/marketing-content-service";
import { geolocationService, LocationData } from "@/lib/geolocation-service";
import { aiRecommendationsService, AIRecommendation } from "@/lib/ai-recommendations-service";
import { createComponentDebugger } from "@/lib/debug-utils";
import { runFullStorageTest } from "@/lib/storage-test";
import { getPhotoUploadErrorMessage, getPhotoUploadSuccessMessage } from "@/lib/photo-upload-error-messages";

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
  enablePricingOptimization: boolean;
  enableSmartScheduling: boolean;
  enableMarketingContent: boolean;
  enablePredictiveAnalytics: boolean;
  customSpaceType?: string;
  selectedSpaceTypes: string[];
  availabilityWindows: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  isRecurring: boolean;
  recurringPattern?: 'weekly' | 'monthly';
  availableFrom: string;
  availableUntil: string;
  timezone: string;
  specialInstructions: string;
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
  { value: "rv_storage", label: "RV Storage", description: "Dedicated space for RVs, campers, and trailers" },
  { value: "other", label: "Other", description: "Custom space type" },
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

export function AISpaceListingModal({ open, onOpenChange }: AISpaceListingModalProps) {
  const debug = createComponentDebugger('AISpaceListingModal');
  const { user } = useAuthContext();
  
  // Close modal if user is not authenticated
  useEffect(() => {
    if (open && !user) {
      onOpenChange(false);
    }
  }, [open, user, onOpenChange]);
  
  const [formData, setFormData] = useState<SpaceFormData>({
    address: "",
    zipCode: "",
    photos: [],
    photoUrls: [],
    disableAI: false,
    allowAIAgent: false,
    enableWebScraping: false,
    enablePricingOptimization: false,
    enableSmartScheduling: false,
    enableMarketingContent: false,
    enablePredictiveAnalytics: false,
    customSpaceType: "",
    selectedSpaceTypes: [],
    availabilityWindows: [],
    isRecurring: false,
    recurringPattern: 'weekly',
    availableFrom: "",
    availableUntil: "",
    timezone: "America/Los_Angeles",
    specialInstructions: "",
  });
  
  const [aiGeneratedData, setAiGeneratedData] = useState<AIGeneratedData | null>(null);
  const [editableData, setEditableData] = useState<AIGeneratedData | null>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<MarketAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [step, setStep] = useState<'upload' | 'analyze' | 'review' | 'manual' | 'confirm'>('upload');
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState({ count: 0, maxRequests: 2, isBlocked: false, remaining: 2 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { listingsCount } = useUserListingsCount();

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

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      debug.info('Requesting current location');
      const location = await geolocationService.getCurrentLocation();
      setCurrentLocation(location);
      
      // Auto-fill address and zip code if not already set
      if (!formData.address && location.address) {
        setFormData(prev => ({ ...prev, address: location.address }));
      }
      if (!formData.zipCode && location.zipCode) {
        setFormData(prev => ({ ...prev, zipCode: location.zipCode }));
      }
      
      toast({
        title: "Location Found!",
        description: `Located: ${location.address}`,
      });
      
      debug.info('Location obtained successfully', location);
    } catch (error) {
      debug.error('Failed to get location', error);
      toast({
        title: "Location Access Denied",
        description: "Please enter your address manually or allow location access.",
        variant: "destructive",
      });
    } finally {
      setLocationLoading(false);
    }
  };

  const generateAIRecommendations = async () => {
    if (!user) return;
    
    setRecommendationsLoading(true);
    try {
      debug.info('Generating AI recommendations');
      
      // Create a mock user profile based on current form data
      const userProfile = {
        userId: user.id,
        preferences: {
          spaceTypes: formData.selectedSpaceTypes.length > 0 ? formData.selectedSpaceTypes : ['general'],
          priceRange: { min: 0, max: 100 },
          locations: formData.address ? [formData.address] : [],
          amenities: []
        },
        searchHistory: [],
        bookingHistory: [],
        behaviorPatterns: {
          frequency: 'medium' as const,
          priceSensitivity: 'medium' as const,
          locationPreference: 'flexible' as const
        }
      };

      // Get recommendations for the selected space types or general recommendations
      const recommendations: AIRecommendation[] = [];
      const spaceTypesToAnalyze = formData.selectedSpaceTypes.length > 0 ? formData.selectedSpaceTypes : ['general'];
      
      for (const spaceType of spaceTypesToAnalyze) {
        const spaceRecommendations = await aiRecommendationsService.getSpaceTypeRecommendations(spaceType, userProfile);
        recommendations.push(...spaceRecommendations);
      }

      // Remove duplicates and sort by confidence
      const uniqueRecommendations = recommendations.filter((rec, index, self) => 
        index === self.findIndex(r => r.id === rec.id)
      ).sort((a, b) => b.confidence - a.confidence);

      setAiRecommendations(uniqueRecommendations);
      
      debug.info('AI recommendations generated', { 
        count: uniqueRecommendations.length,
        recommendations: uniqueRecommendations.map(r => ({ id: r.id, title: r.title }))
      });
      
      toast({
        title: "AI Recommendations Ready!",
        description: `Generated ${uniqueRecommendations.length} personalized recommendations for your space.`,
      });
    } catch (error) {
      debug.error('Failed to generate AI recommendations', error);
      toast({
        title: "Recommendations Unavailable",
        description: "Unable to generate AI recommendations at this time.",
        variant: "destructive",
      });
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const applyRecommendation = (recommendation: AIRecommendation) => {
    debug.info('Applying AI recommendation', { recommendationId: recommendation.id });
    
    // Apply the recommendation based on its category
    switch (recommendation.category) {
      case 'pricing':
        setFormData(prev => ({ ...prev, enablePricingOptimization: true }));
        break;
      case 'marketing':
        setFormData(prev => ({ ...prev, enableMarketingContent: true }));
        break;
      case 'scheduling':
        setFormData(prev => ({ ...prev, enableSmartScheduling: true }));
        break;
      case 'webscraping':
        setFormData(prev => ({ ...prev, enableWebScraping: true }));
        break;
      case 'analytics':
        setFormData(prev => ({ ...prev, enablePredictiveAnalytics: true }));
        break;
    }
    
    toast({
      title: "Recommendation Applied!",
      description: `${recommendation.title} has been enabled for your listing.`,
    });
  };

  const updateRequestStatus = useCallback(() => {
    const status = aiService.getRequestStatus();
    setRequestStatus(status);
    debug.info('Request status updated', status);
  }, [debug]);

  const handleSpaceTypeChange = (spaceType: string, checked: boolean) => {
    debug.userAction('Space type checkbox changed', { spaceType, checked });
    setFormData(prev => {
      const newSelectedTypes = checked
        ? [...prev.selectedSpaceTypes, spaceType]
        : prev.selectedSpaceTypes.filter(type => type !== spaceType);
      
      console.log('Space type change:', {
        spaceType,
        checked,
        previousTypes: prev.selectedSpaceTypes,
        newTypes: newSelectedTypes,
        newLength: newSelectedTypes.length
      });
      
      debug.stateChange('selectedSpaceTypes', prev.selectedSpaceTypes, newSelectedTypes);
      return { ...prev, selectedSpaceTypes: newSelectedTypes };
    });
  };

  const addAvailabilityWindow = () => {
    setFormData(prev => ({
      ...prev,
      availabilityWindows: [
        ...prev.availabilityWindows,
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
      ]
    }));
  };

  const removeAvailabilityWindow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      availabilityWindows: prev.availabilityWindows.filter((_, i) => i !== index)
    }));
  };

  const updateAvailabilityWindow = (index: number, field: 'dayOfWeek' | 'startTime' | 'endTime', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      availabilityWindows: prev.availabilityWindows.map((window, i) => 
        i === index ? { ...window, [field]: value } : window
      )
    }));
  };

  const daysOfWeek = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' },
  ];

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    // Always log to console for debugging
    console.log('🚀 File upload started', { 
      fileCount: files.length,
      fileNames: Array.from(files).map(f => f.name),
      fileSizes: Array.from(files).map(f => f.size)
    });

    debug.userAction('File upload started', { 
      fileCount: files.length,
      fileNames: Array.from(files).map(f => f.name),
      fileSizes: Array.from(files).map(f => f.size)
    });

    if (!user) {
      console.error('❌ File upload failed - no user', { hasUser: !!user });
      debug.warn('File upload failed - no user', { hasUser: !!user });
      toast({
        title: "Authentication required",
        description: "Please sign in to upload photos.",
        variant: "destructive",
      });
      return;
    }

    // Check storage access (bucket should already exist from SQL setup)
    try {
      console.log('🔍 Checking storage access...');
      debug.debug('Checking storage access');
      
      // Try to access the bucket directly instead of listing all buckets
      console.log('🔍 Testing direct bucket access...');
      debug.debug('Testing direct bucket access');
      
      // Test if we can list files in the space-photos bucket (this will tell us if it exists and is accessible)
      const { data: testFiles, error: testError } = await supabase.storage
        .from('space-photos')
        .list('', { limit: 1 });
      
      if (testError) {
        console.error('❌ Direct bucket access failed:', testError);
        debug.error('Direct bucket access failed', testError);
        
        // If it's a "bucket not found" error, try to create it
        if (testError.message.includes('not found') || testError.message.includes('does not exist')) {
          console.log('🔧 Bucket not found, attempting to create...');
          debug.info('Bucket not found, attempting to create');
          
          const { setupStorageBuckets } = await import('@/lib/setup-storage');
          const setupResult = await setupStorageBuckets();
          
          if (!setupResult.success) {
            throw new Error(`Failed to create storage bucket: ${setupResult.message}. Please run the SQL setup script in Supabase SQL Editor first.`);
          }
          
          console.log('✅ Bucket created successfully:', setupResult.message);
          debug.info('Bucket created successfully', setupResult);
        } else {
          throw new Error(`Storage access failed: ${testError.message}`);
        }
      } else {
        console.log('✅ Direct bucket access confirmed - bucket exists and is accessible');
        debug.info('Direct bucket access confirmed', { fileCount: testFiles?.length || 0 });
      }
      
    } catch (error: unknown) {
      console.error('❌ Storage access error:', error);
      debug.logError(error instanceof Error ? error : new Error(String(error)), { context: 'storage_access_check' });
      toast({
        title: "Storage Setup Required",
        description: "Please run the SQL setup script in Supabase SQL Editor to create the storage bucket. Check the manual-sql-fix.sql file for the script.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const uploadedUrls: string[] = [];
    
    try {
      console.log('📤 Starting file upload process', { 
        fileCount: files.length,
        userId: user.id 
      });
      debug.info('Starting file upload process', { 
        fileCount: files.length,
        userId: user.id 
      });
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${user.id}-${Date.now()}-${i}.${fileExt}`;

        console.log(`📁 Uploading file ${i + 1}/${files.length}:`, { 
          fileName, 
          fileSize: file.size, 
          fileType: file.type, 
          userId: user.id,
          fileIndex: i
        });
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

          const uploadTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Individual file upload timed out after 15 seconds')), 15000);
          });

          const result = await Promise.race([uploadPromise, uploadTimeoutPromise]) as { data: unknown, error: unknown };
          const { data, error } = result;

          if (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Upload error for file ${i + 1}:`, { 
              fileName, 
              error, 
              errorMessage,
              fileIndex: i 
            });
            debug.error('Upload error for individual file', { 
              fileName, 
              error, 
              errorMessage,
              fileIndex: i 
            });
            
            // Provide more helpful error messages for RLS issues
            if (errorMessage.includes('row-level security')) {
              throw new Error(`Storage security policy error. Please ensure you're logged in and storage policies are configured. Original error: ${errorMessage}`);
            } else if (errorMessage.includes('bucket')) {
              throw new Error(`Storage bucket error. Please try the "Setup Storage Buckets" button in debug mode. Original error: ${errorMessage}`);
            } else {
              throw new Error(`Failed to upload ${file.name}: ${errorMessage}`);
            }
          }

          console.log(`✅ Upload successful for file ${i + 1}:`, { fileName, data });
          debug.debug('Upload successful', { fileName, data });

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('space-photos')
            .getPublicUrl(fileName);

          debug.debug('Public URL generated', { fileName, publicUrl });
          uploadedUrls.push(publicUrl);
        } catch (fileError: unknown) {
          debug.error('Individual file upload failed', { 
            fileName, 
            fileIndex: i, 
            error: fileError instanceof Error ? fileError.message : String(fileError)
          });
          throw fileError; // Re-throw to be caught by outer try-catch
        }
      }

      // Update form data with uploaded files and URLs
      setFormData(prev => ({ 
        ...prev, 
        photos: Array.from(files),
        photoUrls: uploadedUrls 
      }));
      
      console.log('🎉 File upload completed successfully!', {
        uploadedCount: uploadedUrls.length,
        uploadedUrls,
        disableAI: formData.disableAI,
        enableWebScraping: formData.enableWebScraping
      });
      
      // Debug: Log the state update
      debug.info('Form data updated with photos', {
        photoCount: uploadedUrls.length,
        photoUrls: uploadedUrls,
        newState: { 
          ...formData, 
          photos: Array.from(files),
          photoUrls: uploadedUrls 
        }
      });
      debug.info('File upload completed successfully', {
        uploadedCount: uploadedUrls.length,
        uploadedUrls,
        disableAI: formData.disableAI,
        enableWebScraping: formData.enableWebScraping
      });
      
      const successMessage = getPhotoUploadSuccessMessage(files.length);
      toast({
        title: successMessage.title,
        description: successMessage.description,
      });
      
      // Stay on upload step to show AI analysis options
      debug.info('Photos uploaded successfully', { 
          photoCount: uploadedUrls.length,
        enableWebScraping: formData.enableWebScraping,
        enablePricingOptimization: formData.enablePricingOptimization
        });
    } catch (error: unknown) {
      console.error('💥 Upload process failed:', error);
      debug.logError(error instanceof Error ? error : new Error(String(error)), { 
        fileCount: files.length,
        uploadedCount: uploadedUrls.length,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      // Reset form data if upload failed
      setFormData(prev => ({ 
        ...prev, 
        photos: [],
        photoUrls: [] 
      }));
      
      // Clear the file input element on upload failure
      clearFileInput();
      
      const errorMessage = getPhotoUploadErrorMessage(true);
      toast({
        title: errorMessage.title,
        description: errorMessage.description,
        variant: "destructive",
      });
    } finally {
      console.log('🏁 File upload process completed', { 
        success: uploadedUrls.length > 0,
        uploadedCount: uploadedUrls.length 
      });
      debug.info('File upload process completed', { 
        success: uploadedUrls.length > 0,
        uploadedCount: uploadedUrls.length 
      });
      setUploading(false);
    }
  };

  const performWebScraping = useCallback(async (spaceType: string) => {
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
    } catch (error: unknown) {
      debug.logError(error instanceof Error ? error : new Error(String(error)), { spaceType, location: formData.address });
      toast({
        title: "Market Analysis Unavailable",
        description: "Could not gather market data. Proceeding with AI analysis only.",
        variant: "default",
      });
      return null;
    } finally {
      setScraping(false);
    }
  }, [formData.enableWebScraping, formData.address, debug, toast]);

  const performPricingOptimization = useCallback(async (basePrice: number, spaceType: string) => {
    if (!formData.enablePricingOptimization) {
      debug.info('Pricing optimization skipped - disabled by user');
      return null;
    }
    
    debug.info('Starting AI pricing optimization', { basePrice, spaceType });
    
    try {
      console.log('💰 Calling AI service for pricing optimization...');
      
      const optimizationData = await aiService.optimizePricing(
        basePrice,
        spaceType,
        formData.address ? `${formData.address}, ${formData.zipCode}` : undefined,
        marketAnalysis
      );
      
      debug.info('Pricing optimization completed', optimizationData);
      
      toast({
        title: "Pricing Optimization Complete!",
        description: `AI suggests optimizing your price to $${optimizationData.optimizedPrice.toFixed(2)}/hour.`,
      });
      
      return optimizationData;
    } catch (error: unknown) {
      debug.logError(error instanceof Error ? error : new Error(String(error)), { basePrice, spaceType });
      toast({
        title: "Pricing Optimization Unavailable",
        description: "Could not perform pricing optimization. Using base AI pricing.",
        variant: "default",
      });
      return null;
    }
  }, [formData.enablePricingOptimization, formData.address, formData.zipCode, marketAnalysis, debug, toast]);

  const analyzePhotosWithAI = useCallback(async (photoUrls?: string[]) => {
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
        selectedSpaceTypes: formData.selectedSpaceTypes,
        customSpaceType: formData.customSpaceType,
        enableWebScraping: formData.enableWebScraping,
        enablePricingOptimization: formData.enablePricingOptimization,
        enableSmartScheduling: formData.enableSmartScheduling,
        enableMarketingContent: formData.enableMarketingContent,
        enablePredictiveAnalytics: formData.enablePredictiveAnalytics,
        currentLocation: currentLocation,
        userPreferences: {
          priceRange: { min: 0, max: 100 }, // Default range, could be enhanced with user input
          amenities: [], // Could be enhanced with user preferences
          accessibility: [], // Could be enhanced with user preferences
          restrictions: [], // Could be enhanced with user preferences
        },
        additionalInfo: {
          availability: 'Flexible', // Could be enhanced with user input
          accessHours: '24/7 during reservation period', // Updated to clarify reservation period access
          specialFeatures: [], // Could be enhanced with user input
          restrictions: [], // Could be enhanced with user input
          nearbyAmenities: [], // Could be enhanced with user input
        },
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timed out after 30 seconds')), 30000)
      );
      
      const analysisResult = await Promise.race([analysisPromise, timeoutPromise]) as AIGeneratedData;
      
      debug.info('AI analysis completed', { analysisResult });
      
      // Update request status
      updateRequestStatus();
      
      // Perform web scraping if enabled
      const spaceTypeForScraping = analysisResult.spaceType === 'other' && formData.customSpaceType 
        ? formData.customSpaceType 
        : analysisResult.spaceType;
      const marketData = await performWebScraping(spaceTypeForScraping);
      
      // Convert pricePerHour to pricePerDay (assuming 8 hours per day)
      let pricePerHour = analysisResult.pricePerHour;
      let pricePerDay = pricePerHour * 8;
      
      // Initialize final result with AI analysis
      let finalDescription = analysisResult.description;
      let finalDimensions = analysisResult.dimensions;
      let finalTitle = analysisResult.title;
      
      debug.debug('Initial data from AI', { 
        pricePerHour, 
        pricePerDay, 
        description: finalDescription.substring(0, 50) + '...',
        dimensions: finalDimensions,
        title: finalTitle
      });
      
      // Enhance with webscraping data if available
      if (marketData && formData.enableWebScraping) {
        debug.info('Enhancing AI analysis with webscraping data', {
          marketData: {
            averagePrice: marketData.averagePrice,
            competitorCount: marketData.competitorCount,
            priceRange: marketData.priceRange,
            recommendations: marketData.recommendations
          }
        });
        
        // Use market-suggested pricing
        const marketSuggestedPrice = marketData.recommendations.suggestedPrice;
        pricePerHour = marketSuggestedPrice;
        pricePerDay = pricePerHour * 8;
        
        // Enhance description with market insights
        if (marketData.recommendations.competitiveAdvantages.length > 0) {
          const advantages = marketData.recommendations.competitiveAdvantages.join(', ');
          finalDescription = `${analysisResult.description} Market analysis shows competitive advantages: ${advantages}.`;
        }
        
        // Enhance dimensions if market data provides insights
        if (marketData.priceRange && marketData.priceRange.max > marketData.priceRange.min) {
          finalDimensions = `${analysisResult.dimensions} (Market range: $${marketData.priceRange.min}-$${marketData.priceRange.max}/hour)`;
        }
        
        // Enhance title with market positioning
        if (marketData.competitorCount > 0) {
          finalTitle = `${analysisResult.title} - Competitive Market Rate`;
        }
        
        debug.info('Enhanced data with webscraping', {
          finalPrice: pricePerHour,
          enhancedDescription: finalDescription.substring(0, 50) + '...',
          enhancedDimensions: finalDimensions,
          enhancedTitle: finalTitle
        });
      }
      
      // Apply pricing optimization if enabled
      const optimizationData = await performPricingOptimization(pricePerHour, analysisResult.spaceType);
      if (optimizationData) {
        const originalPrice = pricePerHour;
        pricePerHour = optimizationData.optimizedPrice;
        pricePerDay = pricePerHour * 8;
        
        debug.info('Pricing optimized with AI', {
          originalPrice,
          optimizedPrice: pricePerHour,
          optimization: ((pricePerHour - originalPrice) / originalPrice * 100).toFixed(2) + '%'
        });
      }
      
      // Apply smart scheduling if enabled
      if (formData.enableSmartScheduling) {
        try {
          debug.info('Applying smart scheduling analysis');
          
          // Get historical booking data for this space type and location
          const { data: similarSpaces, error: spacesError } = await supabase
            .from('spaces')
            .select('id')
            .eq('space_type', analysisResult.spaceType)
            .ilike('address', `%${formData.address.split(',')[0]}%`)
            .eq('is_active', true);

          if (!spacesError && similarSpaces && similarSpaces.length > 0) {
            const spaceIds = similarSpaces.map(s => s.id);
            const { data: bookings, error: bookingsError } = await supabase
              .from('bookings')
              .select('*')
              .in('space_id', spaceIds)
              .eq('status', 'confirmed')
              .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 90 days

            if (!bookingsError && bookings) {
              const bookingData = bookings.map(booking => ({
                id: booking.id,
                spaceId: booking.space_id,
                startTime: booking.start_time,
                endTime: booking.end_time,
                totalPrice: booking.total_price,
                status: booking.status as 'pending' | 'confirmed' | 'cancelled' | 'completed',
                createdAt: booking.created_at
              }));

              const schedulingData = await smartSchedulingService.suggestOptimalAvailability(
                'temp-space-id', // We'll use a temporary ID for analysis
                bookingData
              );

              debug.info('Smart scheduling analysis completed', { 
                optimalWindows: schedulingData.length,
                schedulingEnabled: true 
              });
            }
          }
        } catch (error) {
          debug.warn('Smart scheduling analysis failed', error);
        }
      }

      // TODO: Re-enable marketing content generation in future
      // Generate marketing content if enabled
      // if (formData.enableMarketingContent) {
      //   try {
      //     debug.info('Generating marketing content');
      //     
      //     const spaceData = {
      //       id: 'temp-space-id',
      //       space_type: analysisResult.spaceType,
      //       title: finalTitle,
      //       description: finalDescription,
      //       address: formData.address,
      //       price_per_hour: pricePerHour,
      //       dimensions: finalDimensions
      //     };

      //     // Generate SEO content
      //     const seoContent = await marketingContentService.generateSEOContent(spaceData, marketData);
      //     
      //     // Generate social media content
      //     const socialContent = await marketingContentService.generateSocialMediaContent(spaceData);
      //     
      //     // Generate email campaigns
      //     const emailCampaigns = await marketingContentService.generateEmailCampaigns(spaceData, 'potential_renters');
      //     
      //     debug.info('Marketing content generated', {
      //       seoScore: seoContent.seoScore,
      //       socialPlatforms: socialContent.length,
      //       emailCampaigns: emailCampaigns.length
      //     });
      //   } catch (error) {
      //     debug.warn('Marketing content generation failed', error);
      //   }
      // }

      // Apply predictive analytics if enabled
      if (formData.enablePredictiveAnalytics) {
        try {
          debug.info('Applying predictive analytics');
          
          const timeframe = {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Next 30 days
          };

          const demandForecast = await smartSchedulingService.predictDemandPatterns(
            formData.address.split(',')[0], // City
            analysisResult.spaceType,
            timeframe
          );

          debug.info('Predictive analytics completed', {
            forecastDays: demandForecast.length,
            averageDemand: demandForecast.reduce((sum, f) => sum + f.expectedDemand, 0) / demandForecast.length
          });
        } catch (error) {
          debug.warn('Predictive analytics failed', error);
        }
      }
      
      // Convert to the expected format using enhanced data
      const aiData: AIGeneratedData = {
        spaceType: analysisResult.spaceType,
        title: finalTitle,
        description: finalDescription,
        dimensions: finalDimensions,
        pricePerHour: pricePerHour,
        pricePerDay: pricePerDay,
      };
      
      debug.info('Final AI data generated', { aiData });
      
      setAiGeneratedData(aiData);
      setEditableData(aiData);
      setStep('review');
      
      debug.info('Analysis completed successfully, moving to review step');
      
      // Create enhanced success message
      const enabledFeatures = [];
      if (formData.enableWebScraping && marketData) {
        enabledFeatures.push(`market data from ${marketData.competitorCount} competitors`);
      }
      if (formData.enablePricingOptimization) {
        enabledFeatures.push('AI pricing optimization');
      }
      if (formData.enableSmartScheduling) {
        enabledFeatures.push('smart scheduling analysis');
      }
      if (formData.enableMarketingContent) {
        enabledFeatures.push('marketing content generation');
      }
      if (formData.enablePredictiveAnalytics) {
        enabledFeatures.push('predictive analytics');
      }

      const description = enabledFeatures.length > 0 
        ? `Your space has been analyzed with ${enabledFeatures.join(', ')}. Review the suggestions below.`
        : "Your space has been analyzed. Review the suggestions below.";
      
      toast({
        title: "AI Analysis Complete!",
        description,
      });
    } catch (error: unknown) {
      debug.logError(error instanceof Error ? error : new Error(String(error)), { photoCount: urlsToUse.length });
      
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
  }, [formData.photoUrls, formData.address, formData.zipCode, formData.enableWebScraping, formData.enablePricingOptimization, formData.enableSmartScheduling, formData.enableMarketingContent, formData.enablePredictiveAnalytics, formData.selectedSpaceTypes, formData.customSpaceType, currentLocation, debug, toast, performWebScraping, performPricingOptimization, updateRequestStatus]);

  // Re-run AI analysis when location is added and we have existing AI data
  const hasRerunAnalysis = useRef(false);
  useEffect(() => {
    if (aiGeneratedData && formData.address && formData.zipCode && !analyzing && !loading && step === 'review' && !hasRerunAnalysis.current) {
      debug.info('Location added after AI analysis - re-running analysis for better results');
      
      // Mark that we've initiated a re-run to prevent infinite loops
      hasRerunAnalysis.current = true;
      
      // Show a toast to inform the user
      toast({
        title: "Location Added!",
        description: "Re-running AI analysis with location data for more accurate results...",
      });
      
      // Re-run AI analysis with the new location data
      setTimeout(() => {
        analyzePhotosWithAI();
      }, 1000); // Small delay to let the toast show
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.address, formData.zipCode, aiGeneratedData, analyzing, loading, debug, toast, step]);

  const handleEditableChange = (field: keyof AIGeneratedData, value: string | number) => {
    if (!editableData) return;
    setEditableData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    debug.info('🎯 Form submit handler called', {
      timestamp: new Date().toISOString(),
      hasEvent: !!e,
      eventType: e.type,
      hasUser: !!user,
      hasEditableData: !!editableData,
      currentStep: step,
      loading: loading
    });

    if (!user || !editableData) {
      debug.warn('❌ Submit blocked - missing user or editable data', { 
        hasUser: !!user, 
        hasEditableData: !!editableData,
        userId: user?.id,
        editableDataKeys: editableData ? Object.keys(editableData) : []
      });
      
      toast({
        title: "❌ Submission Failed",
        description: !user ? "Please log in to submit your listing." : "Please complete the listing information first.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Check listing limit
    if (listingsCount >= 5) {
      debug.warn('❌ Submit blocked - listing limit reached', { 
        listingsCount,
        limit: 5
      });
      
      const handleSalesEmail = () => {
        const subject = encodeURIComponent("Listing Limit Reached - Sales Inquiry");
        const body = encodeURIComponent(`Hi Bagsy Sales Team,

I've reached the free listing limit (5 listings) and would like to discuss options for listing more spaces.

Current listings: ${listingsCount}
User ID: ${user.id}
Email: ${user.email}

Thank you!`);
        
        window.open(`mailto:sales@bagsy.space?subject=${subject}&body=${body}`);
      };

      toast({
        title: "🚫 Listing Limit Reached",
        description: "You've reached the free limit of 5 listings. Contact sales to discuss premium options.",
        variant: "destructive",
        duration: 8000,
      });
      
      // Show additional toast with action
      setTimeout(() => {
        toast({
          title: "💼 Contact Sales",
          description: "Click to email our sales team about premium listing options.",
          action: (
            <button 
              onClick={handleSalesEmail}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
            >
              Email Sales
            </button>
          )
        });
      }, 1000);
      return;
    }

    debug.userAction('✅ Form submission started', { 
      editableData, 
      formData: {
        address: formData.address,
        zipCode: formData.zipCode,
        allowAIAgent: formData.allowAIAgent,
        photoCount: formData.photoUrls.length
      },
      user: {
        id: user.id,
        email: user.email
      }
    });

    if (loading) {
      debug.warn('⚠️ Submit called while already loading - preventing duplicate submission');
      return;
    }

    setLoading(true);
    debug.info('🔄 Loading state set to true');
    
    // Show loading toast
    const loadingToast = toast({
      title: "⏳ Submitting Your Space...",
      description: "Please wait while we submit your space listing to our platform.",
      duration: 0, // Don't auto-dismiss
    });
    
    debug.info('📢 Loading toast shown');
    
    try {
      // Pre-submission debugging
      debug.info('🔍 Pre-submission checks', {
        hasUser: !!user,
        userId: user?.id,
        hasEditableData: !!editableData,
        editableDataKeys: editableData ? Object.keys(editableData) : [],
        hasFormData: !!formData,
        formDataKeys: formData ? Object.keys(formData) : [],
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabaseKeyExists: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      });

      // Test Supabase connection first
      debug.info('🔌 Testing Supabase connection...');
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        debug.info('🔐 Supabase auth check', { 
          hasUser: !!authData.user, 
          userId: authData.user?.id,
          authError: authError?.message 
        });
        
        if (authError) {
          throw new Error(`Authentication error: ${authError.message}`);
        }
        
        if (!authData.user) {
          throw new Error('No authenticated user found');
        }
      } catch (authCheckError) {
        debug.error('❌ Supabase connection/auth check failed', authCheckError);
        throw authCheckError;
      }

      // Insert space into database
      // Validate required fields before submission
      if (!editableData.title?.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.address?.trim()) {
        throw new Error('Address is required');
      }
      if (!formData.zipCode?.trim()) {
        throw new Error('ZIP code is required');
      }
      if (!editableData.pricePerHour || editableData.pricePerHour <= 0) {
        throw new Error('Valid hourly price is required');
      }

      // Map space type to valid database values
      const validSpaceTypes = ['garage', 'driveway', 'parking_lot', 'warehouse', 'storage_unit'];
      let spaceType = editableData.spaceType;
      
      // If it's a custom type or not in valid list, default to 'storage_unit'
      if (editableData.spaceType === 'other' && formData.customSpaceType) {
        spaceType = 'storage_unit'; // Default fallback for custom types
      } else if (!validSpaceTypes.includes(editableData.spaceType)) {
        spaceType = 'storage_unit'; // Fallback for invalid types
      }

      // Convert local datetime strings to UTC timestamps
      const convertToUTC = (localDateTime: string) => {
        if (!localDateTime) return null;
        const date = new Date(localDateTime);
        return date.toISOString();
      };

      const spaceData = {
        title: editableData.title.trim(),
        description: editableData.description?.trim() || null,
        space_type: spaceType,
        address: formData.address.trim(),
        zip_code: formData.zipCode.trim() || '94110', // Default ZIP if empty
        price_per_hour: Number(editableData.pricePerHour),
        price_per_day: editableData.pricePerDay ? Number(editableData.pricePerDay) : null,
        dimensions: editableData.dimensions?.trim() || null,
        available_from: convertToUTC(formData.availableFrom),
        available_until: convertToUTC(formData.availableUntil),
        timezone: formData.timezone,
        special_instructions: formData.specialInstructions?.trim() || null,
        owner_id: user.id,
        is_active: true,
        // Remove columns that don't exist in current schema
        // allow_ai_agent: formData.allowAIAgent,
        // space_types: formData.selectedSpaceTypes.length > 0 ? formData.selectedSpaceTypes : [editableData.spaceType],
      };

      debug.debug('Inserting space into database', spaceData);
      debug.debug('User ID:', user.id);
      debug.debug('Space type validation:', { 
        original: editableData.spaceType, 
        mapped: spaceType,
        validTypes: ['garage', 'driveway', 'parking_lot', 'warehouse', 'storage_unit']
      });

      debug.info('🚀 Starting Supabase insert operation...');
      const insertStartTime = Date.now();

      // Add timeout wrapper for the Supabase call
      const supabasePromise = supabase
        .from('spaces')
        .insert(spaceData)
        .select()
        .single();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Supabase insert operation timed out after 30 seconds'));
        }, 30000);
      });

      debug.info('⏱️ Waiting for Supabase response...');
      const result = await Promise.race([supabasePromise, timeoutPromise]);
      const { data: space, error: spaceError } = result as { data: { id: string } | null; error: { code?: string; message: string } | null };
      
      const insertDuration = Date.now() - insertStartTime;
      debug.info(`✅ Supabase insert completed in ${insertDuration}ms`, { 
        success: !spaceError, 
        spaceId: space?.id,
        error: spaceError?.message 
      });

      if (spaceError) {
        debug.error('Space insertion failed', {
          error: spaceError,
          spaceData,
          user: user.id,
          spaceType: spaceType
        });
        
        // Provide more specific error messages
        if (spaceError.code === '23502') {
          throw new Error('Missing required field: ' + spaceError.message);
        } else if (spaceError.code === '23514') {
          throw new Error('Invalid space type. Please select a valid space type.');
        } else if (spaceError.code === '23503') {
          throw new Error('Invalid user ID. Please log in again.');
        } else {
          throw new Error(`Database error: ${spaceError.message}`);
        }
      }

      if (!space?.id) {
        throw new Error('Space was created but no ID was returned');
      }

      debug.info('Space inserted successfully', { spaceId: space.id });

      // Insert photos
      debug.info('📸 Starting photo insertion', { photoCount: formData.photoUrls.length });
      
      if (formData.photoUrls.length > 0) {
        for (let i = 0; i < formData.photoUrls.length; i++) {
          const photoStartTime = Date.now();
          debug.info(`📷 Inserting photo ${i + 1}/${formData.photoUrls.length}`, { 
            photoIndex: i, 
            photoUrl: formData.photoUrls[i] 
          });

          const photoData = {
            space_id: space.id,
            photo_url: formData.photoUrls[i],
            display_order: i + 1,
          };

          try {
            const { error: photoError } = await supabase
              .from('space_photos')
              .insert(photoData);

            const photoDuration = Date.now() - photoStartTime;
            
            if (photoError) {
              debug.error('❌ Photo insertion failed', { 
                photoIndex: i, 
                photoError: photoError.message,
                photoData,
                duration: photoDuration 
              });
            } else {
              debug.info(`✅ Photo ${i + 1} inserted successfully`, { 
                photoIndex: i,
                duration: photoDuration 
              });
            }
          } catch (photoInsertError) {
            debug.error('❌ Photo insertion exception', { 
              photoIndex: i, 
              error: photoInsertError instanceof Error ? photoInsertError.message : String(photoInsertError),
              duration: Date.now() - photoStartTime
            });
          }
        }
      } else {
        debug.info('📸 No photos to insert');
      }

      debug.info('Space listing completed successfully', {
        spaceId: space.id,
        photoCount: formData.photoUrls.length,
        allowAIAgent: formData.allowAIAgent
      });

      // Dismiss loading toast and show success message
      loadingToast.dismiss();
      toast({
        title: "🎉 Space Successfully Listed!",
        description: "Your space has been submitted and is now available for booking. You can view and manage it from your dashboard.",
        duration: 5000,
      });
      
      // Show additional toast with action
      setTimeout(() => {
        toast({
          title: "📋 View Your Listings",
          description: "Click to go to your listings dashboard and manage your space.",
          action: (
            <button 
              onClick={() => window.location.href = '/my-listings'}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
            >
              View Listings
            </button>
          )
        });
      }, 1000);

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
        enablePricingOptimization: false,
        enableSmartScheduling: false,
        enableMarketingContent: false,
        enablePredictiveAnalytics: false,
        customSpaceType: "",
        selectedSpaceTypes: [],
        availabilityWindows: [],
        isRecurring: false,
        recurringPattern: 'weekly',
        availableFrom: "",
        availableUntil: "",
        timezone: "America/Los_Angeles",
        specialInstructions: "",
      });
      setAiGeneratedData(null);
      setEditableData(null);
      setMarketAnalysis(null);
      setStep('upload');
      
      // Reset the re-run analysis flag
      hasRerunAnalysis.current = false;
      
      // Clear the file input element
      clearFileInput();
      
      onOpenChange(false);
    } catch (error: unknown) {
      debug.logError(error instanceof Error ? error : new Error(String(error)), { 
        hasUser: !!user, 
        hasEditableData: !!editableData,
        formData: {
          address: formData.address,
          zipCode: formData.zipCode,
          photoCount: formData.photoUrls.length
        }
      });
      
      // Dismiss loading toast and show error message
      loadingToast.dismiss();
      toast({
        title: "❌ Submission Failed",
        description: error instanceof Error 
          ? `Failed to submit your space listing: ${error.message}` 
          : "There was an issue submitting your space listing. Please check your internet connection and try again.",
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      debug.info('🏁 Submission process completed - setting loading to false');
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

  const clearFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      enablePricingOptimization: false,
      enableSmartScheduling: false,
      enableMarketingContent: false,
      enablePredictiveAnalytics: false,
      customSpaceType: "",
      selectedSpaceTypes: [],
      availabilityWindows: [],
      isRecurring: false,
      recurringPattern: 'weekly',
      availableFrom: "",
      availableUntil: "",
      timezone: "America/Los_Angeles",
      specialInstructions: "",
    });
    setAiGeneratedData(null);
    setEditableData(null);
    setMarketAnalysis(null);
    setStep('upload');
    
    // Reset the re-run analysis flag
    hasRerunAnalysis.current = false;
    
    // Clear the file input element to prevent issues with subsequent uploads
    clearFileInput();
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
    } catch (error: unknown) {
      debug.logError(error instanceof Error ? error : new Error(String(error)), { context: 'storage_test' });
      toast({
        title: "Storage Test Error",
        description: error instanceof Error ? error.message : "Failed to test storage.",
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
                {formData.photoUrls.length === 0 ? (
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
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-green-600">
                        ✅ {formData.photoUrls.length} photo{formData.photoUrls.length !== 1 ? 's' : ''} uploaded successfully
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="apple-button-secondary"
                      >
                        {uploading ? "Uploading..." : "Add More Photos"}
                      </Button>
                    </div>
                    
                    {/* Photo Preview Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {formData.photoUrls.map((url, index) => {
                        console.log(`Rendering photo ${index + 1}:`, url);
                        return (
                          <Card key={index} className="overflow-hidden">
                            <CardContent className="p-0">
                              <div className="relative">
                                <img
                                  src={url}
                                  alt={`Space photo ${index + 1}`}
                                  className="w-full h-32 object-cover"
                                  onLoad={() => {
                                    console.log(`✅ Photo ${index + 1} loaded successfully:`, url);
                                  }}
                                  onError={(e) => {
                                    console.error(`❌ Image failed to load:`, url);
                                    console.error('Error details:', e);
                                    e.currentTarget.style.display = 'none';
                                  }}
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
                        );
                      })}
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}
                
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
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="address"
                        placeholder="e.g., 123 Main St, San Francisco, CA"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        className="apple-input pl-10 h-12"
                      />
                    </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={getCurrentLocation}
                        disabled={locationLoading}
                        className="apple-button-secondary h-12 px-3"
                        title="Use current location"
                      >
                        {locationLoading ? (
                          <LoadingDots />
                        ) : (
                          <MapPin className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {currentLocation && (
                      <p className="text-xs text-green-600">
                        📍 Location detected: {currentLocation.address}
                      </p>
                    )}
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

              {/* Availability & Timeframes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Availability & Timeframes</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="availableFrom" className="text-sm font-medium">
                      Available From
                    </Label>
                    <Input
                      id="availableFrom"
                      type="datetime-local"
                      value={formData.availableFrom}
                      onChange={(e) => handleInputChange("availableFrom", e.target.value)}
                      className="apple-input h-12"
                    />
                    <p className="text-xs text-muted-foreground">When your space becomes available</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="availableUntil" className="text-sm font-medium">
                      Available Until
                    </Label>
                    <Input
                      id="availableUntil"
                      type="datetime-local"
                      value={formData.availableUntil}
                      onChange={(e) => handleInputChange("availableUntil", e.target.value)}
                      className="apple-input h-12"
                    />
                    <p className="text-xs text-muted-foreground">When your space stops being available</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-sm font-medium">
                    Timezone
                  </Label>
                  <select
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => handleInputChange("timezone", e.target.value)}
                    className="apple-input h-12 w-full px-3 py-2 border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Timezone for the availability dates above</p>
                </div>
              </div>

              {/* Space Type Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Space Types * 
                    {formData.selectedSpaceTypes.length > 0 && (
                      <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                        {formData.selectedSpaceTypes.length} selected
                      </span>
                    )}
                  </Label>
                  <div className="space-y-3 p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-3">
                      Select all space types that apply to your listing:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {spaceTypes.map((type) => (
                        <div key={type.value} className="flex items-start space-x-3">
                    <Checkbox
                            id={`space-type-${type.value}`}
                            checked={formData.selectedSpaceTypes.includes(type.value)}
                            onCheckedChange={(checked) => handleSpaceTypeChange(type.value, checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                            <Label htmlFor={`space-type-${type.value}`} className="text-sm font-medium cursor-pointer">
                              {type.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                              {type.description}
                      </p>
                    </div>
                  </div>
                      ))}
                    </div>
                    
                    {/* Custom space type input */}
                    <div className="mt-4 pt-4 border-t border-muted-foreground/25">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Custom Space Type (Optional)</Label>
                        <Input
                          value={formData.customSpaceType || ''}
                          onChange={(e) => handleInputChange("customSpaceType", e.target.value)}
                          placeholder="e.g., Boat Slip, Workshop, Event Space"
                          className="apple-input h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          Specify a custom space type if none of the above options fit your space
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* OpenAI Request Limit Status */}
              <div className="space-y-4">
                <div className="p-3 border border-muted-foreground/25 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${requestStatus.isBlocked ? 'bg-red-500' : requestStatus.remaining <= 1 ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                      <span className="text-sm font-medium text-gray-700">
                        OpenAI Requests: {requestStatus.count}/{requestStatus.maxRequests}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {requestStatus.isBlocked ? (
                        <span className="text-red-600 font-medium">Limit Reached</span>
                      ) : (
                        <span>{requestStatus.remaining} remaining</span>
                      )}
                    </div>
                  </div>
                  {requestStatus.isBlocked && (
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ OpenAI request limit reached. AI analysis will use mock data. Refresh the page to reset.
                    </p>
                  )}
                </div>
              </div>

              {/* Personalized AI Recommendations */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-800">AI Recommendations</h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateAIRecommendations}
                      disabled={recommendationsLoading}
                      className="apple-button-secondary"
                    >
                      {recommendationsLoading ? (
                        <>
                          <LoadingDots />
                          <span className="ml-2">Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Get Recommendations
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-sm text-purple-700 mb-4">
                    {formData.selectedSpaceTypes.length > 0 
                      ? "Based on your selected space types, our AI will recommend the most beneficial features for your listing."
                      : "Our AI will analyze your space and recommend the most beneficial features for your listing. Select space types above for more personalized recommendations."
                    }
                  </p>

                  {aiRecommendations.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-purple-800">
                        ✅ {aiRecommendations.length} personalized recommendations generated
                      </p>
                      <div className="space-y-2">
                        {aiRecommendations.slice(0, 3).map((recommendation) => (
                          <div key={recommendation.id} className="p-3 bg-white rounded-lg border border-purple-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{recommendation.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{recommendation.description}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    recommendation.estimatedImpact === 'high' 
                                      ? 'bg-green-100 text-green-800'
                                      : recommendation.estimatedImpact === 'medium'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {recommendation.estimatedImpact} impact
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {Math.round(recommendation.confidence * 100)}% confidence
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyRecommendation(recommendation)}
                                className="ml-3 apple-button-secondary"
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {aiRecommendations.length > 3 && (
                        <p className="text-xs text-purple-600">
                          +{aiRecommendations.length - 3} more recommendations available
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-purple-600">
                        Click "Get Recommendations" to receive personalized AI suggestions for your space.
                      </p>
                    </div>
                  )}
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
                      onClick={() => {
                        if (formData.selectedSpaceTypes.length === 0) {
                          toast({
                            title: "Space Type Required",
                            description: "Please select at least one space type to proceed with AI analysis.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (formData.photoUrls.length === 0) {
                          toast({
                            title: "Photos Required",
                            description: "Please upload at least one photo to proceed with AI analysis.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setStep('analyze');
                        setTimeout(() => {
                          analyzePhotosWithAI();
                        }, 500);
                      }}
                      disabled={formData.selectedSpaceTypes.length === 0 || formData.photoUrls.length === 0}
                      className="w-full apple-button-primary h-12"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Next: AI Analysis
                    </Button>
                  )}
                  <p className="text-xs text-center text-muted-foreground">
                    {formData.disableAI 
                      ? "ℹ️ AI analysis disabled - you'll enter details manually"
                      : formData.selectedSpaceTypes.length === 0
                        ? "⚠️ Please select at least one space type above to enable AI analysis"
                        : formData.photoUrls.length === 0
                          ? "⚠️ Please upload at least one photo to enable AI analysis"
                          : requestStatus.isBlocked
                            ? "⚠️ OpenAI request limit reached - will use mock data for analysis"
                      : formData.address && formData.zipCode 
                              ? `✅ Ready for AI analysis - Location provided${formData.enableWebScraping ? ' + market research' : ''}${formData.enablePricingOptimization ? ' + pricing optimization' : ''}`
                              : `✅ Ready for AI analysis - No location provided${formData.enableWebScraping ? ' + market research' : ''}${formData.enablePricingOptimization ? ' + pricing optimization' : ''}`
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
                  <h4 className="font-semibold mb-2">🐛 Debug Info:</h4>
                  <div className="mb-2 text-xs text-gray-600">
                    Check browser console for detailed upload logs. Bucket should exist from SQL setup.
                  </div>
                  <div className="space-y-1">
                    <p><strong>Uploading:</strong> {uploading ? 'Yes' : 'No'}</p>
                    <p><strong>Photos:</strong> {formData.photos.length}</p>
                    <p><strong>Photo URLs:</strong> {formData.photoUrls.length}</p>
                    <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
                    <p><strong>Step:</strong> {step}</p>
                    <p><strong>Custom Space Type:</strong> {formData.customSpaceType || 'None'}</p>
                    <p><strong>Selected Space Types:</strong> {formData.selectedSpaceTypes.length > 0 ? formData.selectedSpaceTypes.join(', ') : 'None'}</p>
                    <p><strong>AI Analysis:</strong> {aiGeneratedData ? 'Completed' : 'Not started'}</p>
                    <p><strong>Market Analysis:</strong> {marketAnalysis ? `${marketAnalysis.competitorCount} competitors found` : 'Not available'}</p>
                    <p><strong>Web Scraping:</strong> {formData.enableWebScraping ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Pricing Optimization:</strong> {formData.enablePricingOptimization ? 'Enabled' : 'Disabled'}</p>
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
                  <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={testStorage}
                      className="w-full text-xs"
                    >
                      Test Storage Connection
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        debug.info('Manual storage check triggered');
                        try {
                          const { checkStorageAccess } = await import('@/lib/setup-storage');
                          const result = await checkStorageAccess();
                          if (result.success) {
                            toast({
                              title: "Storage Access OK",
                              description: result.message,
                            });
                          } else {
                            toast({
                              title: "Storage Access Failed",
                              description: result.message,
                              variant: "destructive",
                            });
                          }
                        } catch (error: unknown) {
                          debug.logError(error instanceof Error ? error : new Error(String(error)), { context: 'manual_storage_check' });
                          toast({
                            title: "Storage Check Error",
                            description: error instanceof Error ? error.message : "Failed to check storage access",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="w-full text-xs"
                    >
                      Check Storage Access
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        debug.info('Storage policies check triggered');
                        try {
                          const { setupStoragePolicies } = await import('@/lib/setup-storage');
                          const result = await setupStoragePolicies();
                          if (result.success) {
                            toast({
                              title: "Storage Policies OK",
                              description: result.message,
                            });
                          } else {
                            toast({
                              title: "Storage Policies Issue",
                              description: `${result.message}. ${result.guidance || 'Check console for details.'}`,
                              variant: "destructive",
                            });
                          }
                        } catch (error: unknown) {
                          debug.logError(error instanceof Error ? error : new Error(String(error)), { context: 'storage_policies_check' });
                          toast({
                            title: "Storage Policies Error",
                            description: error instanceof Error ? error.message : "Failed to check storage policies",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="w-full text-xs"
                    >
                      Check Storage Policies
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
                  {formData.enablePricingOptimization && " with pricing optimization"}
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
                    <Label className="text-sm font-medium">
                      Space Types * 
                      {formData.selectedSpaceTypes.length > 0 && (
                        <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                          {formData.selectedSpaceTypes.length} selected
                        </span>
                      )}
                    </Label>
                    <div className="space-y-3 p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-3">
                        Select all space types that apply to your listing:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {spaceTypes.map((type) => (
                          <div key={type.value} className="flex items-start space-x-3">
                            <Checkbox
                              id={`space-type-${type.value}`}
                              checked={formData.selectedSpaceTypes.includes(type.value)}
                              onCheckedChange={(checked) => handleSpaceTypeChange(type.value, checked as boolean)}
                              className="mt-1"
                            />
                            <div className="space-y-1">
                              <Label htmlFor={`space-type-${type.value}`} className="text-sm font-medium cursor-pointer">
                                {type.label}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {type.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Custom space type input */}
                      <div className="mt-4 pt-4 border-t border-muted-foreground/25">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Custom Space Type (Optional)</Label>
                      <Input
                        value={formData.customSpaceType || ''}
                        onChange={(e) => handleInputChange("customSpaceType", e.target.value)}
                            placeholder="e.g., Boat Slip, Workshop, Event Space"
                            className="apple-input h-10"
                          />
                          <p className="text-xs text-muted-foreground">
                            Specify a custom space type if none of the above options fit your space
                        </p>
                      </div>
                      </div>
                    </div>
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

                {/* Availability Windows */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Availability Windows
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Set when your space is available for booking. You can add multiple time windows for different days.
                    </p>
                    
                    <div className="space-y-3">
                      {formData.availabilityWindows.map((window, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border border-muted-foreground/25 rounded-lg bg-muted/30">
                          <select
                            value={window.dayOfWeek}
                            onChange={(e) => updateAvailabilityWindow(index, 'dayOfWeek', parseInt(e.target.value))}
                            className="apple-input h-10 w-32"
                          >
                            {daysOfWeek.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                          
                          <Input
                            type="time"
                            value={window.startTime}
                            onChange={(e) => updateAvailabilityWindow(index, 'startTime', e.target.value)}
                            className="apple-input h-10 w-24"
                          />
                          
                          <span className="text-sm text-muted-foreground">to</span>
                          
                          <Input
                            type="time"
                            value={window.endTime}
                            onChange={(e) => updateAvailabilityWindow(index, 'endTime', e.target.value)}
                            className="apple-input h-10 w-24"
                          />
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeAvailabilityWindow(index)}
                            className="apple-button-secondary h-10 w-10 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addAvailabilityWindow}
                        className="apple-button-secondary flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Time Window
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Recurring Options */}
                <div className="space-y-4">
                  <div className="p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="isRecurring"
                        checked={formData.isRecurring}
                        onCheckedChange={(checked) => handleInputChange("isRecurring", checked as boolean)}
                        className="mt-1"
                      />
                      <div className="space-y-2">
                        <Label htmlFor="isRecurring" className="text-sm font-medium cursor-pointer">
                          Make this a recurring listing
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically renew this listing based on your selected pattern
                        </p>
                        
                        {formData.isRecurring && (
                          <div className="mt-3 space-y-2">
                            <Label className="text-xs font-medium">Recurring Pattern</Label>
                            <select
                              value={formData.recurringPattern}
                              onChange={(e) => handleInputChange("recurringPattern", e.target.value as 'weekly' | 'monthly')}
                              className="apple-input h-10 w-32"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Availability and Timezone Section */}
              <div className="space-y-4 p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Availability & Scheduling
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Available From</Label>
                    <Input
                      type="datetime-local"
                      value={formData.availableFrom}
                      onChange={(e) => setFormData(prev => ({ ...prev, availableFrom: e.target.value }))}
                      className="apple-input h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      When your space becomes available for booking
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Available Until</Label>
                    <Input
                      type="datetime-local"
                      value={formData.availableUntil}
                      onChange={(e) => setFormData(prev => ({ ...prev, availableUntil: e.target.value }))}
                      className="apple-input h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      When your space stops being available for booking
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Timezone</Label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md apple-input h-10"
                  >
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Phoenix">Arizona Time</option>
                    <option value="America/Anchorage">Alaska Time (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Timezone for your availability times (24/7 access during reservation period)
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={
                  formData.selectedSpaceTypes.length === 0 || 
                  !editableData?.title || 
                  !editableData?.description || 
                  !editableData?.dimensions || 
                  !editableData?.pricePerHour
                }
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
                      Space Types
                      {formData.selectedSpaceTypes.length > 0 && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                          {formData.selectedSpaceTypes.length} selected
                        </span>
                      )}
                    </Label>
                    <div className="space-y-3 p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-3">
                        Select all space types that apply to your listing:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {spaceTypes.map((type) => (
                          <div key={type.value} className="flex items-start space-x-3">
                            <Checkbox
                              id={`review-space-type-${type.value}`}
                              checked={formData.selectedSpaceTypes.includes(type.value)}
                              onCheckedChange={(checked) => handleSpaceTypeChange(type.value, checked as boolean)}
                              className="mt-1"
                            />
                            <div className="space-y-1">
                              <Label htmlFor={`review-space-type-${type.value}`} className="text-sm font-medium cursor-pointer">
                                {type.label}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {type.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Custom space type input */}
                      <div className="mt-4 pt-4 border-t border-muted-foreground/25">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Custom Space Type (Optional)</Label>
                      <Input
                        value={formData.customSpaceType || ''}
                        onChange={(e) => handleInputChange("customSpaceType", e.target.value)}
                            placeholder="e.g., Boat Slip, Workshop, Event Space"
                            className="apple-input h-10"
                          />
                          <p className="text-xs text-muted-foreground">
                            Specify a custom space type if none of the above options fit your space
                        </p>
                      </div>
                      </div>
                    </div>
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
                      placeholder="Describe your space, what makes it special, access details... (Note: 24/7 access during reservation period)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      Special Instructions
                    </Label>
                    <textarea
                      value={formData.specialInstructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                      placeholder="Gate codes, community rules, access instructions, etc. (Optional)"
                      className="apple-input min-h-[80px] resize-none w-full"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide any special access instructions like gate codes, community rules, or specific entry procedures.
                    </p>
                  </div>

                  {/* Availability and Timezone Section */}
                  <div className="space-y-4 p-4 border border-muted-foreground/25 rounded-lg bg-muted/30">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Availability & Scheduling
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Available From</Label>
                        <Input
                          type="datetime-local"
                          value={formData.availableFrom}
                          onChange={(e) => setFormData(prev => ({ ...prev, availableFrom: e.target.value }))}
                          className="apple-input h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          When your space becomes available for booking
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Available Until</Label>
                        <Input
                          type="datetime-local"
                          value={formData.availableUntil}
                          onChange={(e) => setFormData(prev => ({ ...prev, availableUntil: e.target.value }))}
                          className="apple-input h-10"
                        />
                        <p className="text-xs text-muted-foreground">
                          When your space stops being available for booking
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Timezone</Label>
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md apple-input h-10"
                      >
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Phoenix">Arizona Time</option>
                        <option value="America/Anchorage">Alaska Time (AKT)</option>
                        <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Timezone for your availability times (24/7 access during reservation period)
                      </p>
                    </div>
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
                      
                      {/* Recommended Pricing Display */}
                      {(marketAnalysis || formData.enablePricingOptimization) && (
                        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">AI Recommended Pricing</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {marketAnalysis && (
                              <>
                                <div className="text-center p-2 bg-white rounded border">
                                  <div className="font-semibold text-blue-600">${marketAnalysis.recommendations.suggestedPrice}</div>
                                  <div className="text-xs text-gray-600">Market Analysis</div>
                                </div>
                                <div className="text-center p-2 bg-white rounded border">
                                  <div className="font-semibold text-purple-600">${marketAnalysis.averagePrice}</div>
                                  <div className="text-xs text-gray-600">Market Average</div>
                                </div>
                              </>
                            )}
                            {formData.enablePricingOptimization && (
                              <div className="text-center p-2 bg-white rounded border">
                                <div className="font-semibold text-green-600">${editableData.pricePerHour}</div>
                                <div className="text-xs text-gray-600">AI Optimized</div>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-green-700 mt-2">
                            💡 Click "Use Recommended" below to apply the suggested price
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editableData.pricePerHour}
                        onChange={(e) => handleEditableChange("pricePerHour", parseFloat(e.target.value) || 0)}
                          className="apple-input h-12 flex-1"
                        />
                        {(marketAnalysis || formData.enablePricingOptimization) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const recommendedPrice = marketAnalysis?.recommendations.suggestedPrice || editableData.pricePerHour;
                              handleEditableChange("pricePerHour", recommendedPrice);
                              toast({
                                title: "Price Updated",
                                description: `Applied recommended price: $${recommendedPrice}/hour`,
                              });
                            }}
                            className="apple-button-secondary whitespace-nowrap"
                          >
                            Use Recommended
                          </Button>
                        )}
                      </div>
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
                        <span className="font-medium">Types:</span> {
                          formData.selectedSpaceTypes.length > 0 
                            ? formData.selectedSpaceTypes.map(type => spaceTypes.find(t => t.value === type)?.label).join(', ')
                            : editableData.spaceType === 'other' 
                            ? formData.customSpaceType || 'Other (not specified)'
                            : spaceTypes.find(t => t.value === editableData.spaceType)?.label
                        }
                        {formData.customSpaceType && (
                          <span className="text-muted-foreground">, {formData.customSpaceType}</span>
                        )}
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

                    {/* Availability Windows */}
                    {formData.availabilityWindows.length > 0 && (
                      <div>
                        <span className="font-medium">Availability:</span>
                        <div className="mt-2 space-y-1">
                          {formData.availabilityWindows.map((window, index) => (
                            <div key={index} className="text-sm text-gray-600">
                              {daysOfWeek.find(d => d.value === window.dayOfWeek)?.label}: {window.startTime} - {window.endTime}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recurring Information */}
                    {formData.isRecurring && (
                      <div>
                        <span className="font-medium">Recurring:</span> Yes ({formData.recurringPattern})
                      </div>
                    )}
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
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <LoadingDots />
                      Submitting...
                    </div>
                  ) : (
                    "List My Space"
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
