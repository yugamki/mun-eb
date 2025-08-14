const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Firestore collections
const COLLECTIONS = {
  REGISTRATIONS: 'registrations',
  ADMIN_USERS: 'admin_users'
};

// Helper functions
const firestoreHelpers = {
  // Add a new document
  async addDocument(collection, data) {
    try {
      const docRef = await db.collection(collection).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  },

  // Get all documents from a collection
  async getCollection(collection, orderBy = 'createdAt', direction = 'desc') {
    try {
      const snapshot = await db.collection(collection)
        .orderBy(orderBy, direction)
        .get();
      
      const documents = [];
      snapshot.forEach(doc => {
        documents.push({
          id: doc.id,
          ...doc.data(),
          // Convert Firestore timestamps to ISO strings
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
          submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString()
        });
      });
      
      return documents;
    } catch (error) {
      console.error('Error getting collection:', error);
      throw error;
    }
  },

  // Get a single document
  async getDocument(collection, docId) {
    try {
      const doc = await db.collection(collection).doc(docId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        submittedAt: data.submittedAt?.toDate?.()?.toISOString()
      };
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  // Update a document
  async updateDocument(collection, docId, data) {
    try {
      await db.collection(collection).doc(docId).update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  },

  // Delete a document
  async deleteDocument(collection, docId) {
    try {
      await db.collection(collection).doc(docId).delete();
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Get collection statistics
  async getCollectionStats(collection) {
    try {
      const snapshot = await db.collection(collection).get();
      return {
        total: snapshot.size,
        documents: snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      throw error;
    }
  },

  // Query documents with filters
  async queryDocuments(collection, filters = [], orderBy = 'createdAt', direction = 'desc') {
    try {
      let query = db.collection(collection);
      
      // Apply filters
      filters.forEach(filter => {
        query = query.where(filter.field, filter.operator, filter.value);
      });
      
      // Apply ordering
      query = query.orderBy(orderBy, direction);
      
      const snapshot = await query.get();
      const documents = [];
      
      snapshot.forEach(doc => {
        documents.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
          submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString()
        });
      });
      
      return documents;
    } catch (error) {
      console.error('Error querying documents:', error);
      throw error;
    }
  }
};

// Registration-specific helpers
const registrationHelpers = {
  async createRegistration(data) {
    return await firestoreHelpers.addDocument(COLLECTIONS.REGISTRATIONS, {
      ...data,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'submitted'
    });
  },

  async getAllRegistrations() {
    return await firestoreHelpers.getCollection(COLLECTIONS.REGISTRATIONS, 'submittedAt');
  },

  async getRegistration(id) {
    return await firestoreHelpers.getDocument(COLLECTIONS.REGISTRATIONS, id);
  },

  async updateRegistration(id, data) {
    return await firestoreHelpers.updateDocument(COLLECTIONS.REGISTRATIONS, id, data);
  },

  async deleteRegistration(id) {
    return await firestoreHelpers.deleteDocument(COLLECTIONS.REGISTRATIONS, id);
  },

  async getRegistrationStats() {
    const registrations = await this.getAllRegistrations();
    
    const stats = {
      total: registrations.length,
      committees: {},
      positions: {},
      yearDistribution: {},
      organizingExperience: { yes: 0, no: 0 }
    };

    registrations.forEach(reg => {
      // Committee stats
      const committees = Array.isArray(reg.committees) 
        ? reg.committees 
        : JSON.parse(reg.committees || '[]');
      
      committees.forEach(committee => {
        stats.committees[committee] = (stats.committees[committee] || 0) + 1;
      });

      // Position stats
      const positions = Array.isArray(reg.positions) 
        ? reg.positions 
        : JSON.parse(reg.positions || '[]');
      
      positions.forEach(position => {
        stats.positions[position] = (stats.positions[position] || 0) + 1;
      });

      // Year distribution
      stats.yearDistribution[reg.year] = (stats.yearDistribution[reg.year] || 0) + 1;

      // Organizing experience
      stats.organizingExperience[reg.organizingExperience] += 1;
    });

    return stats;
  }
};

module.exports = {
  admin,
  db,
  auth,
  COLLECTIONS,
  firestoreHelpers,
  registrationHelpers
};