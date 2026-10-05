# Frontend Client Migration Guide (Firebase SDK ──► Supabase SDK)
**Ashrey FlowOps System Engineering Blueprint**

This document serves as the developer's guide for replacing client-side Firebase SDK libraries with `@supabase/supabase-js` across views, hooks, context panels, and upload assets forms.

---

## 1. SDK Core Client Configurations

### Firebase Client Initialization (Old)
```ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAs...",
  authDomain: "flowops.firebaseapp.com",
  projectId: "flowops-production",
  storageBucket: "flowops-production.appspot.com",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

### Supabase Client Initialization (New)
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Single unified entrypoint Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
```

---

## 2. Side-by-Side Architectural Code Mappings

### 2.1 Authenticated Sign-in Session handshake

#### ❌ Firebase Auth SDK
```ts
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    return user;
  } catch (err) {
    throw new Error(err.message);
  }
}
```

#### ✅ Supabase GoTrue Auth SDK
```ts
import { supabase } from '../lib/supabase';

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  // Decoded token inside data.session contains RLS claim metadata
  return data.user;
}
```

---

### 2.2 Querying Sandboxed Collections (RFQs Lists)

#### ❌ Firebase Firestore (Subcollections matching Tenant profiles)
```ts
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

async function fetchRfqs(tenantId) {
  // Querying nested path locks user context
  const rfqRef = collection(db, 'tenants', tenantId, 'rfqs');
  const q = query(rfqRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

#### ✅ Supabase Postgres Client (Protected via RLS Custom Claims in header)
```ts
import { supabase } from '../lib/supabase';

async function fetchRfqs() {
  // RLS filters the tenant_id implicitly at the DB level,
  // preventing data leaks even if the developer forgets to add tenant filtering.
  const { data, error } = await supabase
    .from('rfqs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}
```

---

### 2.3 Creating New Order Actions (Money represented in Paise)

#### ❌ Firebase NoSQL Document addition (Rupees representation as Float)
```ts
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

async function createOrder(tenantId, orderData) {
  const ordersRef = collection(db, 'tenants', tenantId, 'orders');
  
  const mappedObj = {
    quoteId: orderData.quoteId,
    orderNumber: orderData.orderNumber,
    customerId: orderData.customerId,
    customerName: orderData.customerName,
    phone: orderData.phone,
    totalAmount: orderData.totalAmountFloat, // 154020.85 (Float issue danger!)
    createdAt: new Date().toISOString(),
    status: 'confirmed'
  };

  const docRef = await addDoc(ordersRef, mappedObj);
  return docRef.id;
}
```

#### ✅ Supabase Relational Row Insertion (Converts inputs to Integer Paise)
```ts
import { supabase } from '../lib/supabase';

async function createOrder(orderData) {
  // Convert standard decimal Rupees input into an Integer representing Paise
  const totalAmountPaise = Math.round(orderData.totalAmountFloat * 100);

  const { data, error } = await supabase
    .from('orders')
    .insert({
      quote_id: orderData.quoteId,
      order_number: orderData.orderNumber,
      customer_id: orderData.customerId,
      customer_name: orderData.customerName,
      phone: orderData.phone,
      total_amount: totalAmountPaise, // 15402085 (bigint Paise)
      status: 'confirmed'
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id; // Returns postgres UUID primary key
}
```

---

### 2.4 Uploading Attachment Drawings

#### ❌ Firebase Storage Reference Upload
```ts
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

async function uploadDrawing(tenantId, file) {
  const storageRef = ref(storage, `tenants/${tenantId}/drawings/${file.name}`);
  const result = await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(result.ref);
  return downloadUrl;
}
```

#### ✅ Supabase Storage Client
```ts
import { supabase } from '../lib/supabase';

async function uploadDrawing(tenantId, file) {
  const filePath = `tenants/${tenantId}/drawings/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('drawings-and-attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(error.message);
  }

  // Retrieve a public URL or a secure temporary signed URL (recommended for RLS)
  const { data: signData, error: sError } = await supabase.storage
    .from('drawings-and-attachments')
    .createSignedUrl(data.path, 1 * 24 * 3600); // 24h validation

  if (sError) throw sError;
  return signData.signedUrl;
}
```

---

### 2.5 Real-time Subscriptions on Shopfloor Status Updates

#### ❌ Firebase Firestore onSnapshot listeners
```ts
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

function subscribeToJobUpdates(tenantId, callback) {
  const jobsRef = collection(db, 'tenants', tenantId, 'jobs');
  const q = query(jobsRef, where('currentStage', '==', 'machining'));

  return onSnapshot(q, (snapshot) => {
    const updatedJobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(updatedJobs);
  });
}
```

#### ✅ Supabase PostgreSQL Real-time Listeners (Fires on DB events)
```ts
import { supabase } from '../lib/supabase';

function subscribeToJobUpdates(callback) {
  // Establishes safe subscription channel. RLS filters data broadcasted.
  const channel = supabase
    .channel('shopfloor-jobs-realtime')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'jobs',
        filter: 'current_stage=eq.machining'
      },
      (payload) => {
        console.log('Realtime change broadcast received:', payload);
        callback(payload);
      }
    )
    .subscribe();

  // Return unsubscribe cleanup handle
  return () => {
    supabase.removeChannel(channel);
  };
}
```
