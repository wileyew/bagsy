import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Clock, DollarSign, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const AIAgentHelp = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Bagsy
          </Link>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            AI Agent Negotiation
          </h1>
          <p className="text-xl text-muted-foreground">
            Let our intelligent AI agent handle negotiations on your behalf
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* What is AI Agent Negotiation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                What is AI Agent Negotiation?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Our AI agent is an intelligent system that automatically negotiates with potential renters 
                on your behalf. It uses advanced algorithms and market data to make informed decisions about 
                pricing, availability, and special requests.
              </p>
              <p className="text-muted-foreground">
                Think of it as having a professional negotiator working 24/7 to get you the best deals 
                while you focus on other important things.
              </p>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>Key Benefits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-semibold">24/7 Availability</h3>
                      <p className="text-sm text-muted-foreground">
                        Never miss a negotiation opportunity. Our AI agent is always available to respond 
                        to inquiries and negotiate deals, even when you're sleeping or busy.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DollarSign className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-semibold">Data-Driven Pricing</h3>
                      <p className="text-sm text-muted-foreground">
                        Uses real-time market data, demand patterns, and competitor pricing to suggest 
                        optimal rates that maximize your revenue while remaining competitive.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Zap className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-semibold">Instant Responses</h3>
                      <p className="text-sm text-muted-foreground">
                        Responds to inquiries within seconds, keeping potential renters engaged and 
                        increasing your chances of closing deals.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-semibold">Smart Counter-Offers</h3>
                      <p className="text-sm text-muted-foreground">
                        Automatically generates intelligent counter-offers based on your preferences, 
                        market conditions, and renter behavior patterns.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Bot className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-semibold">Learning & Adaptation</h3>
                      <p className="text-sm text-muted-foreground">
                        Continuously learns from successful negotiations to improve its strategies 
                        and better represent your interests over time.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-semibold">Time Savings</h3>
                      <p className="text-sm text-muted-foreground">
                        Eliminates the need for constant back-and-forth communication, freeing up 
                        your time for other activities while still maximizing your rental income.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Renter Inquiry</h3>
                    <p className="text-muted-foreground">
                      A potential renter sends a message or makes an offer for your space.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">AI Analysis</h3>
                    <p className="text-muted-foreground">
                      Our AI agent analyzes the request, current market conditions, your preferences, 
                      and historical data to determine the best response.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Automatic Response</h3>
                    <p className="text-muted-foreground">
                      The AI agent responds with an appropriate counter-offer, acceptance, or clarification 
                      request based on your configured preferences.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Deal Closure</h3>
                    <p className="text-muted-foreground">
                      Once both parties agree, the booking is automatically confirmed and you're notified 
                      of the successful negotiation.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Safety & Control */}
          <Card>
            <CardHeader>
              <CardTitle>Your Control & Safety</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Always in Control</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Set minimum acceptable prices</li>
                    <li>• Configure negotiation boundaries</li>
                    <li>• Override any AI decision at any time</li>
                    <li>• Disable the feature whenever you want</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Transparent Process</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Receive notifications for all negotiations</li>
                    <li>• View detailed logs of AI decisions</li>
                    <li>• Access performance analytics</li>
                    <li>• Learn from successful strategies</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="text-center py-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-muted-foreground mb-6">
                Enable AI agent negotiation when creating your space listing to start maximizing 
                your rental income with minimal effort.
              </p>
              <Link to="/">
                <Button size="lg" className="apple-button-primary">
                  Create Your First Listing
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AIAgentHelp;
