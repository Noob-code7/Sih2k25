const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const { connectMongo } = require('./config/mongo');
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

// Serve static files (so /social.html loads in browser)
app.use(express.static(path.join(__dirname, '..')));

const socialMediaRoutes = require('./routes/socialMedia');
app.use('/api/social', socialMediaRoutes);
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
// Mongo connection (optional; only if env provided)
if (process.env.MONGO_URI) {
  connectMongo(process.env.MONGO_URI).then(() => {
    console.log('MongoDB connected');
  }).catch((e) => console.error('MongoDB connection failed', e.message));
  try {
    const uploadsRoutes = require('./routes/uploads');
    app.use('/api/uploads', uploadsRoutes);
  } catch (_) {}
}

// ----- Ocean hazard social feed (mock + filtering) -----
const OCEAN_HAZARD_KEYWORDS = [
    '#Tsunami', '#TsunamiAlert', '#TsunamiWarning',
    '#Hurricane', '#Cyclone', '#Typhoon', '#StormSurge',
    '#CoastalFlooding', '#FloodWarning', '#FlashFlood',
    '#OceanHazard', '#MarineHazard', '#MarineDisaster',
    '#OilSpill', '#MarineOilSpill', '#OceanPollution',
    '#SeaLevelRise', '#CoastalErosion', '#BeachErosion',
    '#TidalWave', '#HighTide', '#KingTide', '#TidalFlooding',
    '#RogueWave', '#OceanWarning', '#WeatherAlert',
    '#EmergencyAlert', '#DisasterAlert', '#EvacuationOrder',
    '#SafetyAlert', '#WeatherEmergency', '#NaturalDisaster',
    'tsunami', 'hurricane', 'cyclone', 'typhoon', 'storm surge',
    'coastal flooding', 'oil spill', 'sea level rise', 'coastal erosion',
    'marine disaster', 'ocean hazard', 'tidal wave', 'rogue wave'
];

