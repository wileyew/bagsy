// Test Data Seeding Script for Bagsy Booking System
// Run this in the browser console after logging in

import { supabase } from "../src/integrations/supabase/client";

export async function seedTestData() {
  console.log('🌱 Starting test data seeding...');

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('✓ User authenticated:', user.email);

    // Create test spaces
    const testSpaces = [
      {
        title: "Downtown SF Garage - Near Moscone Center",
        description: "Spacious garage perfect for storing boats, RVs, or vehicles. Secure gated access, 24/7 availability during booking period.",
        space_type: "garage",
        address: "123 Mission St, San Francisco, CA 94103",
        zip_code: "94103",
        price_per_hour: 8.50,
        price_per_day: 150,
        dimensions: "20x15 feet",
        available_from: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        available_until: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 days
        timezone: "America/Los_Angeles",
        special_instructions: "Gate code: 1234. Enter through main entrance.",
        owner_id: user.id,
        is_active: true,
      },
      {
        title: "Marina District Driveway",
        description: "Convenient driveway parking near Marina Green. Perfect for daily commuters or event parking.",
        space_type: "driveway",
        address: "456 Bay St, San Francisco, CA 94123",
        zip_code: "94123",
        price_per_hour: 5.00,
        price_per_day: 85,
        dimensions: "10x20 feet",
        available_from: new Date().toISOString(),
        available_until: new Date(Date.now() + 86400000 * 60).toISOString(), // 60 days
        timezone: "America/Los_Angeles",
        owner_id: user.id,
        is_active: true,
      },
      {
        title: "Financial District Underground Parking",
        description: "Secure underground parking space in the heart of FiDi. Perfect for business professionals.",
        space_type: "parking_spot",
        address: "789 Market St, San Francisco, CA 94102",
        zip_code: "94102",
        price_per_hour: 12.00,
        price_per_day: 200,
        dimensions: "9x18 feet",
        available_from: new Date().toISOString(),
        available_until: new Date(Date.now() + 86400000 * 90).toISOString(), // 90 days
        timezone: "America/Los_Angeles",
        owner_id: user.id,
        is_active: true,
      },
    ];

    console.log('Creating test spaces...');
    const { data: spaces, error: spacesError } = await supabase
      .from('spaces')
      .insert(testSpaces)
      .select();

    if (spacesError) throw spacesError;
    console.log(`✓ Created ${spaces.length} test spaces`);

    // Create a mock booking scenario
    if (spaces && spaces.length > 0) {
      const testSpace = spaces[0];
      
      // Create a pending booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          space_id: testSpace.id,
          renter_id: user.id,
          owner_id: user.id, // Self-booking for testing
          start_time: new Date(Date.now() + 86400000).toISOString(),
          end_time: new Date(Date.now() + 86400000 * 2).toISOString(),
          status: 'pending',
          original_price: testSpace.price_per_hour,
          final_price: testSpace.price_per_hour,
          total_price: testSpace.price_per_hour * 24, // 1 day
          payment_status: 'pending',
          legal_compliance_checked: true,
          legal_compliance_status: 'allowed',
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      console.log('✓ Created test booking');

      // Create negotiation offers
      const negotiations = [
        {
          booking_id: booking.id,
          from_user_id: user.id,
          to_user_id: user.id,
          offer_price: testSpace.price_per_hour - 1,
          message: "Would you consider $7.50/hour? I'm a regular customer.",
          status: 'pending',
        },
        {
          booking_id: booking.id,
          from_user_id: user.id,
          to_user_id: user.id,
          offer_price: testSpace.price_per_hour - 0.50,
          message: "How about $8/hour? That's fair for both of us.",
          status: 'countered',
        },
      ];

      const { error: negError } = await supabase
        .from('negotiations')
        .insert(negotiations);

      if (negError) console.warn('Negotiation creation warning:', negError);
      else console.log('✓ Created test negotiations');

      // Create test notifications
      const notifications = [
        {
          user_id: user.id,
          type: 'booking_request',
          title: 'New Booking Request',
          message: `You have a new booking request for "${testSpace.title}"`,
          data: { bookingId: booking.id },
          read: false,
        },
        {
          user_id: user.id,
          type: 'negotiation_offer',
          title: 'New Price Offer',
          message: 'A renter has made a counter-offer on your listing',
          data: { bookingId: booking.id },
          read: false,
        },
      ];

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) console.warn('Notification creation warning:', notifError);
      else console.log('✓ Created test notifications');
    }

    console.log('✅ Test data seeding complete!');
    console.log('\nℹ️  You now have:');
    console.log('- 3 test space listings');
    console.log('- 1 pending booking with negotiations');
    console.log('- Sample notifications');
    console.log('\nNavigate to My Bookings to see the test booking!');

    return { success: true, message: 'Test data created successfully!' };
  } catch (error: any) {
    console.error('❌ Seeding failed:', error);
    return { success: false, error: error.message };
  }
}

// Make it available globally for easy console access
(window as any).seedTestData = seedTestData;

console.log('💡 Run seedTestData() in the console to create test data');

