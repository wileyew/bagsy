import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Scale, 
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { LegalComplianceResult } from "@/lib/legal-compliance-checker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface LegalComplianceWarningProps {
  complianceResult: LegalComplianceResult | null;
  loading?: boolean;
}

export function LegalComplianceWarning({ complianceResult, loading }: LegalComplianceWarningProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  if (loading) {
    return (
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-blue-900">Checking local laws and regulations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!complianceResult) {
    return null;
  }

  const isAllowed = complianceResult.isAllowed;
  const hasWarnings = complianceResult.warnings.length > 0;
  const hasRestrictions = 
    complianceResult.restrictions.stateLevel.restrictions.length > 0 ||
    complianceResult.restrictions.cityLevel.restrictions.length > 0;

  return (
    <Card className={`border-2 ${
      !isAllowed 
        ? 'border-red-300 bg-red-50' 
        : hasWarnings 
        ? 'border-yellow-300 bg-yellow-50' 
        : 'border-green-300 bg-green-50'
    }`}>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {!isAllowed ? (
            <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5 flex-shrink-0" />
          ) : hasWarnings ? (
            <Info className="h-6 w-6 text-yellow-600 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
          )}
          
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`text-base sm:text-lg font-bold ${
                !isAllowed ? 'text-red-900' : hasWarnings ? 'text-yellow-900' : 'text-green-900'
              }`}>
                {!isAllowed 
                  ? '⚠️ Potential Legal Restrictions'
                  : hasWarnings 
                  ? '✓ Allowed with Restrictions' 
                  : '✅ Legal to List Your Space'
                }
              </h3>
              <Badge variant={isAllowed ? 'default' : 'destructive'} className="text-xs">
                {complianceResult.certainty.toUpperCase()}
              </Badge>
            </div>
            
            <p className={`text-sm ${
              !isAllowed ? 'text-red-800' : hasWarnings ? 'text-yellow-800' : 'text-green-800'
            }`}>
              <strong>{complianceResult.city}, {complianceResult.state}</strong>
              {' - '}
              {!isAllowed 
                ? 'Driveway rentals may not be permitted in this area. Please verify local laws before listing.'
                : hasWarnings 
                ? 'Driveway rentals are generally allowed, but certain restrictions apply.'
                : 'Driveway rentals are permitted in this area.'
              }
            </p>
          </div>
        </div>

        {/* Quick Warnings */}
        {complianceResult.warnings.length > 0 && (
          <div className="space-y-2">
            {complianceResult.warnings.slice(0, 2).map((warning, index) => (
              <div key={index} className={`text-sm ${!isAllowed ? 'text-red-700' : 'text-yellow-700'}`}>
                • {warning}
              </div>
            ))}
          </div>
        )}

        {/* Requirements */}
        {complianceResult.requirements.length > 0 && (
          <div className={`bg-white/50 border-2 ${isAllowed ? 'border-yellow-200' : 'border-red-200'} rounded-lg p-3`}>
            <p className={`text-xs font-semibold mb-2 ${isAllowed ? 'text-yellow-900' : 'text-red-900'}`}>
              📋 Requirements:
            </p>
            <ul className="space-y-1">
              {complianceResult.requirements.map((req, index) => (
                <li key={index} className={`text-xs ${isAllowed ? 'text-yellow-800' : 'text-red-800'}`}>
                  • {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expandable Details */}
        {hasRestrictions && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between text-xs font-medium"
              >
                <span className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  View Detailed Restrictions
                </span>
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3">
              {/* State Level */}
              {complianceResult.restrictions.stateLevel.restrictions.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-semibold ${!isAllowed ? 'text-red-900' : 'text-yellow-900'}`}>
                    State-Level ({complianceResult.state}):
                  </p>
                  <ul className="space-y-1 pl-4">
                    {complianceResult.restrictions.stateLevel.restrictions.map((restriction, index) => (
                      <li key={index} className={`text-xs ${!isAllowed ? 'text-red-700' : 'text-yellow-700'}`}>
                        • {restriction}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* City Level */}
              {complianceResult.restrictions.cityLevel.restrictions.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-semibold ${!isAllowed ? 'text-red-900' : 'text-yellow-900'}`}>
                    City-Level ({complianceResult.city}):
                  </p>
                  <ul className="space-y-1 pl-4">
                    {complianceResult.restrictions.cityLevel.restrictions.map((restriction, index) => (
                      <li key={index} className={`text-xs ${!isAllowed ? 'text-red-700' : 'text-yellow-700'}`}>
                        • {restriction}
                      </li>
                    ))}
                  </ul>
                  {complianceResult.restrictions.cityLevel.notes && (
                    <p className={`text-xs italic mt-2 ${!isAllowed ? 'text-red-600' : 'text-yellow-600'}`}>
                      {complianceResult.restrictions.cityLevel.notes}
                    </p>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {complianceResult.recommendations.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-300">
                  <p className="text-xs font-semibold text-gray-700">💡 Recommendations:</p>
                  <ul className="space-y-1 pl-4">
                    {complianceResult.recommendations.map((rec, index) => (
                      <li key={index} className="text-xs text-gray-600">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Disclaimer */}
        <div className={`text-xs ${!isAllowed ? 'text-red-700' : 'text-gray-600'} border-t pt-3`}>
          <p className="font-semibold mb-1">⚖️ Legal Disclaimer:</p>
          <p>
            This information is provided for guidance only and should not be considered legal advice. 
            Laws vary by jurisdiction and change frequently. Please consult with a local attorney or 
            your city's planning department to confirm compliance before listing your space.
          </p>
        </div>

        {/* Action Buttons */}
        {!isAllowed && (
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${city} ${state} parking space rental laws`)}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Research Local Laws
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${city} ${state} zoning department contact`)}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Contact Zoning Dept
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

