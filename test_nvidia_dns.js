const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const https = require("https");
const apiKey = "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";
const model = "meta/llama-3.1-8b-instruct";

const postData = JSON.stringify({
  model: model,
  messages: [
    { role: "user", content: "Hello, reply with exactly the word SUCCESS." }
  ],
  max_tokens: 10
});

const options = {
  hostname: "integrate.api.nvidia.com",
  port: 443,
  path: "/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "Content-Length": Buffer.byteLength(postData)
  },
  timeout: 5000,
  lookup: (hostname, opts, callback) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        callback(err || new Error("DNS lookup failed"));
        return;
      }
      callback(null, addresses[0], 4);
    });
  }
};

const req = https.request(options, (res) => {
  console.log("Status Code:", res.statusCode);
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    console.log("Response Body:", body);
  });
});

req.on("error", (e) => {
  console.error("HTTP Error:", e.message);
});

req.on("timeout", () => {
  console.error("Timeout!");
  req.destroy();
});

req.write(postData);
req.end();
