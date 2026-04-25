import { NextResponse } from "next/server";
import { execFileSync } from "child_process";
import { verifySetupToken } from "@/lib/setup-auth";

interface ContainerStatus {
  name: string;
  status: string;
  health: string;
}

export async function GET(req: Request) {
  const authError = verifySetupToken(req);
  if (authError) return authError;
  try {
    const output = execFileSync(
      "docker",
      ["ps", "--format", "{{.Names}}|{{.Status}}", "--filter", "name=pd-app", "--filter", "name=pg", "--filter", "name=redis"],
      { timeout: 5000, stdio: "pipe" }
    ).toString().trim();

    const containers: ContainerStatus[] = output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, status] = line.split("|");
        const health = status.includes("healthy")
          ? "healthy"
          : status.includes("starting")
            ? "starting"
            : status.includes("Up")
              ? "running"
              : "stopped";
        return { name, status, health };
      });

    return NextResponse.json({ containers });
  } catch {
    return NextResponse.json({ containers: [] });
  }
}
