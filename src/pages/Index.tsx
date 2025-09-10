import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, DollarSign, Users, Star, ArrowRight, Search, Car, Warehouse, Home, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingDots } from "@/components/ui/loading-dots";
import { AuthModal } from "@/components/auth/auth-modal";
import { UserMenu } from "@/components/auth/user-menu";
import { AISpaceListingModal } from "@/components/spaces/ai-space-listing-modal";
import { BagsyLogo } from "@/components/ui/bagsy-logo";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiSpaceListingModalOpen, setAiSpaceListingModalOpen] = useState(false);
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
            <BagsyLogo size="lg" />
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
                  <div className="flex justify-center mb-8">
                    <BagsyLogo size="lg" />
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
          <BagsyLogo size="md" />
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
    </div>
  );
};

export default Index;