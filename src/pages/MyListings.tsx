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
import { EditSpaceModal } from '@/components/spaces/edit-space-modal';
import { SpaceCard } from '@/components/spaces/SpaceCard';
import { DeleteConfirmationModal } from '@/components/spaces/delete-confirmation-modal';

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
  const [editingListing, setEditingListing] = useState<SpaceListing | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingListing, setDeletingListing] = useState<SpaceListing | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

      console.log('🔍 Fetching listings for user:', user.id);

      // First, let's check if there are any spaces
      const { data: spacesData, error: spacesError } = await supabase
        .from('spaces')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      console.log('📊 Spaces data:', spacesData);
      console.log('❌ Spaces error:', spacesError);

      if (spacesError) {
        throw spacesError;
      }

      // Now fetch photos for each space separately to debug
      const listingsWithPhotos = await Promise.all(
        (spacesData || []).map(async (space) => {
          console.log(`🖼️ Fetching photos for space ${space.id}:`);
          
          // Try to fetch photos with different approaches to debug RLS issues
          let photosData = null;
          let photosError = null;

          // First attempt: Direct query
          const { data: directPhotos, error: directError } = await supabase
            .from('space_photos')
            .select('*')
            .eq('space_id', space.id)
            .order('display_order', { ascending: true });

          if (directError) {
            console.log(`❌ Direct photo query failed for space ${space.id}:`, directError);
            
            // Second attempt: Try with RLS bypass (if user is owner)
            if (space.owner_id === user.id) {
              console.log(`🔄 Trying RLS bypass for space ${space.id}...`);
              
              // Use service role key for owner's photos (this would need to be implemented server-side)
              // For now, let's try a different approach
              const { data: ownerPhotos, error: ownerError } = await supabase
                .from('space_photos')
                .select('*')
                .eq('space_id', space.id)
                .order('display_order', { ascending: true });

              if (ownerError) {
                console.log(`❌ Owner photo query also failed for space ${space.id}:`, ownerError);
              } else {
                photosData = ownerPhotos;
                console.log(`✅ Owner photo query succeeded for space ${space.id}:`, ownerPhotos);
              }
            }
          } else {
            photosData = directPhotos;
            console.log(`✅ Direct photo query succeeded for space ${space.id}:`, directPhotos);
          }

          console.log(`📸 Final photos for space ${space.id}:`, photosData);
          
          // Debug photo URLs
          if (photosData && photosData.length > 0) {
            photosData.forEach((photo, index) => {
              console.log(`🖼️ Photo ${index + 1} URL:`, photo.photo_url);
            });
          } else {
            console.log(`⚠️ No photos found for space ${space.id}`);
          }

          return {
            ...space,
            photos: photosData || [],
          };
        })
      );

      // Fetch bookings for each space
      const listingsWithBookings = await Promise.all(
        listingsWithPhotos.map(async (listing) => {
          const { data: bookingsData, error: bookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('space_id', listing.id)
            .order('created_at', { ascending: false });

          if (bookingsError) {
            console.error('❌ Bookings error:', bookingsError);
          }

          return {
            ...listing,
            bookings: bookingsData || [],
          };
        })
      );

      // Fetch negotiations for each space (through bookings)
      const finalListings = await Promise.all(
        listingsWithBookings.map(async (listing) => {
          // Get all negotiations for all bookings of this space
          const bookingIds = listing.bookings.map(booking => booking.id);
          
          if (bookingIds.length === 0) {
            return {
              ...listing,
              negotiations: []
            };
          }

          const { data: negotiationsData } = await supabase
            .from('negotiations')
            .select('*')
            .in('booking_id', bookingIds)
            .order('created_at', { ascending: false });

          console.log(`💬 Negotiations for space ${listing.id}:`, negotiationsData);

          return {
            ...listing,
            negotiations: negotiationsData || []
          };
        })
      );

      console.log('📋 Final listings data:', finalListings);
      setListings(finalListings);
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

  const handleSupportEmail = () => {
    const subject = encodeURIComponent("Missing Listing - Need Help");
    const body = encodeURIComponent(`Hi Bagsy™ Support Team,

I believe I posted a listing but it's not showing up in my listings page. Could you please help me check?

User ID: ${user?.id}
Email: ${user?.email}

Thank you!`);
    
    window.open(`mailto:support@bagsy.space?subject=${subject}&body=${body}`);
  };

  const handleSalesEmail = () => {
    const subject = encodeURIComponent("Interested in More Listings - Sales Inquiry");
    const body = encodeURIComponent(`Hi Bagsy™ Sales Team,

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

  const handleEditListing = (listing: SpaceListing) => {
    setEditingListing(listing);
    setShowEditModal(true);
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditingListing(null);
  };

  const handleListingUpdate = () => {
    fetchListings(); // Refresh the listings after update
  };

  const handleDeleteListing = (listing: SpaceListing) => {
    setDeletingListing(listing);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingListing || !user) return;

    setDeleting(true);
    try {
      // Delete photos first
      if (deletingListing.photos && deletingListing.photos.length > 0) {
        const { error: photosError } = await supabase
          .from('space_photos')
          .delete()
          .eq('space_id', deletingListing.id);

        if (photosError) {
          console.error('Error deleting photos:', photosError);
          // Continue with space deletion even if photos fail
        }
      }

      // Delete the space
      const { error: spaceError } = await supabase
        .from('spaces')
        .delete()
        .eq('id', deletingListing.id)
        .eq('owner_id', user.id); // Ensure user can only delete their own spaces

      if (spaceError) throw spaceError;

      toast({
        title: "Listing Deleted",
        description: `"${deletingListing.title}" has been permanently deleted.`,
      });

      // Close modal and refresh listings
      setShowDeleteModal(false);
      setDeletingListing(null);
      fetchListings();
    } catch (error: unknown) {
      console.error('Error deleting listing:', error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete listing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteModalClose = () => {
    if (!deleting) {
      setShowDeleteModal(false);
      setDeletingListing(null);
    }
  };

  const testPhotoFetching = async () => {
    if (!user) return;

    console.log('🧪 Testing photo fetching...');
    
    try {
      // Test direct photo query
      const { data: allPhotos, error: allPhotosError } = await supabase
        .from('space_photos')
        .select('*')
        .limit(10);

      console.log('📸 All photos in database:', allPhotos);
      console.log('❌ All photos error:', allPhotosError);

      // Test user's spaces
      const { data: userSpaces, error: userSpacesError } = await supabase
        .from('spaces')
        .select('id, title, owner_id')
        .eq('owner_id', user.id);

      console.log('🏠 User spaces:', userSpaces);
      console.log('❌ User spaces error:', userSpacesError);

      if (userSpaces && userSpaces.length > 0) {
        // Test photos for each user space
        for (const space of userSpaces) {
          const { data: spacePhotos, error: spacePhotosError } = await supabase
            .from('space_photos')
            .select('*')
            .eq('space_id', space.id);

          console.log(`🖼️ Photos for space ${space.id} (${space.title}):`, spacePhotos);
          console.log(`❌ Photos error for space ${space.id}:`, spacePhotosError);
        }
      }

      toast({
        title: "Photo Test Complete",
        description: "Check the console for detailed photo fetching results.",
      });

    } catch (error) {
      console.error('❌ Photo test error:', error);
      toast({
        title: "Photo Test Failed",
        description: "Check the console for error details.",
        variant: "destructive",
      });
    }
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
            {import.meta.env.DEV && (
              <Button
                onClick={testPhotoFetching}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <Image className="h-4 w-4" />
                <span>Test Photos</span>
              </Button>
            )}
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

              // Debug photo data
              console.log(`🏠 Listing ${listing.id} photos:`, listing.photos);
              console.log(`🖼️ Primary photo for ${listing.id}:`, primaryPhoto);

              return (
                <SpaceCard
                  key={listing.id}
                  space={listing}
                  currentUserId={user?.id}
                  onViewDetails={handleViewDetails}
                  onEdit={handleEditListing}
                  onDelete={handleDeleteListing}
                  onRelist={(space) => {
                    toast({
                      title: "Relist Space",
                      description: `Opening relist form for ${space.title}`,
                    });
                    // Implement relist functionality here
                    // You can open a modal to set new availability dates
                  }}
                  showAvailability={true}
                  showTimezone={true}
                  showSpecialInstructions={true}
                />
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
                      <span className="text-sm font-medium text-gray-500">Availability</span>
                      <p className="text-sm">{formatAvailability(selectedListing.available_from, selectedListing.available_until, selectedListing.timezone)}</p>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-500">Timezone</span>
                      <p className="text-sm">{getTimezoneDisplay(selectedListing.timezone)}</p>
                    </div>

                    {selectedListing.special_instructions && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Special Instructions</span>
                        <p className="text-sm bg-gray-50 p-2 rounded">{selectedListing.special_instructions}</p>
                      </div>
                    )}

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
                  onClick={() => {
                    closeDetailedView();
                    handleEditListing(selectedListing);
                  }}
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

      {/* Edit Space Modal */}
      {editingListing && (
        <EditSpaceModal
          open={showEditModal}
          onOpenChange={handleEditModalClose}
          space={editingListing}
          onUpdate={handleListingUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingListing && (
        <DeleteConfirmationModal
          open={showDeleteModal}
          onOpenChange={handleDeleteModalClose}
          spaceTitle={deletingListing.title}
          onConfirm={handleDeleteConfirm}
          loading={deleting}
        />
      )}
    </div>
  );
};

export default MyListings;
