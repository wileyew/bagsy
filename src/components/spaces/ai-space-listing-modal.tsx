import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, MapPin, Sparkles, CheckCircle, Edit3, HelpCircle, ExternalLink, ArrowRight } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingDots } from "@/components/ui/loading-dots";
import { aiService, LocationContext } from "@/lib/ai-service";
import { webScrapingService } from "@/lib/web-scraping-service";
import { smartSchedulingService } from "@/lib/smart-scheduling-service";
import { smartMatchingService } from "@/lib/smart-matching-service";
import { marketingContentService } from "@/lib/marketing-content-service";
import { geolocationService, LocationData } from "@/lib/geolocation-service";
import { createComponentDebugger } from "@/lib/debug-utils";
import { runFullStorageTest } from "@/lib/storage-test";
import { setupStorageBuckets, checkStorageAccess } from "@/lib/setup-storage";

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
    enablePricingOptimization: false,
    enableSmartScheduling: false,
    enableMarketingContent: false,
    enablePredictiveAnalytics: false,
    customSpaceType: "",
    selectedSpaceTypes: [],
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

  const handleSpaceTypeChange = (spaceType: string, checked: boolean) => {
    debug.userAction('Space type checkbox changed', { spaceType, checked });
    setFormData(prev => {
      const newSelectedTypes = checked
        ? [...prev.selectedSpaceTypes, spaceType]
        : prev.selectedSpaceTypes.filter(type => type !== spaceType);
      
      debug.stateChange('selectedSpaceTypes', prev.selectedSpaceTypes, newSelectedTypes);
      return { ...prev, selectedSpaceTypes: newSelectedTypes };
    });
  };

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
      
      toast({
        title: "Photos uploaded successfully!",
        description: `${files.length} photo(s) uploaded. Ready for AI analysis!`,
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
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload photos. Please try again.",
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
        enableWebScraping: formData.enableWebScraping,
        enablePricingOptimization: formData.enablePricingOptimization,
        currentLocation: currentLocation,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timed out after 30 seconds')), 30000)
      );
      
      const analysisResult = await Promise.race([analysisPromise, timeoutPromise]) as AIGeneratedData;
      
      debug.info('AI analysis completed', { analysisResult });
      
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

      // Generate marketing content if enabled
      if (formData.enableMarketingContent) {
        try {
          debug.info('Generating marketing content');
          
          const spaceData = {
            id: 'temp-space-id',
            space_type: analysisResult.spaceType,
            title: finalTitle,
            description: finalDescription,
            address: formData.address,
            price_per_hour: pricePerHour,
            dimensions: finalDimensions
          };

          // Generate SEO content
          const seoContent = await marketingContentService.generateSEOContent(spaceData, marketData);
          
          // Generate social media content
          const socialContent = await marketingContentService.generateSocialMediaContent(spaceData);
          
          // Generate email campaigns
          const emailCampaigns = await marketingContentService.generateEmailCampaigns(spaceData, 'potential_renters');
          
          debug.info('Marketing content generated', {
            seoScore: seoContent.seoScore,
            socialPlatforms: socialContent.length,
            emailCampaigns: emailCampaigns.length
          });
        } catch (error) {
          debug.warn('Marketing content generation failed', error);
        }
      }

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
  }, [formData.photoUrls, formData.address, formData.zipCode, formData.enableWebScraping, formData.enablePricingOptimization, formData.enableSmartScheduling, formData.enableMarketingContent, formData.enablePredictiveAnalytics, formData.selectedSpaceTypes, formData.customSpaceType, currentLocation, debug, toast, performWebScraping, performPricingOptimization]);

  // Re-run AI analysis when location is added and we have existing AI data
  useEffect(() => {
    if (aiGeneratedData && formData.address && formData.zipCode && !analyzing && !loading && step === 'review') {
      debug.info('Location added after AI analysis - re-running analysis for better results');
      
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
  }, [formData.address, formData.zipCode, aiGeneratedData, analyzing, loading, debug, toast, analyzePhotosWithAI, step]);

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
        space_type: editableData.spaceType === 'other' && formData.customSpaceType 
          ? formData.customSpaceType 
          : editableData.spaceType,
        address: formData.address,
        zip_code: formData.zipCode,
        price_per_hour: editableData.pricePerHour,
        price_per_day: editableData.pricePerDay,
        dimensions: editableData.dimensions,
        owner_id: user.id,
        is_active: true,
        allow_ai_agent: formData.allowAIAgent,
        space_types: formData.selectedSpaceTypes.length > 0 ? formData.selectedSpaceTypes : [editableData.spaceType],
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
        enablePricingOptimization: false,
        enableSmartScheduling: false,
        enableMarketingContent: false,
        enablePredictiveAnalytics: false,
        customSpaceType: "",
        selectedSpaceTypes: [],
      });
      setAiGeneratedData(null);
      setEditableData(null);
      setMarketAnalysis(null);
      setStep('upload');
      
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
    });
    setAiGeneratedData(null);
    setEditableData(null);
    setMarketAnalysis(null);
    setStep('upload');
    
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
                
                {/* Debug Info - Remove this in production */}
                {formData.photoUrls.length > 0 && (
                  <div className="p-3 bg-gray-100 rounded-lg text-xs">
                    <p><strong>Debug Info:</strong></p>
                    <p>Photo URLs count: {formData.photoUrls.length}</p>
                    <p>Photo URLs: {JSON.stringify(formData.photoUrls)}</p>
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

              {/* Pricing Optimization Toggle */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-green-50/50">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="enablePricingOptimization"
                      checked={formData.enablePricingOptimization}
                      onCheckedChange={(checked) => handleInputChange("enablePricingOptimization", checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="enablePricingOptimization" className="text-sm font-medium cursor-pointer">
                          Enable AI-powered pricing optimization
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4">
                              <div className="space-y-2">
                                <p className="font-medium">Pricing Optimization</p>
                                <p className="text-sm">
                                  Our AI analyzes market trends, seasonal demand, competitor pricing, and location factors 
                                  to suggest optimal pricing strategies that maximize your revenue potential.
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium mb-1">Optimization features:</p>
                                  <ul className="space-y-1 list-disc list-inside">
                                    <li>Dynamic pricing recommendations</li>
                                    <li>Peak hour pricing strategies</li>
                                    <li>Seasonal adjustment suggestions</li>
                                    <li>Competitive positioning analysis</li>
                                    <li>Revenue maximization insights</li>
                                  </ul>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, our AI will analyze market conditions and suggest pricing strategies 
                        to help you maximize revenue while remaining competitive in your market.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Smart Scheduling Toggle */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-blue-50/50">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="enableSmartScheduling"
                      checked={formData.enableSmartScheduling}
                      onCheckedChange={(checked) => handleInputChange("enableSmartScheduling", checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="enableSmartScheduling" className="text-sm font-medium cursor-pointer">
                          Enable AI-powered smart scheduling
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4">
                              <div className="space-y-2">
                                <p className="font-medium">Smart Scheduling</p>
                                <p className="text-sm">
                                  Our AI analyzes booking patterns, demand trends, and optimal availability windows 
                                  to automatically suggest the best times to make your space available.
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium mb-1">Smart features:</p>
                                  <ul className="space-y-1 list-disc list-inside">
                                    <li>Optimal availability windows</li>
                                    <li>Demand pattern analysis</li>
                                    <li>Peak hour identification</li>
                                    <li>Revenue optimization scheduling</li>
                                    <li>Automatic pricing adjustments</li>
                                  </ul>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, our AI will analyze demand patterns and suggest optimal scheduling 
                        strategies to maximize your space utilization and revenue.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Marketing Content Toggle */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-purple-50/50">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="enableMarketingContent"
                      checked={formData.enableMarketingContent}
                      onCheckedChange={(checked) => handleInputChange("enableMarketingContent", checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="enableMarketingContent" className="text-sm font-medium cursor-pointer">
                          Enable AI-generated marketing content
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4">
                              <div className="space-y-2">
                                <p className="font-medium">Marketing Content</p>
                                <p className="text-sm">
                                  Our AI creates compelling marketing content including SEO-optimized titles, 
                                  social media posts, email campaigns, and listing optimization suggestions.
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium mb-1">Content types:</p>
                                  <ul className="space-y-1 list-disc list-inside">
                                    <li>SEO-optimized titles & descriptions</li>
                                    <li>Social media marketing posts</li>
                                    <li>Email campaign templates</li>
                                    <li>Listing optimization suggestions</li>
                                    <li>Engagement-focused content</li>
                                  </ul>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, our AI will generate professional marketing content to help you 
                        attract more renters and improve your listing's visibility.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Predictive Analytics Toggle */}
              <div className="space-y-4">
                <div className="p-4 border border-muted-foreground/25 rounded-lg bg-orange-50/50">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="enablePredictiveAnalytics"
                      checked={formData.enablePredictiveAnalytics}
                      onCheckedChange={(checked) => handleInputChange("enablePredictiveAnalytics", checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="enablePredictiveAnalytics" className="text-sm font-medium cursor-pointer">
                          Enable predictive analytics & insights
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4">
                              <div className="space-y-2">
                                <p className="font-medium">Predictive Analytics</p>
                                <p className="text-sm">
                                  Our AI provides advanced analytics including revenue forecasting, 
                                  market trend predictions, and performance insights to help you make data-driven decisions.
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium mb-1">Analytics features:</p>
                                  <ul className="space-y-1 list-disc list-inside">
                                    <li>Revenue potential forecasting</li>
                                    <li>Market trend predictions</li>
                                    <li>Booking pattern analysis</li>
                                    <li>Performance optimization insights</li>
                                    <li>Competitive intelligence reports</li>
                                  </ul>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, our AI will provide advanced analytics and predictions to help you 
                        optimize your space rental strategy and maximize profitability.
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
