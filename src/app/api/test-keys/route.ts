import { NextRequest, NextResponse } from "next/server";
import dns from "dns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const results: any = {
    dns: { status: "unknown" },
    publicDns: { status: "unknown" },
    nvidia: { status: "unknown" }
  };

  // 1. DNS Resolution Test
  try {
    const startTime = Date.now();
    const addresses = await new Promise<string[]>((resolve, reject) => {
      dns.resolve4("integrate.api.nvidia.com", (err, addr) => {
        if (err) reject(err);
        else resolve(addr);
      });
    });
    results.dns = {
      status: "success",
      ips: addresses,
      latencyMs: Date.now() - startTime
    };
  } catch (err: any) {
    results.dns = {
      status: "failed",
      error: err.message
    };
  }

  // 1b. Public DNS (8.8.8.8) Test
  try {
    const resolver = new dns.Resolver();
    resolver.setServers(["8.8.8.8"]);
    const startTime = Date.now();
    const addresses = await new Promise<string[]>((resolve, reject) => {
      resolver.resolve4("integrate.api.nvidia.com", (err, addr) => {
        if (err) reject(err);
        else resolve(addr);
      });
    });
    results.publicDns = {
      status: "success",
      ips: addresses,
      latencyMs: Date.now() - startTime
    };
  } catch (err: any) {
    results.publicDns = {
      status: "failed",
      error: err.message
    };
  }

  // 2. NVIDIA NIM test
  try {
    const apiKey = process.env.NVIDIA_API_KEY || "";
    if (!apiKey) {
      results.nvidia = { status: "failed", error: "NVIDIA_API_KEY is not set in environment." };
    } else {
      const startTime = Date.now();
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [{ role: "user", content: "Hello, reply with exactly the word SUCCESS." }],
          max_tokens: 10
        })
      });

      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        results.nvidia = {
          status: "success",
          latencyMs: Date.now() - startTime,
          response: body.choices?.[0]?.message?.content?.trim() || JSON.stringify(body)
        };
      } else {
        results.nvidia = {
          status: "failed",
          statusCode: response.status,
          error: body.error?.message || JSON.stringify(body)
        };
      }
    }
  } catch (err: any) {
    results.nvidia = {
      status: "failed",
      error: err.message
    };
  }

  return NextResponse.json(results);
}
