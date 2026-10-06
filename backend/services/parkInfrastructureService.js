const { supabaseAdmin } = require('../supabaseClient');

class ParkInfrastructureService {
  /**
   * Get Dynamic Staging Posts & Checkpoints for a Park
   */
  async getStagingPosts(parkId = 1) {
    const parkIdInt = parseInt(parkId, 10);
    const postMap = new Map();

    const stationedCount = {};
    try {
      const { data: rangers } = await supabaseAdmin
        .from('rangers')
        .select('base_location_name, current_status')
        .eq('assigned_park_id', parkIdInt);

      if (rangers) {
        for (const r of rangers) {
          if (r.base_location_name) {
            stationedCount[r.base_location_name] = (stationedCount[r.base_location_name] || 0) + 1;
          }
        }
      }
    } catch (err) {
      console.warn('Could not query rangers for outpost personnel count:', err.message);
    }

    try {
      const { data: dbPosts } = await supabaseAdmin
        .from('staging_posts')
        .select('*')
        .eq('park_id', parkIdInt)
        .order('id', { ascending: true });

      if (dbPosts && dbPosts.length > 0) {
        for (const p of dbPosts) {
          postMap.set(p.name, {
            id: p.id,
            name: p.name,
            lat: p.latitude,
            lng: p.longitude,
            post_type: p.post_type || 'FORWARD_OUTPOST',
            stationed_count: stationedCount[p.name] || 0,
            source: 'Commissioned Outpost'
          });
        }
      }
    } catch (err) {
      console.warn('Could not query staging_posts table:', err.message);
    }

    try {
      const { data: routes } = await supabaseAdmin
        .from('patrol_routes')
        .select('route_name, checkpoints')
        .eq('park_id', parkIdInt);

      if (routes && routes.length > 0) {
        for (const route of routes) {
          if (Array.isArray(route.checkpoints)) {
            for (const cp of route.checkpoints) {
              if (cp.name && cp.lat && cp.lng) {
                const cleanName = cp.name.replace(/^WP-\d+\s*/, '').trim();
                if (!postMap.has(cleanName)) {
                  postMap.set(cleanName, {
                    name: cleanName,
                    lat: cp.lat,
                    lng: cp.lng,
                    post_type: 'SECTOR_CHECKPOINT',
                    stationed_count: stationedCount[cleanName] || 0,
                    source: `Route Checkpoint (${route.route_name})`
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not query patrol_routes checkpoints:', err.message);
    }

    const primaryGates = {
      1: [
        { name: 'Palatupana Headquarters (Main Gate)', lat: 6.3685, lng: 81.5190, post_type: 'MAIN_HEADQUARTERS', source: 'Primary Park Headquarters' },
        { name: 'Katagamuwa Entrance Post (Block 1)', lat: 6.4150, lng: 81.4720, post_type: 'ENTRANCE_POST', source: 'Major Sector Gate' },
        { name: 'Kumbukkan Oya Outpost (Riverine)', lat: 6.5200, lng: 81.6800, post_type: 'RIVERINE_OUTPOST', source: 'Riverine Border Post' },
        { name: 'Sithulpawwa Staging Post', lat: 6.4350, lng: 81.4500, post_type: 'SANCTUARY_POST', source: 'Sanctuary Post' }
      ],
      2: [
        { name: 'Hunuwilagama Base Gate', lat: 8.4100, lng: 80.0100, post_type: 'MAIN_HEADQUARTERS', source: 'Primary Park Headquarters' },
        { name: 'Maradanmaduwa Forward Base', lat: 8.4350, lng: 80.0400, post_type: 'FORWARD_OUTPOST', source: 'Internal Station' },
        { name: 'Kokmote River Camp', lat: 8.4850, lng: 80.0550, post_type: 'RIVERINE_OUTPOST', source: 'Riverine Camp' }
      ],
      3: [
        { name: 'Park HQ Gate (Thanamalwila)', lat: 6.4350, lng: 80.8700, post_type: 'MAIN_HEADQUARTERS', source: 'Primary Park Headquarters' },
        { name: 'Dam Crest Observation Post', lat: 6.4650, lng: 80.8650, post_type: 'FORWARD_OUTPOST', source: 'Reservoir Station' },
        { name: 'Mau Ara Fence Post', lat: 6.4520, lng: 80.8950, post_type: 'BORDER_CHECKPOINT', source: 'Boundary Outpost' }
      ]
    };

    const fallbackList = primaryGates[parkIdInt] || primaryGates[1];
    for (const gate of fallbackList) {
      if (!postMap.has(gate.name)) {
        postMap.set(gate.name, {
          ...gate,
          stationed_count: stationedCount[gate.name] || 0
        });
      }
    }

    return Array.from(postMap.values());
  }

  /**
   * Commission a New Staging Outpost or Checkpoint (Park Manager Authority)
   */
  async createStagingPost(payload) {
    const { parkId = 1, name, latitude, longitude, postType = 'FORWARD_OUTPOST' } = payload;
    if (!name || latitude === undefined || longitude === undefined) {
      throw new Error('Outpost Name, Latitude, and Longitude are mandatory to establish an infrastructure post.');
    }

    const parkIdInt = parseInt(parkId, 10);
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Valid numeric coordinates (Latitude and Longitude) are required.');
    }

    const { data, error } = await supabaseAdmin
      .from('staging_posts')
      .insert({
        park_id: parkIdInt,
        name: name.trim(),
        latitude: lat,
        longitude: lng,
        post_type: postType || 'FORWARD_OUTPOST'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to commission outpost in database: ${error.message}`);
    }

    return data;
  }

  /**
   * Decommission a Staging Post
   */
  async deleteStagingPost(postId) {
    const { data, error } = await supabaseAdmin
      .from('staging_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      throw new Error(`Failed to decommission outpost: ${error.message}`);
    }

    return { success: true, id: postId };
  }

  /**
   * Get Park Settings & Thresholds
   */
  async getParkSettings(parkId = 1) {
    const { data, error } = await supabaseAdmin
      .from('park_settings')
      .select('*')
      .eq('park_id', parkId)
      .single();

    if (error || !data) {
      return {
        park_id: parkId,
        acoustic_spike_threshold: 3,
        max_ranger_workload: 5,
        unmonitored_blindspot_hours: 72,
        telemetry_interval_mins: 45,
        target_coverage_percent: 90
      };
    }
    return data;
  }

  /**
   * Update Park Settings & Thresholds
   */
  async updateParkSettings(parkId, settings) {
    const {
      acoustic_spike_threshold,
      max_ranger_workload,
      unmonitored_blindspot_hours,
      telemetry_interval_mins,
      target_coverage_percent
    } = settings;

    const { data, error } = await supabaseAdmin
      .from('park_settings')
      .upsert({
        park_id: parkId,
        acoustic_spike_threshold: parseInt(acoustic_spike_threshold, 10) || 3,
        max_ranger_workload: parseInt(max_ranger_workload, 10) || 5,
        unmonitored_blindspot_hours: parseInt(unmonitored_blindspot_hours, 10) || 72,
        telemetry_interval_mins: parseInt(telemetry_interval_mins, 10) || 45,
        target_coverage_percent: parseInt(target_coverage_percent, 10) || 90,
        updated_at: new Date().toISOString()
      }, { onConflict: 'park_id' })
      .select()
      .single();

    if (error) throw new Error(`Update settings failed: ${error.message}`);
    return data;
  }
}

module.exports = new ParkInfrastructureService();
