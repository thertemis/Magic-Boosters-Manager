import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Github, Container, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CodeBlock({ children, language = "bash" }: { children: string; language?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-black/60 border border-border rounded-lg p-4 text-sm font-mono text-green-400 overflow-x-auto whitespace-pre-wrap">
        <code>{children.trim()}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
        onClick={handleCopy}
      >
        {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-sm">
        {number}
      </div>
      <div className="flex-1 space-y-2 pb-6">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function UpdateGuidesPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"docker" | "github">("docker");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t("guides.title")}</h1>
        <p className="text-muted-foreground mt-1">
          Step-by-step guides for updating the application without losing data.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "docker" ? "default" : "outline"}
          onClick={() => setActiveTab("docker")}
          data-testid="button-tab-docker"
        >
          <Container className="h-4 w-4 mr-2" />
          {t("guides.docker")}
        </Button>
        <Button
          variant={activeTab === "github" ? "default" : "outline"}
          onClick={() => setActiveTab("github")}
          data-testid="button-tab-github"
        >
          <Github className="h-4 w-4 mr-2" />
          {t("guides.github")}
        </Button>
      </div>

      {activeTab === "docker" && (
        <div className="space-y-6">
          <Card className="bg-yellow-950/20 border-yellow-800">
            <CardContent className="flex gap-3 p-4 text-sm">
              <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-yellow-300">
                <strong>Safe update strategy:</strong> This guide uses <code>db:push</code> to add new columns without dropping existing data. Your database is never wiped — only new fields are added.
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Container className="h-5 w-5 text-primary" />
                Docker Update Guide — Zero Data Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                <Step number={1} title="Back up your database (recommended)">
                  <p className="text-sm text-muted-foreground">Always back up before updating. Use the Backup page in the admin panel, or dump directly:</p>
                  <CodeBlock>{`
# Option A: Use the in-app backup (Admin → Backup → Export)
# Then download the JSON file

# Option B: Direct PostgreSQL dump
docker exec <your-postgres-container> \\
  pg_dump -U <db_user> <db_name> > backup_$(date +%Y%m%d).sql
`}</CodeBlock>
                </Step>

                <Step number={2} title="Pull the latest image">
                  <CodeBlock>{`
# If building from source:
git pull origin main
docker build -t mtg-simulator:latest .

# If using a registry:
docker pull yourregistry/mtg-simulator:latest
`}</CodeBlock>
                </Step>

                <Step number={3} title="Stop the running container">
                  <CodeBlock>{`
# Find your container name
docker ps

# Stop and remove (data is in the DB, not the container)
docker stop mtg-simulator
docker rm mtg-simulator
`}</CodeBlock>
                </Step>

                <Step number={4} title="Run the new container with db:push">
                  <p className="text-sm text-muted-foreground">
                    The <code>db:push</code> command adds any new columns/tables without touching existing data.
                    It is safe to run on a live database.
                  </p>
                  <CodeBlock>{`
# Start the new container
docker run -d \\
  --name mtg-simulator \\
  --env DATABASE_URL=postgresql://user:pass@host:5432/dbname \\
  --env SESSION_SECRET=your-secret-here \\
  -p 5000:5000 \\
  mtg-simulator:latest

# The app automatically runs db:push on startup via npm run dev / npm start
# Or run it manually:
docker exec mtg-simulator npm run db:push
`}</CodeBlock>
                </Step>

                <Step number={5} title="Verify the update">
                  <CodeBlock>{`
# Check logs to confirm startup
docker logs mtg-simulator --tail 50

# Expected output:
# [express] serving on port 5000
# (no migration errors)
`}</CodeBlock>
                </Step>

                <Step number={6} title="Example docker-compose.yml">
                  <p className="text-sm text-muted-foreground">If you use Docker Compose, update like this:</p>
                  <CodeBlock language="yaml">{`
version: "3.8"
services:
  app:
    image: mtg-simulator:latest
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/mtgsim
      SESSION_SECRET: change-me-to-a-random-string
    ports:
      - "5000:5000"
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mtgsim
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
`}</CodeBlock>
                  <CodeBlock>{`
# Update with compose:
docker compose pull
docker compose up -d

# Run schema push if needed:
docker compose exec app npm run db:push
`}</CodeBlock>
                </Step>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">How schema updates work</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>This app uses <strong className="text-foreground">Drizzle ORM with schema push</strong> (not migration files). When you run <code>npm run db:push</code>:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>New tables are created</li>
                <li>New columns are added with their default values</li>
                <li>Existing data is <strong className="text-foreground">never deleted</strong></li>
                <li>Column renames/drops are prompted interactively (safe by default)</li>
              </ul>
              <p className="text-yellow-400 text-xs mt-2">⚠ Never manually ALTER TABLE or change primary key types in the Drizzle schema — this can break existing data.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "github" && (
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Github className="h-5 w-5 text-primary" />
                GitHub Update Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                <Step number={1} title="Connect your Replit to GitHub (first time only)">
                  <p className="text-sm text-muted-foreground">From the Replit workspace, link your repo:</p>
                  <CodeBlock>{`
# Initialize git (if not already done)
git init
git remote add origin https://github.com/yourusername/mtg-simulator.git
`}</CodeBlock>
                </Step>

                <Step number={2} title="Check current status">
                  <CodeBlock>{`
git status
git log --oneline -5
`}</CodeBlock>
                </Step>

                <Step number={3} title="Stage and commit your changes">
                  <CodeBlock>{`
# Stage all changes
git add -A

# Or stage specific files
git add shared/schema.ts server/routes.ts client/src/pages/

# Commit with a descriptive message
git commit -m "feat: add decklist check, API keys, i18n FR/EN support"
`}</CodeBlock>
                </Step>

                <Step number={4} title="Push to GitHub">
                  <CodeBlock>{`
# Push to main branch
git push origin main

# If the remote has changes you don't have locally:
git pull --rebase origin main
git push origin main
`}</CodeBlock>
                </Step>

                <Step number={5} title="Pulling updates from GitHub to Replit">
                  <CodeBlock>{`
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Sync database schema (adds new tables/columns safely)
npm run db:push
`}</CodeBlock>
                </Step>

                <Step number={6} title="Recommended .gitignore">
                  <CodeBlock>{`
node_modules/
dist/
.env
.env.local
*.log
.replit
replit.nix
`}</CodeBlock>
                </Step>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Versioning tip</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Use meaningful commit messages so it's easy to track what changed:</p>
              <div className="space-y-1">
                {[
                  ["feat:", "new feature (decklist check, API keys)"],
                  ["fix:", "bug fix"],
                  ["chore:", "dependency updates, config changes"],
                  ["docs:", "documentation only changes"],
                  ["db:", "database schema changes (always note these!)"],
                ].map(([prefix, desc]) => (
                  <div key={prefix} className="flex gap-2">
                    <code className="text-primary text-xs">{prefix}</code>
                    <span className="text-xs">{desc}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-blue-950/30 border border-blue-800 p-3">
                <p className="text-blue-300 text-xs">
                  💡 After any commit that includes database schema changes, always run <code>npm run db:push</code> on the target environment before starting the server.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
