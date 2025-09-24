import React, { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  MapPin, 
  DollarSign, 
  Eye, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Settings,
  BarChart3,
  Users,
  Mail,
  HelpCircle,
  ExternalLink,
  Image,
  ChevronRight,
  Star,
  User,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  is_active: boolean;
  created_at: string;
  updated_at: string;
  photos: SpacePhoto[];
  bookings: Booking[];
  negotiations: Negotiation[];
}

interface SpacePhoto {
  id: string;
  photo_url: string;
  display_order: number;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  renter_id: string;
  created_at: string;
}

interface Negotiation {
  id: string;
  offer_price: number;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  ai_generated: boolean;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
}

const MyListings: React.FC = () => {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [listings, setListings] = useState<SpaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<SpaceListing | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(false);

  useEffect(() => {
    if (user) {
      fetchListings();
    }
  }, [user]);

  const fetchListings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch spaces with related data
      const { data: spacesData, error: spacesError } = await supabase
        .from('spaces')
        .select(`
          *,
          space_photos (
            id,
            photo_url,
            display_order
          ),
          bookings (
            id,
            start_time,
            end_time,
            total_price,
            status,
            renter_id,
            created_at
          )
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (spacesError) {
        throw spacesError;
      }

      // Fetch negotiations for each space
      const listingsWithNegotiations = await Promise.all(
        (spacesData || []).map(async (space) => {
          const { data: negotiationsData } = await supabase
            .from('negotiations')
            .select('*')
            .eq('booking_id', space.bookings?.[0]?.id || '')
            .order('created_at', { ascending: false });

          return {
            ...space,
            negotiations: negotiationsData || []
          };
        })
      );

      setListings(listingsWithNegotiations);
    } catch (error) {
      console.error('Error fetching listings:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch listings');
      toast({
        title: "Error",
        description: "Failed to load your listings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getListingStatus = (listing: SpaceListing) => {
    if (!listing.is_active) {
      return { status: 'inactive', label: 'Inactive', color: 'secondary' };
    }

    const hasActiveBookings = listing.bookings?.some(
      booking => booking.status === 'confirmed' || booking.status === 'pending'
    );

    const hasPendingNegotiations = listing.negotiations?.some(
      negotiation => negotiation.status === 'pending'
    );

    if (hasActiveBookings) {
      return { status: 'booked', label: 'Booked', color: 'default' };
    }

    if (hasPendingNegotiations) {
      return { status: 'negotiating', label: 'AI Negotiating', color: 'destructive' };
    }

    return { status: 'available', label: 'Available', color: 'default' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'booked':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'negotiating':
        return <MessageCircle className="h-4 w-4 text-orange-500" />;
      case 'inactive':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSupportEmail = () => {
    const subject = encodeURIComponent("Missing Listing - Need Help");
    const body = encodeURIComponent(`Hi Bagsy Support Team,

I believe I posted a listing but it's not showing up in my listings page. Could you please help me check?

User ID: ${user?.id}
Email: ${user?.email}

Thank you!`);
    
    window.open(`mailto:support@bagsy.space?subject=${subject}&body=${body}`);
  };

  const handleSalesEmail = () => {
    const subject = encodeURIComponent("Interested in More Listings - Sales Inquiry");
    const body = encodeURIComponent(`Hi Bagsy Sales Team,

I'm interested in listing more than 5 spaces and would like to discuss partnership or premium options.

Current listings: ${listings.length}
User ID: ${user?.id}
Email: ${user?.email}

Thank you!`);
    
    window.open(`mailto:sales@bagsy.space?subject=${subject}&body=${body}`);
  };

  const handleViewDetails = (listing: SpaceListing) => {
    setSelectedListing(listing);
    setShowDetailedView(true);
  };

  const closeDetailedView = () => {
    setShowDetailedView(false);
    setSelectedListing(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
              <h2 className="text-xl font-semibold">Authentication Required</h2>
              <p className="text-gray-600">
                Please log in to view your listings.
              </p>
              <Button onClick={() => navigate('/')} className="w-full">
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Listings</h1>
            <p className="mt-2 text-gray-600">
              Manage your space listings and track their performance
            </p>
            {listings.length >= 4 && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    You're using {listings.length}/5 free listings. 
                    <button 
                      onClick={handleSalesEmail}
                      className="ml-1 underline hover:no-underline"
                    >
                      Contact sales for more
                    </button>
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            {listings.length < 5 ? (
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>List New Space</span>
              </Button>
            ) : (
              <Button
                onClick={handleSalesEmail}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Mail className="h-4 w-4" />
                <span>Contact Sales</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
            <Button
              onClick={() => navigate('/analytics')}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <MapPin className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Listings</p>
                  <p className="text-2xl font-semibold text-gray-900">{listings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Available</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {listings.filter(l => getListingStatus(l).status === 'available').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <MessageCircle className="h-8 w-8 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">AI Negotiating</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {listings.filter(l => getListingStatus(l).status === 'negotiating').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Booked</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {listings.filter(l => getListingStatus(l).status === 'booked').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listings Grid */}
        {error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h3 className="text-lg font-semibold text-gray-900">Error Loading Listings</h3>
                <p className="text-gray-600">{error}</p>
                <Button onClick={fetchListings} variant="outline">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-6">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">No Listings Yet</h3>
                  <p className="text-gray-600">
                    You haven't created any space listings yet. Create your first listing to get started.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Button onClick={() => navigate('/')} className="flex items-center space-x-2 mx-auto">
                    <Plus className="h-4 w-4" />
                    <span>Create First Listing</span>
                  </Button>
                  
                  <div className="text-sm text-gray-500">or</div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Think you already posted a listing?</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleSupportEmail}
                      className="flex items-center space-x-2 mx-auto"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Contact Support</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const listingStatus = getListingStatus(listing);
              const primaryPhoto = listing.photos?.[0];

              return (
                <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {primaryPhoto && (
                    <div className="aspect-video bg-gray-200">
                      <img
                        src={primaryPhoto.photo_url}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2">{listing.title}</CardTitle>
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="truncate">{listing.address}</span>
                        </div>
                      </div>
                      <Badge variant={listingStatus.color as any} className="ml-2 flex items-center space-x-1">
                        {getStatusIcon(listingStatus.status)}
                        <span>{listingStatus.label}</span>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Price */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Hourly Rate</span>
                        <span className="font-semibold text-lg">
                          {formatPrice(listing.price_per_hour)}
                        </span>
                      </div>

                      {/* Space Type */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Type</span>
                        <span className="text-sm font-medium capitalize">
                          {listing.space_type.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Created Date */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Listed</span>
                        <span className="text-sm">{formatDate(listing.created_at)}</span>
                      </div>

                      {/* AI Negotiation Status */}
                      {listingStatus.status === 'negotiating' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <MessageCircle className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-medium text-orange-800">
                              AI Agent is negotiating with potential renters
                            </span>
                          </div>
                          <p className="text-xs text-orange-600 mt-1">
                            {listing.negotiations?.length || 0} active negotiation(s)
                          </p>
                        </div>
                      )}

                      {/* Active Bookings */}
                      {listingStatus.status === 'booked' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              {listing.bookings?.filter(b => b.status === 'confirmed').length || 0} confirmed booking(s)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleViewDetails(listing)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => navigate(`/listings/${listing.id}/edit`)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Listing View Modal */}
      {showDetailedView && selectedListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Listing Details</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeDetailedView}
                  className="apple-button-secondary"
                >
                  Close
                </Button>
              </div>

              {/* Photo Gallery */}
              {selectedListing.photos && selectedListing.photos.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Photos ({selectedListing.photos.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedListing.photos.map((photo, index) => (
                      <div key={photo.id} className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={photo.photo_url}
                          alt={`${selectedListing.title} - Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{selectedListing.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-600">{selectedListing.description || 'No description provided'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Space Type</span>
                        <p className="text-sm capitalize">{selectedListing.space_type.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Dimensions</span>
                        <p className="text-sm">{selectedListing.dimensions || 'Not specified'}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-500">Location</span>
                      <p className="text-sm flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {selectedListing.address}, {selectedListing.zip_code}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pricing & Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Hourly Rate</span>
                        <p className="text-lg font-semibold">{formatPrice(selectedListing.price_per_hour)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Daily Rate</span>
                        <p className="text-lg font-semibold">
                          {selectedListing.price_per_day ? formatPrice(selectedListing.price_per_day) : 'Not set'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Status</span>
                      <Badge variant={getListingStatus(selectedListing).color as any} className="flex items-center space-x-1">
                        {getStatusIcon(getListingStatus(selectedListing).status)}
                        <span>{getListingStatus(selectedListing).label}</span>
                      </Badge>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-500">Listed</span>
                      <p className="text-sm">{formatDate(selectedListing.created_at)}</p>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-500">Last Updated</span>
                      <p className="text-sm">{formatDate(selectedListing.updated_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Comments from Potential Buyers */}
              {selectedListing.negotiations && selectedListing.negotiations.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Comments & Negotiations ({selectedListing.negotiations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedListing.negotiations.map((negotiation) => (
                        <div key={negotiation.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-gray-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {negotiation.ai_generated ? 'AI Agent' : 'Potential Renter'}
                                </p>
                                <p className="text-xs text-gray-500">{formatDate(negotiation.created_at)}</p>
                              </div>
                            </div>
                            <Badge variant={
                              negotiation.status === 'accepted' ? 'default' :
                              negotiation.status === 'rejected' ? 'destructive' :
                              negotiation.status === 'countered' ? 'secondary' : 'outline'
                            }>
                              {negotiation.status}
                            </Badge>
                          </div>
                          
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700">Offer: </span>
                            <span className="text-sm font-semibold text-green-600">
                              {formatPrice(negotiation.offer_price)}/hour
                            </span>
                          </div>
                          
                          {negotiation.message && (
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              "{negotiation.message}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bookings */}
              {selectedListing.bookings && selectedListing.bookings.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      Bookings ({selectedListing.bookings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedListing.bookings.map((booking) => (
                        <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Booking #{booking.id.slice(0, 8)}</p>
                                <p className="text-xs text-gray-500">{formatDate(booking.created_at)}</p>
                              </div>
                            </div>
                            <Badge variant={
                              booking.status === 'confirmed' ? 'default' :
                              booking.status === 'completed' ? 'secondary' :
                              booking.status === 'cancelled' ? 'destructive' : 'outline'
                            }>
                              {booking.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Duration:</span>
                              <p>{formatDate(booking.start_time)} - {formatDate(booking.end_time)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Price:</span>
                              <p className="font-semibold">{formatPrice(booking.total_price)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/listings/${selectedListing.id}/edit`)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Edit Listing
                </Button>
                <Button
                  onClick={closeDetailedView}
                  className="apple-button-primary"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyListings;
