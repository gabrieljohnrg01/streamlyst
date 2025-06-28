const TMDB_API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3';
const ANILIST_API_URL = 'https://graphql.anilist.co';

// TMDB API functions
async function fetchTrending(mediaType = 'all', timeWindow = 'week') {
    const response = await fetch(`https://api.themoviedb.org/3/trending/${mediaType}/${timeWindow}?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.results.map(item => ({ ...item, media_type: mediaType }));
}

async function fetchPopular(mediaType = 'movie') {
    const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/popular?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.results.map(item => ({ ...item, media_type: mediaType }));
}

async function fetchMediaDetails(id, mediaType) {
    const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`);
    return await response.json();
}

async function fetchTVSeason(seriesId, seasonNumber) {
    const response = await fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.episodes || [];
}

async function searchMedia(query, mediaType = 'multi') {
    const response = await fetch(`https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (mediaType === 'multi') {
        return data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    }
    return data.results.map(item => ({ ...item, media_type: mediaType }));
}

// AniList API functions
async function fetchAnimeTrending() {
    const query = `
        query {
            Page(page: 1, perPage: 20) {
                media(sort: TRENDING_DESC, type: ANIME) {
                    id
                    title {
                        userPreferred
                        romaji
                        english
                        native
                    }
                    coverImage {
                        large
                        color
                    }
                    startDate {
                        year
                        month
                        day
                    }
                    endDate {
                        year
                        month
                        day
                    }
                    episodes
                    genres
                    description
                    averageScore
                }
            }
        }
    `;
    
    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    return data.data.Page.media.map(anime => ({ 
        ...anime, 
        type: 'anime',
        title: anime.title.userPreferred,
        poster_path: anime.coverImage?.large,
        release_date: anime.startDate?.year ? `${anime.startDate.year}-${anime.startDate.month || '01'}-${anime.startDate.day || '01'}` : null
    }));
}

async function fetchAnimePopular() {
    const query = `
        query {
            Page(page: 1, perPage: 20) {
                media(sort: POPULARITY_DESC, type: ANIME) {
                    id
                    title {
                        userPreferred
                    }
                    coverImage {
                        large
                    }
                    startDate {
                        year
                    }
                    episodes
                    genres
                    description
                    popularity
                }
            }
        }
    `;
    
    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    return data.data.Page.media.map(anime => ({ 
        ...anime, 
        type: 'anime',
        title: anime.title.userPreferred,
        poster_path: anime.coverImage?.large,
        release_date: anime.startDate?.year ? `${anime.startDate.year}-01-01` : null
    }));
}

async function fetchAnimeDetails(id) {
    const query = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                id
                title {
                    userPreferred
                    romaji
                    english
                    native
                }
                coverImage {
                    large
                    color
                }
                bannerImage
                startDate {
                    year
                    month
                    day
                }
                endDate {
                    year
                    month
                    day
                }
                episodes
                genres
                description
                averageScore
                relations {
                    edges {
                        relationType
                        node {
                            id
                            title {
                                userPreferred
                            }
                            coverImage {
                                large
                            }
                            type
                        }
                    }
                }
                streamingEpisodes {
                    title
                    thumbnail
                    url
                    site
                }
            }
        }
    `;
    
    const variables = { id: parseInt(id) };
    
    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables })
    });
    
    const data = await response.json();
    const anime = data.data.Media;
    
    // Format episodes if available
    let episodes = [];
    if (anime.streamingEpisodes && anime.streamingEpisodes.length > 0) {
        episodes = anime.streamingEpisodes.map((ep, index) => ({
            number: index + 1,
            title: ep.title,
            thumbnail: ep.thumbnail,
            description: `Available on ${ep.site}`
        }));
    } else if (anime.episodes) {
        // Create placeholder episodes if we know the count but don't have details
        episodes = Array.from({ length: anime.episodes }, (_, i) => ({
            number: i + 1,
            title: `Episode ${i + 1}`,
            thumbnail: anime.coverImage?.large,
            description: 'Episode details not available'
        }));
    }
    
    return {
        ...anime,
        type: 'anime',
        title: anime.title.userPreferred,
        poster_path: anime.coverImage?.large,
        backdrop_path: anime.bannerImage,
        release_date: anime.startDate?.year ? `${anime.startDate.year}-${anime.startDate.month || '01'}-${anime.startDate.day || '01'}` : null,
        overview: anime.description,
        episodes
    };
}

async function searchAnime(query) {
    const searchQuery = `
        query ($search: String) {
            Page(page: 1, perPage: 20) {
                media(search: $search, type: ANIME) {
                    id
                    title {
                        userPreferred
                    }
                    coverImage {
                        large
                    }
                    startDate {
                        year
                    }
                    type
                    popularity
                }
            }
        }
    `;
    
    const variables = { search: query };
    
    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery, variables })
    });
    
    const data = await response.json();
    return data.data.Page.media.map(anime => ({ 
        ...anime, 
        type: 'anime',
        media_type: 'anime',
        title: anime.title.userPreferred,
        poster_path: anime.coverImage?.large,
        release_date: anime.startDate?.year ? `${anime.startDate.year}-01-01` : null
    }));
}