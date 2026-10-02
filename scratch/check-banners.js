const url = "https://brioiujppaaycydndrcp.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function run() {
  const resBanners = await fetch(`${url}/rest/v1/banners?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const banners = await resBanners.json();
  console.log("BANNERS count:", banners.length);
  console.log(JSON.stringify(banners, null, 2));
}
run();
