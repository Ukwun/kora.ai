import type { Instrumentation } from "next";
import { reportServerError } from "@/lib/observability";
import { getProductionConfigurationIssues } from "@/lib/production-config";

export function register() {
  const issues = getProductionConfigurationIssues();
  if (issues.length > 0) {
    console.error("Production configuration is incomplete.", issues);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportServerError({ error, path: request.path, method: request.method, routePath: context.routePath });
};
