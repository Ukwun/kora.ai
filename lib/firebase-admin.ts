import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || (!rawServiceAccount && (!clientEmail || !privateKey))) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_PROJECT_ID and service account credentials.");
  }

  const serviceAccount = rawServiceAccount
    ? JSON.parse(rawServiceAccount) as { project_id?: string; client_email: string; private_key: string }
    : { project_id: projectId, client_email: clientEmail as string, private_key: privateKey as string };

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id || projectId,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
    projectId,
  });
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && (
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
  ));
}
