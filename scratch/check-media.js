const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\saanv\\.gemini\\antigravity\\brain\\1d7be616-eeeb-4284-846d-5f390fac34be\\.system_generated\\logs\\transcript_full.jsonl')
});
rl.on('line', line => {
  if (line.includes('"step_index":38457')) {
    const obj = JSON.parse(line);
    console.log("MEDIA:", JSON.stringify(obj.media, null, 2));
    rl.close();
  }
});
