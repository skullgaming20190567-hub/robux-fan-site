
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*"
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) return response;

      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Request failed: ${response.status}`);
      }

      lastError = new Error(`Request failed: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt === 0) await wait(700);
  }

  throw lastError;
}

export default async (request) => {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, allow: "GET" }
    });
  }

  if (keyword.length < 3 || keyword.length > 50) {
    return new Response(JSON.stringify({ users: [] }), {
      status: 200,
      headers
    });
  }

  try {
    const searchUrl =
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=10`;

    const searchResponse = await fetchWithRetry(searchUrl, {
      headers: { accept: "application/json" }
    });

    const searchData = await searchResponse.json();
    const users = Array.isArray(searchData.data) ? searchData.data : [];
    const ids = users.map(user => user.id).filter(Boolean);

    let thumbnails = {};

    // Avatar loading is optional: a thumbnail failure won't break search.
    if (ids.length) {
      try {
        const thumbUrl =
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ids.join(",")}&size=150x150&format=Png&isCircular=true`;

        const thumbResponse = await fetchWithRetry(thumbUrl, {
          headers: { accept: "application/json" }
        });

        const thumbData = await thumbResponse.json();

        for (const thumb of (thumbData.data || [])) {
          thumbnails[thumb.targetId] = thumb.imageUrl || "";
        }
      } catch (error) {
        // Continue returning usernames even if thumbnails fail.
      }
    }

    const result = users.map(user => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName || user.name,
      avatarUrl: thumbnails[user.id] || ""
    }));

    return new Response(JSON.stringify({ users: result }), {
      status: 200,
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: "Roblox search is temporarily unavailable",
      detail: String(error)
    }), {
      status: 502,
      headers
    });
  }
};
