const { supabaseAdmin } = require('../supabaseClient');
const constants = require('../utils/constants');

class RangerService {
  /**
   * Commission / Register New Ranger (Real Field Ranger Commissioning)
   */
  async registerRanger(payload) {
    const {
      fullName,
      badgeNumber,
      callsign,
      assignedParkId = 1,
      email,
      password,
      baseLocationName,
      baseLat,
      baseLng,
      certifications,
      maxActiveAssignments = 5
    } = payload;

    if (!fullName || !badgeNumber || !callsign) {
      throw new Error('Full Name, Badge Number, and Callsign are mandatory for commissioning.');
    }

    let targetLat = baseLat ? parseFloat(baseLat) : null;
    let targetLng = baseLng ? parseFloat(baseLng) : null;

    if (!targetLat || !targetLng) {
      if (baseLocationName) {
        const lower = baseLocationName.toLowerCase();
        for (const [key, coords] of Object.entries(constants.STAGING_OUTPOSTS)) {
          if (lower.includes(key)) {
            targetLat = coords.lat;
            targetLng = coords.lng;
            break;
          }
        }
      }
    }

    if (!targetLat || !targetLng) {
      const def = constants.PARK_CENTERS[assignedParkId] || constants.PARK_CENTERS[1];
      targetLat = def.lat;
      targetLng = def.lng;
    }

    let authUserId = null;
    if (email && password) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, callsign, role: 'wildlife_officer' }
        });
        if (authUser?.user) {
          authUserId = authUser.user.id;
        }
      } catch (authErr) {
        console.warn('Auth user creation warning (proceeding with ranger record):', authErr.message);
      }
    }

    const { data: newRanger, error: insertErr } = await supabaseAdmin
      .from('rangers')
      .insert([{
        user_id: authUserId,
        badge_number: badgeNumber,
        full_name: fullName,
        callsign: callsign,
        assigned_park_id: assignedParkId,
        current_status: 'AVAILABLE',
        current_lat: targetLat,
        current_lng: targetLng,
        base_location_name: baseLocationName || 'Katagamuwa Entrance Post',
        active_assignments_count: 0,
        max_active_assignments: parseInt(maxActiveAssignments, 10) || 5,
        is_rest_compliant: true,
        certifications: certifications || ['Riverine & Night Tracker', 'First Aid Certified'],
        last_location_update: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertErr) throw new Error(`Ranger commissioning failed: ${insertErr.message}`);
    return newRanger;
  }

  /**
   * Update Ranger Status (Available, On Shift, Resting, etc.)
   */
  async updateRangerStatus(rangerId, status) {
    const { data, error } = await supabaseAdmin
      .from('rangers')
      .update({
        current_status: status,
        last_location_update: new Date().toISOString()
      })
      .eq('id', rangerId)
      .select()
      .single();

    if (error) throw new Error(`Status update failed: ${error.message}`);
    return data;
  }

  /**
   * Get Rangers for a Park
   */
  async getRangersByPark(parkId = 1) {
    const { data, error } = await supabaseAdmin
      .from('rangers')
      .select('*')
      .eq('assigned_park_id', parkId)
      .order('id', { ascending: true });

    if (error) throw new Error(`Fetch rangers failed: ${error.message}`);
    return data;
  }
}

module.exports = new RangerService();
