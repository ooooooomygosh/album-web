function cleanList(value, limit = 12, max = 80) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[，,、\n]/);
  return [...new Set(list.map((item) => String(item || '').trim().slice(0, max)).filter(Boolean))].slice(0, limit);
}

function cleanPublicProfile(value = {}) {
  const profile = value && typeof value === 'object' ? value : {};
  return {
    bio: String(profile.bio || '').trim().slice(0, 360),
    location: String(profile.location || '').trim().slice(0, 80),
    favoriteGenres: cleanList(profile.favoriteGenres, 16, 60),
    favoriteArtists: cleanList(profile.favoriteArtists, 18, 80),
    favoriteBands: cleanList(profile.favoriteBands, 18, 80),
    favoriteAlbums: cleanList(profile.favoriteAlbums, 18, 120),
    favoriteSongs: cleanList(profile.favoriteSongs, 18, 120)
  };
}

export function memberSnapshot(user = {}) {
  const profile = cleanPublicProfile(user.profile || {});
  const name = String(user.name || 'Music friend').trim().slice(0, 60) || 'Music friend';
  const avatar = String(user.avatar || name[0] || 'M').trim().slice(0, 2);
  return {
    id: String(user.id || '').slice(0, 120),
    name,
    avatar,
    avatarUrl: String(user.avatarUrl || '').trim().slice(0, 700),
    avatarDataUrl: String(user.avatarDataUrl || '').trim().slice(0, 180000),
    publicTags: cleanList(user.publicTags, 24, 40),
    bio: profile.bio,
    location: profile.location,
    profile
  };
}
