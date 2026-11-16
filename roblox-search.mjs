export default async (request) => {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();

  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

  if (keyword.length < 3) return json({ users: [] });

  try {
    const searchUrl = new URL("https://users.roblox.com/v1/users/search");
    searchUrl.searchParams.set("keyword", keyword);
    searchUrl.searchParams.set("limit", "10");

    const searchResponse = await fetch(searchUrl, {
      headers: { "accept": "application/json" }
    });

    if (!searchResponse.ok) {
      return json({ users: [], error: `Roblox search returned ${searchResponse.status}` }, 502);
    }

    const searchData = await searchResponse.json();
    const found = Array.isArray(searchData.data) ? searchData.data : [];
    const ids = found.map(user => user.id).filter(Boolean);

    // Avatar lookup is optional: a thumbnail failure must not break username search.
    let thumbnails = {};
    if (ids.length) {
      try {
        const thumbUrl = new URL("https://thumbnails.roblox.com/v1/users/avatar-headshot");
        thumbUrl.searchParams.set("userIds", ids.join(","));
        thumbUrl.searchParams.set("size", "150x150");
        thumbUrl.searchParams.set("format", "Png");
        thumbUrl.searchParams.set("isCircular", "true");

        const thumbResponse = await fetch(thumbUrl, {
          headers: { "accept": "application/json" }
        });
        if (thumbResponse.ok) {
          const thumbData = await thumbResponse.json();
          for (const item of (thumbData.data || [])) {
            thumbnails[item.targetId] = item.imageUrl;
          }
        }
      } catch (_) {
        // Continue with usernames even if Roblox thumbnails are unavailable.
      }
    }

    const users = found.map(user => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: thumbnails[user.id] || null,
      hasVerifiedBadge: !!user.hasVerifiedBadge
    }));

    return json({ users });
  } catch (_) {
    return json({ users: [], error: "Roblox user search is temporarily unavailable." }, 502);
  }
};
