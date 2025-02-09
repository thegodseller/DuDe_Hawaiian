import '../lib/loadenv';
import { qdrantClient } from '../lib/qdrant';

(async () => {
    await qdrantClient.deleteCollection('embeddings');

    const { collections } = await qdrantClient.getCollections();
    console.log(collections);
})();