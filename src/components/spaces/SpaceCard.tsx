import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  DollarSign, 
  Clock, 
  Calendar,
  Star,
  Image,
  Eye,
  Edit,
  Trash2,
  RotateCcw,
  Flag,
  AlertTriangle,
  Shield,
  CreditCard,
  User,
  Lock
} from 'lucide-react';
import { useAuthContext } from '@/contexts/auth-context';
import { tieredVerificationService, type VerificationTier, type UserVerificationStatus } from '@/lib/tiered-verification-service';

interface SpacePhoto {
  id: string;
  photo_url: string;
  display_order: number;
}

interface SpaceListing {
  id: string;
  title: string;
  description: string | null;
  space_type: string;
  address: string;
  zip_code: string;
  price_per_hour: number;
  price_per_day: number | null;
  dimensions: string | null;
  available_from: string | null;
  available_until: string | null;
  timezone: string | null;
  special_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string;
  photos: SpacePhoto[];
}

interface SpaceCardProps {
  space: SpaceListing;
  onViewDetails?: (space: SpaceListing) => void;
  onBookNow?: (space: SpaceListing) => void;
  onEdit?: (space: SpaceListing) => void;
  onDelete?: (space: SpaceListing) => void;
  onRelist?: (space: SpaceListing) => void;
  onReport?: (space: SpaceListing) => void;
  showAvailability?: boolean;
  showTimezone?: boolean;
  showSpecialInstructions?: boolean;
  currentUserId?: string;
}

export const SpaceCard: React.FC<SpaceCardProps> = ({
  space,
  onViewDetails,
  onBookNow,
  onEdit,
  onDelete,
  onRelist,
  onReport,
  showAvailability = true,
  showTimezone = true,
  showSpecialInstructions = true,
  currentUserId
}) => {
  const { user } = useAuthContext();
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [loadingVerification, setLoadingVerification] = useState(false);

  // Load user verification status
  useEffect(() => {
    if (user && !isOwner) {
      loadUserVerificationStatus();
    }
  }, [user, currentUserId]);

  const loadUserVerificationStatus = async () => {
    if (!user) return;

    setLoadingVerification(true);
    try {
      const status = await tieredVerificationService.getUserVerificationStatus(user.id);
      setVerificationStatus(status);
    } catch (error) {
      console.error('Failed to load verification status:', error);
    } finally {
      setLoadingVerification(false);
    }
  };

  const canBook = () => {
    if (isExpired) return false;
    if (!user) return false;
    if (isOwner) return false;
    return verificationStatus?.paymentMethodSetup || false;
  };

  const getBookingButtonText = () => {
    if (isExpired) return 'Expired';
    if (!user) return 'Login to Book';
    if (isOwner) return 'Your Space';
    if (!verificationStatus?.paymentMethodSetup) return 'Verify to Book';
    return 'Book Now';
  };

  const getBookingButtonIcon = () => {
    if (isExpired) return <AlertTriangle className="h-4 w-4" />;
    if (!user) return <User className="h-4 w-4" />;
    if (isOwner) return <Edit className="h-4 w-4" />;
    if (!verificationStatus?.paymentMethodSetup) return <Lock className="h-4 w-4" />;
    return <Calendar className="h-4 w-4" />;
  };
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatAvailability = (availableFrom: string | null, availableUntil: string | null, timezone: string | null) => {
    if (!availableFrom || !availableUntil) {
      return 'Not specified';
    }

    const fromDate = new Date(availableFrom);
    const untilDate = new Date(availableUntil);
    
    // Format dates in the space's timezone
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || 'America/Los_Angeles'
    };

    const fromFormatted = fromDate.toLocaleString('en-US', options);
    const untilFormatted = untilDate.toLocaleString('en-US', options);
    
    return `${fromFormatted} - ${untilFormatted}`;
  };

  const getTimezoneDisplay = (timezone: string | null) => {
    if (!timezone) return 'Not specified';
    
    // Convert timezone to readable format
    const timezoneMap: { [key: string]: string } = {
      'America/Los_Angeles': 'Pacific Time (PT)',
      'America/Denver': 'Mountain Time (MT)',
      'America/Chicago': 'Central Time (CT)',
      'America/New_York': 'Eastern Time (ET)',
      'America/Phoenix': 'Arizona Time',
      'America/Anchorage': 'Alaska Time (AKT)',
      'Pacific/Honolulu': 'Hawaii Time (HST)'
    };
    
    return timezoneMap[timezone] || timezone;
  };

  const primaryPhoto = space.photos?.[0];
  const isOwner = currentUserId && space.owner_id === currentUserId;
  const isExpired = space.available_until && new Date(space.available_until) < new Date();

  return (
    <Card className="apple-card overflow-hidden hover:shadow-xl transition-all duration-300 group">
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {primaryPhoto ? (
          <img 
            src={primaryPhoto.photo_url} 
            alt={space.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-400">
              <Image className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm">No photo available</p>
            </div>
          </div>
        )}
        <Badge className={`absolute top-4 right-4 rounded-full ${
          isExpired 
            ? 'bg-destructive text-destructive-foreground' 
            : 'bg-success text-success-foreground'
        }`}>
          {isExpired ? 'Expired' : 'Available'}
        </Badge>
      </div>
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-lg line-clamp-2">{space.title}</h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground ml-2">
            <Star className="h-4 w-4 fill-current text-warning" />
            <span>4.8</span>
          </div>
        </div>
        
        <div className="space-y-3 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4" />
            {space.address}
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4" />
            {formatPrice(space.price_per_hour)}/hour
            {space.price_per_day && (
              <span className="text-xs">({formatPrice(space.price_per_day)}/day)</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4" />
            {space.dimensions || 'Dimensions not specified'}
          </div>
          
          {showAvailability && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">
                {formatAvailability(space.available_from, space.available_until, space.timezone)}
              </span>
            </div>
          )}
          
          {showTimezone && space.timezone && (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4" />
              <span className="text-xs">{getTimezoneDisplay(space.timezone)}</span>
            </div>
          )}
          
          {showSpecialInstructions && space.special_instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <p className="text-xs text-blue-800">
                <strong>Special Instructions:</strong> {space.special_instructions}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {onViewDetails && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onViewDetails(space)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
          )}
          
          {isOwner ? (
            // Owner actions
            <div className="flex gap-2 flex-1">
              {isExpired ? (
                // Expired listing - show relist button
                onRelist && (
                  <Button 
                    className="flex-1 apple-button-primary"
                    onClick={() => onRelist(space)}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Relist
                  </Button>
                )
              ) : (
                // Active listing - show edit and delete
                <>
                  {onEdit && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => onEdit(space)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => onDelete(space)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            // Non-owner - show book now button and report option
            <div className="flex gap-2 flex-1">
              {onBookNow && (
                <Button 
                  className="flex-1 apple-button-primary"
                  onClick={() => onBookNow(space)}
                  disabled={!canBook()}
                >
                  {getBookingButtonIcon()}
                  <span className="ml-1">{getBookingButtonText()}</span>
                </Button>
              )}
              {onReport && !isExpired && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onReport(space)}
                  title="Report this listing"
                >
                  <Flag className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Verification Status Alert */}
        {!isOwner && user && verificationStatus && !verificationStatus.paymentMethodSetup && (
          <Alert className="mt-4">
            <CreditCard className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Set up payment method to book this space
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onBookNow?.(space)}
                  className="ml-2"
                >
                  Setup
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