function containsOceanHazardKeywords(text) {
    if (!text) return false;
    const lower = String(text).toLowerCase();
    return OCEAN_HAZARD_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function generateMockPosts(lat, lng) {
    const now = Date.now();
    const around = (delta) => (Math.random() - 0.5) * delta;
    const samples = [
        {
            platform: 'Twitter',
            username: 'WeatherAlert_IN',
            handle: 'weatheralert_in',
            text: '🚨 #TsunamiAlert issued for coastal areas. Move to higher ground. #OceanHazard',
            caption: '🚨 #TsunamiAlert issued for coastal areas. Move to higher ground. #OceanHazard',
            timestamp: new Date(now - Math.random() * 60 * 60 * 1000).toISOString(),
            created_at: new Date(now - Math.random() * 60 * 60 * 1000).toISOString(),
            likes: 320, shares: 140, comments: 48,
            original_url: 'https://twitter.com/weatheralert_in/status/123456789',
            link: 'https://twitter.com/weatheralert_in/status/123456789',
            media_type: null, media_url: null,
            latitude: lat + around(0.15), longitude: lng + around(0.15)
        },
        {
            platform: 'Twitter',
            username: 'CoastalGuard',
            handle: 'coastalguard_official',
            text: 'Major #StormSurge expected tonight. Boats advised to return to harbor. #Hurricane',
            caption: 'Major #StormSurge expected tonight. Boats advised to return to harbor. #Hurricane',
            timestamp: new Date(now - Math.random() * 2 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(now - Math.random() * 2 * 60 * 60 * 1000).toISOString(),
            likes: 210, shares: 95, comments: 22,
            original_url: 'https://twitter.com/coastalguard_official/status/123456790',
            link: 'https://twitter.com/coastalguard_official/status/123456790',
            media_type: 'image', media_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
            latitude: lat + around(0.18), longitude: lng + around(0.18)
        },
        {
            platform: 'Twitter',
            username: 'OceanWatch',
            handle: 'oceanwatch_news',
            text: 'Breaking: #OilSpill reported offshore. Teams deployed. #MarineDisaster #OceanPollution',
            caption: 'Breaking: #OilSpill reported offshore. Teams deployed. #MarineDisaster #OceanPollution',
            timestamp: new Date(now - Math.random() * 3 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(now - Math.random() * 3 * 60 * 60 * 1000).toISOString(),
            likes: 640, shares: 280, comments: 96,
            original_url: 'https://twitter.com/oceanwatch_news/status/123456791',
            link: 'https://twitter.com/oceanwatch_news/status/123456791',
            media_type: 'video', media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            latitude: lat + around(0.2), longitude: lng + around(0.2)
        },
        {
            platform: 'Twitter',
            username: 'LocalReporter',
            handle: 'localreporter_news',
            text: 'Severe #CoastalErosion observed. Infrastructure at risk. #SeaLevelRise',
            caption: 'Severe #CoastalErosion observed. Infrastructure at risk. #SeaLevelRise',
            timestamp: new Date(now - Math.random() * 4 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(now - Math.random() * 4 * 60 * 60 * 1000).toISOString(),
            likes: 130, shares: 60, comments: 18,
            original_url: 'https://twitter.com/localreporter_news/status/123456792',
            link: 'https://twitter.com/localreporter_news/status/123456792',
            media_type: 'image', media_url: 'https://images.unsplash.com/photo-1573160813959-df05c1b3e94c?w=800&h=600&fit=crop',
            latitude: lat + around(0.08), longitude: lng + around(0.08)
        }
    ];
    return samples;
}

// ---------------- Provider integrations ----------------
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // App/User token with required scopes
const IG_BUSINESS_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID; // For Instagram Graph hashtag search
const FB_PAGE_IDS = process.env.FB_PAGE_IDS ? process.env.FB_PAGE_IDS.split(',').map(s => s.trim()).filter(Boolean) : [];

function buildHazardQueryForTwitter() {
    // Combine hashtags and keywords, exclude retweets, prefer English
    const tags = [
        '#Tsunami', '#TsunamiAlert', '#Hurricane', '#Cyclone', '#Typhoon', '#StormSurge',
        '#CoastalFlooding', '#FloodWarning', '#OceanHazard', '#MarineHazard', '#OilSpill',
        '#SeaLevelRise', '#CoastalErosion', '#TidalWave', '#HighTide', '#TidalFlooding'
    ];
    const words = ['tsunami', 'hurricane', 'cyclone', 'typhoon', 'storm surge', 'coastal flooding', 'oil spill'];
    const tagPart = tags.map(t => `(${t})`).join(' OR ');
    const wordPart = words.map(w => `("${w}")`).join(' OR ');
    // Note: point_radius operator availability depends on access level.
    return `(${tagPart} OR ${wordPart}) lang:en -is:retweet`;
}

async function fetchTwitterPosts(lat, lng, radiusKm) {
    if (!TWITTER_BEARER_TOKEN) return [];
    const query = buildHazardQueryForTwitter();
    const maxResults = 50;
    // Attempt to use point_radius; if not supported, we still get global and filter locally
    const pointRadius = `point_radius:[${lng} ${lat} ${radiusKm}km]`;
    const fullQuery = `${query} ${pointRadius}`;
    const url = 'https://api.twitter.com/2/tweets/search/recent';
    const params = {
        query: fullQuery,
        max_results: 50,
        'tweet.fields': 'created_at,public_metrics,geo,entities,lang',
        expansions: 'attachments.media_keys,author_id,geo.place_id',
        'media.fields': 'preview_image_url,url,duration_ms,variants,type',
        'user.fields': 'username,name,profile_image_url',
        'place.fields': 'full_name,id,geo,name,place_type'
    };
    try {
        const resp = await axios.get(url, { headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }, params });
        const data = resp.data || {};
        const users = (data.includes && data.includes.users) || [];
        const media = (data.includes && data.includes.media) || [];
        const places = (data.includes && data.includes.places) || [];
        const userById = new Map(users.map(u => [u.id, u]));
        const mediaByKey = new Map(media.map(m => [m.media_key, m]));
        const placeById = new Map(places.map(p => [p.id, p]));
        const out = (data.data || []).map(t => {
            const user = userById.get(t.author_id) || {};
            const firstMediaKey = t.attachments && t.attachments.media_keys && t.attachments.media_keys[0];
            const m = firstMediaKey ? mediaByKey.get(firstMediaKey) : null;
            const place = t.geo && t.geo.place_id ? placeById.get(t.geo.place_id) : null;
            const coords = place && place.geo && place.geo.bbox ? {
                // Approximate center from bbox
                lat: (place.geo.bbox[1] + place.geo.bbox[3]) / 2,
                lng: (place.geo.bbox[0] + place.geo.bbox[2]) / 2
            } : null;
            return {
                platform: 'Twitter',
                username: user.name || user.username || 'Twitter User',
                handle: user.username || 'twitter',
                text: t.text || '',
                caption: t.text || '',
                timestamp: t.created_at,
                created_at: t.created_at,
                likes: t.public_metrics ? t.public_metrics.like_count : 0,
                shares: t.public_metrics ? t.public_metrics.retweet_count : 0,
                comments: t.public_metrics ? t.public_metrics.reply_count : 0,
                original_url: `https://twitter.com/${user.username}/status/${t.id}`,
                link: `https://twitter.com/${user.username}/status/${t.id}`,
                media_type: m ? (m.type === 'video' ? 'video' : 'image') : null,
                media_url: m ? (m.url || m.preview_image_url || null) : null,
                latitude: coords ? coords.lat : null,
                longitude: coords ? coords.lng : null
            };
        });
        return out;
    } catch (e) {
        console.warn('Twitter fetch failed, falling back:', e.response ? e.response.data : e.message);
        return [];
    }
}

async function fetchInstagramHashtagPosts(lat, lng, radiusKm) {
    // Instagram Graph API: requires IG business account + permissions
    if (!META_ACCESS_TOKEN || !IG_BUSINESS_ACCOUNT_ID) return [];
    const hashtags = ['tsunami', 'cyclone', 'hurricane', 'stormsurge', 'coastalflooding', 'oilspill', 'flood'];
    const results = [];
    try {
        for (const tag of hashtags) {
            // Get hashtag ID
            const tagIdResp = await axios.get(`https://graph.facebook.com/v18.0/ig_hashtag_search`, {
                params: { user_id: IG_BUSINESS_ACCOUNT_ID, q: tag, access_token: META_ACCESS_TOKEN }
            });
            const tagId = tagIdResp.data && tagIdResp.data.data && tagIdResp.data.data[0] && tagIdResp.data.data[0].id;
            if (!tagId) continue;
            const mediaResp = await axios.get(`https://graph.facebook.com/v18.0/${tagId}/recent_media`, {
                params: {
                    user_id: IG_BUSINESS_ACCOUNT_ID,
                    fields: 'caption,media_type,media_url,permalink,timestamp,like_count',
                    access_token: META_ACCESS_TOKEN,
                    limit: 25
                }
            });
            const media = (mediaResp.data && mediaResp.data.data) || [];
            for (const m of media) {
                results.push({
                    platform: 'Instagram',
                    username: 'Instagram',
                    handle: 'instagram',
                    text: m.caption || '',
                    caption: m.caption || '',
                    timestamp: m.timestamp,
                    created_at: m.timestamp,
                    likes: m.like_count || 0,
                    shares: 0,
                    comments: 0,
                    original_url: m.permalink,
                    link: m.permalink,
                    media_type: m.media_type && m.media_type.toLowerCase() === 'video' ? 'video' : (m.media_url ? 'image' : null),
                    media_url: m.media_url || null,
                    latitude: null,
                    longitude: null
                });
            }
        }
        return results;
    } catch (e) {
        console.warn('Instagram fetch failed, falling back:', e.response ? e.response.data : e.message);
        return [];
    }
}

async function fetchFacebookPagePosts() {
    // Facebook public search is limited; fetch from configured Pages only
    if (!META_ACCESS_TOKEN || !FB_PAGE_IDS.length) return [];
    const results = [];
    try {
        for (const pageId of FB_PAGE_IDS) {
            const resp = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/posts`, {
                params: {
                    fields: 'message,created_time,full_picture,permalink_url',
                    limit: 25,
                    access_token: META_ACCESS_TOKEN
                }
            });
            const posts = (resp.data && resp.data.data) || [];
            for (const p of posts) {
                results.push({
                    platform: 'Facebook',
                    username: 'Facebook Page',
                    handle: pageId,
                    text: p.message || '',
                    caption: p.message || '',
                    timestamp: p.created_time,
                    created_at: p.created_time,
                    likes: 0,
                    shares: 0,
                    comments: 0,
                    original_url: p.permalink_url,
                    link: p.permalink_url,
                    media_type: p.full_picture ? 'image' : null,
                    media_url: p.full_picture || null,
                    latitude: null,
                    longitude: null
                });
            }
        }
        return results;
    } catch (e) {
        console.warn('Facebook fetch failed, falling back:', e.response ? e.response.data : e.message);
        return [];
    }
}

function applyFilters(posts, latitude, longitude, radius) {
    let filtered = posts.filter(p => containsOceanHazardKeywords(p.text));
    filtered = filtered.filter(p => {
        if (typeof p.latitude === 'number' && typeof p.longitude === 'number') {
            return calculateDistanceKm(latitude, longitude, p.latitude, p.longitude) <= radius;
        }
        // If no coords, keep post; providers often omit precise coordinates
        return true;
    });
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return filtered;
}

app.get('/api/social-feed', async (req, res) => {
    const { lat, lng, radiusKm, platform } = req.query;
    if (!lat || !lng) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radius = radiusKm ? parseFloat(radiusKm) : 100;
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return res.status(400).json({ success: false, message: 'Invalid latitude or longitude' });
    }

    try {
        // Decide which providers to call based on platform query
        const p = (platform || 'all').toLowerCase();
        const calls = [];
        if (p === 'twitter' || p === 'all') calls.push(fetchTwitterPosts(latitude, longitude, radius));
        else calls.push(Promise.resolve([]));
        if (p === 'instagram' || p === 'all') calls.push(fetchInstagramHashtagPosts(latitude, longitude, radius));
        else calls.push(Promise.resolve([]));
        if (p === 'facebook' || p === 'all') calls.push(fetchFacebookPagePosts());
        else calls.push(Promise.resolve([]));

        const [tw, ig, fb] = await Promise.all(calls);
        let posts = [...tw, ...ig, ...fb];
        if (!posts.length) {
            posts = generateMockPosts(latitude, longitude);
        }
        posts = applyFilters(posts, latitude, longitude, radius).slice(0, 50);
        // Ensure created_at is present for frontend compatibility
        posts = posts.map(p => ({
            ...p,
            created_at: p.created_at || p.timestamp || new Date().toISOString(),
            caption: p.caption || p.text || ''
        }));
        // Sort newest first by created_at
        posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return res.json({ success: true, posts, location: { lat: latitude, lng: longitude }, radiusKm: radius });
    } catch (e) {
        console.error('Feed aggregation error:', e);
        // Fallback to mock
        let posts = generateMockPosts(latitude, longitude);
        posts = applyFilters(posts, latitude, longitude, radius).slice(0, 20);
        posts = posts.map(p => ({ ...p, created_at: p.created_at || p.timestamp }));
        posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return res.json({ success: true, posts, location: { lat: latitude, lng: longitude }, radiusKm: radius, fallback: true });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));