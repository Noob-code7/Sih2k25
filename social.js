const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ocean hazard related keywords and hashtags
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

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Helper function to check if text contains ocean hazard keywords
function containsOceanHazardKeywords(text) {
    const lowerText = text.toLowerCase();
    return OCEAN_HAZARD_KEYWORDS.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
    );
}

// Mock function to simulate social media API calls
// In production, you would integrate with actual social media APIs
async function fetchSocialMediaPosts(lat, lng, radius = 100) {
    try {
        // First, try to get posts from our database
        const { data: storedPosts, error } = await supabase
            .from('social_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Database error:', error);
        }

        let posts = storedPosts || [];

        // Filter posts by location if they have coordinates
        if (lat && lng) {
            posts = posts.filter(post => {
                if (post.latitude && post.longitude) {
                    const distance = calculateDistance(lat, lng, post.latitude, post.longitude);
                    return distance <= radius;
                }
                return true; // Include posts without location data
            });
        }

        // If we don't have enough recent posts, generate some mock data
        if (posts.length < 5) {
            const mockPosts = await generateMockPosts(lat, lng);
            posts = [...posts, ...mockPosts];
        }

        // Filter posts to only include ocean hazard related content
        posts = posts.filter(post => containsOceanHazardKeywords(post.text));

        // Sort by timestamp (newest first)
        posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return posts.slice(0, 20); // Return top 20 posts

    } catch (error) {
        console.error('Error fetching social media posts:', error);
        throw error;
    }
}

// Generate mock posts for demonstration
async function generateMockPosts(lat, lng) {
    const mockPostsData = [
        {
            username: "WeatherAlert_IN",
            handle: "weatheralert_in",
            text: "🚨 #TsunamiAlert issued for coastal areas. Residents advised to move to higher ground immediately. Stay safe! #OceanHazard #EmergencyAlert",
            timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            likes: Math.floor(Math.random() * 500) + 100,
            shares: Math.floor(Math.random() * 200) + 50,
            comments: Math.floor(Math.random() * 100) + 20,
            original_url: "https://twitter.com/weatheralert_in/status/123456789",
            media_type: null,
            media_url: null,
            latitude: lat + (Math.random() - 0.5) * 0.1,
            longitude: lng + (Math.random() - 0.5) * 0.1
        },
        {
            username: "CoastalGuard",
            handle: "coastalguard_official",
            text: "Major #StormSurge expected along the coast tonight. Fishing boats advised to return to harbor. #MarineHazard #SafetyAlert #Hurricane",
            timestamp: new Date(Date.now() - Math.random() * 7200000).toISOString(),
            likes: Math.floor(Math.random() * 300) + 80,
            shares: Math.floor(Math.random() * 150) + 30,
            comments: Math.floor(Math.random() * 80) + 15,
            original_url: "https://twitter.com/coastalguard_official/status/123456790",
            media_type: "image",
            media_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop",
            latitude: lat + (Math.random() - 0.5) * 0.15,
            longitude: lng + (Math.random() - 0.5) * 0.15
        },
        {
            username: "OceanWatch",
            handle: "oceanwatch_news",
            text: "Breaking: #OilSpill reported 15km offshore. Marine rescue teams deployed. Environmental impact assessment underway. #MarineDisaster #OceanPollution",
            timestamp: new Date(Date.now() - Math.random() * 10800000).toISOString(),
            likes: Math.floor(Math.random() * 800) + 200,
            shares: Math.floor(Math.random() * 400) + 100,
            comments: Math.floor(Math.random() * 150) + 40,
            original_url: "https://twitter.com/oceanwatch_news/status/123456791",
            media_type: "video",
            media_url: "https://sample-videos.com/zip/10/mp4/SampleVideo_360x240_1mb.mp4",
            latitude: lat + (Math.random() - 0.5) * 0.2,
            longitude: lng + (Math.random() - 0.5) * 0.2
        },
        {
            username: "LocalReporter",
            handle: "localreporter_news",
            text: "Witnessing severe #CoastalErosion at Marina Beach. Sea level rise causing significant damage to infrastructure. #SeaLevelRise #ClimateChange",
            timestamp: new Date(Date.now() - Math.random() * 14400000).toISOString(),
            likes: Math.floor(Math.random() * 250) + 60,
            shares: Math.floor(Math.random() * 120) + 25,
            comments: Math.floor(Math.random() * 70) + 10,
            original_url: "https://twitter.com/localreporter_news/status/123456792",
            media_type: "image",
            media_url: "https://images.unsplash.com/photo-1573160813959-df05c1b3e94c?w=800&h=600&fit=crop",
            latitude: lat + (Math.random() - 0.5) * 0.05,
            longitude: lng + (Math.random() - 0.5) * 0.05
        },
        {
            username: "EmergencyServices",
            handle: "emergency_services",
            text: "⚠️ #FloodWarning: Abnormal high tide expected tonight. Coastal roads may be affected. Plan your travel accordingly. #HighTide #TidalFlooding",
            timestamp: new Date(Date.now() - Math.random() * 18000000).toISOString(),
            likes: Math.floor(Math.random() * 400) + 150,
            shares: Math.floor(Math.random() * 250) + 80,
            comments: Math.floor(Math.random() * 100) + 30,
            original_url: "https://twitter.com/emergency_services/status/123456793",
            media_type: null,
            media_url: null,
            latitude: lat + (Math.random() - 0.5) * 0.12,
            longitude: lng + (Math.random() - 0.5) * 0.12
        },
        {
            username: "WeatherWatcher",
            handle: "weatherwatcher_local",
            text: "#Cyclone update: Wind speeds increasing. Coastal areas under evacuation advisory. Stay indoors and follow official updates. #WeatherAlert #Typhoon",
            timestamp: new Date(Date.now() - Math.random() * 21600000).toISOString(),
            likes: Math.floor(Math.random() * 600) + 180,
            shares: Math.floor(Math.random() * 300) + 90,
            comments: Math.floor(Math.random() * 120) + 35,
            original_url: "https://twitter.com/weatherwatcher_local/status/123456794",
            media_type: "image",
            media_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
            latitude: lat + (Math.random() - 0.5) * 0.18,
            longitude: lng + (Math.random() - 0.5) * 0.18
        }
    ];

    // Store mock posts in database for future reference
    try {
        const { error } = await supabase
            .from('social_posts')
            .upsert(mockPostsData, { onConflict: 'original_url' });

        if (error) {
            console.error('Error storing mock posts:', error);
        }
    } catch (error) {
        console.error('Database storage error:', error);
    }

    return mockPostsData;
}

