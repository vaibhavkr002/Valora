const url = "https://brioiujppaaycydndrcp.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function run() {
  const res = await fetch(`${url}/rest/v1/store_settings?select=key,value&key=eq.sarojini_homepage_sections`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const data = await res.json();
  const hero = data[0].value.find(s => s.section_type === 'sarojini_hero');
  console.log("SAROJINI_HERO:", JSON.stringify(hero, null, 2));

  const spotlight = data[0].value.find(s => s.section_type === 'sarojini_spotlight');
  console.log("SAROJINI_SPOTLIGHT:", JSON.stringify(spotlight, null, 2));
}
run();
