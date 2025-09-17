// Extracted from social.html inline script. Runs in the browser.

// Global variables
let userLocation = null;
let isLoading = false;

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
	requestLocation();
});

// Request user's location
function requestLocation() {
	const locationStatus = document.getElementById('locationStatus');
	const locationText = document.getElementById('locationText');

	locationStatus.classList.remove('hidden');
	locationText.textContent = 'Requesting location access...';

	if (!navigator.geolocation) {
		showError('Geolocation is not supported by this browser');
		return;
	}

	navigator.geolocation.getCurrentPosition(
		// Success callback
		function(position) {
			userLocation = {
				lat: position.coords.latitude,
				lng: position.coords.longitude
			};

			locationText.textContent = `Location found: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
			locationStatus.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg mb-6';

			// Load the social feed
			loadSocialFeed();
		},
		// Error callback
		function(error) {
			let errorMessage = 'Unable to retrieve location';
			switch(error.code) {
				case error.PERMISSION_DENIED:
					errorMessage = 'Location access denied by user';
					break;
				case error.POSITION_UNAVAILABLE:
					errorMessage = 'Location information unavailable';
					break;
				case error.TIMEOUT:
					errorMessage = 'Location request timed out';
					break;
			}

			locationText.textContent = errorMessage + ' - Using default location';
			locationStatus.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6';

			// Use default location (example: Chennai, India)
			userLocation = { lat: 13.0827, lng: 80.2707 };
			loadSocialFeed();
		},
		// Options
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 300000 // 5 minutes
		}
	);
}

// Load social media feed
async function loadSocialFeed() {
	if (isLoading) return;

	isLoading = true;
	showLoadingState();

	try {
		const apiUrl = `/api/social-feed?lat=${userLocation.lat}&lng=${userLocation.lng}`;
		const response = await fetch(apiUrl, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('API Error Response:', errorText);
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const contentType = response.headers.get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			const responseText = await response.text();
			console.error('Non-JSON Response:', responseText);
			throw new Error('Server returned non-JSON response');
		}

		const data = await response.json();

		hideAllStates();

		if (data.posts && data.posts.length > 0) {
			displayPosts(data.posts);
		} else {
			showNoPostsState();
		}

	} catch (error) {
		console.error('Error loading social feed:', error);
		showError(`Failed to load social feed: ${error.message}`);
	} finally {
		isLoading = false;
	}
}

// Display posts in the feed
function displayPosts(posts) {
	const container = document.getElementById('postsContainer');
	container.innerHTML = '';

	posts.forEach(post => {
		const postElement = createPostElement(post);
		container.appendChild(postElement);
	});
}

// Create a post element
function createPostElement(post) {
	const postDiv = document.createElement('div');
	postDiv.className = 'post-card bg-white rounded-lg shadow-md p-6 border border-gray-200';

	const timestamp = post.created_at || post.timestamp;
	const timeAgo = getTimeAgo(new Date(timestamp));
	const processedText = highlightHashtags(post.text || post.caption || '');

	postDiv.innerHTML = `
		<div class="flex items-start space-x-4">
			<div class="flex-shrink-0">
				<div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
					${(post.username || 'U').charAt(0).toUpperCase()}
				</div>
			</div>
			<div class="flex-1">
				<div class="flex items-center space-x-2 mb-2">
					<h3 class="font-semibold text-gray-900">${escapeHtml(post.username || 'User')}</h3>
					<span class="text-gray-500">@${escapeHtml(post.handle || (post.platform || '').toLowerCase())}</span>
					<span class="text-gray-400">•</span>
					<span class="text-gray-500 text-sm">${timeAgo}</span>
				</div>

				<p class="text-gray-800 mb-4 leading-relaxed">${processedText}</p>

				${post.media_url ? createMediaElement(post.media_url, post.media_type) : ''}

				<div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
					<div class="flex items-center space-x-4 text-gray-500">
						<span class="flex items-center">
							<i class="fas fa-heart mr-1"></i>
							${post.likes || 0}
						</span>
						<span class="flex items-center">
							<i class="fas fa-retweet mr-1"></i>
							${post.shares || 0}
						</span>
						<span class="flex items-center">
							<i class="fas fa-comment mr-1"></i>
							${post.comments || 0}
						</span>
					</div>
					<a href="${post.original_url || post.link || '#'}" target="_blank" rel="noopener noreferrer" 
					   class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
						<i class="fas fa-external-link-alt mr-1"></i>View Original
					</a>
				</div>
			</div>
		</div>
	`;

	return postDiv;
}

// Create media element based on type
function createMediaElement(mediaUrl, mediaType) {
	if (!mediaUrl) return '';

	if (mediaType === 'image') {
		return `<div class="mb-4">
			<img src="${escapeHtml(mediaUrl)}" alt="Post media" 
				 class="rounded-lg max-w-full h-auto border border-gray-200" 
				 loading="lazy" onerror="this.closest('div').remove()">
		</div>`;
	} else if (mediaType === 'video') {
		return `<div class="mb-4">
			<video controls class="rounded-lg max-w-full h-auto border border-gray-200" onerror="this.closest('div').remove()">
				<source src="${escapeHtml(mediaUrl)}" type="video/mp4">
				Your browser does not support the video tag.
			</video>
		</div>`;
	}
	return '';
}

// Highlight hashtags in text
function highlightHashtags(text) {
	return escapeHtml(text).replace(/#\w+/g, '<span class="hashtag">$&</span>');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// Get time ago string
function getTimeAgo(date) {
	const now = new Date();
	const diffInMs = now - date;
	const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
	const diffInHours = Math.floor(diffInMinutes / 60);
	const diffInDays = Math.floor(diffInHours / 24);

	if (diffInMinutes < 1) return 'Just now';
	if (diffInMinutes < 60) return `${diffInMinutes}m`;
	if (diffInHours < 24) return `${diffInHours}h`;
	if (diffInDays < 7) return `${diffInDays}d`;

	return date.toLocaleDateString();
}

// State management functions
function showLoadingState() {
	hideAllStates();
	document.getElementById('loadingState').classList.remove('hidden');
}

function showError(message) {
	hideAllStates();
	document.getElementById('errorMessage').textContent = message;
	document.getElementById('errorState').classList.remove('hidden');
}

function showNoPostsState() {
	hideAllStates();
	document.getElementById('noPostsState').classList.remove('hidden');
}

function hideAllStates() {
	document.getElementById('loadingState').classList.add('hidden');
	document.getElementById('errorState').classList.add('hidden');
	document.getElementById('noPostsState').classList.add('hidden');
}

// Refresh feed function
function refreshFeed() {
	if (userLocation) {
		loadSocialFeed();
	} else {
		requestLocation();
	}
}


