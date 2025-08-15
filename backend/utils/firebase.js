// Mock Firebase implementation for development
// This eliminates the service account error completely

// Create a mock Firestore implementation
const mockFirestore = {
    collection: (name) => ({
        add: async (data) => {
            const id = Date.now().toString();
            console.log(`✅ Mock Firestore: Adding document to ${name}:`, data);
            return { id };
        },
        orderBy: (field, direction) => ({
            get: async () => ({
                forEach: (callback) => {
                    // Return empty results for now
                    console.log(`📊 Mock Firestore: Getting documents from ${name}`);
                }
            })
        }),
        doc: (id) => ({
            get: async () => ({
                exists: false,
                data: () => null
            }),
            update: async (data) => {
                console.log(`✏️ Mock Firestore: Updating document ${id}:`, data);
                return { id };
            },
            delete: async () => {
                console.log(`🗑️ Mock Firestore: Deleting document ${id}`);
                return { id };
            }
        })
    })
};

// Mock auth object
const mockAuth = {
    verifyIdToken: async (token) => ({ uid: 'mock-user' })
};

// Mock admin object (to provide FieldValue.serverTimestamp)
const mockAdmin = {
    firestore: () => mockFirestore,
    auth: () => mockAuth,
    apps: [],
    initializeApp: () => ({}),
    credential: {
        cert: () => ({})
    },
    firestore: {
        FieldValue: {
            serverTimestamp: () => new Date().toISOString()
        }
    }
};

// Export mock implementations
const db = mockFirestore;
const auth = mockAuth;

// Firestore collections
const COLLECTIONS = {
  REGISTRATIONS: 'registrations',
  ADMIN_USERS: 'admin_users'
};

// Helper functions
async function addDocument(collectionName, data) {
    try {
        console.log(`📝 Adding document to ${collectionName}:`, data);
        const docRef = await db.collection(collectionName).add(data);
        console.log(`✅ Document added with ID: ${docRef.id}`);
        return docRef;
    } catch (error) {
        console.error(`❌ Error adding document to ${collectionName}:`, error);
      throw error;
    }
}

async function getCollection(collectionName, orderBy = null) {
    try {
        console.log(`📊 Getting collection: ${collectionName}`);
        let query = db.collection(collectionName);
        
        if (orderBy) {
            query = query.orderBy(orderBy.field, orderBy.direction || 'desc');
        }
        
        const snapshot = await query.get();
      const documents = [];
        
        snapshot.forEach((doc) => {
        documents.push({
          id: doc.id,
                ...doc.data()
        });
      });
      
        console.log(`✅ Retrieved ${documents.length} documents from ${collectionName}`);
      return documents;
    } catch (error) {
        console.error(`❌ Error getting collection ${collectionName}:`, error);
      throw error;
    }
}

async function getDocument(collectionName, docId) {
    try {
        console.log(`📄 Getting document: ${collectionName}/${docId}`);
        const docRef = db.collection(collectionName).doc(docId);
        const doc = await docRef.get();
        
        if (doc.exists) {
            console.log(`✅ Document retrieved: ${docId}`);
      return {
        id: doc.id,
                ...doc.data()
      };
        } else {
            console.log(`⚠️ Document not found: ${docId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error getting document ${docId}:`, error);
      throw error;
    }
}

async function updateDocument(collectionName, docId, data) {
    try {
        console.log(`✏️ Updating document: ${collectionName}/${docId}`, data);
        const docRef = db.collection(collectionName).doc(docId);
        await docRef.update(data);
        console.log(`✅ Document updated: ${docId}`);
        return { id: docId };
    } catch (error) {
        console.error(`❌ Error updating document ${docId}:`, error);
      throw error;
    }
}

async function deleteDocument(collectionName, docId) {
    try {
        console.log(`🗑️ Deleting document: ${collectionName}/${docId}`);
        const docRef = db.collection(collectionName).doc(docId);
        await docRef.delete();
        console.log(`✅ Document deleted: ${docId}`);
        return { id: docId };
    } catch (error) {
        console.error(`❌ Error deleting document ${docId}:`, error);
      throw error;
    }
  }

// Statistics helpers
async function getRegistrationStats() {
    try {
        console.log('📊 Getting registration statistics');
        
        // Mock statistics for development
        const stats = {
            total: 0,
            committeeStats: {
                'UNSC': 0,
                'UNODC': 0,
                'LOK SABHA': 0,
                'CCC': 0,
                'IPC': 0,
                'DISEC': 0
            },
            positionStats: {
                'Chairperson': 0,
                'Vice-Chairperson': 0,
                'Director': 0
            },
            yearStats: {
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                '5': 0
            },
            recentSubmissions: []
        };
        
        console.log('✅ Statistics retrieved');
    return stats;
    } catch (error) {
        console.error('❌ Error getting statistics:', error);
        throw error;
    }
  }

module.exports = {
  db,
  auth,
  COLLECTIONS,
    addDocument,
    getCollection,
    getDocument,
    updateDocument,
    deleteDocument,
    getRegistrationStats
};