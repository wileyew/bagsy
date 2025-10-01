import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, DollarSign, MapPin, Home, MessageCircle, FileText, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NegotiationPanel } from '@/components/bookings/negotiation-panel';
import { PaymentForm } from '@/components/bookings/payment-form';
import { AgreementSignature } from '@/components/bookings/agreement-signature';

const MyBookings = () => {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch bookings as renter
      const { data: renterBookings, error: renterError } = await supabase
        .from('bookings')
        .select(`
          *,
          spaces:space_id (
            id,
            title,
            address,
            space_type
          )
        `)
        .eq('renter_id', user.id)
        .order('created_at', { ascending: false });

      if (renterError) throw renterError;

      // Fetch bookings as owner
      const { data: ownerBookings, error: ownerError } = await supabase
        .from('bookings')
        .select(`
          *,
          spaces:space_id (
            id,
            title,
            address,
            space_type
          )
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (ownerError) throw ownerError;

      setBookings([...(renterBookings || []), ...(ownerBookings || [])]);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (booking: any) => {
    // Fetch additional details
    const [negotiations, agreement] = await Promise.all([
      supabase
        .from('negotiations')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('agreements')
        .select('*')
        .eq('booking_id', booking.id)
        .single()
    ]);

    setSelectedBooking({
      ...booking,
      negotiations: negotiations.data || [],
      agreement: agreement.data
    });
    setView('detail');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      pending: { label: 'Pending', variant: 'secondary' },
      negotiating: { label: 'Negotiating', variant: 'default' },
      accepted: { label: 'Accepted', variant: 'default' },
      confirmed: { label: 'Confirmed', variant: 'default' },
      active: { label: 'Active', variant: 'default' },
      completed: { label: 'Completed', variant: 'outline' },
      cancelled: { label: 'Cancelled', variant: 'destructive' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-gray-600">Please log in to view your bookings.</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedBooking) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => {
                setView('list');
                setSelectedBooking(null);
              }}
            >
              ← Back to Bookings
            </Button>
          </div>

          <div className="space-y-6">
            {/* Booking Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedBooking.spaces?.title}</span>
                  {getStatusBadge(selectedBooking.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{selectedBooking.spaces?.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedBooking.start_time).toLocaleString()} - {new Date(selectedBooking.end_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Total Price</p>
                      <p className="text-sm text-muted-foreground">${selectedBooking.total_price?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Negotiations */}
            {selectedBooking.negotiations && selectedBooking.negotiations.length > 0 && (
              <NegotiationPanel
                booking={selectedBooking}
                negotiations={selectedBooking.negotiations}
                onUpdate={fetchBookings}
              />
            )}

            {/* Agreement Signature */}
            {selectedBooking.agreement && (
              <AgreementSignature
                agreement={selectedBooking.agreement}
                booking={selectedBooking}
                onSigned={() => handleViewDetails(selectedBooking)}
              />
            )}

            {/* Payment */}
            {selectedBooking.status === 'accepted' && 
             selectedBooking.agreement?.fully_executed && 
             selectedBooking.payment_status !== 'succeeded' &&
             user.id === selectedBooking.renter_id && (
              <PaymentForm
                booking={selectedBooking}
                onPaymentComplete={() => {
                  fetchBookings();
                  setView('list');
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Bookings</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Manage your rental bookings
            </p>
          </div>
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            <span className="hidden xs:inline">Back to Home</span>
            <span className="xs:hidden">Home</span>
          </Button>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Bookings Yet</h3>
              <p className="text-gray-600 mb-4">
                Start by booking a space or listing your own!
              </p>
              <Button onClick={() => navigate('/')}>
                Browse Spaces
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-lg">{booking.spaces?.title}</h3>
                        {getStatusBadge(booking.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{booking.spaces?.address}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(booking.start_time).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          <span>${booking.total_price?.toFixed(2)}</span>
                        </div>
                      </div>
                      {booking.license_plate && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">License Plate:</span>{' '}
                          <span className="font-mono font-semibold">{booking.license_plate}</span>
                        </div>
                      )}
                    </div>
                    <Button onClick={() => handleViewDetails(booking)}>
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;

