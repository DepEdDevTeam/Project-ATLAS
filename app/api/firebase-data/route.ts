import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const headers = { "Cache-Control": "private, no-store" };
  const projectId = process.env.FIREBASE_PROJECT_ID || "depedprototype";
  if (params.get("view") === "config") return Response.json({ projectId, apiKey: process.env.FIREBASE_API_KEY, authDomain: `${projectId}.firebaseapp.com` }, { headers });
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: "Sign in to access Firestore." }, { status: 401, headers });
  const readers = (process.env.FIREBASE_ATLAS_READER_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!readers.length) return Response.json({ error: "Configure FIREBASE_ATLAS_READER_EMAILS to grant reader access." }, { status: 403, headers });
  try {
    const app = getApps().find(a => a.name === "atlas-reader") || initializeApp({ projectId, credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault() }, "atlas-reader");
    let identity;
    try { identity = await getAuth(app).verifyIdToken(token, true); }
    catch { return Response.json({ error: "Session invalid or expired. Sign in again." }, { status: 401, headers }); }
    if (!identity.email_verified || !identity.email || !readers.includes(identity.email.toLowerCase())) return Response.json({ error: "This account has not been granted Atlas reader access." }, { status: 403, headers });
    const db = getFirestore(app, process.env.FIREBASE_DATABASE_ID || "(default)");
    const collection = params.get("collection"), document = params.get("document");
    for (const [value, parity] of [[collection, 1], [document, 0]] as const) {
      if (value && (value.length > 1500 || value.split("/").some(s => !s || s === "." || s === "..") || value.split("/").length % 2 !== parity)) return Response.json({ error: "Invalid Firestore path." }, { status: 400, headers });
    }
    if (!collection) {
      const refs = await (document ? db.doc(document).listCollections() : db.listCollections());
      return Response.json({ collections: refs.map(ref => ref.path) }, { headers });
    }
    let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(21);
    const cursor = params.get("cursor");
    if (cursor) {
      if (cursor.includes("/") || cursor.length > 1500) return Response.json({ error: "Invalid cursor." }, { status: 400, headers });
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get(), docs = snapshot.docs.slice(0,20);
    return Response.json({ documents: docs.map(doc => ({ id: doc.id, path: doc.ref.path, fields: doc.data() })), nextCursor: snapshot.docs.length > 20 ? docs.at(-1)!.id : null }, { headers });
  } catch (error) {
    console.error("Atlas Firestore read failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Firestore connection unavailable. Configure server credentials for depedprototype (FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS) and check the database ID and read permissions." }, { status: 503, headers });
  }
}
