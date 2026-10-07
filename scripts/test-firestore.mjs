import {applicationDefault, cert, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "depedprototype";
const databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";
const collectionName = process.argv[2] || "department_orders";

const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ?
    cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    :
    applicationDefault();

const app = initializeApp({ projectId, credential });
const db = getFirestore(app, databaseId);

try {
    const result = await db.collection(collectionName).limit(1).get();

    console.log(`Connected to ${projectId}/${databaseId}, collection: ${collectionName}`);
    
    if (result.empty) {
        console.log("No documents found in the collection.");
    } else {
        for (const doc of result.docs) {
            console.log(JSON.stringify({id: doc.id, ...doc.data() }, null, 2));
        }
    }
} catch (error) {
    console.error("Error occurred:", error);
    process.exitCode = 1;
}