
import { z } from "zod";
import { insertUserSchema, insertPackConfigSchema, insertUserPackSchema, users, sets, cards, packConfigs, userPacks, collection, boosterTemplates } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/auth/login" as const,
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(), // Returns user without password
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/auth/logout" as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/auth/me" as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  admin: {
    users: {
      list: {
        method: "GET" as const,
        path: "/api/admin/users" as const,
        responses: {
          200: z.array(z.custom<typeof users.$inferSelect>()),
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/admin/users" as const,
        input: insertUserSchema,
        responses: {
          201: z.custom<typeof users.$inferSelect>(),
          400: errorSchemas.validation,
        },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/admin/users/:id" as const,
        input: insertUserSchema.partial(),
        responses: {
          200: z.custom<typeof users.$inferSelect>(),
          404: errorSchemas.notFound,
        },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/admin/users/:id" as const,
        responses: {
          200: z.object({ message: z.string() }),
          404: errorSchemas.notFound,
        },
      },
      packs: {
        method: "GET" as const,
        path: "/api/admin/users/:id/packs" as const,
        responses: {
          200: z.array(z.custom<typeof userPacks.$inferSelect & { set: typeof sets.$inferSelect }>()),
        },
      },
      collection: {
        method: "GET" as const,
        path: "/api/admin/users/:id/collection" as const,
        responses: {
          200: z.array(z.custom<typeof collection.$inferSelect & { card: typeof cards.$inferSelect }>()),
        },
      },
    },
    packs: {
      grant: {
        method: "POST" as const,
        path: "/api/admin/packs/grant" as const,
        input: z.object({
          userId: z.number(),
          setCode: z.string(),
          packType: z.string(),
          count: z.number().default(1),
          tag: z.string().optional(),
        }),
        responses: {
          200: z.object({ message: z.string(), count: z.number() }),
        },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/admin/packs/:id" as const,
        responses: {
          200: z.object({ message: z.string() }),
          404: errorSchemas.notFound,
          400: errorSchemas.validation,
        },
      },
    },
    tags: {
      list: {
        method: "GET" as const,
        path: "/api/admin/tags" as const,
        responses: {
          200: z.array(z.string()),
        },
      },
      remove: {
        method: "DELETE" as const,
        path: "/api/admin/tags/:tag" as const,
        responses: {
          200: z.object({ message: z.string() }),
        },
      },
    },
    sets: {
      list: {
        method: "GET" as const,
        path: "/api/admin/sets" as const,
        responses: {
          200: z.array(z.custom<typeof sets.$inferSelect>()),
        },
      },
      sync: {
        method: "POST" as const,
        path: "/api/admin/sets/sync" as const,
        input: z.object({ setCode: z.string() }),
        responses: {
          200: z.object({ message: z.string(), addedCards: z.number() }),
        },
      },
      cards: {
        method: "GET" as const,
        path: "/api/admin/sets/:code/cards" as const,
        responses: {
          200: z.array(z.custom<typeof cards.$inferSelect>()),
        },
      },
      toggleCard: {
        method: "PATCH" as const,
        path: "/api/admin/cards/:id/toggle" as const,
        input: z.object({ disabled: z.boolean() }),
        responses: {
          200: z.object({ message: z.string() }),
        },
      },
    },
    boosterTemplates: {
      list: {
        method: "GET" as const,
        path: "/api/admin/booster-templates" as const,
        responses: {
          200: z.array(z.custom<typeof boosterTemplates.$inferSelect>()),
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/admin/booster-templates" as const,
        input: z.object({ name: z.string(), definition: z.string() }),
        responses: {
          201: z.custom<typeof boosterTemplates.$inferSelect>(),
          400: errorSchemas.validation,
        },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/admin/booster-templates/:id" as const,
        input: z.object({ name: z.string().optional(), definition: z.string().optional() }),
        responses: {
          200: z.custom<typeof boosterTemplates.$inferSelect>(),
          400: errorSchemas.validation,
        },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/admin/booster-templates/:id" as const,
        responses: {
          200: z.object({ message: z.string() }),
        },
      },
      validate: {
        method: "POST" as const,
        path: "/api/admin/booster-templates/validate" as const,
        input: z.object({ definition: z.string() }),
        responses: {
          200: z.object({ valid: z.boolean(), errors: z.array(z.string()), slots: z.number() }),
        },
      },
      testGenerate: {
        method: "POST" as const,
        path: "/api/admin/booster-templates/test" as const,
        input: z.object({ definition: z.string(), setCode: z.string() }),
        responses: {
          200: z.object({
            cards: z.array(z.object({
              card: z.custom<typeof cards.$inferSelect>(),
              isFoil: z.boolean(),
              isAltArt: z.boolean(),
            })),
          }),
        },
      },
    },
  },
  player: {
    packs: {
      list: {
        method: "GET" as const,
        path: "/api/player/packs" as const,
        responses: {
          200: z.array(z.custom<typeof userPacks.$inferSelect & { set: typeof sets.$inferSelect }>()),
        },
      },
      open: {
        method: "POST" as const,
        path: "/api/player/packs/:id/open" as const,
        responses: {
          200: z.object({
            packId: z.number(),
            cards: z.array(z.object({
              card: z.custom<typeof cards.$inferSelect>(),
              isFoil: z.boolean(),
              isAltArt: z.boolean(),
            })),
          }),
          400: errorSchemas.validation,
          404: errorSchemas.notFound,
        },
      },
    },
    collection: {
      list: {
        method: "GET" as const,
        path: "/api/player/collection" as const,
        responses: {
          200: z.array(z.custom<typeof collection.$inferSelect & { card: typeof cards.$inferSelect }>()),
        },
      },
      export: {
        method: "GET" as const,
        path: "/api/player/collection/export" as const,
        responses: {
          200: z.string(),
        },
      },
      tags: {
        method: "GET" as const,
        path: "/api/player/collection/tags" as const,
        responses: {
          200: z.array(z.string()),
        },
      },
      exportByTag: {
        method: "GET" as const,
        path: "/api/player/collection/export/:tag" as const,
        responses: {
          200: z.string(),
        },
      },
      exportCsv: {
        method: "GET" as const,
        path: "/api/player/collection/export-csv" as const,
        responses: {
          200: z.string(),
        },
      },
      exportCsvByTag: {
        method: "GET" as const,
        path: "/api/player/collection/export-csv/:tag" as const,
        responses: {
          200: z.string(),
        },
      },
    },
    preferences: {
      updateLanguage: {
        method: "PATCH" as const,
        path: "/api/player/preferences/language" as const,
        input: z.object({ language: z.string() }),
        responses: {
          200: z.object({ message: z.string() }),
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type LoginInput = z.infer<typeof api.auth.login.input>;
export type CreateUserInput = z.infer<typeof api.admin.users.create.input>;
export type GrantPackInput = z.infer<typeof api.admin.packs.grant.input>;
export type SyncSetInput = z.infer<typeof api.admin.sets.sync.input>;
