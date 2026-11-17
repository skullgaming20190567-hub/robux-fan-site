export default async (request) => {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "content-type": "application/json", "allow": "GET" }
    });
  }
  if (keyword.length < 3 || keyword.length > 50) {
    return new Response(JSON.stringify({ users: [] }), {
      status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
  try {
    const searchResponse = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=10`,
      { headers: { "accept": "application/json", "user-agent": "Mozilla/5.0" } }
    );
    if (!searchResponse.ok) throw new Error(`Roblox user search returned ${searchResponse.status}`);
    const searchData = await searchResponse.json();
    const users = Array.isArray(searchData.data) ? searchData.data : [];
    const ids = users.map(u => u.id).filter(Boolean);
    let thumbnails = {};
    if (ids.length) {
      const thumbResponse = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.join(",")}&size=150x150&format=Png&isCircular=true`,
        { headers: { "accept": "application/json", "user-agent": "Mozilla/5.0" } }
      );
      if (thumbResponse.ok) {
        const thumbData = await thumbResponse.json();
        for (const t of (thumbData.data || [])) thumbnails[t.targetId] = t.imageUrl;
      }
    }
    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      displayName: u.displayName || u.name,
      avatarUrl: thumbnails[u.id] || ""
    }));
    return new Response(JSON.stringify({ users: result }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Roblox search is temporarily unavailable", detail: String(error) }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" }
    });
  }
};