const url = "https://brioiujppaaycydndrcp.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function run() {
  try {
    const resBanners = await fetch(`${url}/rest/v1/banners?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const banners = await resBanners.json();
    console.log("BANNERS:", Array.isArray(banners) ? banners.length : banners);
    if (Array.isArray(banners)) console.log(JSON.stringify(banners, null, 2));

    const resSettings = await fetch(`${url}/rest/v1/store_settings?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const settings = await resSettings.json();
    if (Array.isArray(settings)) {
      settings.forEach(s => {
        if (s.key.includes('ad') || s.key.includes('banner') || s.key.includes('sarojini')) {
          console.log("\nKEY:", s.key);
          console.log("VALUE:", JSON.stringify(s.value, null, 2));
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
}
run();
