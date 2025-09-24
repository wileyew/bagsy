import { useState } from "react";
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
import { BagsyLogo } from "@/components/ui/bagsy-logo";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import DebugPanel from "@/components/debug/DebugPanel";
import { useNavigate } from "react-router-dom";
import { useUserListingsCount } from "@/hooks/use-user-listings-count";

const Index = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiSpaceListingModalOpen, setAiSpaceListingModalOpen] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
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
        title: "What type of space do you need?",
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
        title: "Where do you need the space?",
        content: (
          <div className="space-y-4">
            <Input
              placeholder="Enter address or ZIP code"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              className="apple-input text-lg h-14"
            />
            <p className="text-sm text-muted-foreground text-center">
              Enter your location to find nearby spaces
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
                Finding your perfect space
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
              {currentStep === questions.length - 1 ? "Find My Space" : "Continue"}
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
          Our AI found {mockListings.length} spaces matching your needs
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {mockListings.map((listing) => (
          <Card key={listing.id} className="apple-card overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div className="aspect-[4/3] bg-muted relative overflow-hidden">
              <img src={listing.image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <Badge className="absolute top-4 right-4 bg-success text-success-foreground rounded-full">
                Available
              </Badge>
            </div>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-lg line-clamp-2">{listing.title}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-current text-warning" />
                  {listing.rating}
                </div>
              </div>
              
              <div className="space-y-3 text-sm text-muted-foreground mb-6">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4" />
                  {listing.address}
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4" />
                  ${listing.price}/hour
                </div>
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4" />
                  {listing.dimensions}
                </div>
              </div>
              
              <Button className="w-full apple-button-primary h-12">
                Book Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
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
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BagsyLogo size="lg" />
              <div className="hidden md:block">
                <span className="text-sm font-medium text-muted-foreground">
                  AI-Powered Space Rental
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Button 
                    size="lg" 
                    className="apple-button-primary"
                    onClick={() => setAiSpaceListingModalOpen(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    List Your Space with AI
                  </Button>
                  {hasListings && (
                    <Button 
                      variant="outline"
                      size="lg" 
                      onClick={() => navigate('/my-listings')}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      My Listings
                    </Button>
                  )}
                  <UserMenu />
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="lg" 
                    className="text-base"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    Sign In
                  </Button>
                  <Button 
                    size="lg" 
                    className="apple-button-primary"
                    onClick={() => setAuthModalOpen(true)}
                  >
                    List Your Space
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {currentStep < 5 ? (
          <div className="space-y-16">
            {/* Hero Section */}
            {currentStep === 0 && (
              <div className="text-center space-y-8 mb-20 animate-fade-in">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
                      Bagsy - AI-Powered Space Rental
                    </Badge>
                  </div>
                  <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight">
                    Find the perfect space in
                    <span className="apple-text-gradient"> seconds</span>
                  </h1>
                  <p className="text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    AI-powered space booking from posting to lease confirmation. 
                    Get fair prices and instant bookings.
                  </p>
                </div>
                
                <div className="flex items-center justify-center gap-8 text-base text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    Instant matching
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    Fair AI pricing
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    Auto negotiation
                  </div>
                </div>
              </div>
            )}

            {/* Differentiation Section */}
            {currentStep === 0 && (
              <div className="space-y-16 mb-20">
                {/* Why Bagsy Section */}
                <div className="text-center space-y-8 animate-fade-in">
                  <div className="space-y-4">
                    <Badge variant="outline" className="px-4 py-2 text-sm font-medium">
                      Why Choose Bagsy?
                    </Badge>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                      The <span className="apple-text-gradient">Uber for Spaces</span>
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                      Just like Uber revolutionized transportation, Bagsy is revolutionizing space rental. 
                      We're not just another marketplace—we're the infrastructure that powers the future of space sharing.
                    </p>
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="max-w-6xl mx-auto animate-fade-in">
                  <Card className="apple-card border-0 shadow-xl overflow-hidden">
                    <CardHeader className="text-center pb-8">
                      <CardTitle className="text-2xl font-bold">Bagsy vs. Traditional Platforms</CardTitle>
                      <CardDescription className="text-lg">
                        See how we're different from Airbnb, Craigslist, and other space rental platforms
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-6 font-semibold">Feature</th>
                              <th className="text-center p-6 font-semibold">
                                <div className="flex items-center justify-center gap-2">
                                  <BagsyLogo size="sm" />
                                  <span>Bagsy</span>
                                </div>
                              </th>
                              <th className="text-center p-6 font-semibold text-muted-foreground">Airbnb</th>
                              <th className="text-center p-6 font-semibold text-muted-foreground">Craigslist</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="p-6 font-medium">AI-Powered Matching</td>
                              <td className="p-6 text-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-6 font-medium">Instant Booking</td>
                              <td className="p-6 text-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-6 font-medium">AI Agents for Negotiation</td>
                              <td className="p-6 text-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-6 font-medium">Dynamic Pricing</td>
                              <td className="p-6 text-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-6 font-medium">Space-Specific Features</td>
                              <td className="p-6 text-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                            </tr>
                            <tr>
                              <td className="p-6 font-medium">Market Research Integration</td>
                              <td className="p-6 text-center">
                                <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              </td>
                              <td className="p-6 text-center">
                                <X className="h-5 w-5 text-red-500 mx-auto" />
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
                        Twilio provides APIs for communication. We provide AI agents for space negotiation.
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
                        We're not just a marketplace—we're the infrastructure that powers space sharing.
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
                      <CardTitle className="text-2xl font-bold">What Makes Bagsy Different</CardTitle>
                      <CardDescription className="text-lg">
                        We're building the future of space sharing, not just another rental platform
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
                  <h3 className="text-2xl font-bold">Ready to experience the future of space sharing?</h3>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Join thousands of users who are already using AI-powered space booking. 
                    List your space in seconds, get fair prices, and let our AI agents handle the rest.
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <Button 
                      size="lg" 
                      className="apple-button-primary h-14 px-8 text-lg"
                      onClick={() => setCurrentStep(1)}
                    >
                      <Search className="h-5 w-5 mr-2" />
                      Find Your Space
                    </Button>
                    {user ? (
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="apple-button-secondary h-14 px-8 text-lg"
                        onClick={() => setAiSpaceListingModalOpen(true)}
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        List Your Space
                      </Button>
                    ) : (
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="apple-button-secondary h-14 px-8 text-lg"
                        onClick={() => setAuthModalOpen(true)}
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        List Your Space
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
      <footer className="border-t border-border/50 mt-20 py-12">
        <div className="container mx-auto px-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <BagsyLogo size="lg" />
            <span className="text-sm font-medium text-muted-foreground">
              AI-Powered Space Rental
            </span>
          </div>
          <p className="text-muted-foreground">
            &copy; 2024 Bagsy. Revolutionizing space booking.
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

      {/* Debug Panel */}
      {import.meta.env.DEV && (
        <>
          <DebugPanel 
            isOpen={debugPanelOpen}
            onClose={() => setDebugPanelOpen(false)}
          />
          
          {/* Debug Toggle Button */}
          <button
            onClick={() => setDebugPanelOpen(!debugPanelOpen)}
            className="fixed top-4 right-4 z-50 p-2 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors"
            title="Toggle Debug Panel"
          >
            🐛
          </button>
        </>
      )}
    </div>
  );
};

export default Index;