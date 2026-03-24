import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { BookOpen, Lock, Globe } from "lucide-react";

interface Endpoint {
  method: "GET" | "POST" | "DELETE" | "PUT";
  path: string;
  description: string;
  auth: "api-key" | "session";
  body?: string;
  response: string;
}

interface EndpointGroup {
  title: string;
  endpoints: Endpoint[];
}

const endpointGroups: EndpointGroup[] = [
  {
    title: "Users",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/users",
        description: "List all users (id, username, role, discordUserId, createdAt).",
        auth: "api-key",
        response: '[{ "id": 1, "username": "alice", "role": "player", "discordUserId": "123456789", "createdAt": "..." }]',
      },
      {
        method: "GET",
        path: "/api/v1/users/discord/:discordId",
        description: "Look up a user by their linked Discord User ID. Useful for Discord bot slash commands.",
        auth: "api-key",
        response: '{ "id": 3, "username": "alice", "role": "player", "discordUserId": "123456789" }',
      },
      {
        method: "PATCH",
        path: "/api/v1/users/:id/discord",
        description: "Set or clear a user's Discord User ID (admin / API). Use null to unlink.",
        auth: "api-key",
        body: '{ "discordUserId": "123456789012345678" }',
        response: '{ "id": 3, "username": "alice", "discordUserId": "123456789012345678" }',
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/collection",
        description: "Get a user's collection. Returns card name, set, rarity, quantity, foil status, tag.",
        auth: "api-key",
        response: '[{ "cardId": "...", "cardName": "Lightning Bolt", "setCode": "m21", "rarity": "common", "quantity": 4, "isFoil": false, "tag": null }]',
      },
      {
        method: "POST",
        path: "/api/v1/users/:id/decklist-check",
        description: "Check a decklist against a user's collection. Match is by card name only (not set/variant).",
        auth: "api-key",
        body: '{ "decklist": "4 Lightning Bolt\\n2 Tarmogoyf" }',
        response: '{ "userId": 1, "username": "alice", "results": [...], "summary": { "total": 2, "owned": 1, "partial": 0, "missing": 1 } }',
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/packs",
        description: "Get a user's available and opened booster packs.",
        auth: "api-key",
        response: '[{ "id": 12, "setCode": "neo", "packType": "play", "status": "available", "createdAt": "..." }]',
      },
      {
        method: "GET",
        path: "/api/v1/users/:id/balance",
        description: "Get a user's currency balance.",
        auth: "api-key",
        response: '{ "userId": 1, "username": "alice", "balance": 500 }',
      },
    ],
  },
  {
    title: "Grants",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/users/grant-packs",
        description: "Grant booster packs to one or more users. Targets can be resolved by id, username, or discordId. Use \"all\" to grant to every user. setCode and packType must match an installed set.",
        auth: "api-key",
        body: '{ "targets": [{ "discordId": "123456789" }, { "username": "bob" }], "setCode": "neo", "packType": "play_booster", "count": 2, "tag": "tournament" }',
        response: '{ "message": "Granted 4 pack(s) to 2 user(s)", "results": [{ "userId": 3, "username": "alice", "granted": 2 }] }',
      },
      {
        method: "POST",
        path: "/api/v1/users/grant-currency",
        description: "Grant (or deduct, with negative amount) currency to one or more users. Use \"all\" to grant to every user.",
        auth: "api-key",
        body: '{ "targets": "all", "amount": 100, "description": "Weekly reward" }',
        response: '{ "message": "Granted 100 currency to 5 user(s)", "results": [...] }',
      },
    ],
  },
  {
    title: "Settings",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/economy",
        description: "Get current economy and marketplace settings.",
        auth: "api-key",
        response: '{ "currencyName": "Gold", "currencySymbol": "G", "economyEnabled": true, "dailyClaimAmount": 100, "sellRateMultiplier": 50 }',
      },
      {
        method: "PATCH",
        path: "/api/v1/settings",
        description: "Update economy settings remotely. Only the fields you send will be changed. Valid fields: economyEnabled, currencyName, currencySymbol, dailyClaimAmount, sellRateMultiplier, userTradingEnabled, packSaleEnabled, cardSaleEnabled.",
        auth: "api-key",
        body: '{ "economyEnabled": true, "currencyName": "Coins", "dailyClaimAmount": 250 }',
        response: '{ "message": "Settings updated", "settings": { "economyEnabled": true, ... } }',
      },
    ],
  },
  {
    title: "Sets & Cards",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/sets",
        description: "List all synced MTG sets.",
        auth: "api-key",
        response: '[{ "code": "neo", "name": "Kamigawa: Neon Dynasty", "releaseDate": "2022-02-18", "cardCount": 302 }]',
      },
      {
        method: "GET",
        path: "/api/v1/sets/:code/cards",
        description: "Get all cards in a set (includes disabled flag, prices, image URIs).",
        auth: "api-key",
        response: '[{ "id": "...", "name": "Hinata, Dawn-Crowned", "rarity": "mythic", "disabled": false, ... }]',
      },
    ],
  },
  {
    title: "Player (Session Auth)",
    endpoints: [
      {
        method: "GET",
        path: "/api/player/profile",
        description: "Get the authenticated player's profile, including their linked Discord User ID.",
        auth: "session",
        response: '{ "id": 3, "username": "alice", "role": "player", "discordUserId": "123456789" }',
      },
      {
        method: "PATCH",
        path: "/api/player/discord",
        description: "Link or unlink the authenticated player's Discord User ID. Use null to unlink.",
        auth: "session",
        body: '{ "discordUserId": "123456789012345678" }',
        response: '{ "discordUserId": "123456789012345678" }',
      },
      {
        method: "POST",
        path: "/api/player/decklist-check",
        description: "Check a decklist against the authenticated player's own collection.",
        auth: "session",
        body: '{ "decklist": "4 Lightning Bolt\\n2 Tarmogoyf" }',
        response: '{ "results": [...], "totalCards": 2, "owned": 1, "partial": 0, "missing": 1 }',
      },
    ],
  },
];

