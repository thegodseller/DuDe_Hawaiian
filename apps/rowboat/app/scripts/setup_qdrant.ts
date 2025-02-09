import '../lib/loadenv';
import { qdrantClient } from '../lib/qdrant';

(async () => {
    await qdrantClient.createCollection('embeddings', {
        vectors: {
            size: 1536,
            distance: 'Dot',
        },
    });

    const { collections } = await qdrantClient.getCollections();
    console.log(collections);
})();