// API endpoint to get social media feed
app.get('/api/social-feed', async (req, res) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid latitude or longitude values'
            });
        }

        // Validate coordinate ranges
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                success: false,
                message: 'Latitude must be between -90 and 90, longitude between -180 and 180'
            });
        }

        console.log(`Fetching social feed for location: ${latitude}, ${longitude}`);

        const posts = await fetchSocialMediaPosts(latitude, longitude);

        res.json({
            success: true,
            posts: posts,
            location: { lat: latitude, lng: longitude },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// API endpoint to add a new social post (for testing/admin purposes)
app.post('/api/social-feed', async (req, res) => {
    try {
        const {
            username,
            handle,
            text,
            latitude,
            longitude,
            media_type,
            media_url,
            original_url
        } = req.body;

        // Validate required fields
        if (!username || !handle || !text) {
            return res.status(400).json({
                success: false,
                message: 'Username, handle, and text are required'
            });
        }

        // Check if it contains ocean hazard keywords
        if (!containsOceanHazardKeywords(text)) {
            return res.status(400).json({
                success: false,
                message: 'Post must contain ocean hazard related keywords'
            });
        }

        const postData = {
            username,
            handle,
            text,
            timestamp: new Date().toISOString(),
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            media_type: media_type || null,
            media_url: media_url || null,
            original_url: original_url || `https://example.com/post/${Date.now()}`,
            likes: 0,
            shares: 0,
            comments: 0,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('social_posts')
            .insert([postData])
            .select();

        if (error) {
            console.error('Database insertion error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to save post',
                error: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'Post created successfully',
            post: data[0]
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Ocean Hazard Social Media Feed API'
    });
});

// Serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'social-feed.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Handle 404 routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Social feed API: http://localhost:${PORT}/api/social-feed?lat=13.0827&lng=80.2707`);
    
    // Verify Supabase connection
    if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️  Supabase credentials not found. Please check your .env file.');
    } else {
        console.log('✅ Supabase connection configured');
    }
});

module.exports = app;