const endpoints: Endpoint[] = endpointGroups.flatMap(g => g.endpoints);

const methodColor: Record<string, string> = {
  GET: "bg-blue-900/50 text-blue-300 border-blue-700",
  POST: "bg-green-900/50 text-green-300 border-green-700",
  DELETE: "bg-red-900/50 text-red-300 border-red-700",
  PUT: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-black/50 border border-border rounded-lg p-3 text-xs font-mono text-primary overflow-x-auto whitespace-pre-wrap break-all">
      {children}
    </pre>
  );
}

export default function ApiDocsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t("apidocs.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("apidocs.subtitle")}</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Public API endpoints require an API key. Generate one in the <strong className="text-foreground">Admin → API Keys</strong> panel.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold mb-2 text-foreground">HTTP Header (recommended)</p>
              <CodeBlock>X-Api-Key: mtg_abc123...</CodeBlock>
            </div>
            <div>
              <p className="font-semibold mb-2 text-foreground">Query Parameter</p>
              <CodeBlock>GET /api/v1/users?api_key=mtg_abc123...</CodeBlock>
            </div>
          </div>
          <div className="rounded-lg bg-blue-950/30 border border-blue-800 p-3">
            <p className="text-blue-300 text-xs">
              <Globe className="h-3 w-3 inline mr-1" />
              <strong>Base URL:</strong> The API is hosted at the same domain as this app. All endpoints start with <code>/api/v1/</code> for the public API or <code>/api/player/</code> for session-authenticated player routes.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <h2 className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Endpoints
        </h2>

        {endpointGroups.map((group, gi) => (
          <div key={gi} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">{group.title}</h3>
            {group.endpoints.map((ep, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <Badge className={`font-mono text-xs border ${methodColor[ep.method]}`}>
                      {ep.method}
                    </Badge>
                    <code className="text-sm font-mono text-foreground">{ep.path}</code>
                    <Badge variant="outline" className={ep.auth === "api-key" ? "border-purple-700 text-purple-400" : "border-blue-700 text-blue-400"}>
                      {ep.auth === "api-key" ? "🔑 API Key" : "🍪 Session"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ep.description}</p>
                  {ep.body && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Request Body</p>
                      <CodeBlock>{ep.body}</CodeBlock>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Response</p>
                    <CodeBlock>{ep.response}</CodeBlock>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Error Responses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="grid gap-2">
            {[
              { code: "401", msg: "{ \"error\": \"API key required\" }", desc: "No key provided" },
              { code: "401", msg: "{ \"error\": \"Invalid or revoked API key\" }", desc: "Bad or revoked key" },
              { code: "404", msg: "{ \"error\": \"User not found\" }", desc: "Unknown user ID" },
              { code: "400", msg: "{ \"error\": \"decklist is required\" }", desc: "Missing request body field" },
            ].map((e, i) => (
              <div key={i} className="flex items-start gap-3">
                <Badge variant="outline" className="border-red-700 text-red-400 font-mono shrink-0">{e.code}</Badge>
                <code className="text-xs font-mono text-muted-foreground">{e.msg}</code>
                <span className="text-xs">— {e.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
