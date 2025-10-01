import { createComponentDebugger } from "./debug-utils";
import { supabase } from "@/integrations/supabase/client";

const debug = createComponentDebugger('NotificationService');

export type NotificationType = 
  | 'booking_request'
  | 'negotiation_offer'
  | 'agreement_ready'
  | 'payment_received'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'legal_alert';

export interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  sendEmail?: boolean;
  sendSMS?: boolean;
}

class NotificationService {
  /**
   * Send a notification to a user
   */
  async sendNotification(notification: NotificationData): Promise<void> {
    debug.info('Sending notification', notification);

    try {
      // Create notification in database
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          email_sent: false,
          sms_sent: false,
          read: false
        });

      if (error) throw error;

      // In production, trigger email/SMS sending via Supabase Edge Functions or external service
      if (notification.sendEmail) {
        await this.sendEmail(notification);
      }

      if (notification.sendSMS) {
        await this.sendSMS(notification);
      }

      debug.info('Notification sent successfully');
    } catch (error) {
      debug.error('Failed to send notification', error);
      throw error;
    }
  }

  /**
   * Send booking request notification to owner
   */
  async notifyBookingRequest(ownerId: string, bookingId: string, renterName: string, spaceName: string): Promise<void> {
    await this.sendNotification({
      userId: ownerId,
      type: 'booking_request',
      title: 'New Booking Request',
      message: `${renterName} has requested to book your space "${spaceName}"`,
      data: { bookingId, renterName, spaceName },
      sendEmail: true
    });
  }

  /**
   * Send negotiation offer notification
   */
  async notifyNegotiationOffer(
    userId: string,
    negotiationId: string,
    fromUserName: string,
    offerPrice: number,
    message?: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'negotiation_offer',
      title: 'New Price Offer',
      message: `${fromUserName} has offered $${offerPrice.toFixed(2)}${message ? `: "${message}"` : ''}`,
      data: { negotiationId, fromUserName, offerPrice, message },
      sendEmail: true
    });
  }

  /**
   * Send agreement ready notification
   */
  async notifyAgreementReady(userId: string, bookingId: string, agreementId: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'agreement_ready',
      title: 'Agreement Ready to Sign',
      message: 'Your rental agreement is ready for signature. Please review and sign.',
      data: { bookingId, agreementId },
      sendEmail: true,
      sendSMS: true
    });
  }

  /**
   * Send payment received notification
   */
  async notifyPaymentReceived(ownerId: string, bookingId: string, amount: number, renterName: string): Promise<void> {
    await this.sendNotification({
      userId: ownerId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `Payment of $${amount.toFixed(2)} received from ${renterName}`,
      data: { bookingId, amount, renterName },
      sendEmail: true
    });
  }

  /**
   * Send booking confirmed notification
   */
  async notifyBookingConfirmed(
    userId: string,
    bookingId: string,
    spaceName: string,
    startTime: string,
    endTime: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      message: `Your booking for "${spaceName}" is confirmed from ${new Date(startTime).toLocaleDateString()} to ${new Date(endTime).toLocaleDateString()}`,
      data: { bookingId, spaceName, startTime, endTime },
      sendEmail: true,
      sendSMS: true
    });
  }

  /**
   * Send legal compliance alert
   */
  async notifyLegalAlert(
    userId: string,
    bookingId: string,
    complianceStatus: string,
    details: string
  ): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'legal_alert',
      title: 'Legal Compliance Alert',
      message: `Legal status: ${complianceStatus}. ${details}`,
      data: { bookingId, complianceStatus, details },
      sendEmail: true
    });
  }

  /**
   * Mock email sending (in production, use Supabase Edge Functions + SendGrid/AWS SES)
   */
  private async sendEmail(notification: NotificationData): Promise<void> {
    debug.debug('Sending email notification', notification);
    
    // In production, this would call an email service
    // For now, just log it
    console.log('📧 Email would be sent:', {
      to: notification.userId,
      subject: notification.title,
      body: notification.message
    });

    // Update notification as email sent
    await supabase
      .from('notifications')
      .update({ email_sent: true })
      .eq('user_id', notification.userId)
      .eq('type', notification.type)
      .order('created_at', { ascending: false })
      .limit(1);
  }

  /**
   * Mock SMS sending (in production, use Twilio/AWS SNS)
   */
  private async sendSMS(notification: NotificationData): Promise<void> {
    debug.debug('Sending SMS notification', notification);
    
    // In production, this would call an SMS service
    console.log('📱 SMS would be sent:', {
      to: notification.userId,
      message: `${notification.title}: ${notification.message}`
    });

    // Update notification as SMS sent
    await supabase
      .from('notifications')
      .update({ sms_sent: true })
      .eq('user_id', notification.userId)
      .eq('type', notification.type)
      .order('created_at', { ascending: false })
      .limit(1);
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      debug.error('Failed to fetch notifications', error);
      return [];
    }

    return data || [];
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      debug.error('Failed to mark notification as read', error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      debug.error('Failed to get unread count', error);
      return 0;
    }

    return count || 0;
  }
}

export const notificationService = new NotificationService();

