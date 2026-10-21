import type { Instrumentation } from "next";
import { reportServerError } from "@/lib/observability";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportServerError({ error, path: request.path, method: request.method, routePath: context.routePath });
};
