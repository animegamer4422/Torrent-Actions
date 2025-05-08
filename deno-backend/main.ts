// torrent.ts - Deno Deploy backend to trigger torrent downloads via GitHub Actions

type Payload = {
  magnet: string;
  infohash?: string;
  id: string;
};

const GH_OWNER = "animegamer4422";
const GH_REPO = "Torrent-Actions";
const BRANCH = "Testing";
const GH_PAT = Deno.env.get("GH_PAT");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Only POST allowed", { status: 405, headers: corsHeaders });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const { magnet, id } = body;

  if (!magnet || !id) {
    return new Response("Missing magnet or id", { status: 400, headers: corsHeaders });
  }

  const filePath = `queue/${id}.json`;
  const fileUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${filePath}`;

  const headers = {
    Authorization: `Bearer ${GH_PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Check if file already exists
  const checkRes = await fetch(`${fileUrl}?ref=${BRANCH}`, { headers });
  if (checkRes.ok) {
    return new Response(JSON.stringify({ error: "This torrent ID already exists." }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contentObj = {
    magnet,
    id,
    infohash: body.infohash || null
  };

  const encodedContent = btoa(JSON.stringify(contentObj, null, 2));

  const commitRes = await fetch(fileUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `Add torrent request: ${id}`,
      content: encodedContent,
      branch: BRANCH
    }),
  });

  if (!commitRes.ok) {
    const err = await commitRes.text();
    return new Response("GitHub commit failed: " + err, {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      queuePath: `queue/${id}.json`,
      statusPath: `status/${id}.json`,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
