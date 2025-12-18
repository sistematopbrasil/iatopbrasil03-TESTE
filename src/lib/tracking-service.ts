import { supabase } from '@/integrations/supabase/client';
import type { TrackingData } from '@/hooks/useTracking';

export interface SaveTrackingResult {
  success: boolean;
  sessionId: string | null;
  error?: string;
}

/**
 * Save tracking session to database
 */
export async function saveTrackingSession(
  organizationId: string,
  trackingData: TrackingData
): Promise<SaveTrackingResult> {
  try {
    const { data, error } = await supabase
      .from('tracking_sessions')
      .insert({
        organization_id: organizationId,
        session_id: trackingData.session_id,
        utm_source: trackingData.utm_source,
        utm_medium: trackingData.utm_medium,
        utm_campaign: trackingData.utm_campaign,
        utm_content: trackingData.utm_content,
        utm_term: trackingData.utm_term,
        referrer: trackingData.referrer,
        landing_page: trackingData.landing_page,
        device_type: trackingData.device_type,
        browser: trackingData.browser,
        os: trackingData.os,
        user_agent: trackingData.user_agent,
        ip_address: trackingData.ip_address,
      })
      .select('session_id')
      .single();

    if (error) {
      // If duplicate session, it's okay - just return success
      if (error.code === '23505') { // Unique violation
        return { success: true, sessionId: trackingData.session_id };
      }
      throw error;
    }

    return { success: true, sessionId: data.session_id };
  } catch (error) {
    console.error('Error saving tracking session:', error);
    return { 
      success: false, 
      sessionId: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Update tracking session with submission ID
 */
export async function linkTrackingToSubmission(
  sessionId: string,
  submissionId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tracking_sessions')
      .update({ 
        submission_id: submissionId,
        last_activity_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error linking tracking to submission:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in linkTrackingToSubmission:', error);
    return false;
  }
}

/**
 * Update last activity timestamp
 */
export async function updateTrackingActivity(sessionId: string): Promise<void> {
  try {
    await supabase
      .from('tracking_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('session_id', sessionId);
  } catch (error) {
    console.error('Error updating tracking activity:', error);
  }
}

/**
 * Get organization ID by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('Error fetching organization:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error in getOrganizationBySlug:', error);
    return null;
  }
}

/**
 * Get default organization (TOP Brasil)
 */
export async function getDefaultOrganization(): Promise<string | null> {
  return getOrganizationBySlug('topbrasil');
}
