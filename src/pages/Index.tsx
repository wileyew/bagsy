import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, DollarSign, Users, Star, ArrowRight, Search, Car, Warehouse, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    spaceType: "",
    location: "",
    budget: "",
    timeframe: "",
    description: ""
  });
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
      setCurrentStep(5); // Show results
    }
  };

  const renderConversationalForm = () => {
    const questions = [
      {
        title: "What type of space do you need?",
        content: (
          <div className="grid grid-cols-1 gap-3">
            {spaceTypes.map((type) => (
              <Button
                key={type.id}
                variant={formData.spaceType === type.id ? "default" : "outline"}
                onClick={() => setFormData({...formData, spaceType: type.id})}
                className="flex items-center justify-start gap-3 p-4 h-auto"
              >
                <type.icon className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{type.name}</div>
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
          <div className="space-y-3">
            <Input
              placeholder="Enter address or ZIP code"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              className="text-base"
            />
            <p className="text-sm text-muted-foreground">We currently serve ZIP code 94110 (Mission District)</p>
          </div>
        )
      },
      {
        title: "What's your budget?",
        content: (
          <div className="space-y-3">
            <Input
              placeholder="e.g., $5-10 per hour"
              value={formData.budget}
              onChange={(e) => setFormData({...formData, budget: e.target.value})}
              className="text-base"
            />
            <p className="text-sm text-muted-foreground">Our AI will suggest fair market prices</p>
          </div>
        )
      },
      {
        title: "When do you need it?",
        content: (
          <div className="space-y-3">
            <Input
              placeholder="e.g., Tomorrow 9am-5pm, or Next week"
              value={formData.timeframe}
              onChange={(e) => setFormData({...formData, timeframe: e.target.value})}
              className="text-base"
            />
          </div>
        )
      },
      {
        title: "Any special requirements?",
        content: (
          <div className="space-y-3">
            <Textarea
              placeholder="Tell us about what you'll store, access needs, etc."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="text-base min-h-[100px]"
            />
          </div>
        )
      }
    ];

    if (currentStep >= questions.length) return null;

    const question = questions[currentStep];
    const canProceed = currentStep === 0 ? formData.spaceType : 
                      currentStep === 1 ? formData.location :
                      currentStep === 2 ? formData.budget :
                      currentStep === 3 ? formData.timeframe : true;

    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{currentStep + 1} of {questions.length}</Badge>
            <div className="text-sm text-muted-foreground">
              {Math.round(((currentStep + 1) / questions.length) * 100)}% complete
            </div>
          </div>
          <CardTitle className="text-xl">{question.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {question.content}
          <Button 
            onClick={handleStepSubmit} 
            disabled={!canProceed}
            className="w-full"
          >
            {currentStep === questions.length - 1 ? "Find My Space" : "Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderResults = () => (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Perfect matches found!</h2>
        <p className="text-muted-foreground">Our AI found {mockListings.length} spaces matching your needs</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockListings.map((listing) => (
          <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-video bg-muted relative">
              <img src={listing.image} alt={listing.title} className="w-full h-full object-cover" />
              <Badge className="absolute top-2 right-2 bg-success text-success-foreground">
                Available
              </Badge>
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold line-clamp-2">{listing.title}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-current text-warning" />
                  {listing.rating}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {listing.address}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  ${listing.price}/hour
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {listing.dimensions}
                </div>
              </div>
              
              <Button className="w-full mt-4">
                Book Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="text-center">
        <Button variant="outline" onClick={() => setCurrentStep(0)}>
          <Search className="mr-2 h-4 w-4" />
          Search Again
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">PocketSpot</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">Sign In</Button>
              <Button size="sm">List Your Space</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentStep < 5 ? (
          <div className="space-y-8">
            {/* Hero Section */}
            {currentStep === 0 && (
              <div className="text-center space-y-4 mb-12">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  Find the perfect space in
                  <span className="text-primary"> seconds</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  AI-powered space matching in San Francisco's Mission District. 
                  Get fair prices and instant bookings.
                </p>
                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Instant matching
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Fair AI pricing
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
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
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 PocketSpot. Revolutionizing space booking in SF.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;