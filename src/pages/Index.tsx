import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, DollarSign, Users, Star, ArrowRight, Search, Car, Warehouse, Home, Sparkles, Zap, Bot, Shield, TrendingUp, CheckCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingDots } from "@/components/ui/loading-dots";
import { AuthModal } from "@/components/auth/auth-modal";
import { UserMenu } from "@/components/auth/user-menu";
import { AISpaceListingModal } from "@/components/spaces/ai-space-listing-modal";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { RelistModal } from "@/components/spaces/relist-modal";
import { TieredBookingModal } from "@/components/spaces/tiered-booking-modal";
import { BagsyLogo } from "@/components/ui/bagsy-logo";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useUserListingsCount } from "@/hooks/use-user-listings-count";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiSpaceListingModalOpen, setAiSpaceListingModalOpen] = useState(false);
  const [relistModalOpen, setRelistModalOpen] = useState(false);
  const [selectedSpaceForRelist, setSelectedSpaceForRelist] = useState<any>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedSpaceForBooking, setSelectedSpaceForBooking] = useState<any>(null);
  const navigate = useNavigate();
  const { hasListings } = useUserListingsCount();
  const [formData, setFormData] = useState({
    spaceType: "",
    location: "",
    budget: "",
    timeframe: "",
    description: ""
  });
  const { user } = useAuthContext();
  const { toast } = useToast();

  // Real space data state
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [spacesError, setSpacesError] = useState<string | null>(null);
  
  // Search and filter state
  const [searchFilters, setSearchFilters] = useState({
    spaceType: '',
    location: '',
    minPrice: '',
    maxPrice: '',
    availableFrom: '',
    availableUntil: '',
    timezone: ''
  });

  // Fetch real spaces from database
  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async (filters = searchFilters) => {
    try {
      console.log('🔍 Fetching spaces (Index page)...', { filters });
      setLoadingSpaces(true);
      setSpacesError(null);

      // Build query based on filters
      let query = supabase
        .from('spaces')
        .select(`
          *,
          photos:space_photos(*)
        `)
        .eq('is_active', true);

      // Apply filters
      if (filters.spaceType) {
        query = query.eq('space_type', filters.spaceType);
      }
      
      if (filters.location) {
        query = query.or(`address.ilike.%${filters.location}%,zip_code.ilike.%${filters.location}%`);
      }
      
      if (filters.minPrice) {
        query = query.gte('price_per_hour', parseFloat(filters.minPrice));
      }
      
      if (filters.maxPrice) {
        query = query.lte('price_per_hour', parseFloat(filters.maxPrice));
      }
      
      if (filters.timezone) {
        query = query.eq('timezone', filters.timezone);
      }

      // Apply availability filters
      if (filters.availableFrom) {
        query = query.gte('available_from', filters.availableFrom);
      }
      
      if (filters.availableUntil) {
        query = query.lte('available_until', filters.availableUntil);
      }

      query = query.order('created_at', { ascending: false }).limit(12);

      const { data: spacesData, error: spacesError } = await query;

      if (spacesError) {
        throw spacesError;
      }

      console.log('✅ Spaces fetched successfully (Index page)!', {
        totalSpaces: spacesData?.length || 0,
        spaces: spacesData?.map(s => ({
          id: s.id,
          title: s.title,
          isActive: s.is_active,
          owner: s.owner_id
        }))
      });

      setSpaces(spacesData || []);
    } catch (error) {
      console.error('❌ Error fetching spaces (Index page):', error);
      setSpacesError(error instanceof Error ? error.message : 'Failed to fetch spaces');
      // Fallback to mock data if real data fails
      setSpaces(mockListings.map(listing => ({
        id: listing.id.toString(),
        title: listing.title,
        description: `A great ${listing.type} space in ${listing.address}`,
        space_type: listing.type,
        address: listing.address,
        zip_code: '94110',
        price_per_hour: listing.price,
        price_per_day: null,
        dimensions: listing.dimensions,
        available_from: null,
        available_until: null,
        timezone: 'America/Los_Angeles',
        special_instructions: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        photos: []
      })));
    } finally {
      setLoadingSpaces(false);
    }
  };

  const handleSearch = () => {
    fetchSpaces(searchFilters);
  };

  const clearFilters = () => {
    setSearchFilters({
      spaceType: '',
      location: '',
      minPrice: '',
      maxPrice: '',
      availableFrom: '',
      availableUntil: '',
      timezone: ''
    });
    fetchSpaces({
      spaceType: '',
      location: '',
      minPrice: '',
      maxPrice: '',
      availableFrom: '',
      availableUntil: '',
      timezone: ''
    });
  };

  const spaceTypes = [
    { id: "garage", name: "Garage", icon: Home, description: "Covered storage space" },
    { id: "driveway", name: "Driveway", icon: Car, description: "Open parking space" },
    { id: "warehouse", name: "Warehouse", icon: Warehouse, description: "Large commercial space" }
  ];

  const mockListings = [
    {
      id: 1,
      title: "Spacious Garage in Mission District",
      type: "garage",
      price: 8,
      address: "Mission St, SF 94110",
      rating: 4.8,
      dimensions: "20x12 feet",
      image: "/placeholder.svg"
    },
    {
      id: 2,
      title: "Private Driveway - Valencia Street",
      type: "driveway", 
      price: 5,
      address: "Valencia St, SF 94110",
      rating: 4.6,
      dimensions: "10x20 feet",
      image: "/placeholder.svg"
    },
    {
      id: 3,
      title: "Covered Garage Near BART",
      type: "garage",
      price: 10,
      address: "24th St, SF 94110",
      rating: 4.9,
      dimensions: "18x10 feet",
      image: "/placeholder.svg"
    }
  ];

  const handleStepSubmit = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final submission - would integrate with AI agents here
      toast({
        title: "Looking for spaces...",
        description: "Our AI is finding the perfect match for you!"
      });
      // Simulate AI processing time
      setTimeout(() => {
        setCurrentStep(5); // Show results
      }, 2000);
    }
  };

  const renderConversationalForm = () => {
    const questions = [
      {
        title: "What type of driveway do you need?",
        content: (
          <div className="grid grid-cols-1 gap-4">
            {spaceTypes.map((type) => (
              <Button
                key={type.id}
                variant={formData.spaceType === type.id ? "default" : "outline"}
                onClick={() => setFormData({...formData, spaceType: type.id})}
                className={`flex items-center justify-start gap-4 p-6 h-auto text-left ${
                  formData.spaceType === type.id 
                    ? "apple-button-primary" 
                    : "apple-button-secondary"
                }`}
              >
                <div className="p-3 rounded-2xl bg-primary/10">
                  <type.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{type.name}</div>
                  <div className="text-sm opacity-70">{type.description}</div>
                </div>
              </Button>
            ))}
          </div>
        )
      },
      {
        title: "Where do you need the driveway?",
        content: (
          <div className="space-y-4">
            <Input
              placeholder="Enter address or ZIP code"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              className="apple-input text-lg h-14"
            />
            <p className="text-sm text-muted-foreground text-center">
              Enter your location to find nearby driveways
            </p>
          </div>
        )
      },
      {
        title: "What's your budget?",
        content: (
          <div className="space-y-4">
            <Input
              placeholder="e.g., $5-10 per hour"
              value={formData.budget}
              onChange={(e) => setFormData({...formData, budget: e.target.value})}
              className="apple-input text-lg h-14"
            />
            <p className="text-sm text-muted-foreground text-center">
              Our AI will suggest fair market prices
            </p>
          </div>
        )
      },
      {
        title: "When do you need it?",
        content: (
          <div className="space-y-4">
            <Input
              placeholder="e.g., Tomorrow 9am-5pm, or Next week"
              value={formData.timeframe}
              onChange={(e) => setFormData({...formData, timeframe: e.target.value})}
              className="apple-input text-lg h-14"
            />
          </div>
        )
      },
      {
        title: "Any special requirements?",
        content: (
          <div className="space-y-4">
            <Textarea
              placeholder="Tell us about what you'll store, access needs, etc."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="apple-input text-lg min-h-[120px] resize-none"
            />
          </div>
        )
      }
    ];

    if (currentStep >= questions.length) {
      // Show loading state
      return (
        <div className="w-full max-w-2xl mx-auto">
          <Card className="apple-card border-0 shadow-xl">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-3xl font-bold tracking-tight mb-4">
                Finding your perfect driveway
              </CardTitle>
              <p className="text-muted-foreground text-lg">
                Our AI is analyzing your requirements...
              </p>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <LoadingDots size="lg" className="text-primary mx-auto mb-6" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Matching your location preferences</p>
                <p>• Calculating fair market prices</p>
                <p>• Checking availability</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    const question = questions[currentStep];
    const canProceed = currentStep === 0 ? formData.spaceType : 
                      currentStep === 1 ? formData.location :
                      currentStep === 2 ? formData.budget :
                      currentStep === 3 ? formData.timeframe : true;

    return (
      <div className="w-full max-w-2xl mx-auto animate-fade-in">
        <Card className="apple-card border-0 shadow-xl">
          <CardHeader className="text-center pb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge variant="secondary" className="rounded-full px-4 py-1">
                {currentStep + 1} of {questions.length}
              </Badge>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {question.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pb-8">
            {question.content}
            <Button 
              onClick={handleStepSubmit} 
              disabled={!canProceed}
              className={`w-full h-14 text-lg font-semibold ${
                canProceed ? "apple-button-primary" : "opacity-50"
              }`}
            >
              {currentStep === questions.length - 1 ? "Find My Driveway" : "Continue"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderResults = () => (
    <div className="w-full max-w-6xl mx-auto space-y-12 animate-scale-in">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight mb-4">
          Perfect matches found!
        </h2>
        <p className="text-xl text-muted-foreground">
          Our AI found {spaces.length} driveways matching your needs
        </p>
        {spacesError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Showing sample data. Real driveways will appear here once listings are created.
            </p>
          </div>
        )}
      </div>

      {/* Search and Filter Section */}
      <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Refine Your Search</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Driveway Type</label>
              <select
                value={searchFilters.spaceType}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, spaceType: e.target.value }))}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md"
              >
                <option value="">All Types</option>
                <option value="garage">Garage</option>
                <option value="driveway">Driveway</option>
                <option value="warehouse">Warehouse</option>
                <option value="parking_spot">Parking Spot</option>
                <option value="storage_unit">Storage Unit</option>
                <option value="outdoor_space">Outdoor Space</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Location</label>
              <Input
                placeholder="City, ZIP, or address"
                value={searchFilters.location}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Price Range</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Min $"
                  type="number"
                  value={searchFilters.minPrice}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                />
                <Input
                  placeholder="Max $"
                  type="number"
                  value={searchFilters.maxPrice}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Timezone</label>
              <select
                value={searchFilters.timezone}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md"
              >
                <option value="">All Timezones</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Phoenix">Arizona Time</option>
                <option value="America/Anchorage">Alaska Time (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSearch} className="apple-button-primary">
              <Search className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>
      
      {loadingSpaces ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="apple-card overflow-hidden">
              <div className="aspect-[4/3] bg-muted animate-pulse" />
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-6 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                  <div className="h-10 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              currentUserId={user?.id}
              onViewDetails={(space) => {
                toast({
                  title: "Space Details",
                  description: `Viewing details for ${space.title}`,
                });
                // You can implement a detailed view modal here
              }}
              onBookNow={(space) => {
                if (user) {
                  setSelectedSpaceForBooking(space);
                  setBookingModalOpen(true);
                } else {
                  setAuthModalOpen(true);
                }
              }}
              onEdit={(space) => {
                toast({
                  title: "Edit Space",
                  description: `Opening edit form for ${space.title}`,
                });
                // Implement edit functionality here
                // You can open an edit modal or navigate to edit page
              }}
              onDelete={(space) => {
                toast({
                  title: "Delete Space",
                  description: `Deleting ${space.title}`,
                });
                // Implement delete functionality here
                // You should add a confirmation dialog
              }}
              onRelist={(space) => {
                console.log('📝 Opening relist modal (Index page):', {
                  spaceId: space.id,
                  title: space.title,
                  currentStatus: space.is_active ? 'Active' : 'Inactive'
                });
                setSelectedSpaceForRelist(space);
                setRelistModalOpen(true);
              }}
              showAvailability={true}
              showTimezone={true}
              showSpecialInstructions={true}
            />
          ))}
        </div>
      )}
      
      <div className="text-center">
        <Button 
          variant="outline" 
          onClick={() => setCurrentStep(0)}
          className="apple-button-secondary h-12 px-8"
        >
          <Search className="mr-2 h-4 w-4" />
          Search Again
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <BagsyLogo size="sm" className="sm:hidden" />
              <BagsyLogo size="lg" className="hidden sm:flex" />
              <div className="hidden md:block">
                <span className="text-sm font-medium text-muted-foreground">
                  AI-Powered Driveway Rental
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
              {/* Sign In button - always visible for unauthenticated users */}
              {!user && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-sm sm:text-base h-9 sm:h-10 px-3 sm:px-4"
                  onClick={() => setAuthModalOpen(true)}
                >
                  Sign In
                </Button>
              )}
              
              {/* List Your Space button - always visible, checks auth */}
              <Button 
                size="sm"
                className="apple-button-primary text-sm sm:text-base h-9 sm:h-10 px-3 sm:px-4"
                onClick={() => {
                  if (user) {
                    setAiSpaceListingModalOpen(true);
                  } else {
                    setAuthModalOpen(true);
                  }
                }}
              >
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden xs:inline">List Your Driveway</span>
                <span className="xs:hidden">List</span>
              </Button>
              
              {/* User-specific buttons - only visible when authenticated */}
              {user && (
                <>
                  {hasListings && (
                    <Button 
                      variant="outline"
                      size="sm"
                      className="hidden sm:flex h-9 sm:h-10 px-3 sm:px-4"
                      onClick={() => navigate('/my-listings')}
                    >
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">My Listings</span>
                    </Button>
                  )}
                  <UserMenu />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12">
        {currentStep < 5 ? (
          <div className="space-y-8 sm:space-y-12 md:space-y-16">
            {/* Hero Section */}
            {currentStep === 0 && (
              <div className="text-center space-y-6 sm:space-y-8 mb-12 sm:mb-16 md:mb-20 animate-fade-in">
                <div className="space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <Badge variant="outline" className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium">
                      Bagsy™ - AI-Powered Driveway Rental
                    </Badge>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-tight px-4 sm:px-0">
                    Find the perfect driveway in
                    <span className="apple-text-gradient"> seconds</span>
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4 sm:px-6">
                    AI-powered driveway booking from posting to lease confirmation. 
                    Get fair prices and instant bookings.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8 text-sm sm:text-base text-muted-foreground px-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-full bg-primary/10">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <span className="whitespace-nowrap">Instant matching</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-full bg-primary/10">
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <span className="whitespace-nowrap">Fair AI pricing</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-full bg-primary/10">
                      <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <span className="whitespace-nowrap">Auto negotiation</span>
                  </div>
                </div>
              </div>
            )}

            {/* Differentiation Section */}
            {currentStep === 0 && (
              <div className="space-y-10 sm:space-y-12 md:space-y-16 mb-12 sm:mb-16 md:mb-20">
                {/* Why Bagsy Section */}
                <div className="text-center space-y-6 sm:space-y-8 animate-fade-in px-4">
                  <div className="space-y-3 sm:space-y-4">
                    <Badge variant="outline" className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium">
                      Why Choose Bagsy™?
                    </Badge>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                      The <span className="apple-text-gradient">Uber for Driveways</span>
                    </h2>
                    <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto px-2">
                      Just like Uber revolutionized transportation, Bagsy™ is revolutionizing driveway rental. 
                      We're not just another marketplace—we're the infrastructure that powers the future of driveway sharing.
                    </p>
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="max-w-6xl mx-auto animate-fade-in px-2 sm:px-4">
                  <Card className="apple-card border-0 shadow-xl overflow-hidden">
                    <CardHeader className="text-center pb-4 sm:pb-6 md:pb-8 px-4">
                      <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold">Bagsy™ vs. Traditional Platforms</CardTitle>
                      <CardDescription className="text-sm sm:text-base md:text-lg">
                        See how we're different from Airbnb, Craigslist, and other driveway rental platforms
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm md:text-base">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 sm:p-4 md:p-6 font-semibold min-w-[120px] sm:min-w-[150px]">Feature</th>
                              <th className="text-center p-3 sm:p-4 md:p-6 font-semibold min-w-[80px] sm:min-w-[100px]">
                                <div className="flex items-center justify-center gap-1 sm:gap-2">
                                  <BagsyLogo size="sm" />
                                </div>
                              </th>
                              <th className="text-center p-3 sm:p-4 md:p-6 font-semibold text-muted-foreground min-w-[80px] sm:min-w-[100px]">Airbnb</th>
                              <th className="text-center p-3 sm:p-4 md:p-6 font-semibold text-muted-foreground min-w-[80px] sm:min-w-[100px]">Craigslist</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="p-3 sm:p-4 md:p-6 font-medium">AI-Powered Matching</td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-3 sm:p-4 md:p-6 font-medium">Instant Booking</td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-3 sm:p-4 md:p-6 font-medium">AI Agents for Negotiation</td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-3 sm:p-4 md:p-6 font-medium">Dynamic Pricing</td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-3 sm:p-4 md:p-6 font-medium">Driveway-Specific Features</td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-3 sm:p-4 md:p-6 font-medium">Market Research Integration</td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-3 sm:p-4 md:p-6 text-center">
                                <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Platform Positioning */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto animate-fade-in">
                  {/* Uber Comparison */}
                  <Card className="apple-card border-0 shadow-xl text-center">
                    <CardHeader className="pb-4">
                      <div className="mx-auto w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                        <Zap className="h-8 w-8 text-blue-600" />
                      </div>
                      <CardTitle className="text-xl">Like Uber for Cars</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">
                        Uber didn't just create a taxi app—they built the infrastructure for on-demand transportation.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Instant matching</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Dynamic pricing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Seamless experience</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Twilio Comparison */}
                  <Card className="apple-card border-0 shadow-xl text-center">
                    <CardHeader className="pb-4">
                      <div className="mx-auto w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                        <Bot className="h-8 w-8 text-green-600" />
                      </div>
                      <CardTitle className="text-xl">Like Twilio for Agents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">
                        Twilio provides APIs for communication. We provide AI agents for driveway negotiation.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>AI-powered negotiation</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>24/7 availability</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>API-first approach</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Infrastructure */}
                  <Card className="apple-card border-0 shadow-xl text-center">
                    <CardHeader className="pb-4">
                      <div className="mx-auto w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4">
                        <Shield className="h-8 w-8 text-purple-600" />
                      </div>
                      <CardTitle className="text-xl">Built for Scale</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">
                        We're not just a marketplace—we're the infrastructure that powers driveway sharing.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Enterprise-ready</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>White-label solutions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Developer-friendly APIs</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Key Differentiators */}
                <div className="max-w-4xl mx-auto animate-fade-in">
                  <Card className="apple-card border-0 shadow-xl">
                    <CardHeader className="text-center pb-8">
                      <CardTitle className="text-2xl font-bold">What Makes Bagsy™ Different</CardTitle>
                      <CardDescription className="text-lg">
                        We're building the future of driveway sharing, not just another rental platform
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/10 rounded-xl">
                              <Sparkles className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg mb-2">AI-First Approach</h3>
                              <p className="text-muted-foreground">
                                Every interaction is powered by AI—from photo analysis to price optimization to automated negotiation.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-100 rounded-xl">
                              <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg mb-2">Market Intelligence</h3>
                              <p className="text-muted-foreground">
                                Real-time market research and competitive analysis ensure optimal pricing and positioning.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 rounded-xl">
                              <Bot className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg mb-2">Automated Agents</h3>
                              <p className="text-muted-foreground">
                                AI agents handle negotiations, bookings, and customer service—24/7 availability without human intervention.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-100 rounded-xl">
                              <Zap className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg mb-2">Instant Everything</h3>
                              <p className="text-muted-foreground">
                                Instant matching, instant pricing, instant booking—no waiting, no back-and-forth, no delays.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Call to Action */}
                <div className="text-center space-y-6 animate-fade-in">
                  <h3 className="text-2xl font-bold">Ready to experience the future of driveway sharing?</h3>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Join thousands of users who are already using AI-powered driveway booking. 
                    List your driveway in seconds, get fair prices, and let our AI agents handle the rest.
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <Button 
                      size="lg" 
                      className="apple-button-primary h-14 px-8 text-lg"
                      onClick={() => setCurrentStep(1)}
                    >
                      <Search className="h-5 w-5 mr-2" />
                      Find Your Driveway
                    </Button>
                    {user ? (
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="apple-button-secondary h-14 px-8 text-lg"
                        onClick={() => setAiSpaceListingModalOpen(true)}
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        List Your Driveway
                      </Button>
                    ) : (
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="apple-button-secondary h-14 px-8 text-lg"
                        onClick={() => setAuthModalOpen(true)}
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        List Your Driveway
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Conversational Form */}
            {renderConversationalForm()}
          </div>
        ) : (
          renderResults()
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-12 sm:mt-16 md:mt-20 py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 text-center space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
            <BagsyLogo size="sm" className="sm:hidden" />
            <BagsyLogo size="lg" className="hidden sm:flex" />
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              AI-Powered Driveway Rental
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground px-4">
            &copy; 2024 Bagsy™. Revolutionizing driveway booking.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
      />

      {/* List Space Modal */}
      <AISpaceListingModal 
        open={aiSpaceListingModalOpen}
        onOpenChange={setAiSpaceListingModalOpen}
      />

      {/* Relist Modal */}
      <RelistModal 
        open={relistModalOpen}
        onOpenChange={(open) => {
          setRelistModalOpen(open);
          if (!open) {
            setSelectedSpaceForRelist(null);
          }
        }}
        space={selectedSpaceForRelist}
        onSuccess={() => {
          console.log('✅ Relist successful! Refreshing spaces on Index page...');
          fetchSpaces(); // Refresh the spaces list
        }}
      />

      {/* Booking Modal */}
      <TieredBookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        space={selectedSpaceForBooking}
        onBookingCreated={() => {
          setBookingModalOpen(false);
          toast({
            title: "Success!",
            description: "Check 'My Bookings' to track your request.",
          });
        }}
      />

    </div>
  );
};

export default Index;