import z from "zod";

export const CinemetaResponseSchema = z.object({
  meta: z.object({
    id: z.string(),
    name: z.string(),
    releaseInfo: z.coerce.string().optional(),
  }),
});
