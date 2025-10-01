import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Bot, TrendingUp, Shield, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AIAgentPreferences } from "@/lib/ai-agent-negotiation-service";

interface AIAgentSettingsProps {
  role: 'owner' | 'renter';
  listingPrice?: number;
  preferences: AIAgentPreferences;
  onPreferencesChange: (prefs: AIAgentPreferences) => void;
  compact?: boolean;
}

export function AIAgentSettings({
  role,
  listingPrice,
  preferences,
  onPreferencesChange,
  compact = false
}: AIAgentSettingsProps) {
  const [localPrefs, setLocalPrefs] = useState<AIAgentPreferences>(preferences);

  const handleChange = (updates: Partial<AIAgentPreferences>) => {
    const newPrefs = { ...localPrefs, ...updates };
    setLocalPrefs(newPrefs);
    onPreferencesChange(newPrefs);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Bot className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">AI Agent Negotiation</span>
              <Badge variant="secondary" className="text-xs">BETA</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Let AI negotiate {role === 'owner' ? 'with renters' : 'on your behalf'}
            </p>
          </div>
        </div>
        <Switch
          checked={localPrefs.enabled}
          onCheckedChange={(enabled) => handleChange({ enabled })}
        />
      </div>
    );
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-purple-600" />
          AI Agent Negotiation
          <Badge variant="secondary" className="text-xs">BETA</Badge>
        </CardTitle>
        <CardDescription>
          {role === 'owner' 
            ? 'Let AI automatically negotiate with renters on your behalf'
            : 'Let AI negotiate the best price for you automatically'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex-1">
            <Label htmlFor="ai-enabled" className="text-sm font-medium">
              Enable AI Agent
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              AI will {role === 'owner' ? 'respond to offers' : 'make offers'} automatically
            </p>
          </div>
          <Switch
            id="ai-enabled"
            checked={localPrefs.enabled}
            onCheckedChange={(enabled) => handleChange({ enabled })}
          />
        </div>

        {localPrefs.enabled && (
          <>
            {/* Strategy */}
            <div className="space-y-2">
              <Label htmlFor="strategy" className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Negotiation Strategy
              </Label>
              <Select
                value={localPrefs.negotiationStrategy || 'moderate'}
                onValueChange={(value: any) => handleChange({ negotiationStrategy: value })}
              >
                <SelectTrigger id="strategy" className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aggressive">
                    <div>
                      <div className="font-medium">Aggressive</div>
                      <div className="text-xs text-muted-foreground">
                        {role === 'owner' ? 'Hold firm on price' : 'Seek maximum discount'}
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="moderate">
                    <div>
                      <div className="font-medium">Moderate</div>
                      <div className="text-xs text-muted-foreground">
                        Balanced approach, fair negotiations
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="conservative">
                    <div>
                      <div className="font-medium">Conservative</div>
                      <div className="text-xs text-muted-foreground">
                        {role === 'owner' ? 'More flexible on price' : 'Willing to pay fair value'}
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Limits */}
            {role === 'owner' ? (
              <div className="space-y-2">
                <Label htmlFor="min-price" className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Minimum Acceptable Price (per hour)
                </Label>
                <Input
                  id="min-price"
                  type="number"
                  step="0.50"
                  min="0"
                  placeholder={listingPrice ? `Min: $${(listingPrice * 0.7).toFixed(2)}` : "0.00"}
                  value={localPrefs.minAcceptablePrice || ''}
                  onChange={(e) => handleChange({ 
                    minAcceptablePrice: parseFloat(e.target.value) || undefined 
                  })}
                  className="bg-white"
                />
                <p className="text-xs text-muted-foreground">
                  AI will never accept offers below this price
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="max-price" className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Maximum Budget (per hour)
                </Label>
                <Input
                  id="max-price"
                  type="number"
                  step="0.50"
                  min="0"
                  placeholder={listingPrice ? `Max: $${(listingPrice * 1.1).toFixed(2)}` : "0.00"}
                  value={localPrefs.maxAcceptablePrice || ''}
                  onChange={(e) => handleChange({ 
                    maxAcceptablePrice: parseFloat(e.target.value) || undefined 
                  })}
                  className="bg-white"
                />
                <p className="text-xs text-muted-foreground">
                  AI will never offer more than this amount
                </p>
              </div>
            )}

            {/* Auto-Accept Threshold */}
            <div className="space-y-2">
              <Label htmlFor="auto-accept" className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-Accept Threshold
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="auto-accept"
                  type="number"
                  step="1"
                  min="85"
                  max="100"
                  value={(localPrefs.autoAcceptThreshold || 0.95) * 100}
                  onChange={(e) => handleChange({ 
                    autoAcceptThreshold: parseFloat(e.target.value) / 100 || 0.95
                  })}
                  className="bg-white"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {role === 'owner' 
                  ? `Auto-accept offers at ${((localPrefs.autoAcceptThreshold || 0.95) * 100).toFixed(0)}% or more of listing price`
                  : `Auto-accept prices at ${((localPrefs.autoAcceptThreshold || 1.05) * 100).toFixed(0)}% or less of your budget`}
              </p>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-blue-900">
                  <p className="font-medium">How AI Agent Works:</p>
                  <ul className="text-xs space-y-1 pl-4 list-disc">
                    <li>Analyzes market data and comparable listings</li>
                    <li>Makes intelligent counter-offers based on your strategy</li>
                    <li>Responds instantly to negotiations (no waiting)</li>
                    <li>Can negotiate with other AI agents for fastest deals</li>
                    <li>You can override any AI decision at any time</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

